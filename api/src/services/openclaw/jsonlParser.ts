import fs from 'fs';
import {
  JsonlContentPart,
  JsonlEntry,
  JsonlTextPart,
  JsonlThinkingPart,
  OpenClawMessage,
} from '../../@types/openclaw';

export function extractUserText(raw: string): string {
  const trimmed = raw.trim();
  // Preserve scheduled-task headers so the frontend can render them specially
  if (/^\[cron:/i.test(trimmed)) return trimmed;

  const match = raw
    .split('\n')
    .reverse()
    .map((l) => l.trim().match(/^\[.+?\]\s+(.+)/))
    .find((m) => m !== null);
  return match ? match[1].trim() : trimmed;
}

export function extractAssistantText(raw: string): string {
  return raw
    .replace(/<\/?final>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, '')
    .trim();
}

function isTextPart(p: JsonlContentPart): p is JsonlTextPart {
  return p.type === 'text' && typeof (p as JsonlTextPart).text === 'string';
}

function isThinkingPart(p: JsonlContentPart): p is JsonlThinkingPart {
  return p.type === 'thinking' && typeof (p as JsonlThinkingPart).thinking === 'string';
}

function readJsonlLines(jsonlPath: string): JsonlEntry[] {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return [];
  return fs
    .readFileSync(jsonlPath, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as JsonlEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is JsonlEntry => e !== null);
}

export function readFirstUserMessage(jsonlPath: string): string | null {
  try {
    const entries = readJsonlLines(jsonlPath);
    const userMsg = entries.find(
      (entry) => entry.type === 'message' && entry.message?.role === 'user'
    );
    if (!userMsg?.message) return null;
    const content = userMsg.message.content ?? [];
    const textPart = Array.isArray(content) ? content.find(isTextPart) : null;
    const rawText = textPart?.text || (typeof content === 'string' ? content : null);
    return rawText ? extractUserText(rawText).slice(0, 200) : null;
  } catch {
    return null;
  }
}

export function parseMessagesFromJsonl(jsonlPath: string): OpenClawMessage[] {
  try {
    const raw = readJsonlLines(jsonlPath)
      .filter((entry) => {
        if (entry.type !== 'message') return false;
        const role = entry.message?.role;
        return role === 'user' || role === 'assistant';
      })
      .map((entry): OpenClawMessage | null => {
        const message = entry.message!;
        const { role } = message;
        const content = Array.isArray(message.content) ? message.content : [];
        const rawText = content
          .filter(isTextPart)
          .map((c) => c.text)
          .join('\n')
          .trim();
        const text = role === 'user' ? extractUserText(rawText) : extractAssistantText(rawText);
        const inlineThinkMatch = rawText.match(
          /<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/i
        );
        const inlineThink = inlineThinkMatch ? inlineThinkMatch[1].trim() : '';
        const structuredThink = content
          .filter(isThinkingPart)
          .map((c) => c.thinking)
          .join('\n')
          .trim();
        const thinking = [structuredThink, inlineThink].filter(Boolean).join('\n').trim() || null;
        if (!text) return null;
        return {
          externalId: entry.id || '',
          role,
          text,
          thinking,
          timestamp: entry.timestamp || null,
        };
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
    return [];
  }
}

export function findLastAssistantThinking(jsonlPath: string): string | null {
  try {
    if (!fs.existsSync(jsonlPath)) return null;
    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').reverse();
    const assistantLine = lines.find((l) => {
      try {
        const parsed = JSON.parse(l) as JsonlEntry;
        return parsed.type === 'message' && parsed.message?.role === 'assistant';
      } catch {
        return false;
      }
    });
    if (!assistantLine) return null;
    const parsed = JSON.parse(assistantLine) as JsonlEntry;
    const content = parsed.message?.content;
    if (!Array.isArray(content)) return null;
    const thinkingPart = content.find(isThinkingPart);
    return thinkingPart?.thinking || null;
  } catch {
    return null;
  }
}
