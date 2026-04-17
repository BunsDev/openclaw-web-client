import path from 'path';
import { getOpenclawHome } from '../openclawGateway';

const OPENCLAW_HOME = getOpenclawHome();

export function agentsDir(): string {
  return path.join(OPENCLAW_HOME, 'agents');
}

export function agentDir(agentId: string): string {
  return path.join(OPENCLAW_HOME, 'agents', agentId);
}

export function agentWorkspacePath(agentId: string): string {
  return path.join(OPENCLAW_HOME, 'workspace', agentId);
}

export function sessionsFilePath(agentId: string): string {
  return path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
}

export function mediaInboundDir(): string {
  return path.join(OPENCLAW_HOME, 'media', 'inbound');
}

export function openclawConfigPath(): string {
  return path.join(OPENCLAW_HOME, 'openclaw.json');
}
