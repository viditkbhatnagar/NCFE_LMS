import { test, expect } from '@playwright/test';
import { PROD_USERS } from './_helpers';

// Production mobile smoke at iPhone SE viewport (375x667).
// Don't block launch on minor regressions — log them as observations.

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('mobile sign-in works at 375x667', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/sign-in');
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Email').fill(PROD_USERS.studentReal.email);
  await page.getByLabel('Password').fill(PROD_USERS.studentReal.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.waitForURL(/\/(c|dashboard)/, { timeout: 60_000 });
});

test('mobile assessor /c shows the course list (degraded layout acceptable)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(PROD_USERS.assessor.email);
  await page.getByLabel('Password').fill(PROD_USERS.assessor.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.waitForURL(/\/c(\/|$|\?)/, { timeout: 60_000 });

  // The course card text should be visible — text-truncation is acceptable
  await expect(page.getByText(/NCFE/i).first()).toBeVisible({ timeout: 30_000 });
});
