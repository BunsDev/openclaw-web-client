import { WebSocket as WsWebSocket } from 'ws';
import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function derivePublicKeyRaw(pem: string): Buffer {
  const key = crypto.createPublicKey(pem);
  const spki = key.export({ type: 'spki', format: 'der' });
  return spki.subarray(spki.length - 32);
}

function signPayload(privPem: string, payload: string): string {
  return base64UrlEncode(
    crypto.sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(privPem))
  );
}

interface DeviceCredentials {
  deviceId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

interface AuthCredentials {
  tokens?: {
    operator?: {
      scopes?: string[];
      token?: string;
    };
  };
}

interface GatewayCredentials {
  device: DeviceCredentials;
  auth: AuthCredentials;
  gatewayPort: number;
}

export function loadGatewayCredentials(): GatewayCredentials | null {
  try {
    const identityPath = path.join(OPENCLAW_HOME, 'identity', 'device.json');
    const authPath = path.join(OPENCLAW_HOME, 'identity', 'device-auth.json');
    const configPath = path.join(OPENCLAW_HOME, 'openclaw.json');
    const device = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { device, auth, gatewayPort: config.gateway?.port || 18789 };
  } catch (err: any) {
    console.warn('[gateway] could not load credentials:', err.message);
    return null;
  }
}

interface PendingRequest {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  expectFinal: boolean;
  runId?: string;
}

type EventListener = (msg: any) => void;

export class GatewayClient {
  ws: WsWebSocket | null = null;

  authenticated = false;

  pending = new Map<string, PendingRequest>();

  eventListeners = new Map<string, EventListener>();

  credentials: GatewayCredentials | null = null;

  reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connectPromise: Promise<boolean> | null = null;

  async ensureConnected(): Promise<boolean> {
    if (this.ws?.readyState === WsWebSocket.OPEN && this.authenticated) return true;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  _connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.credentials = loadGatewayCredentials();
      if (!this.credentials) {
        resolve(false);
        return;
      }

      const { device, auth, gatewayPort } = this.credentials;
      const url = `ws://127.0.0.1:${gatewayPort}`;
      console.log(`[gateway] connecting to ${url}...`);

      const ws = new WsWebSocket(url);
      this.ws = ws;
      this.authenticated = false;

      const timeout = setTimeout(() => {
        console.warn('[gateway] connect timeout');
        ws.close();
        resolve(false);
      }, 10000);

      ws.on('open', () => console.log('[gateway] ws open'));

      ws.on('message', (data: Buffer) => {
        let msg: any;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }

        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          const { nonce } = msg.payload;
          const role = 'operator';
          const scopes = auth.tokens?.operator?.scopes || [
            'operator.admin',
            'operator.read',
            'operator.write',
          ];
          const signedAtMs = Date.now();
          const deviceToken = auth.tokens?.operator?.token || '';
          const payload = [
            'v3',
            device.deviceId,
            'gateway-client',
            'backend',
            role,
            scopes.join(','),
            String(signedAtMs),
            deviceToken,
            nonce,
            process.platform,
            '',
          ].join('|');
          const signature = signPayload(device.privateKeyPem, payload);
          ws.send(
            JSON.stringify({
              type: 'req',
              id: crypto.randomUUID(),
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'gateway-client',
                  version: '1.0.0',
                  platform: process.platform,
                  mode: 'backend',
                },
                caps: [],
                role,
                scopes,
                auth: { deviceToken },
                device: {
                  id: device.deviceId,
                  publicKey: base64UrlEncode(derivePublicKeyRaw(device.publicKeyPem)),
                  signature,
                  signedAt: signedAtMs,
                  nonce,
                },
              },
            })
          );
          return;
        }

        if (msg.type === 'res') {
          if (!this.authenticated && msg.ok) {
            this.authenticated = true;
            clearTimeout(timeout);
            console.log('[gateway] authenticated');
            resolve(true);
            return;
          }
          if (!this.authenticated && !msg.ok) {
            clearTimeout(timeout);
            console.error('[gateway] auth failed:', msg.error);
            resolve(false);
            return;
          }
          const p = this.pending.get(msg.id);
          if (p) {
            if (p.expectFinal && msg.payload?.status === 'accepted') {
              p.runId = msg.payload.runId;
              return;
            }
            this.pending.delete(msg.id);
            if (msg.ok) p.resolve(msg.payload);
            else p.reject(new Error(msg.error?.message || 'gateway error'));
          }
          return;
        }

        if (msg.type === 'event') {
          this.eventListeners.forEach((listener) => listener(msg));
        }
      });

      ws.on('close', () => {
        console.log('[gateway] disconnected');
        this.authenticated = false;
        this.ws = null;
        this.pending.forEach((p) => p.reject(new Error('gateway disconnected')));
        this.pending.clear();
        this.eventListeners.clear();
        clearTimeout(timeout);
        if (!this.connectPromise) resolve(false);
        this._scheduleReconnect();
      });

      ws.on('error', (err: Error) => {
        console.error('[gateway] ws error:', err.message);
      });
    });
  }

  _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected().catch(() => {});
    }, 5000);
  }

  request(
    method: string,
    params: Record<string, any>,
    opts: { timeoutMs?: number; expectFinal?: boolean } = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WsWebSocket.OPEN) {
        reject(new Error('gateway not connected'));
        return;
      }
      const id = crypto.randomUUID();
      const timeoutMs = opts.timeoutMs || 120000;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('timeout'));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v: any) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
        expectFinal: opts.expectFinal || false,
      });
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  onEvent(key: string, fn: EventListener): void {
    this.eventListeners.set(key, fn);
  }

  offEvent(key: string): void {
    this.eventListeners.delete(key);
  }
}

export const gateway = new GatewayClient();

export async function ensureDevicePaired(): Promise<void> {
  const creds = loadGatewayCredentials();
  const scopes = creds?.auth?.tokens?.operator?.scopes || [];
  if (scopes.includes('operator.write')) {
    console.log('[setup] device-auth already has operator.write');
    return;
  }

  console.log('[setup] device-auth missing operator.write — auto-pairing...');
  const opts = { cwd: os.homedir(), env: { ...process.env, NO_COLOR: '1' }, timeout: 15000 };

  try {
    execSync('openclaw gateway call health --json 2>/dev/null', opts);
  } catch {
    /* may fail with pairing required */
  }

  try {
    const out = execSync('openclaw devices approve --latest --json 2>&1', opts).toString();
    console.log(
      '[setup] approved pending device:',
      out.includes('"requestId"') ? 'ok' : out.trim().slice(0, 200)
    );
  } catch (err: any) {
    const msg = err.stderr?.toString() || err.stdout?.toString() || err.message;
    if (msg.includes('no pending')) {
      console.log('[setup] no pending pairing requests');
    } else {
      console.warn('[setup] approve failed:', msg.slice(0, 200));
    }
  }

  try {
    execSync('openclaw gateway call health --json 2>/dev/null', opts);
  } catch {
    /* non-critical */
  }

  const updated = loadGatewayCredentials();
  const newScopes = updated?.auth?.tokens?.operator?.scopes || [];
  if (newScopes.includes('operator.write')) {
    console.log('[setup] device-auth now has operator.write — gateway fast-path enabled');
  } else {
    console.warn(
      '[setup] device-auth still missing operator.write — will use CLI fallback for chat'
    );
  }
}

export function getOpenclawHome(): string {
  return OPENCLAW_HOME;
}
