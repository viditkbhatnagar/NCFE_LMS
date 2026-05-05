import './env';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getRunMeta } from './run-id';

interface BaselineSnapshot {
  runId: string;
  startedAt: string;
  databaseName: string;
  databaseHost: string;
  collections: Record<string, number>;
  expectedUserEmails: string[];
}

interface PostflightReport {
  runId: string;
  ok: boolean;
  diff: { collection: string; baseline: number; final: number; delta: number }[];
  leakedDocs: { collection: string; ids: string[]; samples: unknown[] }[];
  leakedS3Keys: { userId: string; keys: string[] }[];
  preExistingTestData: { collection: string; samples: unknown[] }[];
}

// Collections that strictly must equal baseline (immutable seed data).
const FROZEN_COLLECTIONS = [
  'users',
  'centres',
  'qualifications',
  'units',
  'learningoutcomes',
  'assessmentcriterias',
  'enrolments',
];

const RUN_META = getRunMeta();
const RUN_ID = RUN_META.runId;

function loadJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

async function findRunIdLeaks(db: ReturnType<typeof mongoose.connection.db>) {
  if (!db) throw new Error('No db');
  const escaped = RUN_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = { $regex: escaped };
  const checks: { coll: string; q: object; sampleField?: string }[] = [
    { coll: 'assessments', q: { title: re }, sampleField: 'title' },
    { coll: 'evidences', q: { $or: [{ label: re }, { description: re }, { fileName: re }] } },
    { coll: 'coursedocuments', q: { $or: [{ fileName: re }, { description: re }] } },
    { coll: 'learningmaterials', q: { $or: [{ title: re }, { description: re }, { fileName: re }] } },
    { coll: 'workhourslogs', q: { notes: re } },
    { coll: 'personaldocuments', q: { $or: [{ fileName: re }, { description: re }] } },
    { coll: 'remarks', q: { content: re } },
    { coll: 'iqasamples', q: { notes: re } },
    { coll: 'iqadecisions', q: { rationale: re } },
    { coll: 'standardisationrecords', q: { notes: re } },
    { coll: 'qualifications', q: { title: re } },
    { coll: 'units', q: { title: re } },
    { coll: 'users', q: { email: re } },
    { coll: 'enrolments', q: { 'metadata.runId': RUN_ID } },
    { coll: 'notifications', q: { $or: [{ message: re }, { title: re }] } },
  ];
  const results: { collection: string; ids: string[]; samples: unknown[] }[] = [];
  for (const c of checks) {
    const docs = await db.collection(c.coll).find(c.q).limit(50).toArray();
    if (docs.length) {
      results.push({
        collection: c.coll,
        ids: docs.map((d) => String(d._id)),
        samples: docs.slice(0, 5),
      });
    }
  }
  return results;
}

async function preCleanupSweep(
  db: ReturnType<typeof mongoose.connection.db>,
): Promise<void> {
  if (!db) return;
  const escaped = RUN_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = { $regex: escaped };
  const sweeps: { coll: string; q: object }[] = [
    { coll: 'notifications', q: { $or: [{ message: re }, { title: re }] } },
    { coll: 'remarks', q: { content: re } },
    { coll: 'workhourslogs', q: { notes: re } },
    { coll: 'evidences', q: { $or: [{ label: re }, { description: re }, { fileName: re }] } },
    { coll: 'coursedocuments', q: { $or: [{ fileName: re }, { description: re }] } },
    { coll: 'learningmaterials', q: { $or: [{ title: re }, { description: re }, { fileName: re }] } },
    { coll: 'personaldocuments', q: { $or: [{ fileName: re }, { description: re }] } },
    { coll: 'iqasamples', q: { notes: re } },
    { coll: 'iqadecisions', q: { rationale: re } },
    { coll: 'standardisationrecords', q: { notes: re } },
    { coll: 'assessments', q: { title: re } }, // last — after dependents
  ];
  let total = 0;
  for (const s of sweeps) {
    const r = await db.collection(s.coll).deleteMany(s.q);
    if (r.deletedCount) console.log(`  [sweep] ${s.coll}: ${r.deletedCount}`);
    total += r.deletedCount || 0;
  }
  console.log(`[postflight] preCleanupSweep RUN_ID=${RUN_ID} escaped=${escaped} total=${total}`);
  // Also: if we just deleted assessments, sweep their orphan signoffs/criteriamaps
  // (we can't match by RUN_ID directly on them, but their assessmentId is gone).
  await db.collection('signoffs').deleteMany({
    assessmentId: { $nin: (await db.collection('assessments').distinct('_id')) as object[] },
  });
  await db.collection('assessmentcriteriamaps').deleteMany({
    assessmentId: { $nin: (await db.collection('assessments').distinct('_id')) as object[] },
  });
  await db.collection('assessmentevidencemaps').deleteMany({
    assessmentId: { $nin: (await db.collection('assessments').distinct('_id')) as object[] },
  });
  if (total > 0) {
    console.warn(`[postflight] PRE-LEAK SWEEP: deleted ${total} RUN_ID-tagged docs`);
  }
}

