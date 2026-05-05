import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Smoke-verify that the James Bond demo account can sign in and reach
// their course home. Reads the captured password from DEMO_CREDENTIALS.md.

test.use({ storageState: { cookies: [], origins: [] } });

test('James Bond demo student can sign in and reach /c on production', async ({ page }) => {
  test.setTimeout(120_000);

  const credPath = path.join(__dirname, '..', 'DEMO_CREDENTIALS.md');
  if (!fs.existsSync(credPath)) {
    test.skip(true, `${credPath} missing — run create-demo-student first`);
  }
  const text = fs.readFileSync(credPath, 'utf8');
  const match = text.match(/^- \*\*Password:\*\* (.+)$/m);
  if (!match) throw new Error('Could not parse password from DEMO_CREDENTIALS.md');
  const demoPassword = match[1].trim();

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('7777jamesbond7777@gmail.com');
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Continue with email' }).click();

  // Student lands on /c
  await page.waitForURL(/\/c(\/|$|\?)/, { timeout: 60_000 });

  // The NCFE qualification card should be visible
  await expect(page.getByText(/NCFE Level 3/i).first()).toBeVisible({ timeout: 30_000 });
});
