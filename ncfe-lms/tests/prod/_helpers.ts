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

export const PROD_USERS: Record<'admin' | 'assessor' | 'iqa' | 'studentReal', Creds> = {
  admin: { email: 'admin@learnerseducation.com', password: 'passwordadmin' },
  assessor: { email: 'jyothi@learnerseducation.com', password: 'password123' },
  iqa: { email: 'iqa@test.com', password: 'iqapassword' },
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
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  // role-specific landing — assessor/student → /c, admin → /admin/dashboard, iqa → /iqa or /dashboard
  await page.waitForURL(/\/(admin\/dashboard|iqa|c|dashboard)/, { timeout: 60_000 });
  await page.close();
  return context;
}
