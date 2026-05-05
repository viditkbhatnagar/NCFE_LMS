import * as fs from 'fs';
import * as path from 'path';

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const envFile = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envFile)) return;
  const raw = fs.readFileSync(envFile, 'utf8');
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
