import { execSync, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY_DIR = path.join(ROOT, 'proxy');
const PID_FILE = path.join(ROOT, '.proxy.pid');

const NETWORK = 'openclaw-net';
const CONTAINERS = ['openclaw-mongo', 'openclaw-api', 'openclaw-client'];

function run(cmd, args = [], cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function runSilent(cmd, args = []) {
  try { execFileSync(cmd, args, { cwd: ROOT, stdio: 'ignore' }); } catch { /* ignore */ }
}

function commandExists(cmd) {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

// 0. Preflight checks
if (!commandExists('docker')) {
  console.error('Error: Docker is not installed. Install it from https://docs.docker.com/get-docker/');
  process.exit(1);
}

try {
  execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch {
  console.error('Error: Docker is not running. Please start Docker Desktop and try again.');
  process.exit(1);
}

// 1. Generate env files (idempotent)
console.log('Setting up environment...');
run('node', [path.join(ROOT, 'scripts', 'setup.js')]);

// 2. Install proxy dependencies
console.log('\nInstalling proxy dependencies...');
run('npm', ['install'], PROXY_DIR);

// 3. Build images (Docker layer cache makes this instant after first build)
console.log('\nBuilding Docker images...');
run('docker', ['build', '-t', 'openclaw-api', path.join(ROOT, 'api')]);
run('docker', ['build', '-t', 'openclaw-client', '--target', 'app', path.join(ROOT, 'client')]);

// 4. Create network
runSilent('docker', ['network', 'create', NETWORK]);

// 5. Stop and remove any existing containers
for (const name of CONTAINERS) {
  runSilent('docker', ['rm', '-f', name]);
}

// 6. Read env files
const rootEnv = readEnvFile(path.join(ROOT, '.env'));
const apiEnvPath = path.join(ROOT, 'api', '.env');

// 7. Start MongoDB
console.log('\nStarting MongoDB...');
run('docker', [
  'run', '-d',
  '--name', 'openclaw-mongo',
  '--network', NETWORK,
  '--network-alias', 'mongo',
  '-e', `MONGO_INITDB_ROOT_USERNAME=${rootEnv.MONGO_USER}`,
  '-e', `MONGO_INITDB_ROOT_PASSWORD=${rootEnv.MONGO_PASSWORD}`,
  '-v', 'openclaw-mongodata:/data/db',
  '-p', '27017:27017',
  'mongo:latest',
]);

// 8. Start API
console.log('Starting API...');
run('docker', [
  'run', '-d',
  '--name', 'openclaw-api',
  '--network', NETWORK,
  '--env-file', apiEnvPath,
  '-e', 'OPENCLAW_PROXY_URL=http://host.docker.internal:18801',
  '--add-host', 'host.docker.internal:host-gateway',
  '-p', '18802:18802',
  'openclaw-api',
]);

// 9. Start Client
console.log('Starting Client...');
run('docker', [
  'run', '-d',
  '--name', 'openclaw-client',
  '--network', NETWORK,
  '-p', '18800:18800',
  'openclaw-client',
  'npm', 'run', 'dev',
]);

// 10. Kill stale proxy if PID file exists
if (fs.existsSync(PID_FILE)) {
  try {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    process.kill(oldPid);
  } catch { /* already dead */ }
  fs.unlinkSync(PID_FILE);
}

// 11. Start the proxy (detached so it survives this script exiting)
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
