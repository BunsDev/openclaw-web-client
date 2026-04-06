import express from "express";
import { WebSocket as WsWebSocket } from "ws";
import { spawn, execSync } from "child_process";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});
app.use(express.json());

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
const PROXY_PORT = parseInt(process.env.PROXY_PORT || "18801", 10);
const SHARED_FILES_DIR = path.join(os.tmpdir(), "openclaw-files");
if (!fs.existsSync(SHARED_FILES_DIR)) fs.mkdirSync(SHARED_FILES_DIR, { recursive: true });

function base64UrlEncode(buf) {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(pem) {
  const key = crypto.createPublicKey(pem);
  const spki = key.export({ type: "spki", format: "der" });
  return spki.subarray(spki.length - 32);
}

function signPayload(privPem, payload) {
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, "utf8"), crypto.createPrivateKey(privPem)));
}

function loadGatewayCredentials() {
  try {
    const identityPath = path.join(OPENCLAW_HOME, "identity", "device.json");
    const authPath = path.join(OPENCLAW_HOME, "identity", "device-auth.json");
    const configPath = path.join(OPENCLAW_HOME, "openclaw.json");
    const device = JSON.parse(fs.readFileSync(identityPath, "utf-8"));
    const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return { device, auth, gatewayPort: config.gateway?.port || 18789 };
  } catch (err) {
    console.warn("[gateway] could not load credentials:", err.message);
    return null;
  }
}

class GatewayClient {
  constructor() {
    this.ws = null;
    this.authenticated = false;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.credentials = null;
    this.reconnectTimer = null;
    this.connectPromise = null;
  }

  async ensureConnected() {
    if (this.ws?.readyState === WsWebSocket.OPEN && this.authenticated) return true;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  _connect() {
    return new Promise((resolve) => {
      this.credentials = loadGatewayCredentials();
      if (!this.credentials) { resolve(false); return; }

      const { device, auth, gatewayPort } = this.credentials;
      const url = `ws://127.0.0.1:${gatewayPort}`;
      console.log(`[gateway] connecting to ${url}...`);

      const ws = new WsWebSocket(url);
      this.ws = ws;
      this.authenticated = false;

      const timeout = setTimeout(() => {
        console.warn("[gateway] connect timeout");
        ws.close();
        resolve(false);
      }, 10000);

      ws.on("open", () => console.log("[gateway] ws open"));

      ws.on("message", (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }

        if (msg.type === "event" && msg.event === "connect.challenge") {
          const nonce = msg.payload.nonce;
          const role = "operator";
          const scopes = auth.tokens?.operator?.scopes || ["operator.admin", "operator.read", "operator.write"];
          const signedAtMs = Date.now();
          const deviceToken = auth.tokens?.operator?.token || "";
          const payload = ["v3", device.deviceId, "gateway-client", "backend", role, scopes.join(","), String(signedAtMs), deviceToken, nonce, process.platform, ""].join("|");
          const signature = signPayload(device.privateKeyPem, payload);
          ws.send(JSON.stringify({
            type: "req", id: crypto.randomUUID(), method: "connect",
            params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: "gateway-client", version: "1.0.0", platform: process.platform, mode: "backend" },
              caps: [], role, scopes,
              auth: { deviceToken },
              device: { id: device.deviceId, publicKey: base64UrlEncode(derivePublicKeyRaw(device.publicKeyPem)), signature, signedAt: signedAtMs, nonce },
            },
          }));
          return;
        }

        if (msg.type === "res") {
          if (!this.authenticated && msg.ok) {
            this.authenticated = true;
            clearTimeout(timeout);
            console.log("[gateway] authenticated");
            resolve(true);
            return;
          }
          if (!this.authenticated && !msg.ok) {
            clearTimeout(timeout);
            console.error("[gateway] auth failed:", msg.error);
            resolve(false);
            return;
          }
          const p = this.pending.get(msg.id);
          if (p) {
            if (p.expectFinal && msg.payload?.status === "accepted") {
              p.runId = msg.payload.runId;
              return;
            }
            this.pending.delete(msg.id);
            if (msg.ok) p.resolve(msg.payload);
            else p.reject(new Error(msg.error?.message || "gateway error"));
          }
          return;
        }

        if (msg.type === "event") {
          for (const [, listener] of this.eventListeners) {
            listener(msg);
          }
        }
      });

      ws.on("close", () => {
        console.log("[gateway] disconnected");
        this.authenticated = false;
        this.ws = null;
        for (const [, p] of this.pending) p.reject(new Error("gateway disconnected"));
        this.pending.clear();
        this.eventListeners.clear();
        clearTimeout(timeout);
        if (!this.connectPromise) resolve(false);
        this._scheduleReconnect();
      });

      ws.on("error", (err) => {
        console.error("[gateway] ws error:", err.message);
      });
    });
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected().catch(() => {});
    }, 5000);
  }

  request(method, params, opts = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WsWebSocket.OPEN) {
        reject(new Error("gateway not connected"));
        return;
      }
      const id = crypto.randomUUID();
      const timeoutMs = opts.timeoutMs || 120000;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout")); }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
        expectFinal: opts.expectFinal || false,
      });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  onEvent(key, fn) { this.eventListeners.set(key, fn); }
  offEvent(key) { this.eventListeners.delete(key); }
}

