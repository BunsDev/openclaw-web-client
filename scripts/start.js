import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'api');
const CLIENT_DIR = path.join(ROOT, 'client');
const LOG_FILE = path.join(ROOT, 'openclaw.log');

function run(cmd, args = [], cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: 'pipe' });
}

// 1. Setup env (idempotent)
run('node', [path.join(ROOT, 'scripts', 'setup.js')]);

// 2. Install dependencies
if (!fs.existsSync(path.join(API_DIR, 'node_modules'))) {
  process.stdout.write('📦 Installing API dependencies...\n');
  run('npm', ['install'], API_DIR);
}
if (!fs.existsSync(path.join(CLIENT_DIR, 'node_modules'))) {
  process.stdout.write('📦 Installing Client dependencies...\n');
  run('npm', ['install'], CLIENT_DIR);
}

// 3. Build both
process.stdout.write('🔨 Building...\n');
run('npm', ['run', 'build'], API_DIR);
run('npm', ['run', 'build'], CLIENT_DIR);

// 4. Start both detached — output goes to log file
const logFd = fs.openSync(LOG_FILE, 'w');

const api = spawn('npm', ['start'], {
  cwd: API_DIR,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env, NODE_ENV: 'production' },
  detached: true,
});

const client = spawn('npm', ['start'], {
  cwd: CLIENT_DIR,
  stdio: ['ignore', logFd, logFd],
  detached: true,
});

api.unref();
client.unref();
fs.closeSync(logFd);

console.log();
console.log('  🚀 OpenClaw Client is running!');
console.log();
console.log('     🌐  http://localhost:18800');
console.log();
console.log('  📄 Logs: openclaw.log');
console.log('  🛑 Stop: npm run stop');
console.log();
