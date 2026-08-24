import { test, expect, type APIRequestContext } from '@playwright/test';
import { PROD_USERS, makeApiContext } from './_helpers';

/**
 * API-level role-access contract, asserted against production.
 *
 * These encode the findings of the role-access audit so they cannot silently
 * regress. Every request here is a GET — nothing in this file mutates
 * production data.
 *
 * The two directions that matter:
 *   - NARROWING must hold: a role must not reach data outside its scope.
 *   - WIDENING must hold: a role must not be locked out of its own data.
 * A test suite that only checks the first would have passed happily while
 * Robert was staring at "The server returned an error".
 */

const EYE_QUALIFICATION_ID = '6a1e8c5ed76d3d201c54cf81';

let admin: APIRequestContext;
let iqaAssigned: APIRequestContext;
let iqaUnassigned: APIRequestContext;

/** An assessment the assigned IQA quality-assures, and one they do not. */
let ownAssessmentId: string;
let foreignAssessmentId: string;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  [admin, iqaAssigned, iqaUnassigned] = await Promise.all([
    makeApiContext(PROD_USERS.admin),
    makeApiContext(PROD_USERS.iqaAssigned),
    makeApiContext(PROD_USERS.iqa),
  ]);

  const mine = await (await iqaAssigned.get(`/api/v2/assessments?qualificationId=${EYE_QUALIFICATION_ID}`)).json();
  ownAssessmentId = mine.data?.[0]?._id;

  const all = await (await admin.get(`/api/v2/assessments?qualificationId=${EYE_QUALIFICATION_ID}`)).json();
  foreignAssessmentId = (all.data ?? []).map((a: { _id: string }) => a._id).find((id: string) => id !== ownAssessmentId);

  expect(ownAssessmentId, 'assigned IQA must have at least one assessment to test against').toBeTruthy();
  expect(foreignAssessmentId, 'need a second assessment outside the IQA scope').toBeTruthy();
});

test.afterAll(async () => {
  await Promise.all([admin?.dispose(), iqaAssigned?.dispose(), iqaUnassigned?.dispose()]);
});

test.describe('sign-off is gated on being a party to the assessment', () => {
  test('assigned IQA reads sign-offs for their own learner', async () => {
    expect((await iqaAssigned.get(`/api/v2/assessments/${ownAssessmentId}/sign-off`)).status()).toBe(200);
  });

  test('assigned IQA cannot read sign-offs for a learner they do not quality-assure', async () => {
    expect((await iqaAssigned.get(`/api/v2/assessments/${foreignAssessmentId}/sign-off`)).status()).toBe(403);
  });

  test('an IQA with no assignments cannot read any sign-offs', async () => {
    expect((await iqaUnassigned.get(`/api/v2/assessments/${ownAssessmentId}/sign-off`)).status()).toBe(403);
  });

  test('admin reads sign-offs for any assessment', async () => {
    expect((await admin.get(`/api/v2/assessments/${ownAssessmentId}/sign-off`)).status()).toBe(200);
  });
});

test.describe('assessment exports and comments are scoped to the IQA assignment', () => {
  test('assigned IQA exports the PDF for their own learner', async () => {
    // Also guards the pdfkit font regression: pdfkit resolves data/*.afm from
    // its own package at runtime, so bundling it made every export 500.
    expect((await iqaAssigned.get(`/api/v2/assessments/${ownAssessmentId}/pdf`)).status()).toBe(200);
  });

  test('admin exports the PDF for any assessment', async () => {
    expect((await admin.get(`/api/v2/assessments/${foreignAssessmentId}/pdf`)).status()).toBe(200);
  });

  test('assigned IQA cannot export a PDF outside their scope', async () => {
    expect((await iqaAssigned.get(`/api/v2/assessments/${foreignAssessmentId}/pdf`)).status()).toBe(403);
  });

  test('assigned IQA cannot read criterion comments outside their scope', async () => {
    expect((await iqaAssigned.get(`/api/v2/assessments/${foreignAssessmentId}/criteria-comments`)).status()).toBe(403);
  });
});

test.describe('roles reach their own data', () => {
  test('assigned IQA loads assessments from the oversight endpoint', async () => {
    const res = await iqaAssigned.get(`/api/v2/assessments?qualificationId=${EYE_QUALIFICATION_ID}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.length).toBeGreaterThan(0);
  });

  test('the student-only assessments endpoint stays closed to an IQA', async () => {
    // The original bug: the page routed IQA here and rendered the 403 as
    // "The server returned an error. Please try again."
    expect((await iqaAssigned.get(`/api/v2/student/assessments?qualificationId=${EYE_QUALIFICATION_ID}`)).status()).toBe(403);
  });

  test('curriculum tree loads for an IQA', async () => {
    const res = await iqaAssigned.get(`/api/v2/qualifications/${EYE_QUALIFICATION_ID}/criteria-tree`);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.length).toBeGreaterThan(0);
  });

  test('search works for IQA and admin, not just assessor and student', async () => {
    expect((await iqaAssigned.get('/api/v2/search?q=theme')).status()).toBe(200);
    expect((await admin.get('/api/v2/search?q=theme')).status()).toBe(200);
  });

  test('members returns learners for IQA and admin, not an empty list', async () => {
    for (const [label, ctx] of [['iqa', iqaAssigned], ['admin', admin]] as const) {
      const res = await ctx.get(`/api/v2/members/${EYE_QUALIFICATION_ID}`);
      expect(res.status()).toBe(200);
      const groups = (await res.json()).data?.learnerGroups ?? [];
      const learners = groups.reduce((sum: number, g: { learners?: unknown[] }) => sum + (g.learners?.length ?? 0), 0);
      expect(learners, `${label} should see at least one learner`).toBeGreaterThan(0);
    }
  });

  test('admin can list course documents', async () => {
    expect((await admin.get(`/api/v2/course-documents?qualificationId=${EYE_QUALIFICATION_ID}`)).status()).toBe(200);
  });

  test('admin reaches the legacy IQA sampling surface', async () => {
    expect((await admin.get('/api/iqa/samples')).status()).toBe(200);
    expect((await admin.get('/api/iqa/decisions')).status()).toBe(200);
  });
});