const gateway = new GatewayClient();

/**
 * Auto-setup: ensure the device has full operator scopes (incl. operator.write)
 * so the gateway fast-path works for `agent` calls.
 *
 * Flow: health call → approve pending pairing → health call again → connect.
 * All via `openclaw` CLI so the local device-auth.json stays in sync.
 */
async function ensureDevicePaired() {
  const creds = loadGatewayCredentials();
  const scopes = creds?.auth?.tokens?.operator?.scopes || [];
  if (scopes.includes("operator.write")) {
    console.log("[setup] device-auth already has operator.write");
    return;
  }

  console.log("[setup] device-auth missing operator.write — auto-pairing...");
  const opts = { cwd: os.homedir(), env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 };

  try {
    // Trigger a gateway connect (creates pairing request if needed)
    execSync("openclaw gateway call health --json 2>/dev/null", opts);
  } catch { /* may fail with pairing required — that's fine */ }

  try {
    // Approve the most recent pending pairing request
    const out = execSync("openclaw devices approve --latest --json 2>&1", opts).toString();
    console.log("[setup] approved pending device:", out.includes('"requestId"') ? "ok" : out.trim().slice(0, 200));
  } catch (err) {
    const msg = err.stderr?.toString() || err.stdout?.toString() || err.message;
    if (msg.includes("no pending")) {
      console.log("[setup] no pending pairing requests");
    } else {
      console.warn("[setup] approve failed:", msg.slice(0, 200));
    }
  }

  try {
    // Reconnect to pick up the new token (updates device-auth.json)
    execSync("openclaw gateway call health --json 2>/dev/null", opts);
  } catch { /* non-critical */ }

  // Verify
  const updated = loadGatewayCredentials();
  const newScopes = updated?.auth?.tokens?.operator?.scopes || [];
  if (newScopes.includes("operator.write")) {
    console.log("[setup] device-auth now has operator.write — gateway fast-path enabled");
  } else {
    console.warn("[setup] device-auth still missing operator.write — will use CLI fallback for chat");
  }
}

(async () => {
  await ensureDevicePaired();
  const ok = await gateway.ensureConnected();
  if (ok) console.log("[gateway] persistent connection ready");
  else console.warn("[gateway] initial connection failed, will use CLI fallback");
})();

function sseEmitter(res) {
  return {
    send(type, delta) {
      res.write(`data: ${JSON.stringify({ type, delta })}\n\n`);
    },
    done() {
      res.write("data: [DONE]\n\n");
      res.end();
    },
    error(msg) {
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      } else {
        res.end();
      }
    },
  };
}

