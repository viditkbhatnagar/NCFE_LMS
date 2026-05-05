import { test, expect } from '../fixtures/base';
import { QUALIFICATION_SLUG } from '../users';

const ROUTES: { path: string; landmark: RegExp }[] = [
  { path: '/c', landmark: /(my courses|level)/i },
  { path: `/c/${QUALIFICATION_SLUG}`, landmark: /(course overview|recent)/i },
  { path: `/c/${QUALIFICATION_SLUG}/assessment`, landmark: /assessment/i },
  { path: `/c/${QUALIFICATION_SLUG}/progress`, landmark: /(progress|units)/i },
  { path: `/c/${QUALIFICATION_SLUG}/portfolio`, landmark: /(portfolio|evidence)/i },
  { path: `/c/${QUALIFICATION_SLUG}/course-documents`, landmark: /(documents|folder)/i },
  { path: `/c/${QUALIFICATION_SLUG}/personal-documents`, landmark: /(documents|personal)/i },
  { path: `/c/${QUALIFICATION_SLUG}/materials`, landmark: /materials/i },
  { path: `/c/${QUALIFICATION_SLUG}/work-hours`, landmark: /(work hours|hours)/i },
];

for (const route of ROUTES) {
  test(`student health: ${route.path}`, async ({ page, consoleCapture }) => {
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
