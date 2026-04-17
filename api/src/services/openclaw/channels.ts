/* eslint-disable no-console */
import { execFileSync } from 'child_process';
import { ChannelAuth, ChannelChat, ChannelOpResult, ChannelsResponse } from '../../@types/channel';
import { getOpenclawBin } from '../openclawGateway';
import { withCache } from '../../utils/cache';
import { errMsg } from '../../utils/errors';

const OPENCLAW_BIN = getOpenclawBin();
const CHANNELS_CACHE_TTL = 10 * 60 * 1000;

interface RawChannelAuth {
  id?: string;
  provider?: string;
  type?: string;
  isExternal?: boolean;
}

interface RawChannelsResponse {
  chat?: Record<string, unknown>;
  auth?: RawChannelAuth[];
}

const channelsCache = withCache<ChannelsResponse>(CHANNELS_CACHE_TTL, () => {
  const raw = execFileSync(OPENCLAW_BIN, ['channels', 'list', '--json', '--no-usage'], {
    encoding: 'utf-8',
    timeout: 30000,
  });
  const parsed = JSON.parse(raw) as RawChannelsResponse;
  const chat: ChannelChat[] = Object.entries(parsed.chat || {}).map(([key, val]) => ({
    id: key,
    provider: key,
    enabled: true,
    ...(typeof val === 'object' && val !== null ? (val as Record<string, unknown>) : {}),
  }));
  const auth: ChannelAuth[] = (parsed.auth || []).map((a) => ({
    id: String(a.id || ''),
    provider: String(a.provider || ''),
    type: String(a.type || ''),
    isExternal: Boolean(a.isExternal),
  }));
  return { chat, auth };
});

export function listChannels(): ChannelsResponse {
  try {
    return channelsCache.get();
  } catch (err) {
    console.error('[channels] failed to list channels:', errMsg(err));
    return channelsCache.peek() ?? { chat: [], auth: [] };
  }
}

export function addChannel(channel: string, opts: Record<string, string>): ChannelOpResult {
  try {
    const args = ['channels', 'add', '--channel', channel];
    Object.entries(opts).forEach(([key, val]) => {
      if (val) args.push(`--${key}`, val);
    });
    execFileSync(OPENCLAW_BIN, args, { encoding: 'utf-8', timeout: 30000 });
    channelsCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to add channel' };
  }
}

export function removeChannel(channel: string, account?: string): ChannelOpResult {
  try {
    const args = ['channels', 'remove', '--channel', channel, '--delete'];
    if (account) args.push('--account', account);
    execFileSync(OPENCLAW_BIN, args, { encoding: 'utf-8', timeout: 15000 });
    channelsCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to remove channel' };
  }
}
