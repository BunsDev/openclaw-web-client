#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, realpathSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploy } from './build-dist.mjs';
import {
  bootoutLaunchAgent,
  bootstrapLaunchAgent,
  getLaunchdDomain,
  getPlistPath,
  kickstartLaunchAgent,
  launchAgentIsLoaded,
  LAUNCH_AGENT_LABEL,
  removePlistFile,
  writeLaunchAgentPlist,
} from './launchd.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(os.homedir(), '.openclaw_client');
const LEGACY_DIST = path.join(os.homedir(), '.openclaw_client');
const API_DIST = path.join(DIST, 'api');
const CLIENT_DIST = path.join(DIST, 'client');
const DATA_DIR = path.join(DIST, 'data');
const LOG_FILE = path.join(DIST, 'openclaw.log');
const PORTS = [18800, 18802];

// ── helpers ──────────────────────────────────────────────────────────────────

function isDarwin() {
  return process.platform === 'darwin';
}

function killPorts() {
  for (const port of PORTS) {
    try {
      const pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim();
      for (const p of pids.split('\n').filter(Boolean)) {
        try { process.kill(+p); } catch { /* gone */ }
      }
    } catch { /* free */ }
  }
}

function portListening(port) {
  try {
    const out = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim();
    return out.length > 0;
  } catch { return false; }
}

function linkGlobal() {
  execFileSync('npm', ['link'], { cwd: ROOT, stdio: 'pipe' });
}

function unlinkGlobal() {
  try { execFileSync('npm', ['unlink', '-g', 'openclaw-client'], { stdio: 'pipe' }); } catch { /* ok */ }
}

function assertBuilt() {
  const required = [
    path.join(API_DIST, 'build', 'src', 'app.js'),
    path.join(CLIENT_DIST, 'serve.mjs'),
    path.join(CLIENT_DIST, 'dist'),
    path.join(DIST, 'service-runner.mjs'),
  ];
  const missing = required.filter((f) => !existsSync(f));
  if (missing.length) {
    console.log('❌ No build found. Run `npm start` from the openclaw_client repo first.');
    process.exit(1);
  }
}

function installLaunchd() {
  const runner = path.join(DIST, 'service-runner.mjs');
  writeLaunchAgentPlist({
    nodePath: process.execPath,
    runnerPath: runner,
    workDir: DIST,
    stdoutPath: LOG_FILE,
    stderrPath: path.join(DIST, 'openclaw.err.log'),
  });
  bootoutLaunchAgent();
  bootstrapLaunchAgent();
}