function extractThinkingFromJsonl(agentId, sessionKey) {
  try {
    const sessFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    if (!fs.existsSync(sessFile)) return null;
    const raw = JSON.parse(fs.readFileSync(sessFile, "utf-8"));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry?.sessionFile) return null;
    if (!fs.existsSync(entry.sessionFile)) return null;
    const lines = fs.readFileSync(entry.sessionFile, "utf-8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed.type === "message" && parsed.message?.role === "assistant") {
          const thinkingPart = (parsed.message.content || []).find((p) => p.type === "thinking");
          return thinkingPart?.thinking || null;
        }
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }
  return null;
}

function getSessionSettings(agentId, sessionKey) {
  const defaults = { thinkingLevel: "medium", fastMode: null, verboseLevel: "inherit", reasoningLevel: "inherit" };
  if (!sessionKey) return defaults;
  try {
    const sessFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    if (!fs.existsSync(sessFile)) return defaults;
    const raw = JSON.parse(fs.readFileSync(sessFile, "utf-8"));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry) return defaults;
    return {
      thinkingLevel: entry.thinkingLevel || defaults.thinkingLevel,
      fastMode: entry.fastMode ?? defaults.fastMode,
      verboseLevel: entry.verboseLevel || defaults.verboseLevel,
      reasoningLevel: entry.reasoningLevel || defaults.reasoningLevel,
    };
  } catch { return defaults; }
}

const GW_TAG = "final|output|think|thinking|redacted_thinking";
const GW_RE_OPEN = new RegExp(`^<(?:${GW_TAG})\\b[^>]*>`, "i");
const GW_RE_CLOSE = new RegExp(`</(?:${GW_TAG})\\s*>\\s*$`, "i");
const GW_RE_PARTIAL_CLOSE = /<\/[a-z]*\s*$/i;
const GW_RE_PARTIAL_TAG = new RegExp(`^<\\/?\\s*(?:${GW_TAG})\\s*$`, "i");

function stripGatewayTags(text) {
  if (!text) return text;
  return text
    .replace(GW_RE_OPEN, "")
    .replace(GW_RE_CLOSE, "")
    .replace(GW_RE_PARTIAL_CLOSE, "");
}

function runAgentViaGateway(agentId, message, sessionKey, emitter) {
  const runId = crypto.randomUUID();
  const listenerKey = `agent-${runId}`;
  let assistantSent = "";
  let reasoningSent = "";

  gateway.onEvent(listenerKey, (msg) => {
    const p = msg.payload;
    if (msg.event !== "agent" && msg.event !== "chat") return;
    if (p.runId !== runId) return;

    if (msg.event === "agent" && p.data?.delta) {
      const stream = p.stream;
      if (stream !== "assistant" && stream !== "reasoning") return;

      const fullText = p.data.text;
      if (fullText == null) return;

      const clean = stripGatewayTags(fullText);
      if (!clean || GW_RE_PARTIAL_TAG.test(clean)) return;

      const alreadySent = stream === "assistant" ? assistantSent : reasoningSent;

      if (alreadySent.length === 0 || clean.startsWith(alreadySent)) {
        if (clean.length > alreadySent.length) {
          const newContent = clean.substring(alreadySent.length);
          if (stream === "assistant") assistantSent = clean;
          else reasoningSent = clean;
          emitter.send(
            stream === "assistant"
              ? "response.output_text.delta"
              : "response.thinking.delta",
            newContent
          );
        }
      } else {
        if (stream === "assistant") assistantSent = clean;
        else reasoningSent = clean;
        emitter.send(
          stream === "assistant"
            ? "response.output_text.delta"
            : "response.thinking.delta",
          clean
        );
      }
    }
  });

  const sessionSettings = getSessionSettings(agentId, sessionKey);
  const params = {
    message,
    agentId,
    idempotencyKey: runId,
    thinking: sessionSettings.thinkingLevel || "medium",
  };
  if (sessionKey) {
    const fullKey = `agent:${agentId}:${sessionKey}`;
    params.sessionId = sessionKey;
    params.sessionKey = fullKey;
  }

  gateway.request("agent", params, { expectFinal: true, timeoutMs: 120000 })
    .then(() => {
      gateway.offEvent(listenerKey);
      if (sessionKey) {
        const thinking = extractThinkingFromJsonl(agentId, sessionKey);
        if (thinking) emitter.send("response.thinking.delta", thinking);
      }
      emitter.done();
    })
    .catch((err) => {
      console.error("[gateway] agent error:", err.message);
      gateway.offEvent(listenerKey);
      emitter.error(err.message);
    });

  return { kill: () => gateway.offEvent(listenerKey) };
}

