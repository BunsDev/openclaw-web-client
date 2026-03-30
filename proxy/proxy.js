import express from "express";
import { spawn, execSync } from "child_process";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";

const app = express();
app.use(express.json());

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
const PROXY_PORT = parseInt(process.env.PROXY_PORT || "18801", 10);
const SHARED_FILES_DIR = path.join(os.tmpdir(), "openclaw-files");
if (!fs.existsSync(SHARED_FILES_DIR)) fs.mkdirSync(SHARED_FILES_DIR, { recursive: true });

const upload = multer({ dest: SHARED_FILES_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

function agentWorkspace(agentId) {
  return path.join(OPENCLAW_HOME, "agents", agentId, "workspace");
}

function agentDir(agentId) {
  return path.join(OPENCLAW_HOME, "agents", agentId);
}

function runAgent(agentId, message, sessionKey, res) {
  const args = ["agent", "--agent", agentId, "-m", message];
  if (sessionKey) args.push("--session-id", sessionKey);

  console.log(`[chat] spawning: openclaw ${args.join(" ")}`);

  const child = spawn("openclaw", args, {
    env: { ...process.env, NO_COLOR: "1" },
  });

  let hasOutput = false;
  let stderrBuf = "";
  let buf = "";
  let mode = "idle";

  const noisePatterns = [
    /\[.*?model-providers.*?\]/,
    /\[.*?auth-profiles?\]/,
    /\[.*?auth\]/,
    /bootstrap.*config.*fallback/i,
    /inherited.*from.*main/i,
    /ExperimentalWarning/,
    /punycode/,
    /deprecated/i,
    /no config backend key found/i,
  ];

  function stripNoise(text) {
    return text
      .split("\n")
      .filter((line) => !noisePatterns.some((rx) => rx.test(line)))
      .join("\n");
  }

  function emit(text, isThinking) {
    if (!text) return;
    const type = isThinking ? "response.thinking.delta" : "response.output_text.delta";
    res.write(`data: ${JSON.stringify({ type, delta: text })}\n\n`);
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
    const cleaned = stripNoise(data.toString());
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
      runAgent("main", message, sessionKey, res);
      return;
    }

    if (!hasOutput && stderrBuf.trim()) {
      const noisePatterns = [
        "bootstrap", "fallback", "config backend", "model-providers",
        "auth]", "auth-profiles]", "inherited", "deprecated",
        "ExperimentalWarning", "punycode",
      ];
      const errorLines = stderrBuf
        .split("\n")
        .filter((l) => {
          const trimmed = l.trim();
          if (!trimmed) return false;
          if (noisePatterns.some((p) => trimmed.includes(p))) return false;
          return trimmed.includes("Error") || trimmed.includes("error") || trimmed.includes("failed") || trimmed.includes("No API key");
        })
        .join(" | ");
      if (errorLines) {
        res.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: `[Error] ${errorLines}` })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });

  child.on("error", (err) => {
    console.error("[openclaw] spawn error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  });
}

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
      { env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
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
      { env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
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
      { env: { ...process.env, NO_COLOR: "1" }, timeout: 15000 },
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

app.post("/api/chat/stream", upload.array("files", 5), (req, res) => {
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

  runAgent(agentId, fullMessage, sessionKey, res);
});

app.listen(PROXY_PORT, () => {
  console.log(`OpenClaw proxy listening on http://localhost:${PROXY_PORT}`);
  console.log(`OPENCLAW_HOME: ${OPENCLAW_HOME}`);
});
