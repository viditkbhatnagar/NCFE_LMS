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
      await assessor.delete(`/api/v2/assessments/${assessmentId}`);
    }
  });
});

test.describe('progress page → assessment', () => {
  test('clicking a linked assessment opens its detail panel', async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const context = await makeBrowserContext(browser, PROD_USERS.assessor);
    try {
      const page = await context.newPage();
      await page.goto(`/c/${EYE_SLUG}/progress`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});

      // Drill in: unit → outcome → criterion, then the assessments column fills.
      for (const column of ['Units', 'Outcomes', 'Criteria']) {
        const first = page.locator(`section:has-text("${column}") button, div:has-text("${column}") button`).first();
        await first.click({ timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(600);
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
