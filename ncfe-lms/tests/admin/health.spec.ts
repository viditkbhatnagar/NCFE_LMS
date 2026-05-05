import { test, expect } from '../fixtures/base';
import { isRoleAvailable } from '../fixtures/base';

const ROUTES: { path: string; landmark: RegExp }[] = [
  { path: '/admin/dashboard', landmark: /(admin|dashboard|users|courses)/i },
  { path: '/admin/users', landmark: /users?/i },
  { path: '/admin/courses', landmark: /courses?/i },
  { path: '/admin/enrolments', landmark: /enrolments?/i },
  { path: '/admin/audit-logs', landmark: /(audit|logs?)/i },
];

test.describe('admin health (skipped if admin login failed)', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  for (const route of ROUTES) {
    test(`admin health: ${route.path}`, async ({ page, consoleCapture }) => {
      const responses: { url: string; status: number }[] = [];
      page.on('response', (r) => {
        if (r.url().startsWith('http://localhost:3000')) {
          responses.push({ url: r.url(), status: r.status() });
        }
      });
      const resp = await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30_000 });
      expect(resp).not.toBeNull();
      expect(resp!.status()).toBeLessThan(400);
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(20);
      await expect(page.locator('body')).toContainText(route.landmark, { timeout: 12_000 });
      const fivexx = responses.filter((r) => r.status >= 500);
      expect(fivexx, `5xx responses on ${route.path}: ${JSON.stringify(fivexx)}`).toEqual([]);
      expect(consoleCapture.errors).toEqual([]);
    });
  }
});