function runAgentWithEmitter(agentId, message, sessionKey, emitter) {
  const sessionSettings = getSessionSettings(agentId, sessionKey);
  const thinkingArg = sessionSettings.thinkingLevel === "inherit" ? "medium" : sessionSettings.thinkingLevel;
  const args = ["agent", "--agent", agentId, "-m", message, "--thinking", thinkingArg];
  if (sessionSettings.reasoningLevel && sessionSettings.reasoningLevel !== "inherit") {
    args.push("--reasoning", sessionSettings.reasoningLevel);
  }
  if (sessionKey) args.push("--session-id", sessionKey);

  console.log(`[chat] CLI fallback: openclaw ${args.join(" ")}`);

  const child = spawn("openclaw", args, {
    cwd: os.homedir(),
    env: { ...process.env, NO_COLOR: "1" },
  });

  let hasOutput = false;
  let stderrBuf = "";
  let buf = "";
  let mode = "idle";

  function emit(text, isThinking) {
    if (!text) return;
    const type = isThinking ? "response.thinking.delta" : "response.output_text.delta";
    emitter.send(type, text);
    hasOutput = true;
  }

  function processBuf() {
    while (buf.length > 0) {
      if (mode === "idle") {
        const thinkIdx = buf.indexOf("<think>");
        const outputIdx = buf.indexOf("<output>");
        if (thinkIdx === -1 && outputIdx === -1) {
          const ltIdx = buf.lastIndexOf("<");
          if (ltIdx !== -1 && buf.length - ltIdx < "<output>".length) {
            if (ltIdx > 0) emit(buf.slice(0, ltIdx), false);
            buf = buf.slice(ltIdx);
          } else {
            emit(buf, false);
            buf = "";
          }
          break;
        }
        const firstTag = (thinkIdx !== -1 && (outputIdx === -1 || thinkIdx < outputIdx)) ? thinkIdx : -1;
        const tagIdx = firstTag !== -1 ? thinkIdx : outputIdx;
        if (tagIdx > 0) emit(buf.slice(0, tagIdx), false);
        if (firstTag !== -1) {
          buf = buf.slice(thinkIdx + "<think>".length);
          mode = "think";
        } else {
          buf = buf.slice(outputIdx + "<output>".length);
          mode = "output";
        }
      } else if (mode === "think") {
        const endIdx = buf.indexOf("</think>");
        if (endIdx !== -1) {
          emit(buf.slice(0, endIdx), true);
          buf = buf.slice(endIdx + "</think>".length);
          mode = "idle";
        } else {
          emit(buf, true);
          buf = "";
          break;
        }
      } else if (mode === "output") {
        const endIdx = buf.indexOf("</output>");
        if (endIdx !== -1) {
          emit(buf.slice(0, endIdx), false);
          buf = buf.slice(endIdx + "</output>".length);
          mode = "idle";
        } else {
          emit(buf, false);
          buf = "";
          break;
        }
      }
    }
  }

  child.stdout.on("data", (data) => {
    const cleaned = data.toString();
    if (!cleaned) return;
    buf += cleaned;
    processBuf();
  });

  child.stderr.on("data", (data) => {
    stderrBuf += data.toString();
  });

  child.on("close", () => {
    if (buf.trim()) emit(buf, mode === "think");

    const isUnknownAgent = stderrBuf.includes("Unknown agent id");
    if (isUnknownAgent && agentId !== "main") {
      console.warn(`[chat] agent "${agentId}" not found, falling back to "main"`);
      runAgentWithEmitter("main", message, sessionKey, emitter);
      return;
    }

    if (!hasOutput && stderrBuf.trim()) {
      const errorLines = stderrBuf
        .split("\n")
        .filter((l) => {
          const trimmed = l.trim();
          if (!trimmed) return false;
          return trimmed.includes("Error") || trimmed.includes("error") || trimmed.includes("failed") || trimmed.includes("No API key");
        })
        .join(" | ");
      if (errorLines) {
        emitter.send("response.output_text.delta", `[Error] ${errorLines}`);
      }
    }
    emitter.done();
  });

  child.on("error", (err) => {
    console.error("[openclaw] spawn error:", err);
    emitter.error(err.message);
  });

  return child;
}

