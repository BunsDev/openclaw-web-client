import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PID_FILE = path.join(ROOT, '.proxy.pid');

console.log('Stopping openclaw client...\n');

console.log('Stopping Docker services...');
execSync('docker compose down', { cwd: ROOT, stdio: 'inherit' });

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
  // Fallback: try pkill (macOS/Linux only)
  try {
    execSync('pkill -f "node proxy.js"', { stdio: 'ignore' });
    console.log('Proxy stopped.');
  } catch {
    console.log('Proxy was not running.');
  }
}

console.log('\nAll services stopped.');
