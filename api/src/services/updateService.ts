import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawn } from 'child_process';

const DIST = path.join(os.homedir(), '.openclaw_client');
const UPDATE_DIR = path.join(DIST, 'update');
const META_PATH = path.join(DIST, 'meta.json');
const REPO_HTTPS = 'https://github.com/lotsoftick/openclaw_client.git';
const REMOTE_URL = 'https://raw.githubusercontent.com/lotsoftick/openclaw_client/main/package.json';
const CHECK_INTERVAL = 2 * 60 * 60 * 1000;
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

interface VersionMeta {
  version: string;
  sourceRepo: string;
}

interface UpdateStatus {
  available: boolean;
  current: string;
  latest: string;
  checkedAt: string | null;
}

let cached: UpdateStatus = {
  available: false,
  current: '0.0.0',
  latest: '0.0.0',
  checkedAt: null,
};

let updating = false;

function readLocalMeta(): VersionMeta {
  if (fs.existsSync(META_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    } catch {
      /* fall through */
    }
  }
  const devRoot = path.resolve(__dirname, '..', '..', '..');
  const devPkg = path.join(devRoot, 'package.json');
  if (fs.existsSync(devPkg)) {
    const pkg = JSON.parse(fs.readFileSync(devPkg, 'utf-8'));
    return { version: pkg.version || '0.0.0', sourceRepo: devRoot };
  }
  return { version: '0.0.0', sourceRepo: '' };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(REMOTE_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version || null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const meta = readLocalMeta();
  const remote = await fetchRemoteVersion();

  if (remote) {
    cached = {
      available: compareVersions(remote, meta.version) > 0,
      current: meta.version,
      latest: remote,
      checkedAt: new Date().toISOString(),
    };
  } else {
    cached = { ...cached, current: meta.version, checkedAt: new Date().toISOString() };
  }
  return cached;
}

export function getUpdateStatus(): UpdateStatus {
  return cached;
}

export function isUpdating(): boolean {
  return updating;
}

export async function applyUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (updating) return { ok: false, error: 'Update already in progress' };
  updating = true;

  try {
    if (fs.existsSync(path.join(UPDATE_DIR, '.git'))) {
      execFileSync('git', ['fetch', '--all'], {
        cwd: UPDATE_DIR,
        encoding: 'utf-8',
        timeout: 60000,
        env: GIT_ENV,
      });
      execFileSync('git', ['reset', '--hard', 'origin/main'], {
        cwd: UPDATE_DIR,
        encoding: 'utf-8',
        timeout: 30000,
        env: GIT_ENV,
      });
    } else {
      if (fs.existsSync(UPDATE_DIR)) {
        fs.rmSync(UPDATE_DIR, { recursive: true, force: true });
      }
      execFileSync('git', ['clone', '--depth', '1', REPO_HTTPS, UPDATE_DIR], {
        encoding: 'utf-8',
        timeout: 120000,
        env: GIT_ENV,
      });
    }
  } catch (err: any) {
    updating = false;
    return { ok: false, error: `git failed: ${err.message}` };
  }

  const startScript = path.join(UPDATE_DIR, 'scripts', 'start.js');
  if (!fs.existsSync(startScript)) {
    updating = false;
    return { ok: false, error: 'Update source missing start script' };
  }

  try {
    const logFile = path.join(DIST, 'update.log');
    const fd = fs.openSync(logFile, 'w');
    const child = spawn(process.execPath, [startScript], {
      cwd: UPDATE_DIR,
      detached: true,
      stdio: ['ignore', fd, fd],
      env: {
        ...process.env,
        PATH: [path.dirname(process.execPath), process.env.PATH || ''].filter(Boolean).join(':'),
      },
    });
    child.unref();
    fs.closeSync(fd);
  } catch (err: any) {
    updating = false;
    return { ok: false, error: `Failed to start update: ${err.message}` };
  }

  setTimeout(() => {
    updating = false;
  }, 300000);
  return { ok: true };
}

export function startUpdateChecker(): void {
  checkForUpdate().catch(() => {});
  setInterval(() => {
    checkForUpdate().catch(() => {});
  }, CHECK_INTERVAL);
}