function detachStart() {
  const fd = openSync(LOG_FILE, 'w');
  const api = spawn('node', ['build/src/app.js'], { cwd: API_DIST, stdio: ['ignore', fd, fd], env: { ...process.env, NODE_ENV: 'production' }, detached: true });
  const client = spawn('node', ['serve.mjs'], { cwd: CLIENT_DIST, stdio: ['ignore', fd, fd], env: { ...process.env, NODE_ENV: 'production' }, detached: true });
  api.unref();
  client.unref();
  closeSync(fd);
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── commands ─────────────────────────────────────────────────────────────────

/** npm start only — full build + deploy + launchd + global link */
export function fullStart() {
  deploy();
  killPorts();

  if (isDarwin()) {
    installLaunchd();
  } else {
    detachStart();
  }

  linkGlobal();

  console.log('');
  console.log('  🚀 OpenClaw Client is running');
  console.log('  🌐 http://localhost:18800');
  if (isDarwin()) console.log('  🔄 Starts automatically on login (LaunchAgent)');
  console.log('  📁 ~/.openclaw_client');
  console.log('  🛠️  openclaw_client status | stop | restart | uninstall');
  console.log('');
}

/** openclaw_client start — run from existing build only */
function cmdStart() {
  assertBuilt();
  killPorts();

  if (isDarwin()) {
    installLaunchd();
  } else {
    detachStart();
  }

  console.log('');
  console.log('  🚀 OpenClaw Client started');
  console.log('  🌐 http://localhost:18800');
  console.log('');
}

function cmdStop() {
  if (isDarwin()) bootoutLaunchAgent();
  killPorts();
  console.log('  🛑 OpenClaw Client stopped');
}

function cmdRestart() {
  if (isDarwin()) {
    if (!existsSync(getPlistPath())) {
      console.log('❌ No LaunchAgent installed. Run `npm start` first.');
      return;
    }
    if (launchAgentIsLoaded()) {
      kickstartLaunchAgent();
    } else {
      bootstrapLaunchAgent();
    }
    console.log('  🔄 OpenClaw Client restarted');
    console.log('  🌐 http://localhost:18800');
    return;
  }
  cmdStop();
  cmdStart();
}

function cmdStatus() {
  console.log('');
  console.log('  📦 OpenClaw Client');
  console.log(`  📁 ${DIST}`);

  if (isDarwin()) {
    try {
      const out = execFileSync('launchctl', ['print', `${getLaunchdDomain()}/${LAUNCH_AGENT_LABEL}`], { encoding: 'utf-8' });
      const state = out.match(/^\s*state = (\S+)/m)?.[1] ?? 'unknown';
      const pid = out.match(/^\s*pid = (\d+)/m)?.[1];
      if (state === 'running') {
        console.log(`  ✅ LaunchAgent: running${pid ? ` (pid ${pid})` : ''}`);
      } else {
        console.log(`  ⚠️  LaunchAgent: ${state}`);
      }
    } catch {
      console.log('  ❌ LaunchAgent: not loaded');
    }
  }

  const api = portListening(18802);
  const ui = portListening(18800);
  console.log(`  ${api ? '✅' : '❌'} API:    port 18802 ${api ? '(listening)' : '(down)'}`);
  console.log(`  ${ui ? '✅' : '❌'} Client: port 18800 ${ui ? '(listening)' : '(down)'}`);
  console.log(`  📄 Logs: ~/.openclaw_client/openclaw.log`);
  console.log('');
}

async function cmdUninstall(args) {
  const purge = args.includes('--purge');

  if (purge) {
    const dbPath = path.join(DATA_DIR, 'openclaw.sqlite');
    const dbExists = existsSync(dbPath);
    if (dbExists) {
      console.log('');
      console.log('  ⚠️  --purge will delete your OpenClaw database:');
      console.log(`     ${dbPath}`);
      console.log('');
      const ok = await confirm('  Are you sure? (y/N) ');
      if (!ok) {
        console.log('  Cancelled.');
        return;
      }
    }
  }

  if (isDarwin()) {
    bootoutLaunchAgent();
    removePlistFile();
  }
  killPorts();
  unlinkGlobal();

  if (existsSync(API_DIST)) rmSync(API_DIST, { recursive: true, force: true });
  if (existsSync(CLIENT_DIST)) rmSync(CLIENT_DIST, { recursive: true, force: true });
  const runner = path.join(DIST, 'service-runner.mjs');
  if (existsSync(runner)) rmSync(runner, { force: true });

  if (purge) {
    if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
    console.log('  🗑️  Uninstalled (all data removed)');
  } else {
    console.log('  🗑️  Uninstalled (database kept in ~/.openclaw_client/data)');
  }
}

// ── CLI entry ────────────────────────────────────────────────────────────────

function printUsage() {
  console.log(`
  OpenClaw Client

  npm start                    Build, deploy, register LaunchAgent, link global CLI
  openclaw_client <command>    Control running service (from any directory)

  Commands:
    start       Start servers from ~/.openclaw_client (no build)
    stop        Stop servers
    restart     Stop + start
    status      Show service status
    uninstall   Remove LaunchAgent, global CLI, api & client artifacts
    uninstall --purge   Also delete database (with confirmation)
`);
}

function isCliMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(import.meta.url);
  try { return realpathSync(path.resolve(entry)) === realpathSync(here); }
  catch { return path.resolve(entry) === path.resolve(here); }
}

if (isCliMain()) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === '-h' || cmd === '--help') {
    printUsage();
    process.exit(cmd ? 0 : 1);
  }

  try {
    switch (cmd) {
      case 'start': cmdStart(); break;
      case 'stop': cmdStop(); break;
      case 'restart': cmdRestart(); break;
      case 'status': cmdStatus(); break;
      case 'uninstall': await cmdUninstall(argv.slice(1)); break;
      default:
        console.error(`Unknown command: ${cmd}`);
        printUsage();
        process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
