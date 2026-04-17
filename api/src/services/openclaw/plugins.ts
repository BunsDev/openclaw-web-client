/* eslint-disable no-console */
import { execFileSync } from 'child_process';
import { PluginInfo } from '../../@types/plugin';
import { getOpenclawBin } from '../openclawGateway';
import { withCache } from '../../utils/cache';
import { errMsg } from '../../utils/errors';

const OPENCLAW_BIN = getOpenclawBin();
const PLUGINS_CACHE_TTL = 5 * 60 * 1000;

interface RawPlugin {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  status?: string;
  origin?: string;
  enabled?: boolean;
  toolNames?: unknown;
  hookNames?: unknown;
}

function parsePluginList(raw: string): PluginInfo[] {
  const parsed = JSON.parse(raw) as { plugins?: RawPlugin[] };
  return (parsed.plugins || []).map((p) => ({
    id: String(p.id || ''),
    name: String(p.name || p.id || ''),
    description: String(p.description || ''),
    version: String(p.version || ''),
    status: String(p.status || 'unknown'),
    origin: String(p.origin || 'unknown'),
    enabled: Boolean(p.enabled),
    toolNames: Array.isArray(p.toolNames) ? p.toolNames.map(String) : [],
    hookNames: Array.isArray(p.hookNames) ? p.hookNames.map(String) : [],
  }));
}

const pluginsCache = withCache<PluginInfo[]>(PLUGINS_CACHE_TTL, () => {
  const raw = execFileSync(OPENCLAW_BIN, ['plugins', 'list', '--json'], {
    encoding: 'utf-8',
    timeout: 30000,
  });
  return parsePluginList(raw);
});

export function listPlugins(): PluginInfo[] {
  try {
    return pluginsCache.get();
  } catch (err) {
    console.error('[plugins] failed to list plugins:', errMsg(err));
    return pluginsCache.peek() ?? [];
  }
}

export function togglePlugin(pluginId: string, enable: boolean): { ok: boolean; error?: string } {
  try {
    const cmd = enable ? 'enable' : 'disable';
    execFileSync(OPENCLAW_BIN, ['plugins', cmd, pluginId], {
      encoding: 'utf-8',
      timeout: 15000,
    });
    pluginsCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to toggle plugin' };
  }
}
