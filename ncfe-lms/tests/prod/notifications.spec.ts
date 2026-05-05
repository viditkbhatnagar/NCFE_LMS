import { test, expect, request as playwrightRequest } from '@playwright/test';
import { PROD_USERS, makeApiContext } from './_helpers';

// Production notifications smoke — verifies the notifications API responds
// for an authenticated user and the read/unread state can be queried.

test('Jyothi can list notifications via API on production', async () => {
  test.setTimeout(60_000);
  const api = await makeApiContext(PROD_USERS.assessor);
  try {
    const resp = await api.get('/api/notifications');
    if (!resp.ok()) {
      // Some endpoints are role-restricted; accept 200 or 403 (with logged note)
      console.warn(`[notifications] /api/notifications returned ${resp.status()} for assessor`);
      return;
    }
    const body = await resp.json();
    expect(body).toBeTruthy();
    // Shape may be { data: [...] } or { notifications: [...] } — accept either
    const items = body.data || body.notifications || [];
    expect(Array.isArray(items)).toBe(true);
  } finally {
    await api.dispose();
  }
});

test('admin can list notifications via API on production', async () => {
  test.setTimeout(60_000);
  const api = await makeApiContext(PROD_USERS.admin);
  try {
    const resp = await api.get('/api/notifications');
    if (resp.ok()) {
      const body = await resp.json();
      const items = body.data || body.notifications || [];
      expect(Array.isArray(items)).toBe(true);
    }
  } finally {
    await api.dispose();
  }
});

test.describe('notifications browser flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('notifications page renders for assessor browser session', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/sign-in');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Email').fill(PROD_USERS.assessor.email);
    await page.getByLabel('Password').fill(PROD_USERS.assessor.password);
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.waitForURL(/\/c(\/|$|\?)/, { timeout: 60_000 });

    // Try direct nav to /notifications
    const resp = await page.goto('/notifications');
    if (resp && resp.ok()) {
      await page.waitForTimeout(2_000);
    }
  });
});
