/* eslint-disable no-console */
import fs from 'fs';
import os from 'os';
import {
  AgentModelConfigResponse,
  AgentModelOption,
  OpenclawAgentEntry,
  OpenclawConfig,
} from '../../@types/openclaw';
import { ocExec } from '../openclawGateway';
import { openclawConfigPath } from './paths';
import { execErrText } from '../../utils/errors';

const CLI_OPTS = {
  cwd: os.homedir(),
  env: { ...process.env, NO_COLOR: '1' },
  timeout: 15000,
};

function readConfig(): OpenclawConfig | null {
  try {
    return JSON.parse(fs.readFileSync(openclawConfigPath(), 'utf-8')) as OpenclawConfig;
  } catch {
    return null;
  }
}

function findAgentIndex(config: OpenclawConfig | null, openclawAgentId: string): number {
  const list = config?.agents?.list ?? [];
  return list.findIndex((a) => a?.id === openclawAgentId);
}

function extractModel(entry: OpenclawAgentEntry | undefined): string | null {
  if (!entry?.model) return null;
  if (typeof entry.model === 'string') return entry.model;
  if (entry.model && typeof entry.model === 'object') return entry.model.primary || null;
  return null;
}

function listAvailableModels(config: OpenclawConfig | null): AgentModelOption[] {
  const models = config?.agents?.defaults?.models ?? {};
  return Object.entries(models).map(([key, val]) => ({
    key,
    alias: val && typeof val === 'object' && typeof val.alias === 'string' ? val.alias : null,
  }));
}

export function getAgentModelConfig(openclawAgentId: string): AgentModelConfigResponse {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  const list = config?.agents?.list ?? [];
  const entry = agentIndex >= 0 ? list[agentIndex] : undefined;

  const override = extractModel(entry);
  const systemDefault = config?.agents?.defaults?.model?.primary ?? null;

  return {
    agentId: openclawAgentId,
    known: agentIndex >= 0,
    override,
    systemDefault,
    effective: override ?? systemDefault,
    available: listAvailableModels(config),
  };
}

export interface SetAgentModelResult {
  ok: boolean;
  error?: string;
  config?: AgentModelConfigResponse;
}

export function setAgentModel(
  openclawAgentId: string,
  modelKey: string | null
): SetAgentModelResult {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  if (agentIndex < 0) {
    return { ok: false, error: `Agent "${openclawAgentId}" not found in openclaw config.` };
  }

  const path = `agents.list[${agentIndex}].model`;

  try {
    if (modelKey === null || modelKey === '') {
      try {
        ocExec(['config', 'unset', path], CLI_OPTS);
      } catch (err) {
        const stderr = execErrText(err);
        if (!/not found|does not exist/i.test(stderr)) throw err;
      }
    } else {
      const available = listAvailableModels(config).map((m) => m.key);
      if (!available.includes(modelKey)) {
        return {
          ok: false,
          error: `Model "${modelKey}" is not configured. Configure it via \`openclaw models\` first.`,
        };
      }
      ocExec(['config', 'set', path, JSON.stringify(modelKey), '--strict-json'], CLI_OPTS);
    }
  } catch (err) {
    const stderr = execErrText(err);
    console.error(`[agent-model] failed to set ${path}:`, stderr);
    return { ok: false, error: stderr || 'Failed to update agent model.' };
  }

  return { ok: true, config: getAgentModelConfig(openclawAgentId) };
}
