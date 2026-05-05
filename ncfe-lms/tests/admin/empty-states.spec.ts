import { test, expect } from '../fixtures/base';
import { isRoleAvailable } from '../fixtures/base';

test.describe('Admin — G9 empty / loading / error states', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  test('users page shows empty state for impossible search', async ({ ensurePage }) => {
    const page = await ensurePage('admin');
    await page.goto('/admin/users');
    // Type a string that should match nothing
    await page.fill('input[placeholder*="Search by name"]', 'XQXQXQXNOMATCH-zzz');
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 5000 });
  });

  test('error state surfaces with retry when API returns 500', async ({ ensurePage }) => {
    const page = await ensurePage('admin');
    await page.route('**/api/v2/admin/qualifications**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.goto('/admin/courses');
    await expect(page.locator('[data-testid="error-state"]')).toBeVisible({ timeout: 5000 });
    // Retry button is present
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // Now let it succeed and click retry
    await page.unroute('**/api/v2/admin/qualifications**');
    await page.getByRole('button', { name: 'Retry' }).click();
    // Either we land on the table or the empty state, but not error
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0, { timeout: 5000 });
  });

  test('audit-logs shows empty state when no logs match filter', async ({ ensurePage }) => {
    const page = await ensurePage('admin');
    await page.goto('/admin/audit-logs');
    // Filter by a future date to guarantee zero results
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    const fromInput = page.locator('input[type="date"]').first();
    await fromInput.fill(future.toISOString().slice(0, 10));
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 5000 });
  });
});
