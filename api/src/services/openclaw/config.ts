import fs from 'fs';
import { OpenclawAgentEntry, OpenclawConfig } from '../../@types/openclaw';
import { openclawConfigPath } from './paths';

function readOpenclawConfig(): OpenclawConfig | null {
  try {
    return JSON.parse(fs.readFileSync(openclawConfigPath(), 'utf-8')) as OpenclawConfig;
  } catch {
    return null;
  }
}

function resolveModel(
  entry: OpenclawAgentEntry | undefined,
  fallback: string | null
): string | null {
  if (!entry?.model) return fallback;
  const { model } = entry;
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object') return model.primary || fallback;
  return fallback;
}

export function getAgentModelsForOpenclawIds(openclawIds: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const config = readOpenclawConfig();
  if (!config?.agents) {
    openclawIds.forEach((id) => {
      result[id] = null;
    });
    return result;
  }
  const list: OpenclawAgentEntry[] = config.agents.list || [];
  const fallback = config.agents.defaults?.model?.primary || null;

  openclawIds.forEach((agentId) => {
    const agentEntry = list.find((a) => a.id === agentId);
    result[agentId] = resolveModel(agentEntry, fallback);
  });
  return result;
}

export function getAgentModel(agentId: string): string | null {
  return getAgentModelsForOpenclawIds([agentId])[agentId] ?? null;
}
