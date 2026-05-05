import { test, expect } from '../fixtures/base';
import { QUALIFICATION_SLUG } from '../users';

const ROUTES: { path: string; landmark: RegExp; expected5xx?: false }[] = [
  { path: '/c', landmark: /(my courses|select a course|level)/i },
  { path: `/c/${QUALIFICATION_SLUG}`, landmark: /(course overview|recent activity|my learners)/i },
  { path: `/c/${QUALIFICATION_SLUG}/assessment`, landmark: /assessment/i },
  { path: `/c/${QUALIFICATION_SLUG}/progress`, landmark: /(progress|units)/i },
  { path: `/c/${QUALIFICATION_SLUG}/portfolio`, landmark: /(portfolio|evidence)/i },
  { path: `/c/${QUALIFICATION_SLUG}/course-documents`, landmark: /(documents|folder)/i },
  { path: `/c/${QUALIFICATION_SLUG}/personal-documents`, landmark: /(documents|personal)/i },
  { path: `/c/${QUALIFICATION_SLUG}/materials`, landmark: /materials/i },
  { path: `/c/${QUALIFICATION_SLUG}/work-hours`, landmark: /(work hours|hours)/i },
  { path: `/c/${QUALIFICATION_SLUG}/members`, landmark: /(members|learners)/i },
  { path: `/c/${QUALIFICATION_SLUG}/notifications`, landmark: /notifications/i },
  { path: '/c/notifications', landmark: /notifications/i },
];

for (const route of ROUTES) {
  test(`assessor health: ${route.path}`, async ({ page, consoleCapture }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      const url = r.url();
      if (url.startsWith('http://localhost:3000')) {
        responses.push({ url, status: r.status() });
      }
    });
    const resp = await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30_000 });
    expect(resp, `no response for ${route.path}`).not.toBeNull();
    expect(resp!.status(), `top-level status for ${route.path}`).toBeLessThan(400);

    // Ensure something rendered (the page didn't blank-screen)
    const body = await page.locator('body').innerText();
    expect(body.length, `empty page body for ${route.path}`).toBeGreaterThan(20);

    // Landmark text — soft check; failure here means the page rendered but the
    // critical content didn't. Tolerate timing on dynamic loads.
    await expect(page.locator('body')).toContainText(route.landmark, { timeout: 12_000 });

    // No 5xx from any sub-resource
    const fivexx = responses.filter((r) => r.status >= 500);
    expect(fivexx, `5xx responses on ${route.path}: ${JSON.stringify(fivexx)}`).toEqual([]);

    // No console errors except known-ignored
    expect(consoleCapture.errors, `console errors on ${route.path}`).toEqual([]);
  });
}
