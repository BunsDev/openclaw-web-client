import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Response } from 'express';
import { SseEmitter, OpenClawMessage, OpenClawSession } from '../@types/openclaw';
import { gateway, loadGatewayCredentials, getOpenclawHome } from './openclawGateway';

const OPENCLAW_HOME = getOpenclawHome();

const GW_TAG = 'final|output|think|thinking|redacted_thinking';
const GW_RE_OPEN = new RegExp(`^<(?:${GW_TAG})\\b[^>]*>`, 'i');
const GW_RE_CLOSE = new RegExp(`</(?:${GW_TAG})\\s*>\\s*$`, 'i');
const GW_RE_PARTIAL_CLOSE = /<\/[a-z]*\s*$/i;
const GW_RE_PARTIAL_TAG = new RegExp(`^<\\/?\\s*(?:${GW_TAG})\\s*$`, 'i');

function stripGatewayTags(text: string): string {
  if (!text) return text;
  return text.replace(GW_RE_OPEN, '').replace(GW_RE_CLOSE, '').replace(GW_RE_PARTIAL_CLOSE, '');
}

export function agentWorkspacePath(agentId: string): string {
  return path.join(OPENCLAW_HOME, 'workspace', agentId);
}

function agentDir(agentId: string): string {
  return path.join(OPENCLAW_HOME, 'agents', agentId);
}

