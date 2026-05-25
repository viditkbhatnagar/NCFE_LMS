/* eslint-disable no-console */
// One-shot script: signs in as production admin and aggregates everything
// that looks like leaked test data so the operator can review before any
// destructive action. NEVER touches James Bond or seed accounts.
//
// Usage:
//   npx ts-node --project tsconfig.scripts.json scripts/audit-test-leaks.ts
// or, if no scripts tsconfig, via npx tsx scripts/audit-test-leaks.ts.

import { request as playwrightRequest } from '@playwright/test';
import * as fs from 'fs';

const BASE_URL = 'https://ncfe-lms.onrender.com';
const ADMIN = { email: 'admin@learnerseducation.com', password: 'passwordadmin' };

// Anyone in this set is permanent and must never be deleted.
const PROTECTED_EMAILS = new Set<string>([
  '7777jamesbond7777@gmail.com',
  'admin@learnerseducation.com',
  'jyothi@learnerseducation.com',
  'iqa@test.com',
  'student@test.com',
  'assessor@test.com',
  'bhatnagar007vidit@gmail.com',
]);

const PROTECTED_NAME_FRAGMENTS = ['james bond', 'jyothi'];

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  enrolmentCount?: number;
}

function looksLikeTest(u: UserRow): boolean {
  const e = (u.email ?? '').toLowerCase();
  const n = (u.name ?? '').toLowerCase();
  if (PROTECTED_EMAILS.has(e)) return false;
  if (PROTECTED_NAME_FRAGMENTS.some((f) => n.includes(f))) return false;

  // Patterns we created during test runs:
  //  e2e-<runid>-<...>@example.invalid
  //  [E2E-<runid>] <name>
  //  [PROD-<runid>] <name>
  //  bulk-* (during this session's prod tests)
  //  smoke-* (any future probes)
  //  *@example.invalid (always test domain)
  if (e.endsWith('@example.invalid')) return true;
  if (n.includes('[e2e-') || n.includes('[prod-')) return true;
  if (n.includes('bulk-csv') || n.includes('bulk-a') || n.includes('bulk-b') || n.includes('bulk-c') || n.includes('bulk-d')) return true;
  if (n.startsWith('e2e ') || n.includes('audit_user') || n.includes('demo_user')) return true;
  return false;
}

(async () => {
  const ctx = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { accept: 'application/json' },
  });

  // CSRF + sign-in
  const csrfRes = await ctx.get('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();
  const sign = await ctx.post('/api/auth/callback/credentials', {
    form: {
      email: ADMIN.email,
      password: ADMIN.password,
      csrfToken,
      json: 'true',
      callbackUrl: BASE_URL,
    },
  });
  if (!sign.ok() && sign.status() !== 302) {
    throw new Error(`admin sign-in failed: ${sign.status()}`);
  }
  const session = await ctx.get('/api/auth/session');
  const sessBody = await session.json();
  if (sessBody?.user?.role !== 'admin') {
    throw new Error('not signed in as admin');
  }

  // Page through admin/users
  const all: UserRow[] = [];
  let page = 1;
  while (true) {
    const r = await ctx.get(`/api/v2/admin/users?page=${page}&limit=100`);
    if (!r.ok()) throw new Error(`/admin/users page ${page} returned ${r.status()}`);
    const body = await r.json();
    all.push(...body.data);
    if (page >= body.pagination.totalPages) break;
    page += 1;
  }

  const flagged = all.filter(looksLikeTest);

  console.log(`Total users on prod: ${all.length}`);
  console.log(`Looks-like-test (candidates for cleanup): ${flagged.length}`);
  console.log('');
  console.log('By role:');
  const byRole: Record<string, number> = {};
  for (const u of flagged) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
  for (const [r, n] of Object.entries(byRole)) console.log(`  ${r.padEnd(10)} ${n}`);
  console.log('');
  console.log('First 25 candidates:');
  for (const u of flagged.slice(0, 25)) {
    console.log(`  ${u.role.padEnd(8)} ${(u.email || '<no email>').padEnd(55)} ${u.name}`);
  }
  if (flagged.length > 25) console.log(`  ... +${flagged.length - 25} more`);

  // Sanity: confirm none of the protected accounts are in the flagged set.
  for (const f of flagged) {
    if (PROTECTED_EMAILS.has(f.email?.toLowerCase())) {
      throw new Error(`SAFETY: protected email ${f.email} was flagged — abort.`);
    }
  }

  fs.writeFileSync('/tmp/test-user-leaks.json', JSON.stringify(flagged, null, 2));
  console.log('');
  console.log(`Full candidate list saved to /tmp/test-user-leaks.json (${flagged.length} entries).`);
  console.log('Review and run scripts/delete-test-leaks.ts to actually delete them.');

  await ctx.dispose();
})();