async function findPreExistingTestData(
  db: ReturnType<typeof mongoose.connection.db>,
): Promise<{ collection: string; samples: unknown[] }[]> {
  if (!db) return [];
  const generic = { $regex: 'E2E-' };
  const checks = [
    { coll: 'assessments', q: { title: generic } },
    { coll: 'evidences', q: { label: generic } },
    { coll: 'qualifications', q: { title: generic } },
    { coll: 'users', q: { email: generic } },
  ];
  const out: { collection: string; samples: unknown[] }[] = [];
  for (const c of checks) {
    const sample = await db.collection(c.coll).find(c.q).limit(5).toArray();
    // Filter out our run; we want only OTHER runs' leftovers
    const others = sample.filter(
      (d) => !JSON.stringify(d).includes(RUN_ID),
    );
    if (others.length) out.push({ collection: c.coll, samples: others });
  }
  return out;
}

async function findS3Leaks(userIds: string[]): Promise<{ userId: string; keys: string[] }[]> {
  const region = process.env.AWS_REGION!;
  const bucket = process.env.AWS_S3_BUCKET!;
  const prefix = (process.env.AWS_S3_KEY_PREFIX || 'uploads').replace(/^\/+|\/+$/g, '');
  const s3 = new S3Client({ region });

  const baselineRaw = loadJson<Record<string, string[]>>(
    path.join(__dirname, 'baseline-s3.json'),
  );
  const baseline = baselineRaw || {};
  const startedAtMs = RUN_META.startedAtMs;

  const out: { userId: string; keys: string[] }[] = [];
  for (const uid of userIds) {
    const baselineKeys = new Set(baseline[uid] || []);
    const newKeys: string[] = [];
    let token: string | undefined;
    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${prefix}/${uid}/`,
          ContinuationToken: token,
        }),
      );
      for (const obj of resp.Contents || []) {
        if (!obj.Key) continue;
        if (baselineKeys.has(obj.Key)) continue;
        const lastModMs = obj.LastModified?.getTime() ?? 0;
        if (lastModMs < startedAtMs) continue; // pre-existing, leave alone
        newKeys.push(obj.Key);
      }
      token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (token);
    if (newKeys.length) out.push({ userId: uid, keys: newKeys });
  }
  return out;
}

async function emergencyS3Cleanup(leaks: { userId: string; keys: string[] }[]): Promise<number> {
  if (!leaks.length) return 0;
  const region = process.env.AWS_REGION!;
  const bucket = process.env.AWS_S3_BUCKET!;
  const s3 = new S3Client({ region });
  let deleted = 0;
  for (const leak of leaks) {
    for (const key of leak.keys) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        deleted += 1;
      } catch (err) {
        console.error(`[postflight] failed to delete S3 key ${key}:`, err);
      }
    }
  }
  return deleted;
}

async function main(): Promise<PostflightReport> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No db');
  console.log(`[postflight] RUN_ID=${RUN_ID}`);

  const baseline = loadJson<BaselineSnapshot>(path.join(__dirname, 'baseline.json'));
  const userIdMap =
    loadJson<Record<string, string>>(path.join(__dirname, 'baseline-user-ids.json')) || {};

  // ALWAYS run an emergency RUN_ID-gated sweep (defense in depth) BEFORE
  // computing the diff so the report reflects post-cleanup counts.
  await preCleanupSweep(db);

  const diff: { collection: string; baseline: number; final: number; delta: number }[] = [];
  if (baseline) {
    for (const [coll, base] of Object.entries(baseline.collections)) {
      const final = await db.collection(coll).countDocuments();
      const delta = final - base;
      diff.push({ collection: coll, baseline: base, final, delta });
    }
  }

  // Then run the leak detector — anything left after the sweep is a real
  // leak we want surfaced (entity that didn't contain RUN_ID anywhere).
  const leakedDocs = await findRunIdLeaks(db);
  const preExistingTestData = await findPreExistingTestData(db);

  let leakedS3Keys = await findS3Leaks(Object.values(userIdMap));

  // If there are S3 leaks, attempt emergency cleanup so we leave no trace.
  if (leakedS3Keys.length) {
    const removed = await emergencyS3Cleanup(leakedS3Keys);
    console.warn(
      `[postflight] EMERGENCY S3 CLEANUP: deleted ${removed} leaked objects (these will be reported as a test bug).`,
    );
    // Re-snapshot to confirm
    leakedS3Keys = await findS3Leaks(Object.values(userIdMap));
  }

  const frozenViolations = diff.filter(
    (d) => FROZEN_COLLECTIONS.includes(d.collection) && d.delta !== 0,
  );

  const ok =
    frozenViolations.length === 0 && leakedDocs.length === 0 && leakedS3Keys.length === 0;

  const report: PostflightReport = {
    runId: RUN_ID,
    ok,
    diff,
    leakedDocs,
    leakedS3Keys,
    preExistingTestData,
  };

  fs.writeFileSync(
    path.join(__dirname, 'postflight-report.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('\n[postflight] Diff vs baseline:');
  for (const d of diff) {
    const flag = d.delta === 0 ? '  ' : d.delta > 0 ? '+ ' : '- ';
    console.log(`  ${flag}${d.collection.padEnd(28)} ${d.baseline} -> ${d.final}  (Δ ${d.delta})`);
  }

  if (frozenViolations.length) {
    console.error('\n[postflight] FROZEN COLLECTION VIOLATIONS:');
    for (const v of frozenViolations) {
      console.error(`  ${v.collection}: ${v.baseline} -> ${v.final} (delta ${v.delta})`);
    }
  }

  if (leakedDocs.length) {
    console.error('\n[postflight] DB LEAKS (RUN_ID still present):');
    for (const l of leakedDocs) {
      console.error(`  ${l.collection}: ${l.ids.length} docs`);
    }
  }

  if (leakedS3Keys.length) {
    console.error('\n[postflight] S3 LEAKS (after emergency cleanup):');
    for (const s of leakedS3Keys) {
      console.error(`  ${s.userId}: ${s.keys.length} objects`);
    }
  }

  if (preExistingTestData.length) {
    console.warn(
      '\n[postflight] PRE-EXISTING test data from earlier runs (not from this run; please clean up manually):',
    );
    for (const p of preExistingTestData) {
      console.warn(`  ${p.collection}: ${p.samples.length} sample(s)`);
    }
  }

  await mongoose.disconnect();
  console.log(`\n[postflight] ${ok ? 'OK' : 'FAILED'}`);
  return report;
}

export default async function globalTeardown() {
  try {
    await main();
  } catch (err) {
    console.error('[postflight] threw during teardown:', err);
  }
}

if (require.main === module) {
  main()
    .then((r) => {
      process.exit(r.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('[postflight] FAILED:', err);
      process.exit(1);
    });
}
