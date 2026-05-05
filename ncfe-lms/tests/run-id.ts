import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const META_PATH = path.join(__dirname, '.run-id.json');

export interface RunMeta {
  runId: string;
  startedAt: string;
  startedAtMs: number;
}

function generate(): RunMeta {
  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getUTCDate()).padStart(2, '0') +
    '-' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex');
  return {
    runId: `E2E-${stamp}-${suffix}`,
    startedAt: now.toISOString(),
    startedAtMs: now.getTime(),
  };
}

export function getRunMeta(): RunMeta {
  if (fs.existsSync(META_PATH)) {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8')) as RunMeta;
  }
  const meta = generate();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

export function resetRunMeta(): RunMeta {
  if (fs.existsSync(META_PATH)) fs.unlinkSync(META_PATH);
  return getRunMeta();
}

export const RUN_META = getRunMeta();
export const RUN_ID = RUN_META.runId;
export const RUN_STARTED_AT_MS = RUN_META.startedAtMs;