export function createSseEmitter(res: Response): SseEmitter {
  return {
    send(type, delta) {
      res.write(`data: ${JSON.stringify({ type, delta })}\n\n`);
    },
    done() {
      res.write('data: [DONE]\n\n');
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

// ── Filesystem helpers ──

function extractUserText(raw: string): string {
  const match = raw
    .split('\n')
    .reverse()
    .map((l) => l.trim().match(/^\[.+?\]\s+(.+)/))
    .find((m) => m !== null);
  return match ? match[1].trim() : raw.trim();
}

function extractAssistantText(raw: string): string {
  return raw.replace(/<\/?final>/gi, '').trim();
}

function readFirstUserMessage(jsonlPath: string): string | null {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return null;
  try {
    const lines = fs
      .readFileSync(jsonlPath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    const userMsg = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((entry) => entry?.type === 'message' && entry.message?.role === 'user');
    if (!userMsg) return null;
    const content = userMsg.message.content || [];
    const textPart = Array.isArray(content) ? content.find((c: any) => c.type === 'text') : null;
    const rawText = textPart?.text || (typeof content === 'string' ? content : null);
    return rawText ? extractUserText(rawText).slice(0, 200) : null;
  } catch {
    /* ignore */
  }
  return null;
}

function parseMessagesFromJsonl(jsonlPath: string): OpenClawMessage[] {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return [];
  try {
    const lines = fs
      .readFileSync(jsonlPath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    const raw = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((entry) => {
        if (!entry || entry.type !== 'message') return false;
        const { role } = entry.message || {};
        return role === 'user' || role === 'assistant';
      })
      .map((entry) => {
        const { role } = entry.message;
        const content = Array.isArray(entry.message.content) ? entry.message.content : [];
        const rawText = content
          .filter((c: any) => c.type === 'text' && c.text)
          .map((c: any) => c.text)
          .join('\n')
          .trim();
        const text = role === 'user' ? extractUserText(rawText) : extractAssistantText(rawText);
        const thinking =
          content
            .filter((c: any) => c.type === 'thinking' && c.thinking)
            .map((c: any) => c.thinking)
            .join('\n')
            .trim() || null;
        return text
          ? {
              externalId: entry.id,
              role,
              text,
              thinking,
              timestamp: entry.timestamp || null,
            }
          : null;
      })
      .filter((m): m is OpenClawMessage => m !== null);

    return raw.reduce<OpenClawMessage[]>((messages, msg) => {
      const prev = messages[messages.length - 1];
      if (msg.role === 'assistant' && prev?.role === 'assistant') {
        prev.text += msg.text;
        if (msg.thinking) prev.thinking = (prev.thinking || '') + msg.thinking;
        prev.externalId = msg.externalId;
        prev.timestamp = msg.timestamp || prev.timestamp;
      } else {
        messages.push({ ...msg });
      }
      return messages;
    }, []);
  } catch {
    /* ignore read errors */
  }
  return [];
}

function extractThinkingFromJsonl(agentId: string, sessionKey: string): string | null {
  try {
    const sessFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
    if (!fs.existsSync(sessFile)) return null;
    const raw = JSON.parse(fs.readFileSync(sessFile, 'utf-8'));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry?.sessionFile) return null;
    if (!fs.existsSync(entry.sessionFile)) return null;
    const lines = fs.readFileSync(entry.sessionFile, 'utf-8').trim().split('\n').reverse();
    const assistantLine = lines.find((l) => {
      try {
        const parsed = JSON.parse(l);
        return parsed.type === 'message' && parsed.message?.role === 'assistant';
      } catch {
        return false;
      }
    });
    if (assistantLine) {
      const parsed = JSON.parse(assistantLine);
      const thinkingPart = (parsed.message.content || []).find((p: any) => p.type === 'thinking');
      return thinkingPart?.thinking || null;
    }
  } catch {
    /* non-critical */
  }
  return null;
}

function getSessionSettingsInternal(agentId: string, sessionKey: string | null) {
  const defaults = {
    thinkingLevel: 'medium',
    fastMode: null as boolean | null,
    verboseLevel: 'inherit',
    reasoningLevel: 'inherit',
  };
  if (!sessionKey) return defaults;
  try {
    const sessFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
    if (!fs.existsSync(sessFile)) return defaults;
    const raw = JSON.parse(fs.readFileSync(sessFile, 'utf-8'));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry) return defaults;
    return {
      thinkingLevel: entry.thinkingLevel || defaults.thinkingLevel,
      fastMode: entry.fastMode ?? defaults.fastMode,
      verboseLevel: entry.verboseLevel || defaults.verboseLevel,
      reasoningLevel: entry.reasoningLevel || defaults.reasoningLevel,
    };
  } catch {
    return defaults;
  }
}

// ── Agent execution ──

function runAgentViaGateway(
  agentId: string,
  message: string,
  sessionKey: string | null,
  emitter: SseEmitter
) {
  const runId = crypto.randomUUID();
  const listenerKey = `agent-${runId}`;
  let assistantSent = '';
  let reasoningSent = '';

  gateway.onEvent(listenerKey, (msg: any) => {
    const p = msg.payload;
    if (msg.event !== 'agent' && msg.event !== 'chat') return;
    if (p.runId !== runId) return;

    if (msg.event === 'agent' && p.data?.delta) {
      const { stream } = p;
      if (stream !== 'assistant' && stream !== 'reasoning') return;

      const fullText = p.data.text;
      if (fullText == null) return;

      const clean = stripGatewayTags(fullText);
      if (!clean || GW_RE_PARTIAL_TAG.test(clean)) return;

      const alreadySent = stream === 'assistant' ? assistantSent : reasoningSent;

      if (alreadySent.length === 0 || clean.startsWith(alreadySent)) {
        if (clean.length > alreadySent.length) {
          const newContent = clean.substring(alreadySent.length);
          if (stream === 'assistant') assistantSent = clean;
          else reasoningSent = clean;
          emitter.send(
            stream === 'assistant' ? 'response.output_text.delta' : 'response.thinking.delta',
            newContent
          );
        }
      } else {
        if (stream === 'assistant') assistantSent = clean;
        else reasoningSent = clean;
        emitter.send(
          stream === 'assistant' ? 'response.output_text.delta' : 'response.thinking.delta',
          clean
        );
      }
    }
  });

  const sessionSettings = getSessionSettingsInternal(agentId, sessionKey);
  const params: Record<string, any> = {
    message,
    agentId,
    idempotencyKey: runId,
    thinking: sessionSettings.thinkingLevel || 'medium',
  };
  if (sessionKey) {
    const fullKey = `agent:${agentId}:${sessionKey}`;
    params.sessionId = sessionKey;
    params.sessionKey = fullKey;
  }

  gateway
    .request('agent', params, { expectFinal: true, timeoutMs: 120000 })
    .then(() => {
      gateway.offEvent(listenerKey);
      if (sessionKey) {
        const thinking = extractThinkingFromJsonl(agentId, sessionKey);
        if (thinking) emitter.send('response.thinking.delta', thinking);
      }
      emitter.done();
    })
    .catch((err: Error) => {
      console.error('[gateway] agent error:', err.message);
      gateway.offEvent(listenerKey);
      emitter.error(err.message);
    });

  return { kill: () => gateway.offEvent(listenerKey) };
}

function runAgentWithEmitter(
  agentId: string,
  message: string,
  sessionKey: string | null,
  emitter: SseEmitter
) {
  const sessionSettings = getSessionSettingsInternal(agentId, sessionKey);
  const thinkingArg =
    sessionSettings.thinkingLevel === 'inherit' ? 'medium' : sessionSettings.thinkingLevel;
  const args = ['agent', '--agent', agentId, '-m', message, '--thinking', thinkingArg];
  if (sessionSettings.reasoningLevel && sessionSettings.reasoningLevel !== 'inherit') {
    args.push('--reasoning', sessionSettings.reasoningLevel);
  }
  if (sessionKey) args.push('--session-id', sessionKey);

  console.log(`[chat] CLI fallback: openclaw ${args.join(' ')}`);

  const child = spawn('openclaw', args, {
    cwd: os.homedir(),
    env: { ...process.env, NO_COLOR: '1' },
  });

  let hasOutput = false;
  let stderrBuf = '';
  let buf = '';
  let mode: 'idle' | 'think' | 'output' = 'idle';

  function emit(text: string, isThinking: boolean) {
    if (!text) return;
    const type = isThinking ? 'response.thinking.delta' : 'response.output_text.delta';
    emitter.send(type, text);
    hasOutput = true;
  }

  function processBuf() {
    while (buf.length > 0) {
      if (mode === 'idle') {
        const thinkIdx = buf.indexOf('<think>');
        const outputIdx = buf.indexOf('<output>');
        if (thinkIdx === -1 && outputIdx === -1) {
          const ltIdx = buf.lastIndexOf('<');
          if (ltIdx !== -1 && buf.length - ltIdx < '<output>'.length) {
            if (ltIdx > 0) emit(buf.slice(0, ltIdx), false);
            buf = buf.slice(ltIdx);
          } else {
            emit(buf, false);
            buf = '';
          }
          break;
        }
        const firstTag =
          thinkIdx !== -1 && (outputIdx === -1 || thinkIdx < outputIdx) ? thinkIdx : -1;
        const tagIdx = firstTag !== -1 ? thinkIdx : outputIdx;
        if (tagIdx > 0) emit(buf.slice(0, tagIdx), false);
        if (firstTag !== -1) {
          buf = buf.slice(thinkIdx + '<think>'.length);
          mode = 'think';
        } else {
          buf = buf.slice(outputIdx + '<output>'.length);
          mode = 'output';
        }
      } else if (mode === 'think') {
        const endIdx = buf.indexOf('</think>');
        if (endIdx !== -1) {
          emit(buf.slice(0, endIdx), true);
          buf = buf.slice(endIdx + '</think>'.length);
          mode = 'idle';
        } else {
          emit(buf, true);
          buf = '';
          break;
        }
      } else if (mode === 'output') {
        const endIdx = buf.indexOf('</output>');
        if (endIdx !== -1) {
          emit(buf.slice(0, endIdx), false);
          buf = buf.slice(endIdx + '</output>'.length);
          mode = 'idle';
        } else {
          emit(buf, false);
          buf = '';
          break;
        }
      }
    }
  }

  child.stdout.on('data', (data: Buffer) => {
    const cleaned = data.toString();
    if (!cleaned) return;
    buf += cleaned;
    processBuf();
  });

  child.stderr.on('data', (data: Buffer) => {
    stderrBuf += data.toString();
  });

  child.on('close', () => {
    if (buf.trim()) emit(buf, mode === 'think');

    const isUnknownAgent = stderrBuf.includes('Unknown agent id');
    if (isUnknownAgent && agentId !== 'main') {
      console.warn(`[chat] agent "${agentId}" not found, falling back to "main"`);
      runAgentWithEmitter('main', message, sessionKey, emitter);
      return;
    }

    if (!hasOutput && stderrBuf.trim()) {
      const errorLines = stderrBuf
        .split('\n')
        .filter((l) => {
          const trimmed = l.trim();
          if (!trimmed) return false;
          return (
            trimmed.includes('Error') ||
            trimmed.includes('error') ||
            trimmed.includes('failed') ||
            trimmed.includes('No API key')
          );
        })
        .join(' | ');
      if (errorLines) {
        emitter.send('response.output_text.delta', `[Error] ${errorLines}`);
      }
    }
    emitter.done();
  });

  child.on('error', (err: Error) => {
    console.error('[openclaw] spawn error:', err);
    emitter.error(err.message);
  });

  return child;
}

// ── Public API ──

const WORKSPACE_MARKDOWN_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
];

export function isAllowedWorkspaceFilename(name: string): boolean {
  return typeof name === 'string' && WORKSPACE_MARKDOWN_FILES.includes(name);
}

export function listAgents(): {
  agentId: string;
  name: string;
  createdAt: Date;
}[] {
  const agentsDir = path.join(OPENCLAW_HOME, 'agents');
  if (!fs.existsSync(agentsDir)) return [];

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const aid = e.name;
        let name = aid;
        const identityPath = path.join(agentsDir, aid, 'identity.json');
        if (fs.existsSync(identityPath)) {
          try {
            const identity = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
            name = identity.name || aid;
          } catch {
            /* keep agentId as name */
          }
        }
        const stat = fs.statSync(path.join(agentsDir, aid));
        return { agentId: aid, name, createdAt: stat.birthtime };
      });
  } catch {
    return [];
  }
}

