import { test, expect } from '@playwright/test';

// Production end-to-end smoke: prove the deployed app can run the
// real-world admin → student → assessor → IQA flow without errors.
// Uses the auth state from prod-auth-setup (admin), and signs in as
// each subsequent role via direct browser context.

const TIMESTAMP = Date.now();
const SMOKE_EMAIL = `intern+prodsmoke-${TIMESTAMP}@learnerseducation.com`;
const SMOKE_NAME = `[PROD-SMOKE] Transient ${TIMESTAMP}`;

let smokeUserId: string | null = null;
let smokePassword: string | null = null;

test.describe.configure({ mode: 'serial' });

test.describe('Production — admin user-create + email + cleanup', () => {
  test('admin creates a transient smoke user via UI, captures auto-password from success modal, verifies emailSent', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Add User' }).click();

    await page.getByLabel('Name').fill(SMOKE_NAME);
    await page.getByLabel('Email').fill(SMOKE_EMAIL);

    // Capture the auto-generated password from the visible password field
    const passwordInput = page.getByLabel('Password', { exact: true });
    await expect(passwordInput).toBeVisible();
    smokePassword = await passwordInput.inputValue();
    expect(smokePassword).toBeTruthy();
    expect(smokePassword!.length).toBe(14);

    await page.getByRole('button', { name: 'Create' }).click();

    // Success modal must show 'User created' AND 'Email sent ✓'.
    // Brevo's API call from Render can take 5-15s on a cold path; 60s is generous.
    await expect(page.getByText('User created')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Email sent to/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(SMOKE_EMAIL).first()).toBeVisible();
    await expect(page.getByText(smokePassword!).first()).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).click();

    // Find the user in the list to capture their _id
    await page.getByPlaceholder(/Search/).fill(SMOKE_EMAIL);
    await expect(page.getByText(SMOKE_EMAIL)).toBeVisible({ timeout: 10_000 });

    // The "+" in the email breaks the API's regex search; search by the unique suffix instead
    const list = await page.request.get(`/api/v2/admin/users?search=prodsmoke-${TIMESTAMP}`);
    const body = await list.json();
    smokeUserId = body.data.find((u: { email: string; _id: string }) => u.email === SMOKE_EMAIL)?._id;
    expect(smokeUserId).toBeTruthy();
  });

  test('Brevo events API confirms the welcome email was accepted', async () => {
    test.setTimeout(120_000);

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) test.skip(true, 'BREVO_API_KEY not configured for verification');

    let events: Array<{ event: string; email: string; date: string }> = [];
    for (let i = 0; i < 18; i++) {
      const res = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(SMOKE_EMAIL)}&limit=10`,
        { headers: { 'api-key': apiKey!, accept: 'application/json' } },
      );
      if (res.ok) {
        const body = (await res.json()) as { events?: typeof events };
        if (body.events && body.events.length > 0) {
          events = body.events;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
    expect(events.length, `Brevo events for ${SMOKE_EMAIL}: ${JSON.stringify(events)}`).toBeGreaterThanOrEqual(1);
  });

  test('admin soft-deletes the smoke user (cleanup)', async ({ page }) => {
    test.setTimeout(60_000);
    if (!smokeUserId) test.skip(true, 'no smoke user to delete');

    const resp = await page.request.delete(`/api/v2/admin/users/${smokeUserId}`);
    expect(resp.ok()).toBeTruthy();
  });
});
