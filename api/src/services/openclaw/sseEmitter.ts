import { Response } from 'express';
import { SseEmitter } from '../../@types/openclaw';

const GW_TAG = 'final|output|think|thinking|redacted_thinking';
const GW_RE_OPEN = new RegExp(`^<(?:${GW_TAG})\\b[^>]*>`, 'i');
const GW_RE_CLOSE = new RegExp(`</(?:${GW_TAG})\\s*>\\s*$`, 'i');
const GW_RE_PARTIAL_CLOSE = /<\/[a-z]*\s*$/i;
export const GW_RE_PARTIAL_TAG = new RegExp(`^<\\/?\\s*(?:${GW_TAG})\\s*$`, 'i');

export function stripGatewayTags(text: string): string {
  if (!text) return text;
  return text.replace(GW_RE_OPEN, '').replace(GW_RE_CLOSE, '').replace(GW_RE_PARTIAL_CLOSE, '');
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
