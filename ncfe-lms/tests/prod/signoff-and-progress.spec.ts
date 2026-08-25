import { test, expect, type APIRequestContext } from '@playwright/test';
import { PROD_USERS, makeApiContext, makeBrowserContext } from './_helpers';

/**
 * Covers the two things Robert and Jyothi reported:
 *
 *  1. "Robert is not able to sign off — why is the option not coming there?"
 *     The IQA step is genuinely gated behind assessor + learner. That is the
 *     designed order, and the API says so plainly; the UI just never showed the
 *     reason, so an absent button read as a broken one.
 *
 *  2. "on the progress bar ... he should be able to click on the assessment,
 *     and the assessment should open."
 *     The progress page's assessment card was a plain div with no handler.
 *
 * The sign-off test creates its own assessment and deletes it again, so it is
 * repeatable and leaves production exactly as it found it.
 */

const EYE_SLUG = 'ncfe-cache-level-3-diploma-for-working-in-early-years-sector-eye';
const EYE_QUALIFICATION_ID = '6a1e8c5ed76d3d201c54cf81';

let assessor: APIRequestContext;
let learner: APIRequestContext;
let iqa: APIRequestContext;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  [assessor, learner, iqa] = await Promise.all([
    makeApiContext(PROD_USERS.assessor),
    makeApiContext(PROD_USERS.studentFixture),
    makeApiContext(PROD_USERS.iqaAssigned),
  ]);
});

test.afterAll(async () => {
  await Promise.all([assessor?.dispose(), learner?.dispose(), iqa?.dispose()]);
});

test.describe('IQA sign-off', () => {
  test('is independent of assessor and learner, while EQA still waits on IQA', async () => {
    test.setTimeout(180_000);

    // Fresh assessment on the fixture enrolment, so the sign-off state is known.
    const enrolments = await (await assessor.get(`/api/v2/assessor/courses`)).json();
    expect(enrolments.data?.length, 'fixture assessor must have a course').toBeGreaterThan(0);

    const mine = await (await assessor.get(`/api/v2/assessments?qualificationId=${EYE_QUALIFICATION_ID}`)).json();
    const sample = mine.data?.[0];
    expect(sample, 'fixture assessor must have an assessment to read ids from').toBeTruthy();
    const enrollmentId = typeof sample.enrollmentId === 'object' ? sample.enrollmentId._id : sample.enrollmentId;
    const learnerId = typeof sample.learnerId === 'object' ? sample.learnerId._id : sample.learnerId;

    const created = await assessor.post('/api/v2/assessments', {
      data: {
        title: 'E2E sign-off chain — auto-deleted',
        learnerId,
        enrollmentId,
        assessmentKind: 'written_assessment',
        status: 'published',
      },
    });
    expect(created.status()).toBe(201);
    const assessmentId = (await created.json()).data._id;

    try {
      // 1. EQA is still sequenced behind IQA.
      const eqaEarly = await assessor.post(`/api/v2/assessments/${assessmentId}/sign-off`, {
        data: { role: 'eqa', status: 'signed_off' },
      });
      expect(eqaEarly.status(), 'EQA must still wait for IQA').not.toBe(200);

      // 2. The IQA signs FIRST — nothing else has been signed yet. This is the
      //    rule Robert was blocked by; an IQA now samples on their own schedule.
      const signed = await iqa.post(`/api/v2/assessments/${assessmentId}/sign-off`, {
        data: { role: 'iqa', status: 'signed_off', comments: 'verified' },
      });
      expect(signed.status(), 'IQA must be able to sign without waiting on anyone').toBe(200);

      // 3. Assessor and learner still sign independently, in any order.
      expect((await assessor.post(`/api/v2/assessments/${assessmentId}/sign-off`, {
        data: { role: 'assessor', status: 'signed_off' },
      })).status()).toBe(200);
      expect((await learner.post(`/api/v2/assessments/${assessmentId}/sign-off`, {
        data: { role: 'learner', status: 'signed_off' },
      })).status()).toBe(200);

      const rows = await (await iqa.get(`/api/v2/assessments/${assessmentId}/sign-off`)).json();
      const byRole = Object.fromEntries((rows.data ?? []).map((s: { role: string; status: string }) => [s.role, s.status]));
      expect(byRole.iqa).toBe('signed_off');
      expect(byRole.assessor).toBe('signed_off');
      expect(byRole.learner).toBe('signed_off');
    } finally {
      // Delete as ADMIN and assert it worked. An assessor may only delete DRAFT
      // assessments, and this one has to be published for the learner to sign —
      // so an assessor-issued delete 400s, and a silent cleanup would leak a new
      // assessment into production on every single run.
      const admin = await makeApiContext(PROD_USERS.admin);
      const removed = await admin.delete(`/api/v2/assessments/${assessmentId}`);
      await admin.dispose();
      expect(removed.status(), 'test assessment must be cleaned up').toBe(200);
    }
  });
});

test.describe('progress page → assessment', () => {
  test('clicking a linked assessment opens its detail panel', async ({ browser }) => {
    test.setTimeout(6 * 60_000);

    // Resolve a real (enrolment → unit → outcome → criterion) path that actually
    // has a linked assessment, rather than clicking the first card in each
    // column and hoping. Keeps the test deterministic as curriculum data shifts.
    const admin = await makeApiContext(PROD_USERS.admin);
    let target: { enrolmentId: string; unit: string; lo: string; ac: string } | null = null;
    try {
      const enrolments = await (await admin.get(`/api/v2/admin/enrolments?qualificationId=${EYE_QUALIFICATION_ID}&limit=200`)).json();
      const list = enrolments.data?.enrolments ?? enrolments.data ?? [];
      for (const e of list) {
        const progress = await (await admin.get(`/api/v2/progress/${e._id}`)).json();
        for (const unit of progress.data?.units ?? []) {
          for (const lo of unit.learningOutcomes ?? []) {
            for (const ac of lo.assessmentCriteria ?? []) {
              if ((ac.linkedAssessments ?? []).length > 0) {
                target = { enrolmentId: e._id, unit: unit.unitReference ?? unit.title, lo: lo.loNumber ?? lo.description, ac: ac.acNumber ?? ac.description };
                break;
              }
            }
            if (target) break;
          }
          if (target) break;
        }
        if (target) break;
      }
    } finally {
      await admin.dispose();
    }
    expect(target, 'need a criterion with a linked assessment to test against').toBeTruthy();

    const context = await makeBrowserContext(browser, PROD_USERS.admin);
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 1600, height: 1000 });
      // The progress page renders an empty state until a learner is chosen.
      await page.goto(`/c/${EYE_SLUG}/progress?currentEnrollmentId=${target!.enrolmentId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});

      for (const label of [target!.unit, target!.lo, target!.ac]) {
        await page.locator('button', { hasText: String(label).slice(0, 24) }).first().click({ timeout: 20_000 });
        await page.waitForTimeout(700);
      }

      const card = page.getByRole('button', { name: /^Open assessment / }).first();
      await expect(card, 'progress page must expose assessments as clickable controls').toBeVisible({ timeout: 20_000 });
      await card.click();

      await page.waitForURL(/\/assessment\?.*assessmentId=/, { timeout: 30_000 });
      // The panel fetches its own detail, so its chrome is the proof it opened.
      await expect(page.getByText(/sign-off status/i).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.close();
    }
  });
});
