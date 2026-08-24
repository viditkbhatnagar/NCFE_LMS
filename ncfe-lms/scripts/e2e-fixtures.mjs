#!/usr/bin/env node
/**
 * Provision (or re-provision) the permanent E2E test fixtures on a deployed
 * environment, through the app's own admin HTTP API.
 *
 * Why HTTP and not a Mongoose seed script: this runs against whatever
 * environment BASE_URL points at, needs no database credentials, and exercises
 * the same validation, cascade and audit-log paths a real admin would — so a
 * fixture can never end up in a state the app itself would refuse to create.
 *
 * Idempotent: re-running reconciles the existing fixtures instead of failing.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/e2e-fixtures.mjs
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/e2e-fixtures.mjs --verify
 *
 * Flags:
 *   --verify   report the current fixture state and exit without writing
 *
 * Every fixture uses the RFC 2606 reserved `.invalid` TLD, so the welcome
 * emails the API sends on user creation cannot reach a real mailbox.
 */

const BASE_URL = process.env.BASE_URL || 'https://ncfe-lms.onrender.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const VERIFY_ONLY = process.argv.includes('--verify');

// The course the E2E suites exercise.
const QUALIFICATION_SLUG = 'ncfe-cache-level-3-diploma-for-working-in-early-years-sector-eye';

// Keep these in sync with PROD_USERS in tests/prod/_helpers.ts.
const FIXTURES = {
  assessor: { name: 'E2E Fixture Assessor', email: 'e2e-assessor@example.invalid', role: 'assessor', password: 'E2eFixture2026!' },
  iqa: { name: 'E2E Fixture IQA', email: 'e2e-iqa@example.invalid', role: 'iqa', password: 'E2eFixture2026!' },
  learner: { name: 'E2E Fixture Learner', email: 'e2e-learner@example.invalid', role: 'student', password: 'E2eFixture2026!' },
};

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
  process.exit(2);
}

// ---- minimal NextAuth credentials client ---------------------------------

function absorb(res, jar) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = (jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function signIn(email, password) {
  const jar = new Map();
  let res = await fetch(`${BASE_URL}/api/auth/csrf`, { headers: { accept: 'application/json' } });
  absorb(res, jar);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar) },
    body: new URLSearchParams({ email, password, csrfToken, json: 'true', callbackUrl: BASE_URL }),
  });
  absorb(res, jar);
  const session = await (await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: cookieHeader(jar), accept: 'application/json' },
  })).json();
  if (session?.user?.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error(`sign-in failed for ${email} (got ${session?.user?.email ?? 'anonymous'})`);
  }
  return { jar, session };
}

async function api(jar, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      cookie: cookieHeader(jar),
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
  return { status: res.status, json };
}

// ---- reconcilers ----------------------------------------------------------