export function listSessions(agentId: string, skipFirstMessage = false): OpenClawSession[] {
  const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
  if (!fs.existsSync(sessionsFile)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const prefix = `agent:${agentId}:`;
    return Object.entries(raw)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, val]: [string, any]) => {
        const customKey = key.slice(prefix.length);
        const firstMessage = skipFirstMessage ? null : readFirstUserMessage(val.sessionFile);
        return {
          sessionKey: customKey,
          sessionId: val.sessionId,
          updatedAt: val.updatedAt,
          label: val.label || null,
          firstMessage,
        };
      });
  } catch {
    return [];
  }
}

export function getSessionMessages(agentId: string, sessionKey: string): OpenClawMessage[] {
  const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
  if (!fs.existsSync(sessionsFile)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const sessionEntry =
      raw[`agent:${agentId}:${sessionKey}`] ||
      Object.values(raw).find((v: any) => v.sessionId === sessionKey);
    if (!sessionEntry) return [];
    const jsonlPath =
      (sessionEntry as any).sessionFile ||
      path.join(
        OPENCLAW_HOME,
        'agents',
        agentId,
        'sessions',
        `${(sessionEntry as any).sessionId}.jsonl`
      );
    return parseMessagesFromJsonl(jsonlPath);
  } catch {
    return [];
  }
}

