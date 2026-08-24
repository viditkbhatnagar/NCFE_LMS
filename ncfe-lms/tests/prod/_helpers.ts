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

export const PROD_USERS: Record<'admin' | 'assessor' | 'iqa' | 'iqaAssigned' | 'studentReal', Creds> = {
  admin: { email: 'admin@learnerseducation.com', password: 'passwordadmin' },
  // WARNING: Jyothi was promoted to ADMIN, so this row no longer exercises the
  // assessor role — it is a second admin. The only true assessor on production
  // is nahmiya@skillhubinstitute.com, a real user whose password we must not
  // reset. Until a dedicated assessor test account exists, assessor-specific
  // behaviour is NOT covered end to end; do not read a green run as proof of it.
  assessor: { email: 'jyothi@learnerseducation.com', password: 'password123' },
  // Sarah has the IQA role but is assigned to NO enrolments, so course-scoped
  // endpoints legitimately 403 her. Good for role-guard checks, wrong for
  // anything that needs data.
  iqa: { email: 'iqa@test.com', password: 'iqapassword' },
  // Disposable test IQA that IS assigned to an enrolment on the EYE course —
  // this is the one that mirrors a real IQA like Robert. Use it whenever the
  // assertion is about what an IQA can SEE rather than what they may reach.
  iqaAssigned: { email: 'rmrepro-mshb1p3g.iqa@example.invalid', password: 'VerifyIqa2026!' },
  studentReal: { email: 'bhatnagar007vidit@gmail.com', password: 'password' },
};

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
