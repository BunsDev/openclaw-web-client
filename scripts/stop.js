import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PID_FILE = path.join(ROOT, '.proxy.pid');

const CONTAINERS = ['openclaw-mongo', 'openclaw-api', 'openclaw-client'];
const NETWORK = 'openclaw-net';

function runSilent(cmd, args = []) {
  try { execFileSync(cmd, args, { cwd: ROOT, stdio: 'ignore' }); } catch { /* ignore */ }
}

console.log('Stopping openclaw client...\n');

// Stop and remove containers
console.log('Stopping Docker containers...');
for (const name of CONTAINERS) {
  runSilent('docker', ['rm', '-f', name]);
}

// Remove network
runSilent('docker', ['network', 'rm', NETWORK]);
console.log('Docker containers stopped.');

// Also stop any compose containers (in case `npm run dev` was used)
runSilent('docker', ['compose', 'down']);

// Stop proxy
console.log('\nStopping OpenClaw proxy...');
if (fs.existsSync(PID_FILE)) {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    process.kill(pid);
    console.log('Proxy stopped.');
  } catch {
    console.log('Proxy was not running.');
  }
  fs.unlinkSync(PID_FILE);
} else {
  try {
    execFileSync('pkill', ['-f', 'node proxy.js'], { stdio: 'ignore' });
    console.log('Proxy stopped.');
  } catch {
    console.log('Proxy was not running.');
  }
}

console.log('\nAll services stopped.');
