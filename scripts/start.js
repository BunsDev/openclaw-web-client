import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY_DIR = path.join(ROOT, 'proxy');
const PID_FILE = path.join(ROOT, '.proxy.pid');

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function commandExists(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 0. Preflight checks
if (!commandExists('docker')) {
  console.error('Error: Docker is not installed. Install it from https://docs.docker.com/get-docker/');
  process.exit(1);
}

try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  console.error('Error: Docker is not running. Please start Docker Desktop and try again.');
  process.exit(1);
}

// 1. Generate env files (idempotent — skips if they already exist)
console.log('Setting up environment...');
run('node scripts/setup.js');

// 2. Install proxy dependencies
console.log('\nInstalling proxy dependencies...');
run('npm install', PROXY_DIR);

// 3. Start Docker services
console.log('\nStarting Docker services...');
run('docker compose up -d');

// 4. Kill stale proxy if PID file exists
if (fs.existsSync(PID_FILE)) {
  try {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    process.kill(oldPid);
  } catch {
    // already dead — ignore
  }
  fs.unlinkSync(PID_FILE);
}

// 5. Start the proxy (detached so it survives this script exiting)
console.log('\nStarting OpenClaw proxy on host (port 18801)...');
const logFd = fs.openSync(path.join(PROXY_DIR, 'proxy.log'), 'a');
const proxy = spawn('node', ['proxy.js'], {
  cwd: PROXY_DIR,
  detached: true,
  stdio: ['ignore', logFd, logFd],
});
proxy.unref();
fs.writeFileSync(PID_FILE, String(proxy.pid));
console.log(`Proxy started (PID: ${proxy.pid}), log: proxy/proxy.log`);

console.log('\nAll services are up!');
console.log('  Client:  http://localhost:18800');
console.log('  API:     http://localhost:18802');
console.log('  Proxy:   http://localhost:18801 (host, runs openclaw CLI)');