const upload = multer({ dest: SHARED_FILES_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

function agentWorkspace(agentId) {
  return path.join(OPENCLAW_HOME, "agents", agentId, "workspace");
}

function agentDir(agentId) {
  return path.join(OPENCLAW_HOME, "agents", agentId);
}

const WORKSPACE_MARKDOWN_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
];

function isAllowedWorkspaceFilename(name) {
  return typeof name === "string" && WORKSPACE_MARKDOWN_FILES.includes(name);
}

function extractUserText(raw) {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(/^\[.+?\]\s+(.+)/);
    if (match) return match[1].trim();
  }
  return raw.trim();
}

function extractAssistantText(raw) {
  return raw.replace(/<\/?final>/gi, "").trim();
}

function parseMessagesFromJsonl(jsonlPath) {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return [];
  const raw = [];
  try {
    const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }

      if (entry.type !== "message") continue;
      const { role } = entry.message || {};
      if (role !== "user" && role !== "assistant") continue;

      const content = Array.isArray(entry.message.content) ? entry.message.content : [];

      const rawText = content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n")
        .trim();

      const text = role === "user"
        ? extractUserText(rawText)
        : extractAssistantText(rawText);

      const thinking = content
        .filter((c) => c.type === "thinking" && c.thinking)
        .map((c) => c.thinking)
        .join("\n")
        .trim() || null;

      if (!text) continue;

      raw.push({
        externalId: entry.id,
        role,
        text,
        thinking,
        timestamp: entry.timestamp || null,
      });
    }
  } catch { /* ignore read errors */ }

  const messages = [];
  for (const msg of raw) {
    const prev = messages[messages.length - 1];
    if (msg.role === "assistant" && prev?.role === "assistant") {
      prev.text = prev.text + msg.text;
      if (msg.thinking) prev.thinking = (prev.thinking || "") + msg.thinking;
      prev.externalId = msg.externalId;
      prev.timestamp = msg.timestamp || prev.timestamp;
    } else {
      messages.push({ ...msg });
    }
  }
  return messages;
}

function readFirstUserMessage(jsonlPath) {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return null;
  try {
    const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      if (entry.type === "message" && entry.message?.role === "user") {
        const content = entry.message.content || [];
        const textPart = Array.isArray(content)
          ? content.find((c) => c.type === "text")
          : null;
        const rawText = textPart?.text || (typeof content === "string" ? content : null);
        if (rawText) return extractUserText(rawText).slice(0, 200);
      }
    }
  } catch { /* ignore */ }
  return null;
}

