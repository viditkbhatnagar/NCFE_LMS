/* eslint-disable no-console */
// Pre-launch production wipe.
//
// Removes every piece of user-generated test/dummy data so the platform can
// go live to real students with a clean slate. Preserves:
//   - Users (the "login credentials" — admin / assessor / IQA / student
//     accounts stay; admin will manage going forward)
//   - Centres
//   - Curriculum tree: Qualifications + Modules + Units + LearningOutcomes
//     + AssessmentCriteria (this is real content the admin authored)
//   - Audit logs (the historical trail of who-did-what during build/test)
//
// Deletes:
//   - Enrolments (will be re-created per real student)
//   - Assessments + AssessmentCriteriaMap + AssessmentEvidenceMap +
//     SignOff + Remark + CriterionComment + AssessmentDecision +
//     EvidenceMapping (Mongoose model)
//   - Evidence (Mongo docs + best-effort S3 object cleanup)
//   - LiveSession (incl. uploaded recording S3 objects)
//   - WorkHoursLog
//   - Notification
//   - PersonalDocument (incl. S3)
//   - LearningMaterial (incl. S3)
//   - CourseDocument (incl. S3)
//   - CentreDocument (incl. S3)
//   - IQASample + IQADecision + StandardisationRecord
//   - Submission + Feedback
//   - Message
//
// Usage:
//   npx tsx scripts/wipe-prod-for-launch.ts            # dry-run (default)
//   npx tsx scripts/wipe-prod-for-launch.ts --apply    # actually deletes
//
// Idempotent. Safe to re-run.

import * as fs from 'fs';
import mongoose from 'mongoose';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const APPLY = process.argv.includes('--apply');

function readEnv(): { mongoUri: string; s3?: { region: string; bucket: string } } {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const lines = envText.split(/\r?\n/);
  const get = (k: string) =>
    lines.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
  const mongoUri = get('MONGODB_URI');
  if (!mongoUri) throw new Error('MONGODB_URI not found in .env.local');
  const region = get('AWS_REGION');
  const bucket = get('AWS_S3_BUCKET');
  return {
    mongoUri,
    s3: region && bucket ? { region, bucket } : undefined,
  };
}

interface KeyedDoc {
  storageKey?: string;
  storageBucket?: string;
  thumbnailStorageKey?: string;
  recordingStorageKey?: string;
  recordingStorageBucket?: string;
  fileUrl?: string;
}

