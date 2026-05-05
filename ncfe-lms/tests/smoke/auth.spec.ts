import { test, expect } from '../fixtures/base';
import { USERS } from '../users';
import { RUN_ID } from '../run-id';

test.describe('Authentication — public flows', () => {
  test('sign-in: empty submit is blocked by HTML5 validation', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /continue with email/i }).click();
    // Browser validation prevents submit; URL stays on /sign-in
    await expect(page).toHaveURL(/\/sign-in/);
    const emailInput = page.getByLabel('Email');
    expect(await emailInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  });

  test('sign-in: wrong password shows error', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(USERS.assessor.email);
    await page.getByLabel('Password').fill('definitelyNotTheRightPassword!');
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('sign-in: assessor login redirects to /c', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(USERS.assessor.email);
    await page.getByLabel('Password').fill(USERS.assessor.password);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page).toHaveURL(/\/c(?:\/|$)/, { timeout: 15_000 });
  });

  test('sign-in: student login redirects to /c', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(USERS.student.email);
    await page.getByLabel('Password').fill(USERS.student.password);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page).toHaveURL(/\/c(?:\/|$)/, { timeout: 15_000 });
  });

  test('sign-in: iqa login lands on /iqa or /dashboard', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(USERS.iqa.email);
    await page.getByLabel('Password').fill(USERS.iqa.password);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page).toHaveURL(/\/(iqa|dashboard)/, { timeout: 15_000 });
  });

  test('sign-in: admin login redirects to /admin/dashboard', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(USERS.admin.email);
    await page.getByLabel('Password').fill(USERS.admin.password);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });
  });

  test('sign-in: Google sign-in button is wired', async ({ page }) => {
    await page.goto('/sign-in');
    const googleBtn = page.getByRole('button', { name: /sign in with google/i });
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
    // Don't actually click — would redirect us off-host. Just confirm presence.
  });

  test('sign-up: passwords-mismatch shows inline error', async ({ page }) => {
    await page.goto('/sign-up');
    const tag = `nope_${RUN_ID}_${Date.now()}@example.invalid`;
    await page.getByLabel('Full Name').fill('Mismatch User');
    await page.getByLabel('Email').fill(tag);
    await page.getByLabel('Password', { exact: true }).fill('Abcdefg1');
    await page.getByLabel('Confirm Password').fill('NotTheSame1');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('forgot-password: directs to contact administrator', async ({ page }) => {
    // Self-service password reset has been disabled — students cannot reset
    // their own password. The /forgot-password page now points users at
    // their centre administrator instead.
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /contact your administrator/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
  });

  test('unauthenticated /c redirects to /sign-in', async ({ page }) => {
    await page.goto('/c');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('unauthenticated /admin/dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
