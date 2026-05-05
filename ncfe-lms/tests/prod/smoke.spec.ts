import { test, expect } from '@playwright/test';

// Smoke tests need a clean slate — the prod project ships with admin
// storageState so /sign-in would auto-redirect to /admin/dashboard.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Production smoke — public + role logins', () => {
  test('home page redirects/serves without error', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.ok() || resp?.status() === 307 || resp?.status() === 302).toBeTruthy();
  });

  test('/sign-in renders cleanly', async ({ page }) => {
    const resp = await page.goto('/sign-in');
    expect(resp?.ok()).toBeTruthy();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('/sign-up renders cleanly', async ({ page }) => {
    const resp = await page.goto('/sign-up');
    expect(resp?.ok()).toBeTruthy();
  });

  test('/forgot-password redirects to contact-administrator', async ({ page }) => {
    const resp = await page.goto('/forgot-password');
    expect(resp?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: /contact your administrator/i })).toBeVisible();
  });

  test('admin login → /admin/dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('admin@learnerseducation.com');
    await page.getByLabel('Password').fill('passwordadmin');
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 60_000 });
  });

  test('assessor login → /c', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('jyothi@learnerseducation.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.waitForURL(/\/c(\/|$|\?)/, { timeout: 60_000 });
  });

  test('IQA login with new password "iqapassword" → /iqa or /dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('iqa@test.com');
    await page.getByLabel('Password').fill('iqapassword');
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.waitForURL(/\/(iqa|dashboard)/, { timeout: 60_000 });
  });

  test('student login → /c or /dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('bhatnagar007vidit@gmail.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.waitForURL(/\/(c|dashboard)/, { timeout: 60_000 });
  });
});
