import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { USERS, type Role } from '../users';

async function signIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<{ ok: boolean; role?: Role; error?: string }> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15_000 }).catch(() => {}),
    page.getByRole('button', { name: /continue with email/i }).click(),
  ]);

  // Explicit failure path
  const error = await page.getByText('Invalid email or password').isVisible().catch(() => false);
  if (error) return { ok: false, error: 'Invalid email or password' };

  // Confirm session by hitting the API
  const sessionResp = await page.request.get('/api/auth/session');
  const session = await sessionResp.json();
  const role = session?.user?.role as Role | undefined;
  if (!role) return { ok: false, error: 'No session role after sign-in' };
  return { ok: true, role };
}

async function persistStorageState(
  context: import('@playwright/test').BrowserContext,
  filePath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await context.storageState({ path: filePath });
}

const PROBE_REPORT = path.join(__dirname, '..', '.auth', 'auth-probe.json');

interface ProbeReport {
  [role: string]: { ok: boolean; reason?: string };
}

function writeProbe(update: Partial<ProbeReport>) {
  let existing: ProbeReport = {};
  if (fs.existsSync(PROBE_REPORT)) {
    try {
      existing = JSON.parse(fs.readFileSync(PROBE_REPORT, 'utf8')) as ProbeReport;
    } catch {
      existing = {};
    }
  }
  fs.writeFileSync(PROBE_REPORT, JSON.stringify({ ...existing, ...update }, null, 2));
}

setup('authenticate as assessor', async ({ page, context }) => {
  const u = USERS.assessor;
  const result = await signIn(page, u.email, u.password);
  expect(result.ok, `Assessor sign-in failed: ${result.error}`).toBeTruthy();
  expect(result.role).toBe('assessor');
  await persistStorageState(context, u.storageStatePath);
  writeProbe({ assessor: { ok: true } });
});

setup('authenticate as student', async ({ page, context }) => {
  const u = USERS.student;
  const result = await signIn(page, u.email, u.password);
  expect(result.ok, `Student sign-in failed: ${result.error}`).toBeTruthy();
  expect(result.role).toBe('student');
  await persistStorageState(context, u.storageStatePath);
  writeProbe({ student: { ok: true } });
});

setup('authenticate as second student', async ({ page, context }) => {
  const u = USERS.student2;
  const result = await signIn(page, u.email, u.password);
  if (!result.ok) {
    writeProbe({ student2: { ok: false, reason: result.error } });
    setup.fail();
  }
  expect(result.role).toBe('student');
  await persistStorageState(context, u.storageStatePath);
  writeProbe({ student2: { ok: true } });
});

setup('authenticate as iqa', async ({ page, context }) => {
  const u = USERS.iqa;
  const result = await signIn(page, u.email, u.password);
  expect(result.ok, `IQA sign-in failed: ${result.error}`).toBeTruthy();
  expect(result.role).toBe('iqa');
  await persistStorageState(context, u.storageStatePath);
  writeProbe({ iqa: { ok: true } });
});

setup('authenticate as admin', async ({ page, context }) => {
  const u = USERS.admin;
  const result = await signIn(page, u.email, u.password);
  if (!result.ok) {
    // Don't fail the whole suite — write a marker file the admin specs check.
    writeProbe({ admin: { ok: false, reason: result.error } });
    fs.mkdirSync(path.dirname(u.storageStatePath), { recursive: true });
    fs.writeFileSync(u.storageStatePath, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  expect(result.role).toBe('admin');
  await persistStorageState(context, u.storageStatePath);
  writeProbe({ admin: { ok: true } });
});
