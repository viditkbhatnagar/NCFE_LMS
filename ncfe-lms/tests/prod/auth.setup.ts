import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ADMIN = {
  email: 'admin@learnerseducation.com',
  password: 'passwordadmin',
  storageStatePath: path.join(__dirname, '..', '.auth', 'prod-admin.json'),
};

setup('cold-start warm-up + admin auth on production', async ({ page }) => {
  setup.setTimeout(180_000);

  // Cold-start warm-up. Render free/paid tier may sleep; first request can take 30-60s.
  await page.request.get('/api/auth/session', { timeout: 90_000 });

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();

  // Admin redirects to /admin/dashboard
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 60_000 });

  fs.mkdirSync(path.dirname(ADMIN.storageStatePath), { recursive: true });
  await page.context().storageState({ path: ADMIN.storageStatePath });
});
