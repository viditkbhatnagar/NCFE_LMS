import { test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Captures production screenshots for docs/USER_GUIDE.md.
// Runs as a one-shot — invoke with:
//   npx playwright test --config=playwright.prod.config.ts --grep "capture screenshots"
//
// Skips itself unless CAPTURE_SCREENSHOTS=1 to avoid running in regular CI.

const SHOULD_RUN = process.env.CAPTURE_SCREENSHOTS === '1';

const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'screenshots');

const ADMIN = { email: 'admin@learnerseducation.com', password: 'passwordadmin' };
const ASSESSOR = { email: 'jyothi@learnerseducation.com', password: 'password123' };
const STUDENT = { email: 'bhatnagar007vidit@gmail.com', password: 'password' };
const IQA = { email: 'iqa@test.com', password: 'iqapassword' };

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.waitForURL(/\/(c|admin\/dashboard|iqa|dashboard)/, { timeout: 60_000 });
  // Settle for fonts/icons
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function snap(page: Page, file: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: false });
  console.log('[capture]', file);
}

test.describe('capture screenshots for the user guide', () => {
  test.skip(!SHOULD_RUN, 'set CAPTURE_SCREENSHOTS=1 to run');
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });

  test('public + admin', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle').catch(() => {});
    await snap(page, '01-sign-in.png');

    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle').catch(() => {});
    await snap(page, '02-forgot-password.png');

    await signIn(page, ADMIN.email, ADMIN.password);
    await snap(page, '03-admin-dashboard.png');

    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    await snap(page, '04-admin-users-list.png');

    await page.goto('/admin/courses');
    await page.waitForTimeout(2000);
    await snap(page, '05-admin-courses.png');

    await page.goto('/admin/enrolments');
    await page.waitForTimeout(2000);
    await snap(page, '06-admin-enrolments.png');

    await page.goto('/admin/audit-logs');
    await page.waitForTimeout(2000);
    await snap(page, '07-admin-audit-logs.png');
  });

  test('assessor', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, ASSESSOR.email, ASSESSOR.password);
    await snap(page, '10-assessor-courses.png');

    // Click into the NCFE qualification
    const card = page.getByText(/NCFE Level 3/i).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1500);
      await snap(page, '11-assessor-course-home.png');

      const url = page.url();
      const slugMatch = url.match(/\/c\/([^/?#]+)/);
      const slug = slugMatch?.[1];
      if (slug) {
        await page.goto(`/c/${slug}/assessment`);
        await page.waitForTimeout(2000);
        await snap(page, '12-assessor-assessment-list.png');

        await page.goto(`/c/${slug}/portfolio`);
        await page.waitForTimeout(2000);
        await snap(page, '13-assessor-portfolio.png');

        await page.goto(`/c/${slug}/progress`);
        await page.waitForTimeout(2000);
        await snap(page, '14-assessor-progress.png');
      }
    }
  });

  test('student', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, STUDENT.email, STUDENT.password);
    await snap(page, '20-student-courses.png');

    await page.goto('/profile');
    await page.waitForTimeout(2000);
    await snap(page, '21-student-profile.png');
  });

  test('iqa', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, IQA.email, IQA.password);
    await snap(page, '30-iqa-dashboard.png');

    await page.goto('/iqa/sampling');
    await page.waitForTimeout(2000);
    await snap(page, '31-iqa-sampling.png');

    await page.goto('/iqa/decisions');
    await page.waitForTimeout(2000);
    await snap(page, '32-iqa-decisions.png');
  });
});
