/**
 * Supervises API (18802) + static UI server (18800) under one launchd job.
 * Installed to ~/.openclaw_client/service-runner.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.dirname(fileURLToPath(import.meta.url));
const API_DIST = path.join(DIST, 'api');
const CLIENT_DIST = path.join(DIST, 'client');
const node = process.execPath;

const children = [];

function killAll(sig = 'SIGTERM') {
  for (const c of children) {
    try {
      c.kill(sig);
    } catch {
      /* ignore */
    }
  }
}

process.on('SIGTERM', () => {
  killAll();
  process.exit(0);
});
process.on('SIGINT', () => {
  killAll();
  process.exit(0);
});

const api = spawn(node, ['build/src/app.js'], {
  cwd: API_DIST,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit',
});

const client = spawn(node, ['serve.mjs'], {
  cwd: CLIENT_DIST,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit',
});

children.push(api, client);

function onChildExit(label, code, signal) {
  const err = signal ? 1 : code ?? 0;
  console.error(`[openclaw] ${label} exited${signal ? ` (signal ${signal})` : ` (code ${code})`}`);
  killAll();
  process.exit(err !== 0 ? 1 : 0);
}

api.on('exit', (code, signal) => onChildExit('api', code, signal));
client.on('exit', (code, signal) => onChildExit('client', code, signal));
