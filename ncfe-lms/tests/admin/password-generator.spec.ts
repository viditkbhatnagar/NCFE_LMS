import { test, expect, isRoleAvailable } from '../fixtures/base';
import { RUN_ID } from '../run-id';

const PW_REGEX = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /[2-9]/,
  symbol: /[!@#$%^&*\-_=+]/,
};

test.describe('Admin — auto-password generator UX (Phase 1.5)', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  test('Create user dialog auto-generates a password and Copy/Eye/Generate work', async ({
    page,
    context,
    created,
  }) => {
    test.setTimeout(180_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: 'Add User' }).click();

    const passwordInput = page.getByLabel('Password', { exact: true });
    await expect(passwordInput).toBeVisible();

    // Auto-pre-fill (length 14, all 4 character classes)
    const initial = await passwordInput.inputValue();
    expect(initial.length).toBe(14);
    expect(initial).toMatch(PW_REGEX.lower);
    expect(initial).toMatch(PW_REGEX.upper);
    expect(initial).toMatch(PW_REGEX.digit);
    expect(initial).toMatch(PW_REGEX.symbol);

    // Click Generate — value must change
    await page.getByRole('button', { name: 'Generate password' }).click();
    const regenerated = await passwordInput.inputValue();
    expect(regenerated).not.toBe(initial);
    expect(regenerated.length).toBe(14);

    // Click Copy — clipboard equals input value
    await page.getByRole('button', { name: 'Copy password' }).click();
    const fromClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(fromClipboard).toBe(regenerated);

    // Eye toggle flips input type
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Submit form
    const email = `e2e-${RUN_ID.toLowerCase()}-pwgen-${Date.now()}@example.invalid`;
    await page.getByLabel('Name').fill(`[${RUN_ID}] Password Gen User`);
    await page.getByLabel('Email').fill(email);
    // Capture the final password value
    const finalPassword = await passwordInput.inputValue();
    await page.getByRole('button', { name: 'Create' }).click();

    // Success modal with the same password.
    // Brevo rejects @example.invalid recipients, so the welcome-email
    // round-trip can take 30-60s before the route returns. Generous timeout.
    await expect(page.getByText('User created')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(finalPassword).first()).toBeVisible();

    // Copy all credentials → clipboard contains 4-line block with prod login URL
    await page.getByRole('button', { name: /^Copy all credentials$/ }).click();
    const credBlock = await page.evaluate(() => navigator.clipboard.readText());
    expect(credBlock).toContain(`Email: ${email}`);
    expect(credBlock).toContain(`Password: ${finalPassword}`);
    expect(credBlock).toContain('Login: https://ncfe-lms.onrender.com/sign-in');
    expect(credBlock.split('\n')).toHaveLength(4);

    // Done → modal closes, user appears in list
    await page.getByRole('button', { name: 'Done' }).click();

    // Track for cleanup
    const list = await page.request.get('/api/v2/admin/users?search=' + encodeURIComponent(email));
    const body = await list.json();
    const created_user = body.data?.find((u: { email: string; _id: string }) => u.email === email);
    expect(created_user).toBeDefined();
    created.trackAdmin('admin-user', created_user._id);

    // Now exercise Reset Password flow on the same user
    await page.reload();
    await page.getByPlaceholder(/Search/).fill(email);
    // Wait for the table to settle to a single row matching our user
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
    // Click the Reset PW button on that row (only one user should be visible)
    await page.getByRole('button', { name: 'Reset PW' }).first().click();

    const newPwInput = page.getByLabel('New password', { exact: true });
    await expect(newPwInput).toBeVisible({ timeout: 10_000 });
    const generatedReset = await newPwInput.inputValue();
    expect(generatedReset.length).toBe(14);
    expect(generatedReset).toMatch(PW_REGEX.symbol);

    await page.getByRole('button', { name: 'Reset Password' }).click();
    await expect(page.getByText('Password reset')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Done' }).click();
  });
});
