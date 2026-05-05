import { test, expect } from '../fixtures/base';

const ROUTES: { path: string; landmark: RegExp }[] = [
  { path: '/iqa/dashboard', landmark: /(iqa|dashboard|sampling|decisions)/i },
  { path: '/iqa/sampling', landmark: /sampling/i },
  { path: '/iqa/decisions', landmark: /decisions?/i },
  { path: '/iqa/actions', landmark: /actions?/i },
  { path: '/iqa/documents', landmark: /documents?/i },
  { path: '/iqa/standardisation', landmark: /standardisation/i },
  { path: '/iqa/eqa-readiness', landmark: /(eqa|readiness)/i },
];

for (const route of ROUTES) {
  test(`iqa health: ${route.path}`, async ({ page, consoleCapture }) => {
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
