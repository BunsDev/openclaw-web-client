import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = path.join(ROOT, 'api');
const CLIENT_SRC = path.join(ROOT, 'client');

const DIST = path.join(os.homedir(), '.openclaw_client');
const API_DIST = path.join(DIST, 'api');
const CLIENT_DIST = path.join(DIST, 'client');
const LOG_FILE = path.join(DIST, 'openclaw.log');
const DATA_DIR = path.join(DIST, 'data');

function run(cmd, args = [], cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: 'pipe' });
}

// 1. Install source dependencies (needed for build)
if (!existsSync(path.join(API_SRC, 'node_modules'))) {
  process.stdout.write('📦 Installing API dependencies...\n');
  run('npm', ['ci'], API_SRC);
}
if (!existsSync(path.join(CLIENT_SRC, 'node_modules'))) {
  process.stdout.write('📦 Installing Client dependencies...\n');
  run('npm', ['ci'], CLIENT_SRC);
}

// 2. Build both in source
process.stdout.write('🔨 Building...\n');
run('npm', ['run', 'build'], API_SRC);
run('npm', ['run', 'build'], CLIENT_SRC);

// 3. Prepare ~/.openclaw_client
mkdirSync(API_DIST, { recursive: true });
mkdirSync(CLIENT_DIST, { recursive: true });

// Copy API build + package.json
cpSync(path.join(API_SRC, 'build'), path.join(API_DIST, 'build'), { recursive: true, force: true });
cpSync(path.join(API_SRC, 'package.json'), path.join(API_DIST, 'package.json'));
cpSync(path.join(API_SRC, 'package-lock.json'), path.join(API_DIST, 'package-lock.json'));

// Copy client dist
cpSync(path.join(CLIENT_SRC, 'dist'), path.join(CLIENT_DIST, 'dist'), { recursive: true, force: true });

mkdirSync(DATA_DIR, { recursive: true });
const canonicalDbPath = path.join(DATA_DIR, 'openclaw.sqlite');

const envDist = path.join(API_DIST, '.env');
if (!existsSync(envDist)) {
  writeFileSync(envDist, [
    'NODE_ENV=production',
    `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    `DB_PATH=${canonicalDbPath}`,
    'ALLOWED_DOMAIN=http://localhost:18800',
    '',
  ].join('\n'));
} else {
  const lines = readFileSync(envDist, 'utf-8').split('\n');
  let hasDbPath = false;
  const updated = lines.map((line) => {
    if (line.startsWith('DB_PATH=')) {
      hasDbPath = true;
      return `DB_PATH=${canonicalDbPath}`;
    }
    return line;
  });
  if (!hasDbPath) updated.push(`DB_PATH=${canonicalDbPath}`);
  writeFileSync(envDist, updated.join('\n'));
}

// One-time migration: old builds used api/build/data or api/data
if (!existsSync(canonicalDbPath)) {
  const legacyDb = [
    path.join(API_DIST, 'build', 'data', 'openclaw.sqlite'),
    path.join(API_DIST, 'data', 'openclaw.sqlite'),
  ].find((p) => existsSync(p));
  if (legacyDb) {
    cpSync(legacyDb, canonicalDbPath);
  }
}

// Create a lightweight static file server for the client
writeFileSync(path.join(CLIENT_DIST, 'serve.mjs'), `
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(path.dirname(new URL(import.meta.url).pathname), 'dist');
const PORT = 18800;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('client listening on port ' + PORT);
});
`.trimStart());

// 4. Install production-only API deps in dist
process.stdout.write('📦 Installing production dependencies...\n');
run('npm', ['ci', '--omit=dev'], API_DIST);

// 5. Start both detached
const logFd = openSync(LOG_FILE, 'w');

const api = spawn('node', ['build/src/app.js'], {
  cwd: API_DIST,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env, NODE_ENV: 'production' },
  detached: true,
});

const client = spawn('node', ['serve.mjs'], {
  cwd: CLIENT_DIST,
  stdio: ['ignore', logFd, logFd],
  detached: true,
});

api.unref();
client.unref();
closeSync(logFd);

console.log();
console.log('  🚀 OpenClaw Client is running!');
console.log();
console.log('     http://localhost:18800');
console.log();
console.log('  🛑 Stop: npm run stop');
console.log();
