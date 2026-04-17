/* eslint-disable no-console */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { getOpenclawBin } from '../openclawGateway';
import { agentDir, agentsDir, agentWorkspacePath } from './paths';
import { execErrText } from '../../utils/errors';

const OPENCLAW_BIN = getOpenclawBin();

const CLI_OPTS = {
  cwd: os.homedir(),
  env: { ...process.env, NO_COLOR: '1' },
  timeout: 15000,
};

export interface AgentSummary {
  agentId: string;
  name: string;
  createdAt: Date;
}

export function listAgents(): AgentSummary[] {
  const root = agentsDir();
  if (!fs.existsSync(root)) return [];
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const aid = e.name;
        let name = aid;
        const identityPath = path.join(root, aid, 'identity.json');
        if (fs.existsSync(identityPath)) {
          try {
            const identity = JSON.parse(fs.readFileSync(identityPath, 'utf-8')) as {
              name?: string;
            };
            name = identity.name || aid;
          } catch {
            /* keep aid */
          }
        }
        const stat = fs.statSync(path.join(root, aid));
        return { agentId: aid, name, createdAt: stat.birthtime };
      });
  } catch {
    return [];
  }
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
    const output = execFileSync(
      OPENCLAW_BIN,
      ['agents', 'add', agentId, '--non-interactive', '--workspace', workspace, '--json'],
      CLI_OPTS
    ).toString();
    console.log(`[register] success: ${output.trim()}`);
    return { ok: true, output: output.trim() };
  } catch (err) {
    const stderr = execErrText(err);
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
    const output = execFileSync(OPENCLAW_BIN, args, CLI_OPTS).toString();
    console.log(`[set-identity] success: ${output.trim()}`);
    return { ok: true };
  } catch (err) {
    const stderr = execErrText(err);
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
    const output = execFileSync(
      OPENCLAW_BIN,
      ['agents', 'delete', agentId, '--force', '--json'],
      CLI_OPTS
    ).toString();
    console.log(`[remove] success: ${output.trim()}`);
    const dir = agentDir(agentId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[remove] cleaned up: ${dir}`);
    }
    return { ok: true };
  } catch (err) {
    const stderr = execErrText(err);
    console.error(`[remove] failed for "${agentId}":`, stderr);
    if (stderr.includes('not found') || stderr.includes('Unknown agent'))
      return { ok: true, notFound: true };
    return { ok: false, error: stderr };
  }
}
