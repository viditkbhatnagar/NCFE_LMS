import './env';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RUN_META, resetRunMeta } from './run-id';

const COLLECTIONS_TO_TRACK = [
  'users',
  'centres',
  'qualifications',
  'units',
  'learningoutcomes',
  'assessmentcriterias',
  'enrolments',
  'assessments',
  'evidences',
  'coursedocuments',
  'learningmaterials',
  'workhourslogs',
  'personaldocuments',
  'iqasamples',
  'iqadecisions',
  'standardisationrecords',
  'notifications',
  'auditlogs',
  'remarks',
  'signoffs',
  'assessmentcriteriamaps',
  'assessmentevidencemaps',
];

interface BaselineSnapshot {
  runId: string;
  startedAt: string;
  databaseName: string;
  databaseHost: string;
  collections: Record<string, number>;
  expectedUserEmails: string[];
}

const TEST_USER_EMAILS = [
  'jyothi@learnerseducation.com',
  'bhatnagar007vidit@gmail.com',
  'intern@learnerseducation.com',
  'iqa@test.com',
  'admin@learnerseducation.com',
];

async function snapshotMongo(): Promise<BaselineSnapshot> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Could not get db handle from mongoose connection');

  const dbName = db.databaseName;
  const host = mongoose.connection.host;

  if (dbName !== 'ncfe_lms') {
    throw new Error(
      `[PREFLIGHT] Refusing to run: connected database is "${dbName}", expected "ncfe_lms".`,
    );
  }

  console.log(`[preflight] connected to ${host} / ${dbName}`);

  const counts: Record<string, number> = {};
  for (const coll of COLLECTIONS_TO_TRACK) {
    counts[coll] = await db.collection(coll).countDocuments();
  }

  // Verify expected users exist (cannot test against missing accounts)
  const users = db.collection('users');
  const presentEmails: string[] = [];
  for (const email of TEST_USER_EMAILS) {
    const found = await users.findOne({ email });
    if (found) presentEmails.push(email);
  }

  return {
    runId: RUN_META.runId,
    startedAt: RUN_META.startedAt,
    databaseName: dbName,
    databaseHost: host,
    collections: counts,
    expectedUserEmails: presentEmails,
  };
}

async function snapshotS3(userIds: string[]): Promise<Record<string, string[]>> {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const prefix = (process.env.AWS_S3_KEY_PREFIX || 'uploads').replace(/^\/+|\/+$/g, '');
  if (!region || !bucket) {
    throw new Error('AWS_REGION and AWS_S3_BUCKET must be set');
  }

  const s3 = new S3Client({ region });
  const out: Record<string, string[]> = {};

  for (const userId of userIds) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${prefix}/${userId}/`,
          ContinuationToken: token,
        }),
      );
      for (const obj of resp.Contents || []) {
        if (obj.Key) keys.push(obj.Key);
      }
      token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (token);
    out[userId] = keys;
  }

  return out;
}

async function getUserIds(emails: string[]): Promise<Record<string, string>> {
  const db = mongoose.connection.db!;
  const users = db.collection('users');
  const map: Record<string, string> = {};
  for (const email of emails) {
    const u = await users.findOne({ email });
    if (u) map[email] = String(u._id);
  }
  return map;
}

async function main() {
  // Reset RUN_ID for a fresh run
  const meta = resetRunMeta();
  console.log(`[preflight] RUN_ID=${meta.runId}`);

  const snapshot = await snapshotMongo();
  const userIdMap = await getUserIds(snapshot.expectedUserEmails);
  const s3Snapshot = await snapshotS3(Object.values(userIdMap));

  const baselinePath = path.join(__dirname, 'baseline.json');
  const s3BaselinePath = path.join(__dirname, 'baseline-s3.json');
  const userIdMapPath = path.join(__dirname, 'baseline-user-ids.json');

  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(s3BaselinePath, JSON.stringify(s3Snapshot, null, 2));
  fs.writeFileSync(userIdMapPath, JSON.stringify(userIdMap, null, 2));

  console.log('\n[preflight] Mongo baseline (counts):');
  for (const [coll, n] of Object.entries(snapshot.collections)) {
    console.log(`  ${coll.padEnd(28)} ${n}`);
  }
  console.log('\n[preflight] User ID map:');
  for (const [email, id] of Object.entries(userIdMap)) {
    console.log(`  ${email.padEnd(40)} ${id}`);
  }
  console.log('\n[preflight] S3 baseline keys (per user):');
  for (const [uid, keys] of Object.entries(s3Snapshot)) {
    console.log(`  ${uid}: ${keys.length} keys`);
  }

  await mongoose.disconnect();
  console.log('\n[preflight] OK — baseline written.');
}

// Playwright globalSetup signature
export default async function globalSetup() {
  await main();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[preflight] FAILED:', err);
    process.exit(1);
  });
}
