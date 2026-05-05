import mongoose from 'mongoose';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// One-shot data cleanup: $unset the rolled-back `mustChangePassword` field
// on every user document that still carries it. Idempotent — running it
// again after rollback is a no-op (matchedCount === 0).
//
// Run once locally before pushing the G5 rollback commit:
//   npx tsx scripts/disable-must-change-password.ts

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local may not exist; that's fine if MONGODB_URI is already in env
  }
}

loadEnvFile(resolve(__dirname, '../.env.local'));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  const result = await mongoose.connection
    .collection('users')
    .updateMany(
      { mustChangePassword: { $exists: true } },
      { $unset: { mustChangePassword: '' } },
    );
  console.log(
    `disable-must-change-password: matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
