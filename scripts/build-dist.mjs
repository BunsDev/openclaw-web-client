import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVE_MJS = `
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
`.trimStart();

export function deploy() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const API_SRC = path.join(root, 'api');
  const CLIENT_SRC = path.join(root, 'client');

  const dist = path.join(os.homedir(), '.openclaw_client');
  const apiDist = path.join(dist, 'api');
  const clientDist = path.join(dist, 'client');
  const dataDir = path.join(dist, 'data');

  function run(cmd, args = [], cwd = root) {
    execFileSync(cmd, args, { cwd, stdio: 'pipe' });
  }

  if (!existsSync(path.join(API_SRC, 'node_modules'))) {
    process.stdout.write('📦 Installing API dependencies...\n');
    run('npm', ['ci'], API_SRC);
  }
  if (!existsSync(path.join(CLIENT_SRC, 'node_modules'))) {
    process.stdout.write('📦 Installing Client dependencies...\n');
    run('npm', ['ci'], CLIENT_SRC);
  }

  process.stdout.write('🔨 Building...\n');
  run('npm', ['run', 'build'], API_SRC);
  run('npm', ['run', 'build'], CLIENT_SRC);

  mkdirSync(apiDist, { recursive: true });
  mkdirSync(clientDist, { recursive: true });

  cpSync(path.join(API_SRC, 'build'), path.join(apiDist, 'build'), { recursive: true, force: true });
  const ptyBridgeSrc = path.join(API_SRC, 'pty-bridge.py');
  if (existsSync(ptyBridgeSrc)) {
    cpSync(ptyBridgeSrc, path.join(apiDist, 'build', 'pty-bridge.py'), { force: true });
  }
  cpSync(path.join(API_SRC, 'package.json'), path.join(apiDist, 'package.json'));
  cpSync(path.join(API_SRC, 'package-lock.json'), path.join(apiDist, 'package-lock.json'));

  cpSync(path.join(CLIENT_SRC, 'dist'), path.join(clientDist, 'dist'), { recursive: true, force: true });

  mkdirSync(dataDir, { recursive: true });
  const canonicalDbPath = path.join(dataDir, 'openclaw.sqlite');

  const envDist = path.join(apiDist, '.env');
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
      if (line.startsWith('DB_PATH=')) { hasDbPath = true; return `DB_PATH=${canonicalDbPath}`; }
      return line;
    });
    if (!hasDbPath) updated.push(`DB_PATH=${canonicalDbPath}`);
    writeFileSync(envDist, updated.join('\n'));
  }

  if (!existsSync(canonicalDbPath)) {
    const legacyDb = [
      path.join(apiDist, 'build', 'data', 'openclaw.sqlite'),
      path.join(apiDist, 'data', 'openclaw.sqlite'),
    ].find((p) => existsSync(p));
    if (legacyDb) cpSync(legacyDb, canonicalDbPath);
  }

  writeFileSync(path.join(clientDist, 'serve.mjs'), SERVE_MJS);

  const runnerSrc = path.join(root, 'scripts', 'service-runner.mjs');
  if (existsSync(runnerSrc)) {
    cpSync(runnerSrc, path.join(dist, 'service-runner.mjs'), { force: true });
  }

  const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
  const updateDir = path.join(dist, 'update');

  if (!existsSync(path.join(updateDir, '.git'))) {
    process.stdout.write('📥 Setting up update source...\n');
    try {
      execFileSync('git', [
        'clone', '--depth', '1',
        'https://github.com/lotsoftick/openclaw_client.git', updateDir,
      ], { stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    } catch {
      process.stdout.write('  ⚠️  Could not clone update source (updates will use local repo)\n');
    }
  }

  const sourceRepo = existsSync(path.join(updateDir, 'package.json')) ? updateDir : root;
  writeFileSync(path.join(dist, 'meta.json'), JSON.stringify({
    version: rootPkg.version,
    sourceRepo,
  }));

  process.stdout.write('📦 Installing production dependencies...\n');
  run('npm', ['ci', '--omit=dev'], apiDist);
}