export function deleteSessionMessage(
  agentId: string,
  sessionKey: string,
  externalId: string
): boolean {
  const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
  try {
    if (!fs.existsSync(sessionsFile)) return true;
    const raw = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const entry =
      raw[`agent:${agentId}:${sessionKey}`] ||
      Object.values(raw).find((v: any) => v.sessionId === sessionKey);
    if (!(entry as any)?.sessionFile || !fs.existsSync((entry as any).sessionFile)) return true;

    const lines = fs
      .readFileSync((entry as any).sessionFile, 'utf-8')
      .trimEnd()
      .split('\n');
    const filtered = lines.filter((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.id !== externalId;
      } catch {
        return true;
      }
    });

    if (filtered.length < lines.length) {
      fs.writeFileSync((entry as any).sessionFile, `${filtered.join('\n')}\n`);
    }
    return true;
  } catch {
    return false;
  }
}

export function getSessionSettings(agentId: string, sessionKey: string) {
  const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
  if (!fs.existsSync(sessionsFile)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const entry = raw[`agent:${agentId}:${sessionKey}`];
    if (!entry) return {};
    return {
      thinkingLevel: entry.thinkingLevel || 'inherit',
      fastMode: entry.fastMode ?? null,
      verboseLevel: entry.verboseLevel || 'inherit',
      reasoningLevel: entry.reasoningLevel || 'inherit',
    };
  } catch {
    return {};
  }
}

