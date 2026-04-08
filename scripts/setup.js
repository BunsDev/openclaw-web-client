import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = path.join(ROOT, 'api', '.env');

if (fs.existsSync(API_ENV)) {
  console.log(`${API_ENV} already exists; skipping setup.`);
  process.exit(0);
}

const JWT_SECRET = crypto.randomBytes(32).toString('hex');

fs.writeFileSync(
  API_ENV,
  [
    `NODE_ENV=development`,
    `JWT_SECRET=${JWT_SECRET}`,
    `DB_PATH=./data/openclaw.sqlite`,
    `ALLOWED_DOMAIN=http://localhost:18800`,
    '',
  ].join('\n'),
);

console.log('Environment file created at api/.env');
