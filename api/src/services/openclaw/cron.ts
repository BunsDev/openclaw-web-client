/* eslint-disable no-console */
import { CronJob, CronListResponse, CronOpResult } from '../../@types/cron';
import { ocExec } from '../openclawGateway';
import { withCache } from '../../utils/cache';
import { errMsg } from '../../utils/errors';

const CRON_CACHE_TTL = 60 * 1000;

const cronCache = withCache<CronListResponse>(CRON_CACHE_TTL, () => {
  const raw = ocExec(['cron', 'list', '--all', '--json'], {
    encoding: 'utf-8',
    timeout: 30000,
  });
  const parsed = JSON.parse(raw) as { jobs?: CronJob[]; total?: number };
  return { jobs: parsed.jobs || [], total: parsed.total || 0 };
});

export function listCronJobs(): CronListResponse {
  try {
    return cronCache.get();
  } catch (err) {
    console.error('[cron] failed to list cron jobs:', errMsg(err));
    return cronCache.peek() ?? { jobs: [], total: 0 };
  }
}

export function addCronJob(opts: Record<string, string>): CronOpResult {
  try {
    const args = ['cron', 'add'];
    Object.entries(opts).forEach(([key, val]) => {
      if (!val) return;
      if (val === 'true') args.push(`--${key}`);
      else args.push(`--${key}`, val);
    });
    ocExec(args, { encoding: 'utf-8', timeout: 30000 });
    cronCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to add cron job' };
  }
}

export function removeCronJob(id: string): CronOpResult {
  try {
    ocExec(['cron', 'rm', id], { encoding: 'utf-8', timeout: 15000 });
    cronCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to remove cron job' };
  }
}

export function toggleCronJob(id: string, enable: boolean): CronOpResult {
  try {
    const cmd = enable ? 'enable' : 'disable';
    ocExec(['cron', cmd, id], { encoding: 'utf-8', timeout: 15000 });
    cronCache.invalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) || 'Failed to toggle cron job' };
  }
}
