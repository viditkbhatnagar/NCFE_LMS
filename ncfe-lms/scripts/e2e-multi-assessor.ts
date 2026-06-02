/* eslint-disable no-console */
// End-to-end verification of MULTI-ASSESSOR-PER-STUDENT on production.
//
// Admin creates a temp student + a temp SECOND assessor, enrols the student
// under TWO assessors (Jyothi as lead + the temp one as co-assessor), then
// confirms BOTH assessors get full visibility + access to the learner, and
// that evidence upload notifies BOTH. Everything is cleaned up afterwards.

import * as fs from 'fs';
import * as path from 'path';
import { request as playwrightRequest } from '@playwright/test';

const BASE = 'https://ncfe-lms.onrender.com';
const ADMIN = { email: 'admin@learnerseducation.com', password: 'passwordadmin' };
const LEAD_ASSESSOR = { email: 'jyothi@learnerseducation.com', password: 'password123' };
const TAG = `MA-${Date.now().toString(36)}`;
const TEMP_PASS = 'TempPass123!';

function pass(m: string) { console.log(`  ✅ ${m}`); }
function fail(m: string) { console.log(`  ❌ ${m}`); process.exitCode = 1; }
function section(t: string) { console.log(`\n=== ${t} ===`); }

async function ctxFor(creds: { email: string; password: string }) {
  const ctx = await playwrightRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { accept: 'application/json' },
  });
  const { csrfToken } = await (await ctx.get('/api/auth/csrf')).json();
  await ctx.post('/api/auth/callback/credentials', {
    form: { email: creds.email, password: creds.password, csrfToken, json: 'true', callbackUrl: BASE },
  });
  const sess = await (await ctx.get('/api/auth/session')).json();
  if (sess?.user?.email?.toLowerCase() !== creds.email.toLowerCase()) {
    throw new Error(`sign-in failed for ${creds.email}`);
  }
  return { ctx, userId: sess.user.id as string };
}

const cleanup: { studentId?: string; coAssessorId?: string; enrolmentId?: string; evidenceId?: string } = {};

