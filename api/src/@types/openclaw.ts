export interface SseEmitter {
  send: (type: string, delta: string) => void;
  done: () => void;
  error: (msg: string) => void;
}

export interface OpenClawMessage {
  externalId: string;
  role: string;
  text: string;
  thinking: string | null;
  timestamp: string | null;
}

export interface OpenClawSession {
  sessionKey: string;
  sessionId: string;
  updatedAt: number;
  label: string | null;
  firstMessage: string | null;
}
