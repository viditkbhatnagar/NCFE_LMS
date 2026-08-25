import {
  request as playwrightRequest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';

const BASE_URL = 'https://ncfe-lms.onrender.com';

export const PROD_RUN_ID = `PROD-${new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, '')
  .slice(2, 13)}-${Math.random().toString(16).slice(2, 8)}`;

export interface Creds {
  email: string;
  password: string;
}

/**
 * The `e2e-*@example.invalid` accounts are permanent, purpose-built fixtures
 * provisioned by `scripts/e2e-fixtures.mjs` — run that to (re)create them:
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/e2e-fixtures.mjs
 *
 * They share one enrolment on the EYE course, so the assessor assesses, and the
 * IQA quality-assures, exactly the fixture learner and nobody real. `.invalid`
 * is an RFC 2606 reserved TLD, so the welcome emails cannot reach a mailbox.
 *
 * Do NOT point these at real people's accounts: the suite re-asserts fixture
 * passwords on every provisioning run.
 */
export const PROD_USERS: Record<
  'admin' | 'assessor' | 'iqa' | 'iqaAssigned' | 'studentFixture' | 'studentReal',
  Creds
> = {
  admin: { email: 'admin@learnerseducation.com', password: 'passwordadmin' },
  assessor: { email: 'e2e-assessor@example.invalid', password: 'E2eFixture2026!' },
  // Sarah has the IQA role but is assigned to NO enrolments, so course-scoped
  // endpoints legitimately 403 her. Good for role-guard checks, wrong for
  // anything that needs data — that is what `iqaAssigned` is for.
  iqa: { email: 'iqa@test.com', password: 'iqapassword' },
  iqaAssigned: { email: 'e2e-iqa@example.invalid', password: 'E2eFixture2026!' },
  studentFixture: { email: 'e2e-learner@example.invalid', password: 'E2eFixture2026!' },
  // A real learner — use only for read-only assertions, never for mutations.
  studentReal: { email: 'bhatnagar007vidit@gmail.com', password: 'password' },
};

/**
 * Look up a user id by exact email, via the admin API.
 *
 * Specs used to hardcode `?search=jyothi` and then match on
 * PROD_USERS.assessor.email — which silently finds nothing the moment that
 * account changes. Search on the address' local part (no regex metacharacters,
 * so it dodges the `+`-in-email search bug) and match the address exactly.
 */
export async function findUserIdByEmail(admin: APIRequestContext, email: string): Promise<string> {
  const res = await admin.get(`/api/v2/admin/users?search=${encodeURIComponent(email.split('@')[0])}&limit=100`);
  const body = (await res.json()) as { data?: { users?: Array<{ _id: string; email: string }> } | Array<{ _id: string; email: string }> };
  const raw = body.data;
  const users = Array.isArray(raw) ? raw : (raw?.users ?? []);
  const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) throw new Error(`user ${email} not found on production — is the fixture provisioned? (scripts/e2e-fixtures.mjs)`);
  return match._id;
}

export async function makeApiContext(creds: Creds): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { accept: 'application/json' },
  });
  const csrfRes = await ctx.get('/api/auth/csrf');
  const csrfBody = (await csrfRes.json()) as { csrfToken: string };
  const sign = await ctx.post('/api/auth/callback/credentials', {
    form: {
      email: creds.email,
      password: creds.password,
      csrfToken: csrfBody.csrfToken,
      json: 'true',
      callbackUrl: BASE_URL,
    },
  });
  if (!sign.ok() && sign.status() !== 302) {
    const text = await sign.text().catch(() => '');
    await ctx.dispose();
    throw new Error(`prod sign-in for ${creds.email} returned ${sign.status()}: ${text.slice(0, 200)}`);
  }
  // verify session
  const session = await ctx.get('/api/auth/session');
  const body = (await session.json()) as { user?: { email?: string } };
  if (body?.user?.email?.toLowerCase() !== creds.email.toLowerCase()) {
    await ctx.dispose();
    throw new Error(`prod session for ${creds.email} not established (got ${body?.user?.email ?? 'none'})`);
  }
  return ctx;
}

export async function makeBrowserContext(browser: Browser, creds: Creds): Promise<BrowserContext> {
  // `storageState: undefined` is REQUIRED. Playwright applies the project's
  // `use.contextOptions` — including the admin `storageState` the prod project
  // sets — to browser.newContext(). Without this, every role context silently
  // carries the admin session cookie, NextAuth keeps that session, and a test
  // that believes it is an IQA actually runs as an admin. That is precisely how
  // an IQA-only 403 reached production unnoticed.
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: undefined });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  // role-specific landing — assessor/student → /c, admin → /admin/dashboard, iqa → /iqa or /dashboard
  await page.waitForURL(/\/(admin\/dashboard|iqa|c|dashboard)/, { timeout: 60_000 });

  // Fail fast if we are not who we asked to be — a silent identity mix-up makes
  // every downstream assertion meaningless.
  const res = await page.request.get(`${BASE_URL}/api/auth/session`);
  const body = (await res.json()) as { user?: { email?: string } };
  const actual = body?.user?.email?.toLowerCase();
  if (actual !== creds.email.toLowerCase()) {
    await context.close();
    throw new Error(`browser context identity mismatch: asked for ${creds.email}, got ${actual ?? 'anonymous'}`);
  }

  await page.close();
  return context;
}
