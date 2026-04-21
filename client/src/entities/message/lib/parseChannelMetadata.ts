export interface ChannelSenderMetadata {
  id?: string;
  name?: string;
  label?: string;
  [key: string]: unknown;
}

export interface ChannelConversationMetadata {
  message_id?: string;
  sender_id?: string;
  sender?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ParsedChannelMessage {
  cleanText: string;
  sender: ChannelSenderMetadata | null;
  conversation: ChannelConversationMetadata | null;
  extras: Record<string, unknown>;
}

const BLOCK_RE =
  /([^\n]+?)\s*\(untrusted metadata\)\s*:\s*\n+\s*(?:```(?:json)?\s*\n)?(\{[^{}]*\})(?:\s*```)?/gi;

function labelToKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseChannelMetadata(text: string | undefined | null): ParsedChannelMessage {
  const empty: ParsedChannelMessage = {
    cleanText: text ?? '',
    sender: null,
    conversation: null,
    extras: {},
  };
  if (!text) return empty;

  let sender: ChannelSenderMetadata | null = null;
  let conversation: ChannelConversationMetadata | null = null;
  const extras: Record<string, unknown> = {};
  let cleanText = text;
  let found = false;

  const matches = [...text.matchAll(BLOCK_RE)];
  for (const m of matches) {
    const rawLabel = m[1];
    const rawJson = m[2];
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      continue;
    }
    found = true;
    const key = labelToKey(rawLabel);
    if (key.includes('sender')) {
      sender = parsed as ChannelSenderMetadata;
    } else if (key.includes('conversation')) {
      conversation = parsed as ChannelConversationMetadata;
    } else {
      extras[key] = parsed;
    }
    cleanText = cleanText.replace(m[0], '');
  }

  if (!found) return empty;

  cleanText = cleanText
    .replace(/^\s+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  return { cleanText, sender, conversation, extras };
}