async function findUserByEmail(jar, email) {
  // The admin search treats `+` as a regex quantifier, so search on a plain
  // substring and match exactly client-side.
  const { json } = await api(jar, 'GET', `/api/v2/admin/users?search=${encodeURIComponent(email.split('@')[0])}&limit=100`);
  const users = json?.data?.users ?? json?.data ?? [];
  return (Array.isArray(users) ? users : []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(jar, spec) {
  const existing = await findUserByEmail(jar, spec.email);
  if (existing) {
    // Re-assert the password so a fixture is never unusable because someone
    // rotated it; the account is a throwaway on an undeliverable domain.
    const reset = await api(jar, 'POST', `/api/v2/admin/users/${existing._id}/reset-password`, { newPassword: spec.password });
    if (reset.status !== 200) throw new Error(`could not reset ${spec.email}: ${reset.status} ${JSON.stringify(reset.json)}`);
    console.log(`  = ${spec.role.padEnd(8)} ${spec.email} (existing ${existing._id}, password re-asserted)`);
    return existing._id;
  }
  const created = await api(jar, 'POST', '/api/v2/admin/users', {
    name: spec.name, email: spec.email, password: spec.password, role: spec.role, status: 'active',
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`could not create ${spec.email}: ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json?.data?._id ?? created.json?.data?.user?._id;
  console.log(`  + ${spec.role.padEnd(8)} ${spec.email} (created ${id})`);
  return id;
}

async function getQualificationId(jar) {
  const { json } = await api(jar, 'GET', '/api/v2/admin/qualifications?limit=100');
  const list = json?.data?.qualifications ?? json?.data ?? [];
  const q = (Array.isArray(list) ? list : []).find((x) => x.slug === QUALIFICATION_SLUG);
  if (!q) throw new Error(`qualification ${QUALIFICATION_SLUG} not found`);
  return q._id;
}

async function ensureEnrolment(jar, { qualificationId, learnerId, assessorId, iqaId }) {
  const { json } = await api(jar, 'GET', `/api/v2/admin/enrolments?qualificationId=${qualificationId}&limit=200`);
  const list = json?.data?.enrolments ?? json?.data ?? [];
  const refId = (v) => String(v?._id ?? v ?? '');
  const existing = (Array.isArray(list) ? list : []).find((e) => refId(e.userId) === String(learnerId));

  const desired = { assessorIds: [assessorId], iqaIds: [iqaId], status: 'in_progress' };

  if (existing) {
    const upd = await api(jar, 'PUT', `/api/v2/admin/enrolments/${existing._id}`, desired);
    if (upd.status !== 200) throw new Error(`could not update enrolment: ${upd.status} ${JSON.stringify(upd.json)}`);
    console.log(`  = enrolment ${existing._id} (assessor + iqa re-asserted)`);
    return existing._id;
  }

  const created = await api(jar, 'POST', '/api/v2/admin/enrolments', {
    userId: learnerId, qualificationId, ...desired,
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`could not create enrolment: ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json?.data?._id;
  console.log(`  + enrolment ${id}`);
  return id;
}

async function ensureAssessment(jar, { enrolmentId, learnerId, qualificationId }) {
  // role-access.spec.ts needs at least one assessment inside the IQA's scope.
  // Created as the fixture ASSESSOR, because POST /api/v2/assessments requires
  // the caller to be an assessor on the enrolment.
  const assessorJar = (await signIn(FIXTURES.assessor.email, FIXTURES.assessor.password)).jar;
  const { json } = await api(assessorJar, 'GET', `/api/v2/assessments?qualificationId=${qualificationId}&enrollmentId=${enrolmentId}`);
  const existing = (json?.data ?? [])[0];
  if (existing) {
    console.log(`  = assessment ${existing._id}`);
    return existing._id;
  }
  const created = await api(assessorJar, 'POST', '/api/v2/assessments', {
    title: 'E2E Fixture Assessment — do not delete',
    learnerId,
    enrollmentId: enrolmentId,
    assessmentKind: 'written_assessment',
    status: 'published',
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`could not create assessment: ${created.status} ${JSON.stringify(created.json)}`);
  }
  console.log(`  + assessment ${created.json?.data?._id}`);
  return created.json?.data?._id;
}

// ---- main -----------------------------------------------------------------

const { jar: admin } = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
console.log(`admin session established against ${BASE_URL}\n`);

const qualificationId = await getQualificationId(admin);

if (VERIFY_ONLY) {
  console.log('fixture state (--verify, no writes):');
  for (const spec of Object.values(FIXTURES)) {
    const u = await findUserByEmail(admin, spec.email);
    console.log(`  ${u ? 'OK  ' : 'MISS'} ${spec.role.padEnd(8)} ${spec.email}${u ? ` (${u._id})` : ''}`);
  }
  process.exit(0);
}

console.log('users:');
const assessorId = await ensureUser(admin, FIXTURES.assessor);
const iqaId = await ensureUser(admin, FIXTURES.iqa);
const learnerId = await ensureUser(admin, FIXTURES.learner);

console.log('\nenrolment:');
const enrolmentId = await ensureEnrolment(admin, { qualificationId, learnerId, assessorId, iqaId });

console.log('\nassessment:');
await ensureAssessment(admin, { enrolmentId, learnerId, qualificationId });

console.log('\nfixtures ready. tests/prod/_helpers.ts PROD_USERS should reference:');
for (const spec of Object.values(FIXTURES)) {
  console.log(`  ${spec.role.padEnd(8)} ${spec.email} / ${spec.password}`);
}
