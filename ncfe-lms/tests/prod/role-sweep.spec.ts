import { test, expect, type Page, type BrowserContext, type Browser } from '@playwright/test';
import { PROD_USERS, makeBrowserContext, type Creds } from './_helpers';

/**
 * Exhaustive, NON-MUTATING production sweep.
 *
 * For every role, visit every page that role can reach and click every control
 * that cannot change data. Fail on ANY of:
 *   - an /api/ response with status >= 400
 *   - an uncaught page exception
 *   - a visible "couldn't load" / "server returned an error" banner
 *
 * This is the regression net for the class of bug Robert hit: a page that
 * renders its chrome fine but whose data fetch 403s because the client routed
 * the request at an endpoint the role is not allowed to call.
 *
 * Safety: this runs against live production, so the click sweep is restricted
 * to an allowlist of read-only control labels. Nothing here creates, edits,
 * deletes, signs off, publishes or sends.
 */

const EYE_SLUG = 'ncfe-cache-level-3-diploma-for-working-in-early-years-sector-eye';

/** Controls that are safe to click on production — pure view-state changes. */
const SAFE_CLICK = /^(home|assessment|progress|portfolio|materials|work hours|personal documents|course documents|members|all learners|expand|collapse|show|view|open|details|filter|sort|search|next|previous|close|cancel|back|refresh|retry|grid|list|tab)/i;

/** Anything matching this is never clicked, even if it also matches SAFE_CLICK. */
const DESTRUCTIVE = /(delete|remove|withdraw|deactivate|sign ?off|publish|send|reset|save|submit|create|new |add |upload|assign|approve|reject|confirm|invite|export|generate|import|duplicate)/i;

interface Failure {
  kind: 'api' | 'pageerror' | 'banner';
  detail: string;
}

function instrument(page: Page, failures: Failure[]) {
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    // NextAuth probes 401 by design when checking an anonymous session.
    if (url.includes('/api/auth/')) return;
    if (res.status() >= 400) {
      failures.push({ kind: 'api', detail: `${res.status()} ${res.request().method()} ${new URL(url).pathname}${new URL(url).search}` });
    }
  });
  page.on('pageerror', (err) => {
    failures.push({ kind: 'pageerror', detail: err.message });
  });
}

async function checkBanner(page: Page, where: string, failures: Failure[]) {
  const banner = page.getByText(/couldn't load this page|the server returned an error|failed to load|something went wrong/i);
  if (await banner.first().isVisible().catch(() => false)) {
    const text = await banner.first().innerText().catch(() => '?');
    failures.push({ kind: 'banner', detail: `${where}: "${text.replace(/\s+/g, ' ').trim()}"` });
  }
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
}

async function visit(page: Page, path: string, failures: Failure[]) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await checkBanner(page, path, failures);
}

/** Click every safe, visible, enabled control on the current page. */
async function sweepButtons(page: Page, where: string, failures: Failure[]) {
  const controls = page.locator('button:visible, [role="tab"]:visible');
  const n = Math.min(await controls.count(), 40);
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    const label = ((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    if (DESTRUCTIVE.test(label)) continue;
    if (!SAFE_CLICK.test(label)) continue;
    if (!(await el.isEnabled().catch(() => false))) continue;

    await el.click({ timeout: 10_000, trial: false }).catch(() => {});
    await page.waitForTimeout(400);
    await checkBanner(page, `${where} → click "${label}"`, failures);
    // Dismiss anything modal the click may have opened, without submitting it.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
}

function report(role: string, failures: Failure[]) {
  const lines = failures.map((f) => `  [${f.kind}] ${f.detail}`);
  expect(failures, `${role} sweep found ${failures.length} failure(s):\n${lines.join('\n')}`).toEqual([]);
}

/** Course-scoped pages an IQA is allowed to see (Course Documents + Live Classes are hidden for IQA). */
const IQA_COURSE_PAGES = ['', '/assessment', '/progress', '/portfolio', '/personal-documents', '/materials', '/work-hours'];
const ASSESSOR_COURSE_PAGES = [...IQA_COURSE_PAGES, '/course-documents', '/live-sessions', '/members'];

const IQA_STANDALONE = ['/iqa/dashboard', '/iqa/sampling', '/iqa/decisions', '/iqa/actions', '/iqa/eqa-readiness', '/iqa/standardisation', '/iqa/documents'];

test.describe('Production role sweep — every page, every safe control', () => {
  test.describe.configure({ mode: 'serial' });

  async function runSweep(
    browser: Browser,
    role: string,
    creds: Creds,
    paths: string[],
  ): Promise<void> {
    let context: BrowserContext | undefined;
    try {
      context = await makeBrowserContext(browser, creds);
      const page = await context.newPage();
      const failures: Failure[] = [];
      instrument(page, failures);

      for (const p of paths) {
        await visit(page, p, failures);
        await sweepButtons(page, p, failures);
      }

      report(role, failures);
    } finally {
      await context?.close();
    }
  }

  // Uses the ASSIGNED IQA on purpose: an IQA with no enrolments legitimately
  // 403s on course-scoped endpoints, which would drown the real signal.
  test('IQA — course view + IQA dashboard load without a single API error', async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    await runSweep(browser, 'iqa', PROD_USERS.iqaAssigned, [
      '/c',
      ...IQA_COURSE_PAGES.map((p) => `/c/${EYE_SLUG}${p}`),
      ...IQA_STANDALONE,
      '/notifications',
      '/profile',
    ]);
  });

  test('assessor — full course view loads without a single API error', async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    await runSweep(browser, 'assessor', PROD_USERS.assessor, [
      '/c',
      ...ASSESSOR_COURSE_PAGES.map((p) => `/c/${EYE_SLUG}${p}`),
      '/notifications',
      '/profile',
    ]);
  });

  test('admin — superset course view + admin dashboard load without a single API error', async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    await runSweep(browser, 'admin', PROD_USERS.admin, [
      '/admin/dashboard',
      '/c',
      ...ASSESSOR_COURSE_PAGES.map((p) => `/c/${EYE_SLUG}${p}`),
      '/notifications',
      '/profile',
    ]);
  });
});

/**
 * Targeted regression for the exact bug Robert reported.
 *
 * Before the fix, /c/{slug}/assessment routed an IQA at
 * /api/v2/student/assessments — a withAuth(['student']) route — which 403s and
 * renders "The server returned an error. Please try again."
 */
test.describe('IQA assessment page — Robert Mitton regression', () => {
  test('IQA never calls the student-only assessments endpoint', async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const context = await makeBrowserContext(browser, PROD_USERS.iqaAssigned);
    try {
      const page = await context.newPage();
      const calls: string[] = [];
      const failures: Failure[] = [];
      instrument(page, failures);
      page.on('request', (r) => {
        const p = new URL(r.url()).pathname;
        if (p.startsWith('/api/v2/')) calls.push(p);
      });

      await visit(page, `/c/${EYE_SLUG}/assessment`, failures);

      expect(calls, 'IQA must not hit the student-only assessments endpoint').not.toContain('/api/v2/student/assessments');
      expect(calls, 'IQA must read assessments from the oversight endpoint').toContain('/api/v2/assessments');
      report('iqa-assessment', failures);

      // The page must render its list surface, not the error state.
      await expect(page.getByText(/couldn't load this page/i)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
