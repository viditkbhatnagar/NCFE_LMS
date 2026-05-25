/* eslint-disable no-console */
// Hard-delete leaked test data (users + cascade) from production Mongo.
//
// Safety rails (in order of strictness):
//   1. Refuses to delete any email in PROTECTED_EMAILS.
//   2. Refuses to delete any user whose name matches a protected fragment.
//   3. Requires email/name to match an unambiguous test pattern.
//   4. Each cascade step is logged and counted.
//   5. Default mode is dry-run; pass `--apply` to actually delete.
//
// Cascades, in dependency order, scoped to the target user:
//   - notifications (where userId == user._id OR entityId == relatedDoc._id)
//   - workhourslogs (userId or enrollmentId)
//   - evidences (enrolmentId)
//   - personaldocuments (uploadedBy)
//   - assessmentcriteriamaps + assessmentevidencemaps + signoffs + remarks
//     for assessments tied to the user's enrolments
//   - assessments (enrollmentId)
//   - iqasamples / iqadecisions referencing the user
//   - enrolments (userId or assessorId)
//   - users (_id)
//
// Audit logs are deliberately KEPT — they are the audit trail and removing
// them would defeat the point of having one.
//
// Usage:
//   npx tsx scripts/cleanup-test-leaks.ts            # dry run
//   npx tsx scripts/cleanup-test-leaks.ts --apply    # actually delete

