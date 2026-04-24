/* eslint-disable no-console */
import fs from 'fs';
import os from 'os';
import {
  AgentProviderModel,
  AgentProviderModelsResponse,
  OpenclawAgentEntry,
  OpenclawConfig,
} from '../../@types/openclaw';
import { gateway, ocExec } from '../openclawGateway';
import { openclawConfigPath } from './paths';
import { errMsg, execErrText } from '../../utils/errors';

const CLI_OPTS = {
  cwd: os.homedir(),
  env: { ...process.env, NO_COLOR: '1' } as NodeJS.ProcessEnv,
  timeout: 20000,
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

function extractModelString(entry: OpenclawAgentEntry | undefined): string | null {
  const m = entry?.model;
  if (!m) return null;
  if (typeof m === 'string') return m;
  if (typeof m === 'object') return m.primary ?? null;
  return null;
}

/** `provider/model` → `provider`. Returns null when slashless (local, alias, etc.). */
function parseProvider(modelKey: string | null): string | null {
  if (!modelKey) return null;
  const idx = modelKey.indexOf('/');
  return idx > 0 ? modelKey.slice(0, idx) : null;
}

interface OcModelsListRow {
  key?: string;
  name?: string;
  contextWindow?: number;
  input?: string;
  local?: boolean;
  available?: boolean;
  missing?: boolean;
  tags?: string[];
}

/**
 * Per-provider memoisation of the CLI catalog. `openclaw models list --all
 * --provider <id> --json` costs ~1.5–2s per invocation and the result is
 * effectively static per OpenClaw build, so we cache by provider for a short
 * window. Model swaps mutate config but never the catalog, so no explicit
 * invalidation is needed — the TTL covers both "new build installed" and
 * "user configured a new alias" cases.
 */
const PROVIDER_MODELS_TTL_MS = 5 * 60 * 1000;
const providerModelsCache = new Map<string, { at: number; models: AgentProviderModel[] }>();

function listProviderModelsViaCli(provider: string): AgentProviderModel[] {
  const cached = providerModelsCache.get(provider);
  if (cached && Date.now() - cached.at < PROVIDER_MODELS_TTL_MS) {
    return cached.models;
  }
  try {
    const out = ocExec(['models', 'list', '--provider', provider, '--all', '--json'], {
      ...CLI_OPTS,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(out) as { models?: OcModelsListRow[] };
    const rows = Array.isArray(parsed?.models) ? parsed.models : [];
    const models = rows
      .filter((r): r is OcModelsListRow & { key: string } => typeof r?.key === 'string' && !!r.key)
      .map((r) => ({
        key: r.key,
        name: typeof r.name === 'string' && r.name ? r.name : r.key,
        contextWindow: typeof r.contextWindow === 'number' ? r.contextWindow : null,
        local: !!r.local,
        available: !!r.available,
        missing: !!r.missing,
        tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    providerModelsCache.set(provider, { at: Date.now(), models });
    return models;
  } catch (err) {
    console.error('[agent-provider-models] list failed:', execErrText(err));
    return cached?.models ?? [];
  }
}

export function getAgentProviderModels(openclawAgentId: string): AgentProviderModelsResponse {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  const entry = agentIndex >= 0 ? config?.agents?.list?.[agentIndex] : undefined;
  const currentModel =
    extractModelString(entry) ??
    (typeof config?.agents?.defaults?.model?.primary === 'string'
      ? (config.agents.defaults.model.primary as string)
      : null);
  const provider = parseProvider(currentModel);

  return {
    agentId: openclawAgentId,
    known: agentIndex >= 0,
    currentModel,
    provider,
    models: provider ? listProviderModelsViaCli(provider) : [],
  };
}

export interface SetAgentProviderModelResult {
  ok: boolean;
  error?: string;
  restartHint?: string | null;
  config?: AgentProviderModelsResponse;
}

/**
 * Hot-apply a model change for the given agent. Uses the Gateway RPC
 * `agents.update` so the daemon's in-memory registry picks it up, then clears
 * any pinned `modelOverride` on the active session (if any) via
 * `sessions.patch { key, model: null }` so the next turn honours the new
 * agent default. Falls back to the CLI when the gateway is unreachable.
 */
export async function setAgentProviderModel(
  openclawAgentId: string,
  modelKey: string,
  sessionKey: string | null
): Promise<SetAgentProviderModelResult> {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  if (agentIndex < 0) {
    return { ok: false, error: `Agent "${openclawAgentId}" not found in openclaw config.` };
  }

  const trimmed = modelKey.trim();
  if (!trimmed) {
    return { ok: false, error: '"model" must be a non-empty string.' };
  }

  let restartHint: string | null = null;
  let wroteViaGateway = false;

  const gwReady = await gateway.ensureConnected();
  if (gwReady) {
    try {
      await gateway.request(
        'agents.update',
        { agentId: openclawAgentId, model: trimmed },
        { timeoutMs: 5000 }
      );
      wroteViaGateway = true;
    } catch (err) {
      console.warn('[agent-provider-models] agents.update failed, falling back:', errMsg(err));
    }
  }

  if (!wroteViaGateway) {
    try {
      const cfgPath = `agents.list[${agentIndex}].model`;
      ocExec(['config', 'set', cfgPath, JSON.stringify(trimmed), '--strict-json'], CLI_OPTS);
      restartHint = 'Restart the gateway or start a new conversation to apply.';
    } catch (err) {
      const stderr = execErrText(err);
      return { ok: false, error: stderr || 'Failed to update agent model.' };
    }
  }

  if (wroteViaGateway && sessionKey) {
    try {
      const fullKey = `agent:${openclawAgentId}:${sessionKey}`;
      await gateway.request('sessions.patch', { key: fullKey, model: null }, { timeoutMs: 5000 });
    } catch (err) {
      restartHint = `Session override could not be cleared: ${errMsg(err)}. Start a new conversation to apply.`;
    }
  }

  return {
    ok: true,
    restartHint,
    config: getAgentProviderModels(openclawAgentId),
  };
}
