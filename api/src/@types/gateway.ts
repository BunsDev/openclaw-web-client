export interface DeviceCredentials {
  deviceId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface AuthCredentials {
  tokens?: {
    operator?: {
      scopes?: string[];
      token?: string;
    };
  };
}

export interface GatewayCredentials {
  device: DeviceCredentials;
  auth: AuthCredentials;
  gatewayPort: number;
}

// ── Wire protocol ──

export interface GwResponsePayloadAccepted {
  status: 'accepted';
  runId?: string;
}

export interface GwResponseMessage<P = unknown> {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: (P & Partial<GwResponsePayloadAccepted>) | GwResponsePayloadAccepted;
  error?: { message?: string; code?: string };
}

export interface GwConnectChallengePayload {
  nonce: string;
}

export interface GwAgentEventPayload {
  runId: string;
  stream?: 'assistant' | 'reasoning';
  data?: {
    delta?: boolean;
    text?: string;
  };
}

export interface GwEventMessage<P = unknown> {
  type: 'event';
  event: string;
  payload: P;
}

export type GwInboundMessage =
  | GwResponseMessage
  | GwEventMessage<GwConnectChallengePayload>
  | GwEventMessage<GwAgentEventPayload>
  | GwEventMessage<unknown>;

export type EventListener = (msg: GwInboundMessage) => void;

export interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  expectFinal: boolean;
  runId?: string;
}

export interface GatewayRequestOpts {
  timeoutMs?: number;
  expectFinal?: boolean;
}