import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Minimal .env.local loader (avoid the dotenv dep in scripts/).
function loadEnvLocal() {
  const p = path.join(PROJECT_ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Aborting.');
  process.exit(2);
}

const PROTECTED_EMAILS = new Set<string>([
  '7777jamesbond7777@gmail.com',
  'admin@learnerseducation.com',
  'jyothi@learnerseducation.com',
  'iqa@test.com',
  'student@test.com',
  'assessor@test.com',
  'bhatnagar007vidit@gmail.com',
]);

const PROTECTED_NAME_FRAGMENTS = ['james bond', 'jyothi'];

function looksLikeTest(name: string, email: string): boolean {
  const e = (email ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (PROTECTED_EMAILS.has(e)) return false;
  if (PROTECTED_NAME_FRAGMENTS.some((f) => n.includes(f))) return false;
  if (e.endsWith('@example.invalid')) return true;
  if (e.endsWith('@learnerseducation.invalid')) return true;
  if (e.startsWith('e2e-') || e.startsWith('intern+prodsmoke-')) return true;
  if (n.includes('[e2e-') || n.includes('[prod-') || n.includes('[prod-smoke]')) return true;
  return false;
}

interface DeleteCounts {
  notifications: number;
  workhourslogs: number;
  evidences: number;
  personaldocuments: number;
  assessmentcriteriamaps: number;
  assessmentevidencemaps: number;
  signoffs: number;
  remarks: number;
  iqasamples: number;
  iqadecisions: number;
  assessments: number;
  enrolments: number;
  users: number;
}

(async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  console.log(`Mode: ${APPLY ? 'APPLY (destructive)' : 'DRY-RUN (read-only)'}`);
  console.log('');

  // 1. Find candidate users
  const allUsers = await db.collection('users').find({}, { projection: { name: 1, email: 1 } }).toArray();
  const candidates = allUsers.filter((u) => looksLikeTest(u.name as string, u.email as string));

  console.log(`Total users: ${allUsers.length}`);
  console.log(`Test-data candidates: ${candidates.length}`);
  console.log('');

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  // Sanity check: confirm no protected users in the candidate set.
  for (const c of candidates) {
    if (PROTECTED_EMAILS.has((c.email as string)?.toLowerCase())) {
      console.error(`SAFETY ABORT: protected email ${c.email} flagged as test-data candidate.`);
      await mongoose.disconnect();
      process.exit(3);
    }
  }

  const counts: DeleteCounts = {
    notifications: 0, workhourslogs: 0, evidences: 0, personaldocuments: 0,
    assessmentcriteriamaps: 0, assessmentevidencemaps: 0, signoffs: 0, remarks: 0,
    iqasamples: 0, iqadecisions: 0, assessments: 0, enrolments: 0, users: 0,
  };

  for (const u of candidates) {
    const userId = u._id;
    const userEmail = u.email as string;

    // 1.1 Find enrolments tied to this user (as student or assessor)
    const enrolments = await db
      .collection('enrolments')
      .find({ $or: [{ userId }, { assessorId: userId }] }, { projection: { _id: 1 } })
      .toArray();
    const enrolmentIds = enrolments.map((e) => e._id);

    // 1.2 Find assessments under those enrolments
    const assessments = enrolmentIds.length
      ? await db
          .collection('assessments')
          .find({ enrollmentId: { $in: enrolmentIds } }, { projection: { _id: 1 } })
          .toArray()
      : [];
    const assessmentIds = assessments.map((a) => a._id);

    // Cascade in correct order ───────────────────────────────────────────────

    // notifications — by userId, OR by entityId in the affected entity set
    const notifQuery = {
      $or: [
        { userId },
        { entityId: { $in: [...assessmentIds.map(String), ...enrolmentIds.map(String)] } },
      ],
    };
    if (APPLY) {
      const r = await db.collection('notifications').deleteMany(notifQuery);
      counts.notifications += r.deletedCount;
    } else {
      counts.notifications += await db.collection('notifications').countDocuments(notifQuery);
    }

    // workhourslogs — by userId or enrollmentId
    const whQuery = {
      $or: [{ userId }, { enrollmentId: { $in: enrolmentIds } }],
    };
    if (APPLY) {
      const r = await db.collection('workhourslogs').deleteMany(whQuery);
      counts.workhourslogs += r.deletedCount;
    } else {
      counts.workhourslogs += await db.collection('workhourslogs').countDocuments(whQuery);
    }

    // evidences — by enrolmentId
    if (enrolmentIds.length) {
      const evQuery = { enrolmentId: { $in: enrolmentIds } };
      if (APPLY) {
        const r = await db.collection('evidences').deleteMany(evQuery);
        counts.evidences += r.deletedCount;
      } else {
        counts.evidences += await db.collection('evidences').countDocuments(evQuery);
      }
    }

    // personaldocuments — by uploadedBy
    const pdQuery = { uploadedBy: userId };
    if (APPLY) {
      const r = await db.collection('personaldocuments').deleteMany(pdQuery);
      counts.personaldocuments += r.deletedCount;
    } else {
      counts.personaldocuments += await db.collection('personaldocuments').countDocuments(pdQuery);
    }

    // assessment children
    if (assessmentIds.length) {
      const asMatch = { assessmentId: { $in: assessmentIds } };
      for (const coll of ['assessmentcriteriamaps', 'assessmentevidencemaps', 'signoffs', 'remarks'] as const) {
        if (APPLY) {
          const r = await db.collection(coll).deleteMany(asMatch);
          counts[coll] += r.deletedCount;
        } else {
          counts[coll] += await db.collection(coll).countDocuments(asMatch);
        }
      }
    }

    // iqa
    const iqaQuery = { $or: [{ assessorUserId: userId }, { sampledByUserId: userId }, { decisionByUserId: userId }, { assessmentId: { $in: assessmentIds } }] };
    if (APPLY) {
      const r1 = await db.collection('iqasamples').deleteMany(iqaQuery);
      counts.iqasamples += r1.deletedCount;
      const r2 = await db.collection('iqadecisions').deleteMany(iqaQuery);
      counts.iqadecisions += r2.deletedCount;
    } else {
      counts.iqasamples += await db.collection('iqasamples').countDocuments(iqaQuery);
      counts.iqadecisions += await db.collection('iqadecisions').countDocuments(iqaQuery);
    }

    // assessments
    if (assessmentIds.length) {
      const aQuery = { _id: { $in: assessmentIds } };
      if (APPLY) {
        const r = await db.collection('assessments').deleteMany(aQuery);
        counts.assessments += r.deletedCount;
      } else {
        counts.assessments += await db.collection('assessments').countDocuments(aQuery);
      }
    }

    // enrolments
    if (enrolmentIds.length) {
      const eQuery = { _id: { $in: enrolmentIds } };
      if (APPLY) {
        const r = await db.collection('enrolments').deleteMany(eQuery);
        counts.enrolments += r.deletedCount;
      } else {
        counts.enrolments += await db.collection('enrolments').countDocuments(eQuery);
      }
    }

    // user — re-validate the protect list one final time before delete
    if (PROTECTED_EMAILS.has(userEmail.toLowerCase())) {
      console.error(`SAFETY ABORT mid-loop: ${userEmail}`);
      await mongoose.disconnect();
      process.exit(4);
    }
    if (APPLY) {
      const r = await db.collection('users').deleteOne({ _id: userId });
      counts.users += r.deletedCount;
    } else {
      counts.users += 1;
    }
  }

  console.log('Cascade counts:');
  for (const [coll, n] of Object.entries(counts)) {
    console.log(`  ${coll.padEnd(28)} ${n}`);
  }
  console.log('');
  if (!APPLY) {
    console.log('Dry run complete — no changes made. Re-run with --apply to delete.');
  } else {
    console.log('Cleanup complete. Audit logs retained intentionally.');
  }

  // Save the candidate list as a record
  fs.writeFileSync(
    '/tmp/cleanup-test-leaks.report.json',
    JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', counts, deleted: candidates.map((u) => ({ id: String(u._id), email: u.email, name: u.name })) }, null, 2),
  );
  console.log('Report: /tmp/cleanup-test-leaks.report.json');

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Fatal:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