async function deleteS3Objects(
  s3: S3Client | null,
  defaultBucket: string | undefined,
  docs: KeyedDoc[],
): Promise<{ tried: number; deleted: number; failed: number }> {
  if (!s3 || !defaultBucket || !APPLY) {
    return { tried: 0, deleted: 0, failed: 0 };
  }
  let tried = 0;
  let deleted = 0;
  let failed = 0;
  for (const d of docs) {
    const keys: { bucket: string; key: string }[] = [];
    if (d.storageKey) keys.push({ bucket: d.storageBucket || defaultBucket, key: d.storageKey });
    if (d.thumbnailStorageKey)
      keys.push({ bucket: d.storageBucket || defaultBucket, key: d.thumbnailStorageKey });
    if (d.recordingStorageKey)
      keys.push({
        bucket: d.recordingStorageBucket || defaultBucket,
        key: d.recordingStorageKey,
      });
    for (const { bucket, key } of keys) {
      tried += 1;
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return { tried, deleted, failed };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

(async () => {
  const env = readEnv();
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db!;

  const s3 = env.s3 ? new S3Client({ region: env.s3.region }) : null;
  const defaultBucket = env.s3?.bucket;

  console.log(`Mode: ${APPLY ? 'APPLY (destructive)' : 'DRY-RUN (read-only)'}`);
  console.log(`S3 cleanup: ${s3 && defaultBucket ? `enabled (bucket=${defaultBucket})` : 'disabled'}`);

  // ─── Identify test/dummy qualifications to scrub from the curriculum ──
  // A qualification is "real" only if status is 'active' AND its code is NOT
  // an E2E tag or the legacy 'Test-course-Vidit' marker. Everything else is
  // residue from automated test runs.
  const allQuals = await db
    .collection('qualifications')
    .find({})
    .project({ _id: 1, code: 1, title: 1, status: 1 })
    .toArray();
  const testQualIds = allQuals
    .filter(
      (q) =>
        q.status !== 'active' ||
        /^E2E[-_]/i.test(q.code || '') ||
        /^Test[-_]course/i.test(q.code || '') ||
        /^\[E2E/i.test(q.title || ''),
    )
    .map((q) => q._id);
  const realQuals = allQuals.filter(
    (q) => !testQualIds.find((id) => String(id) === String(q._id)),
  );

  console.log('\nReal qualifications kept (curriculum tree preserved):');
  for (const q of realQuals) {
    console.log(`  • ${q.code} — ${q.title}`);
  }
  console.log(`\nTest qualifications to wipe: ${testQualIds.length} (incl. their units/LOs/ACs)`);

  // Find units / LOs / ACs attached to test qualifications so we can scrub
  // them too. The curriculum tree on real qualifications stays.
  const testUnits = testQualIds.length
    ? await db
        .collection('units')
        .find({ qualificationId: { $in: testQualIds } })
        .project({ _id: 1 })
        .toArray()
    : [];
  const testUnitIds = testUnits.map((u) => u._id);
  const testLOs = testUnitIds.length
    ? await db
        .collection('learningoutcomes')
        .find({ unitId: { $in: testUnitIds } })
        .project({ _id: 1 })
        .toArray()
    : [];
  const testLOIds = testLOs.map((l) => l._id);
  const testACCount = testLOIds.length
    ? await db
        .collection('assessmentcriterias')
        .countDocuments({ learningOutcomeId: { $in: testLOIds } })
    : 0;
  const testModuleCount = testQualIds.length
    ? await db.collection('modules').countDocuments({ qualificationId: { $in: testQualIds } })
    : 0;

  console.log(`  test units:   ${testUnitIds.length}`);
  console.log(`  test LOs:     ${testLOIds.length}`);
  console.log(`  test ACs:     ${testACCount}`);
  console.log(`  test modules: ${testModuleCount}`);

  // ─── KEEP (informational) ────────────────────────────────────────────
  console.log('\nKept (after scrub):');
  console.log(`  ${pad('users', 28)} ${await db.collection('users').countDocuments()}`);
  console.log(`  ${pad('centres', 28)} ${await db.collection('centres').countDocuments()}`);
  console.log(`  ${pad('qualifications (real)', 28)} ${realQuals.length}`);
  console.log(
    `  ${pad('units (real)', 28)} ${
      (await db.collection('units').countDocuments()) - testUnitIds.length
    }`,
  );
  console.log(
    `  ${pad('learningoutcomes (real)', 28)} ${
      (await db.collection('learningoutcomes').countDocuments()) - testLOIds.length
    }`,
  );
  console.log(
    `  ${pad('assessmentcriterias (real)', 28)} ${
      (await db.collection('assessmentcriterias').countDocuments()) - testACCount
    }`,
  );

  // ─── DELETE (collection name → optional S3 key fetch) ────────────────
  // Each entry: collection name to wipe + which S3-bearing fields to grab
  // before deletion so we can clean up the bucket too.
  const deleteSpec: Array<{
    name: string;
    s3Fields?: string[];
  }> = [
    // Assessment subgraph first — children before parents.
    { name: 'assessmentcriteriamaps' },
    { name: 'assessmentevidencemaps' },
    { name: 'evidencemappings' }, // legacy EvidenceMapping model
    { name: 'signoffs' },
    { name: 'remarks' },
    { name: 'criterioncomments' },
    { name: 'assessmentdecisions' },
    { name: 'assessments' },
    // Evidence + work hours + personal docs (all enrolment-scoped).
    { name: 'evidences', s3Fields: ['storageKey', 'thumbnailStorageKey'] },
    { name: 'workhourslogs' },
    { name: 'personaldocuments', s3Fields: ['storageKey'] },
    // Course-level content. Per Vidit's instruction this is also test data.
    { name: 'learningmaterials', s3Fields: ['storageKey'] },
    { name: 'coursedocuments', s3Fields: ['storageKey'] },
    { name: 'centredocuments', s3Fields: ['storageKey'] },
    // Live sessions (and their uploaded recording).
    { name: 'livesessions', s3Fields: ['recordingStorageKey'] },
    // IQA workflow.
    { name: 'iqasamples' },
    { name: 'iqadecisions' },
    { name: 'standardisationrecords' },
    // Legacy submission flow.
    { name: 'submissions' },
    { name: 'feedbacks' },
    // User-facing.
    { name: 'notifications' },
    { name: 'messages' },
    // Enrolments last — children are gone by now.
    { name: 'enrolments' },
    // Audit logs: fresh start for going live. Comment this out if you want
    // to preserve the historical build/test trail.
    { name: 'auditlogs' },
  ];

  console.log('\nDeletion plan:');

  let totalDocsToDelete = 0;
  const s3Tally = { tried: 0, deleted: 0, failed: 0 };

  for (const spec of deleteSpec) {
    let count = 0;
    let s3Docs: KeyedDoc[] = [];
    try {
      count = await db.collection(spec.name).countDocuments();
    } catch {
      console.log(`  ${pad(spec.name, 28)} (collection does not exist) — skipped`);
      continue;
    }
    totalDocsToDelete += count;

    if (spec.s3Fields && count > 0) {
      // Pull the S3-bearing fields for cleanup BEFORE we wipe the collection.
      const projection: Record<string, 1> = {};
      for (const f of spec.s3Fields) projection[f] = 1;
      // Live sessions also have recordingStorageBucket override.
      if (spec.name === 'livesessions') projection['recordingStorageBucket'] = 1;
      // Evidence/materials/etc. may also have a per-doc storageBucket.
      projection['storageBucket'] = 1;
      s3Docs = (await db
        .collection(spec.name)
        .find({}, { projection })
        .toArray()) as unknown as KeyedDoc[];
    }

    const sub = s3Docs.length > 0
      ? `  (S3 keys to clean: ${s3Docs.reduce(
          (n, d) =>
            n +
            (d.storageKey ? 1 : 0) +
            (d.thumbnailStorageKey ? 1 : 0) +
            (d.recordingStorageKey ? 1 : 0),
          0,
        )})`
      : '';
    console.log(`  ${pad(spec.name, 28)} ${pad(String(count), 6)}${sub}`);

    if (APPLY) {
      // S3 first so failed deletes don't leave orphan keys after the doc
      // is gone (we'd have no way to find them).
      if (spec.s3Fields) {
        const r = await deleteS3Objects(s3, defaultBucket, s3Docs);
        s3Tally.tried += r.tried;
        s3Tally.deleted += r.deleted;
        s3Tally.failed += r.failed;
      }
      const result = await db.collection(spec.name).deleteMany({});
      console.log(`     → deleted ${result.deletedCount} docs`);
    }
  }

  // ─── Test-qualification cleanup (and their attached curriculum tree) ─
  if (testQualIds.length > 0) {
    console.log('\nTest-qualification curriculum scrub:');
    console.log(`  test ACs:           ${testACCount}`);
    console.log(`  test LOs:           ${testLOIds.length}`);
    console.log(`  test units:         ${testUnitIds.length}`);
    console.log(`  test modules:       ${testModuleCount}`);
    console.log(`  test qualifications: ${testQualIds.length}`);

    if (APPLY) {
      if (testLOIds.length > 0) {
        const r = await db
          .collection('assessmentcriterias')
          .deleteMany({ learningOutcomeId: { $in: testLOIds } });
        console.log(`     → assessmentcriterias deleted: ${r.deletedCount}`);
      }
      if (testUnitIds.length > 0) {
        const r = await db
          .collection('learningoutcomes')
          .deleteMany({ unitId: { $in: testUnitIds } });
        console.log(`     → learningoutcomes deleted: ${r.deletedCount}`);
      }
      const ur = await db
        .collection('units')
        .deleteMany({ qualificationId: { $in: testQualIds } });
      console.log(`     → units deleted: ${ur.deletedCount}`);
      const mr = await db
        .collection('modules')
        .deleteMany({ qualificationId: { $in: testQualIds } });
      console.log(`     → modules deleted: ${mr.deletedCount}`);
      const qr = await db
        .collection('qualifications')
        .deleteMany({ _id: { $in: testQualIds } });
      console.log(`     → qualifications deleted: ${qr.deletedCount}`);
    }
  }

  console.log(
    `\nTotals: ${totalDocsToDelete} user-generated docs + ${
      testACCount + testLOIds.length + testUnitIds.length + testModuleCount + testQualIds.length
    } test-curriculum docs would be deleted`,
  );
  if (APPLY) {
    console.log(`S3:     ${s3Tally.deleted} objects deleted, ${s3Tally.failed} failed (out of ${s3Tally.tried} attempted)`);
    console.log('\nWipe complete. Real curriculum + users preserved.');
  } else {
    console.log('\nDry run only — no data was changed.');
    console.log('Re-run with --apply once you have reviewed the above counts.');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
