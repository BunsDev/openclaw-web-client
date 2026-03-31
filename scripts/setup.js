import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = path.join(ROOT, 'api', '.env');
const ROOT_ENV = path.join(ROOT, '.env');

if (fs.existsSync(API_ENV)) {
  console.log(`${API_ENV} already exists; skipping setup.`);
  process.exit(0);
}

const MONGO_USER = 'openclaw';
const MONGO_PASSWORD = crypto.randomBytes(16).toString('hex');
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

fs.writeFileSync(
  ROOT_ENV,
  `MONGO_USER=${MONGO_USER}\nMONGO_PASSWORD=${MONGO_PASSWORD}\n`,
);

fs.writeFileSync(
  API_ENV,
  [
    `NODE_ENV=development`,
    `JWT_SECRET=${JWT_SECRET}`,
    `MONGO_LINK=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/openClawClient?authSource=admin`,
    '',
  ].join('\n'),
);

console.log('Environment files created.');