app.get("/api/agents/list", (req, res) => {
  const agentsDir = path.join(OPENCLAW_HOME, "agents");

  try {
    const raw = execSync(
      `openclaw agents list --json 2>/dev/null`,
      { cwd: os.homedir(), env: { ...process.env, NO_COLOR: "1" }, timeout: 10000 },
    ).toString().trim();

    const parsed = JSON.parse(raw);
    const agents = Array.isArray(parsed)
      ? parsed.map((a) => ({ agentId: a.id || a.agentId || a.name, name: a.name || a.id || a.agentId }))
      : [];
    return res.json({ ok: true, agents });
  } catch {
    // CLI not available or doesn't support list — fall back to directory scan
  }

  if (!fs.existsSync(agentsDir)) {
    return res.json({ ok: true, agents: [] });
  }

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    const agents = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const agentId = e.name;
        let name = agentId;
        const identityPath = path.join(agentsDir, agentId, "identity.json");
        if (fs.existsSync(identityPath)) {
          try {
            const identity = JSON.parse(fs.readFileSync(identityPath, "utf-8"));
            name = identity.name || agentId;
          } catch { /* keep agentId as name */ }
        }
        return { agentId, name };
      });
    return res.json({ ok: true, agents });
  } catch (err) {
    console.error("[list] failed:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/agents/:agentId/sessions", (req, res) => {
  const { agentId } = req.params;
  const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");

  if (!fs.existsSync(sessionsFile)) {
    return res.json({ ok: true, sessions: [] });
  }

  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
    const prefix = `agent:${agentId}:`;
    const sessions = Object.entries(raw)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, val]) => {
        const customKey = key.slice(prefix.length);
        const firstMessage = readFirstUserMessage(val.sessionFile);
        return {
          sessionKey: customKey,
          sessionId: val.sessionId,
          updatedAt: val.updatedAt,
          label: val.label || null,
          firstMessage,
        };
      });
    return res.json({ ok: true, sessions });
  } catch (err) {
    console.error(`[sessions] failed to read sessions for ${agentId}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/agents/:agentId/sessions/:sessionKey/messages", (req, res) => {
  const { agentId, sessionKey } = req.params;
  const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");

  if (!fs.existsSync(sessionsFile)) {
    return res.json({ ok: true, messages: [] });
  }

  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
    const sessionEntry = raw[`agent:${agentId}:${sessionKey}`]
      || Object.values(raw).find((v) => v.sessionId === sessionKey);

    if (!sessionEntry) {
      return res.json({ ok: true, messages: [] });
    }

    const jsonlPath = sessionEntry.sessionFile ||
      path.join(OPENCLAW_HOME, "agents", agentId, "sessions", `${sessionEntry.sessionId}.jsonl`);

    const messages = parseMessagesFromJsonl(jsonlPath);
    return res.json({ ok: true, messages });
  } catch (err) {
    console.error(`[messages] failed for ${agentId}/${sessionKey}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete("/api/agents/:agentId/sessions/:sessionKey/messages/:externalId", (req, res) => {
  const { agentId, sessionKey, externalId } = req.params;
  const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
  try {
    if (!fs.existsSync(sessionsFile)) return res.json({ ok: true });
    const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
    const entry = raw[`agent:${agentId}:${sessionKey}`]
      || Object.values(raw).find((v) => v.sessionId === sessionKey);
    if (!entry?.sessionFile || !fs.existsSync(entry.sessionFile)) return res.json({ ok: true });

    const lines = fs.readFileSync(entry.sessionFile, "utf-8").trimEnd().split("\n");
    const filtered = lines.filter((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id !== externalId;
      } catch { return true; }
    });

    if (filtered.length < lines.length) {
      fs.writeFileSync(entry.sessionFile, filtered.join("\n") + "\n");
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/agents/:agentId/sessions/:sessionKey/settings", (req, res) => {
  const { agentId, sessionKey } = req.params;
  const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
  if (!fs.existsSync(sessionsFile)) {
    return res.json({ ok: true, settings: {} });
  }
  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry) return res.json({ ok: true, settings: {} });
    return res.json({
      ok: true,
      settings: {
        thinkingLevel: entry.thinkingLevel || "inherit",
        fastMode: entry.fastMode ?? null,
        verboseLevel: entry.verboseLevel || "inherit",
        reasoningLevel: entry.reasoningLevel || "inherit",
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch("/api/agents/:agentId/sessions/:sessionKey/settings", async (req, res) => {
  const { agentId, sessionKey } = req.params;
  const fullKey = `agent:${agentId}:${sessionKey}`;
  const patch = { key: fullKey };

  if (req.body.thinkingLevel !== undefined) {
    patch.thinkingLevel = req.body.thinkingLevel === "inherit" ? null : req.body.thinkingLevel;
  }
  if (req.body.fastMode !== undefined) {
    patch.fastMode = req.body.fastMode === null ? null : !!req.body.fastMode;
  }
  if (req.body.verboseLevel !== undefined) {
    patch.verboseLevel = req.body.verboseLevel === "inherit" ? null : req.body.verboseLevel;
  }
  if (req.body.reasoningLevel !== undefined) {
    patch.reasoningLevel = req.body.reasoningLevel === "inherit" ? null : req.body.reasoningLevel;
  }
  if (req.body.label !== undefined) {
    patch.label = req.body.label || null;
  }

  const gwReady = await gateway.ensureConnected();
  if (gwReady) {
    try {
      await gateway.request("sessions.patch", patch, { timeoutMs: 5000 });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[sessions.patch] gateway error:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // Fallback: write directly to sessions.json
  try {
    const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    const raw = fs.existsSync(sessionsFile) ? JSON.parse(fs.readFileSync(sessionsFile, "utf-8")) : {};
    const entry = raw[fullKey] || { sessionId: crypto.randomUUID(), updatedAt: Date.now() };
    if (patch.thinkingLevel !== undefined) entry.thinkingLevel = patch.thinkingLevel;
    if (patch.fastMode !== undefined) entry.fastMode = patch.fastMode;
    if (patch.verboseLevel !== undefined) entry.verboseLevel = patch.verboseLevel;
    if (patch.reasoningLevel !== undefined) entry.reasoningLevel = patch.reasoningLevel;
    if (patch.label !== undefined) entry.label = patch.label;
    raw[fullKey] = entry;
    fs.writeFileSync(sessionsFile, JSON.stringify(raw, null, 2));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/agents/:agentId/sessions/:sessionKey/delete", async (req, res) => {
  const { agentId, sessionKey } = req.params;
  const fullKey = `agent:${agentId}:${sessionKey}`;

  const gwReady = await gateway.ensureConnected();
  if (gwReady) {
    try {
      await gateway.request("sessions.delete", { key: fullKey }, { timeoutMs: 5000 });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[sessions.delete] gateway error:", err.message);
    }
  }

  try {
    const sessionsFile = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    if (fs.existsSync(sessionsFile)) {
      const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
      const entry = raw[fullKey];
      if (entry?.sessionFile && fs.existsSync(entry.sessionFile)) {
        fs.unlinkSync(entry.sessionFile);
      }
      delete raw[fullKey];
      fs.writeFileSync(sessionsFile, JSON.stringify(raw, null, 2));
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/agents/:agentId/workspace", (req, res) => {
  const { agentId } = req.params;
  const root = agentWorkspace(agentId);
  const files = WORKSPACE_MARKDOWN_FILES.map((name) => ({
    name,
    exists: fs.existsSync(path.join(root, name)),
  }));
  return res.json({ ok: true, workspacePath: root, files });
});

app.get("/api/agents/:agentId/workspace/file/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  if (!isAllowedWorkspaceFilename(filename)) {
    return res.status(400).json({ ok: false, error: "Invalid workspace file" });
  }
  const fp = path.join(agentWorkspace(agentId), filename);
  const exists = fs.existsSync(fp);
  const content = exists ? fs.readFileSync(fp, "utf8") : "";
  return res.json({ ok: true, path: fp, exists, content });
});

app.put("/api/agents/:agentId/workspace/file/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  if (!isAllowedWorkspaceFilename(filename)) {
    return res.status(400).json({ ok: false, error: "Invalid workspace file" });
  }
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const dir = agentWorkspace(agentId);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, filename);
    fs.writeFileSync(fp, content, "utf8");
    return res.json({ ok: true, path: fp });
  } catch (err) {
    console.error(`[workspace] write failed ${agentId}/${filename}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/agents/:agentId/workspace/uploads/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  const safe = path.basename(filename);
  const fp = path.join(agentWorkspace(agentId), safe);
  if (!fs.existsSync(fp)) return res.status(404).json({ ok: false, error: "File not found" });
  return res.sendFile(fp);
});

app.post("/api/agents/register", (req, res) => {
  const { agentId } = req.body;
  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId is required" });
  }

  const workspace = agentWorkspace(agentId);
  console.log(`[register] adding agent: ${agentId}, workspace: ${workspace}`);

  try {
    const output = execSync(
      `openclaw agents add ${agentId} --non-interactive --workspace ${workspace} --json 2>&1`,
      { cwd: os.homedir(), env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
    ).toString();
    console.log(`[register] success: ${output.trim()}`);
    return res.json({ ok: true, agentId, output: output.trim() });
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[register] failed for "${agentId}":`, stderr);
    if (stderr.includes("already exists")) {
      return res.json({ ok: true, agentId, existed: true });
    }
    return res.status(500).json({ ok: false, error: stderr });
  }
});

app.post("/api/agents/set-identity", (req, res) => {
  const { agentId, name } = req.body;
  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId is required" });
  }

  console.log(`[set-identity] updating agent: ${agentId}, name: ${name}`);

  try {
    const args = ["agents", "set-identity", "--agent", agentId];
    if (name) args.push("--name", name);
    const output = execSync(
      `openclaw ${args.map((a) => `"${a}"`).join(" ")} 2>&1`,
      { cwd: os.homedir(), env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
    ).toString();
    console.log(`[set-identity] success: ${output.trim()}`);
    return res.json({ ok: true, agentId, output: output.trim() });
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[set-identity] failed for "${agentId}":`, stderr);
    return res.status(500).json({ ok: false, error: stderr });
  }
});

app.post("/api/agents/remove", (req, res) => {
  const { agentId } = req.body;
  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId is required" });
  }

  console.log(`[remove] removing agent: ${agentId}`);

  try {
    const output = execSync(
      `openclaw agents delete ${agentId} --force --json 2>&1`,
      { cwd: os.homedir(), env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
    ).toString();
    console.log(`[remove] success: ${output.trim()}`);

    const dir = agentDir(agentId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[remove] cleaned up: ${dir}`);
    }

    return res.json({ ok: true, agentId, output: output.trim() });
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[remove] failed for "${agentId}":`, stderr);
    if (stderr.includes("not found") || stderr.includes("Unknown agent")) {
      return res.json({ ok: true, agentId, notFound: true });
    }
    return res.status(500).json({ ok: false, error: stderr });
  }
});

app.post("/api/chat/stream", upload.array("files", 5), async (req, res) => {
  const { message, sessionKey, openclawAgentId } = req.body;
  const agentId = openclawAgentId || "main";
  const files = req.files || [];

  const workspaceDir = agentWorkspace(agentId);
  if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

  const filePaths = files.map((f) => {
    const dest = path.join(workspaceDir, f.originalname);
    fs.copyFileSync(f.path, dest);
    fs.unlinkSync(f.path);
    console.log(`[files] saved ${f.originalname} -> ${dest}`);
    return dest;
  });

  let fullMessage = message || "";
  if (filePaths.length) {
    const fileList = filePaths.map((p) => `- ${p}`).join("\n");
    const fileNote = `\n\nThe user attached file(s) saved to your workspace:\n${fileList}\nYou can read them directly.`;
    fullMessage = fullMessage ? fullMessage + fileNote : fileNote.trim();
  }

  if (!fullMessage.trim()) {
    return res.status(400).json({ error: "message or files required" });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.socket?.setNoDelay(true);
  res.flushHeaders();

  const gwReady = await gateway.ensureConnected();
  const creds = gwReady ? loadGatewayCredentials() : null;
  const hasWriteScope = creds
    ? (creds.auth.tokens?.operator?.scopes || []).includes("operator.write")
    : false;

  if (gwReady && hasWriteScope) {
    console.log("[chat] using gateway direct connection");
    runAgentViaGateway(agentId, fullMessage, sessionKey || null, sseEmitter(res));
  } else {
    if (gwReady && !hasWriteScope) {
      console.log(
        "[chat] gateway connected but device-auth lacks operator.write — using CLI fallback. "
        + "Fix: openclaw devices list → openclaw devices approve <id>",
      );
    } else {
      console.log("[chat] gateway unavailable, using CLI fallback");
    }
    runAgentWithEmitter(agentId, fullMessage, sessionKey || null, sseEmitter(res));
  }
});

app.listen(PROXY_PORT, () => {
  console.log(`OpenClaw proxy listening on http://localhost:${PROXY_PORT}`);
  console.log(`OPENCLAW_HOME: ${OPENCLAW_HOME}`);
});