(async () => {
  const admin = await ctxFor(ADMIN);
  const lead = await ctxFor(LEAD_ASSESSOR);
  console.log(`Tag: ${TAG}  admin=${admin.userId}  lead(jyothi)=${lead.userId}`);

  // Pick a course Jyothi assesses.
  const courses = (await (await lead.ctx.get('/api/v2/assessor/courses')).json()).data ?? [];
  if (courses.length === 0) { fail('lead assessor has no courses'); process.exit(1); }
  const course = courses[0];
  console.log(`  course: ${course.title} (${course.code})`);

  section('Setup — temp student + temp co-assessor');
  const coEmail = `${TAG.toLowerCase()}.co@example.invalid`;
  const co = await admin.ctx.post('/api/v2/admin/users', {
    data: { name: `[${TAG}] Co Assessor`, email: coEmail, password: TEMP_PASS, role: 'assessor', status: 'active' },
  });
  if (co.status() !== 201) { fail(`co-assessor create: ${co.status()} ${await co.text()}`); process.exit(1); }
  cleanup.coAssessorId = (await co.json()).data._id;
  pass(`created co-assessor (${cleanup.coAssessorId})`);

  const stuEmail = `${TAG.toLowerCase()}.stu@example.invalid`;
  const stu = await admin.ctx.post('/api/v2/admin/users', {
    data: { name: `[${TAG}] Student`, email: stuEmail, password: TEMP_PASS, role: 'student', status: 'active' },
  });
  if (stu.status() !== 201) { fail(`student create: ${stu.status()}`); process.exit(1); }
  cleanup.studentId = (await stu.json()).data._id;
  pass(`created student (${cleanup.studentId})`);

  section('1. Enrol student under TWO assessors (lead + co)');
  const enrol = await admin.ctx.post('/api/v2/admin/enrolments', {
    data: {
      userId: cleanup.studentId,
      qualificationId: course._id,
      assessorIds: [lead.userId, cleanup.coAssessorId],
      cohortId: TAG,
      status: 'in_progress',
    },
  });
  if (enrol.status() !== 201) { fail(`enrol: ${enrol.status()} ${await enrol.text()}`); process.exit(1); }
  const enrolData = (await enrol.json()).data;
  cleanup.enrolmentId = enrolData._id;
  pass(`enrolment created (${cleanup.enrolmentId})`);

  // Verify dual-field shape.
  const detail = (await (await admin.ctx.get(`/api/v2/admin/enrolments/${cleanup.enrolmentId}`)).json()).data;
  const idsOut = (detail.assessorIds ?? []).map((a: { _id: string }) => a._id);
  if (idsOut.length === 2 && idsOut.includes(lead.userId) && idsOut.includes(cleanup.coAssessorId)) {
    pass(`assessorIds holds both assessors`);
  } else {
    fail(`assessorIds wrong: ${JSON.stringify(idsOut)}`);
  }
  const leadOut = detail.assessorId?._id ?? detail.assessorId;
  if (String(leadOut) === lead.userId) pass(`lead (assessorId) = first selected (jyothi)`);
  else fail(`lead is ${leadOut}, expected ${lead.userId}`);

  // Sign in as the co-assessor.
  const coCtx = await ctxFor({ email: coEmail, password: TEMP_PASS });

  section('2. BOTH assessors see the course');
  const leadCourses = (await (await lead.ctx.get('/api/v2/assessor/courses')).json()).data ?? [];
  const coCourses = (await (await coCtx.ctx.get('/api/v2/assessor/courses')).json()).data ?? [];
  if (leadCourses.some((c: { _id: string }) => c._id === course._id)) pass('lead sees the course');
  else fail('lead does NOT see the course');
  if (coCourses.some((c: { _id: string }) => c._id === course._id)) pass('co-assessor sees the course');
  else fail('co-assessor does NOT see the course');

  section('3. BOTH assessors see the learner (members)');
  const leadMembers = await (await lead.ctx.get(`/api/v2/members/${course._id}`)).json();
  const coMembers = await (await coCtx.ctx.get(`/api/v2/members/${course._id}`)).json();
  const leadHasLearner = JSON.stringify(leadMembers.data?.learnerGroups ?? []).includes(cleanup.studentId!);
  const coHasLearner = JSON.stringify(coMembers.data?.learnerGroups ?? []).includes(cleanup.studentId!);
  if (leadHasLearner) pass('lead sees the learner in their groups'); else fail('lead does NOT see the learner');
  if (coHasLearner) pass('co-assessor sees the learner in their groups'); else fail('co-assessor does NOT see the learner');

  section('4. BOTH assessors can access the learner portfolio + progress');
  for (const [who, c] of [['lead', lead.ctx], ['co-assessor', coCtx.ctx]] as const) {
    const p = await c.get(`/api/v2/portfolio/${cleanup.enrolmentId}`);
    if (p.ok()) pass(`${who} can open portfolio (${p.status()})`);
    else fail(`${who} portfolio returned ${p.status()}`);
    const pr = await c.get(`/api/v2/progress/${cleanup.enrolmentId}`);
    if (pr.ok()) pass(`${who} can open progress (${pr.status()})`);
    else fail(`${who} progress returned ${pr.status()}`);
  }

  section('5. Student uploads evidence → BOTH assessors notified');
  const stuCtx = await ctxFor({ email: stuEmail, password: TEMP_PASS });
  const pdfPath = path.join(__dirname, '..', 'tests', 'fixtures', 'files', 'tiny.pdf');
  const file = fs.existsSync(pdfPath)
    ? { name: `${TAG.toLowerCase()}.pdf`, mimeType: 'application/pdf', buffer: fs.readFileSync(pdfPath) }
    : { name: `${TAG.toLowerCase()}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`${TAG} evidence`, 'utf8') };
  const up = await stuCtx.ctx.post('/api/v2/evidence/upload', {
    multipart: { file, enrolmentId: cleanup.enrolmentId!, label: `[${TAG}] evidence`, description: 'multi-assessor notify check' },
  });
  if (up.status() === 201) {
    cleanup.evidenceId = (await up.json()).data._id;
    pass(`student uploaded evidence (${cleanup.evidenceId})`);
    // Both assessors should have a notification referencing this evidence.
    for (const [who, c] of [['lead', lead.ctx], ['co-assessor', coCtx.ctx]] as const) {
      const notifs = (await (await c.get('/api/notifications?limit=50')).json()).data ?? [];
      const hit = notifs.find((n: { entityId?: string }) => n.entityId === cleanup.evidenceId);
      if (hit) pass(`${who} got the evidence notification`);
      else fail(`${who} did NOT get the evidence notification`);
    }
    // Both assessors can download the evidence.
    for (const [who, c] of [['lead', lead.ctx], ['co-assessor', coCtx.ctx]] as const) {
      const dl = await c.get(`/api/v2/evidence/${cleanup.evidenceId}/download?json=true`);
      if (dl.ok()) pass(`${who} can download the evidence`);
      else fail(`${who} evidence download returned ${dl.status()}`);
    }
  } else {
    fail(`evidence upload: ${up.status()} ${await up.text()}`);
  }
  await stuCtx.ctx.dispose();

  section('6. Co-assessor can create an assessment for the shared learner');
  const createAssess = await coCtx.ctx.post('/api/v2/assessments', {
    data: { enrollmentId: cleanup.enrolmentId, learnerId: cleanup.studentId, title: `[${TAG}] co assessment` },
  });
  // 201 = created; if the schema needs more fields it may 400 — either way NOT 403 (the gate is what we test).
  if (createAssess.status() === 403) fail('co-assessor got 403 creating an assessment (gate bug)');
  else pass(`co-assessor assessment-create gate passed (status ${createAssess.status()})`);

  section('Cleanup');
  if (cleanup.evidenceId) await lead.ctx.delete(`/api/v2/evidence/${cleanup.evidenceId}`).then((r) => pass(`evidence delete ${r.status()}`));
  if (cleanup.enrolmentId) await admin.ctx.delete(`/api/v2/admin/enrolments/${cleanup.enrolmentId}?hard=true`).then((r) => pass(`enrolment hard-delete ${r.status()}`));
  if (cleanup.studentId) await admin.ctx.delete(`/api/v2/admin/users/${cleanup.studentId}?hard=true`).then((r) => pass(`student hard-delete ${r.status()}`));
  if (cleanup.coAssessorId) await admin.ctx.delete(`/api/v2/admin/users/${cleanup.coAssessorId}?hard=true`).then((r) => pass(`co-assessor hard-delete ${r.status()}`));

  await admin.ctx.dispose();
  await lead.ctx.dispose();
  await coCtx.ctx.dispose();
  console.log(`\nDone. Exit code: ${process.exitCode ?? 0}`);
})().catch((err) => { console.error('\nFATAL:', err); process.exit(2); });