export async function patchSessionSettings(
  agentId: string,
  sessionKey: string,
  body: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  const fullKey = `agent:${agentId}:${sessionKey}`;
  const patch: Record<string, any> = { key: fullKey };

  if (body.thinkingLevel !== undefined)
    patch.thinkingLevel = body.thinkingLevel === 'inherit' ? null : body.thinkingLevel;
  if (body.fastMode !== undefined) patch.fastMode = body.fastMode === null ? null : !!body.fastMode;
  if (body.verboseLevel !== undefined)
    patch.verboseLevel = body.verboseLevel === 'inherit' ? null : body.verboseLevel;
  if (body.reasoningLevel !== undefined)
    patch.reasoningLevel = body.reasoningLevel === 'inherit' ? null : body.reasoningLevel;
  if (body.label !== undefined) patch.label = body.label || null;

  const gwReady = await gateway.ensureConnected();
  if (gwReady) {
    try {
      await gateway.request('sessions.patch', patch, { timeoutMs: 5000 });
      return { ok: true };
    } catch (err: any) {
      console.error('[sessions.patch] gateway error:', err.message);
      return { ok: false, error: err.message };
    }
  }

  try {
    const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
    const raw = fs.existsSync(sessionsFile)
      ? JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'))
      : {};
    const entry = raw[fullKey] || {
      sessionId: crypto.randomUUID(),
      updatedAt: Date.now(),
    };
    if (patch.thinkingLevel !== undefined) entry.thinkingLevel = patch.thinkingLevel;
    if (patch.fastMode !== undefined) entry.fastMode = patch.fastMode;
    if (patch.verboseLevel !== undefined) entry.verboseLevel = patch.verboseLevel;
    if (patch.reasoningLevel !== undefined) entry.reasoningLevel = patch.reasoningLevel;
    if (patch.label !== undefined) entry.label = patch.label;
    raw[fullKey] = entry;
    fs.writeFileSync(sessionsFile, JSON.stringify(raw, null, 2));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function deleteSession(agentId: string, sessionKey: string): Promise<{ ok: boolean }> {
  const fullKey = `agent:${agentId}:${sessionKey}`;

  const gwReady = await gateway.ensureConnected();
  if (gwReady) {
    try {
      await gateway.request('sessions.delete', { key: fullKey }, { timeoutMs: 5000 });
      return { ok: true };
    } catch (err: any) {
      console.error('[sessions.delete] gateway error:', err.message);
    }
  }

  try {
    const sessionsFile = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
    if (fs.existsSync(sessionsFile)) {
      const raw = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
      const entry = raw[fullKey];
      if (entry?.sessionFile && fs.existsSync(entry.sessionFile)) {
        fs.unlinkSync(entry.sessionFile);
      }
      delete raw[fullKey];
      fs.writeFileSync(sessionsFile, JSON.stringify(raw, null, 2));
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export function getWorkspaceMeta(agentId: string) {
  const root = agentWorkspacePath(agentId);
  const files = WORKSPACE_MARKDOWN_FILES.map((name) => ({
    name,
    exists: fs.existsSync(path.join(root, name)),
  }));
  return { ok: true, workspacePath: root, files };
}

export function getWorkspaceFile(agentId: string, filename: string) {
  const fp = path.join(agentWorkspacePath(agentId), filename);
  const exists = fs.existsSync(fp);
  const content = exists ? fs.readFileSync(fp, 'utf8') : '';
  return { ok: true, path: fp, exists, content };
}

export function putWorkspaceFile(agentId: string, filename: string, content: string) {
  const dir = agentWorkspacePath(agentId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, filename);
  fs.writeFileSync(fp, content, 'utf8');
  return { ok: true, path: fp };
}

function mediaInboundDir(): string {
  return path.join(OPENCLAW_HOME, 'media', 'inbound');
}

export function getWorkspaceUploadPath(_agentId: string, filename: string): string | null {
  const safe = path.basename(filename);
  const fp = path.join(mediaInboundDir(), safe);
  return fs.existsSync(fp) ? fp : null;
}

export function registerAgent(agentId: string): {
  ok: boolean;
  existed?: boolean;
  output?: string;
  error?: string;
} {
  const workspace = agentWorkspacePath(agentId);
  console.log(`[register] adding agent: ${agentId}, workspace: ${workspace}`);
  try {
    const output = execSync(
      `openclaw agents add ${agentId} --non-interactive --workspace ${workspace} --json 2>&1`,
      {
        cwd: os.homedir(),
        env: { ...process.env, NO_COLOR: '1' },
        timeout: 15000,
      }
    ).toString();
    console.log(`[register] success: ${output.trim()}`);
    return { ok: true, output: output.trim() };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[register] failed for "${agentId}":`, stderr);
    if (stderr.includes('already exists')) return { ok: true, existed: true };
    return { ok: false, error: stderr };
  }
}

export function setAgentIdentity(agentId: string, name: string): { ok: boolean; error?: string } {
  console.log(`[set-identity] updating agent: ${agentId}, name: ${name}`);
  try {
    const args = ['agents', 'set-identity', '--agent', agentId];
    if (name) args.push('--name', name);
    const output = execSync(`openclaw ${args.map((a) => `"${a}"`).join(' ')} 2>&1`, {
      cwd: os.homedir(),
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 15000,
    }).toString();
    console.log(`[set-identity] success: ${output.trim()}`);
    return { ok: true };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[set-identity] failed for "${agentId}":`, stderr);
    return { ok: false, error: stderr };
  }
}

export function removeAgent(agentId: string): {
  ok: boolean;
  notFound?: boolean;
  error?: string;
} {
  console.log(`[remove] removing agent: ${agentId}`);
  try {
    const output = execSync(`openclaw agents delete ${agentId} --force --json 2>&1`, {
      cwd: os.homedir(),
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 15000,
    }).toString();
    console.log(`[remove] success: ${output.trim()}`);
    const dir = agentDir(agentId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[remove] cleaned up: ${dir}`);
    }
    return { ok: true };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    console.error(`[remove] failed for "${agentId}":`, stderr);
    if (stderr.includes('not found') || stderr.includes('Unknown agent'))
      return { ok: true, notFound: true };
    return { ok: false, error: stderr };
  }
}

export async function runChat(
  agentId: string,
  message: string,
  sessionKey: string | null,
  filePaths: string[],
  res: Response
): Promise<void> {
  let fullMessage = message || '';
  if (filePaths.length) {
    const fileList = filePaths.map((p) => `- ${p}`).join('\n');
    const fileNote = `\n\nThe user attached file(s) saved to your workspace:\n${fileList}\nYou can read them directly.`;
    fullMessage = fullMessage ? fullMessage + fileNote : fileNote.trim();
  }

  if (!fullMessage.trim()) {
    res.status(400).json({ error: 'message or files required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).socket?.setNoDelay(true);
  res.flushHeaders();

  const emitter = createSseEmitter(res);
  const gwReady = await gateway.ensureConnected();
  const creds = gwReady ? loadGatewayCredentials() : null;
  const hasWriteScope = creds
    ? (creds.auth.tokens?.operator?.scopes || []).includes('operator.write')
    : false;

  if (gwReady && hasWriteScope) {
    console.log('[chat] using gateway direct connection');
    runAgentViaGateway(agentId, fullMessage, sessionKey, emitter);
  } else {
    if (gwReady && !hasWriteScope) {
      console.log(
        '[chat] gateway connected but device-auth lacks operator.write — using CLI fallback. ' +
          'Fix: openclaw devices list → openclaw devices approve <id>'
      );
    } else {
      console.log('[chat] gateway unavailable, using CLI fallback');
    }
    runAgentWithEmitter(agentId, fullMessage, sessionKey, emitter);
  }
}

// ─── Model management ───

function readOpenclawConfig(): Record<string, unknown> | null {
  try {
    const configPath = path.join(OPENCLAW_HOME, 'openclaw.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

/** One config read; maps OpenClaw agent ids to configured model id (for list endpoints). */
export function getAgentModelsForOpenclawIds(openclawIds: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const config = readOpenclawConfig();
  if (!config) {
    openclawIds.forEach((id) => {
      result[id] = null;
    });
    return result;
  }
  const agents = config.agents as Record<string, unknown> | undefined;
  if (!agents) {
    openclawIds.forEach((id) => {
      result[id] = null;
    });
    return result;
  }
  const list = (agents.list || []) as Record<string, unknown>[];
  const defaults = agents.defaults as Record<string, unknown> | undefined;
  const defModel = defaults?.model as Record<string, string> | undefined;
  const fallback = defModel?.primary || null;

  openclawIds.forEach((agentId) => {
    const agentEntry = list.find((a) => a.id === agentId);
    if (agentEntry?.model) {
      const { model } = agentEntry;
      result[agentId] =
        typeof model === 'string' ? model : (model as Record<string, string>).primary || null;
    } else {
      result[agentId] = fallback;
    }
  });
  return result;
}

export function getAgentModel(agentId: string): string | null {
  return getAgentModelsForOpenclawIds([agentId])[agentId] ?? null;
}

export function copyFileToWorkspace(
  _agentId: string,
  srcPath: string,
  originalName: string
): string {
  const dir = mediaInboundDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalName);
  const safeName = `${crypto.randomUUID()}${ext}`;
  const dest = path.join(dir, safeName);
  fs.copyFileSync(srcPath, dest);
  fs.unlinkSync(srcPath);
  console.log(`[files] saved ${originalName} -> ${dest}`);
  return dest;
}
