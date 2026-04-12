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

export interface PendingRequest {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  expectFinal: boolean;
  runId?: string;
}

export type EventListener = (msg: any) => void;
