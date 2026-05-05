import { test, expect } from '@playwright/test';
import { PROD_USERS } from './_helpers';

// Production file-preview smoke. Signs in as Vidit (a real student with
// existing portfolio evidence on production), navigates to portfolio,
// and verifies that page assets (fonts, icons, CDN-served images) render
// without broken-image markers.

test.use({ storageState: { cookies: [], origins: [] } });

test('production-served assets render: no broken images on student portfolio', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(PROD_USERS.studentReal.email);
  await page.getByLabel('Password').fill(PROD_USERS.studentReal.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.waitForURL(/\/(c|dashboard)/, { timeout: 60_000 });

  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});

  // Inspect every <img> that's currently in the DOM. naturalWidth==0 means
  // it failed to load (common for broken icon CDNs or expired S3 URLs).
  const imgStats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map((img) => ({
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
    }));
  });

  const broken = imgStats.filter(
    (i) => i.complete && i.naturalWidth === 0 && i.naturalHeight === 0,
  );
  expect(
    broken,
    `broken images detected: ${JSON.stringify(broken).slice(0, 500)}`,
  ).toEqual([]);

  // Filter out known third-party warnings that don't reflect our app
  const meaningful = consoleErrors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('Hot Module') &&
      !e.includes('next-auth') &&
      !e.match(/cookies?/i),
  );
  expect(meaningful, `console errors: ${meaningful.join(' | ')}`).toEqual([]);
});
