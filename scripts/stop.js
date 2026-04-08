import { execFileSync } from 'node:child_process';

const PORTS = [18800, 18802];

console.log('Stopping openclaw services...\n');

for (const port of PORTS) {
  try {
    const pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim();
    if (pids) {
      for (const pid of pids.split('\n')) {
        try { process.kill(parseInt(pid, 10)); } catch { /* already gone */ }
      }
      console.log(`Stopped process on port ${port}.`);
    }
  } catch { /* port already free */ }
}

console.log('\nAll services stopped.');
