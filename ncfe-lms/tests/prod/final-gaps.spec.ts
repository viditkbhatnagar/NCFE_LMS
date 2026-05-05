import * as path from 'path';
import { test, expect } from '@playwright/test';
import { PROD_RUN_ID, PROD_USERS, makeApiContext } from './_helpers';

const ADMIN_STORAGE = path.join(__dirname, '..', '.auth', 'prod-admin.json');

// Production verification for the final wrap-up batch (G9 / G15 / G17).
// Black-box: any failure here is logged and surfaced — not hot-fixed.
//
// Cleanup: every entity is tagged with [E2E-${PROD_RUN_ID}] and removed in
// afterAll. James Bond demo (`7777jamesbond7777@gmail.com`) is never touched.

test.describe.serial('Prod — final wrap-up (G9/G15/G17)', () => {
  let admin: Awaited<ReturnType<typeof makeApiContext>>;
  const cleanupUserIds: string[] = [];

  test.beforeAll(async () => {
    admin = await makeApiContext(PROD_USERS.admin);
  });

  test.afterAll(async () => {
    if (admin && cleanupUserIds.length > 0) {
      for (const id of cleanupUserIds) {
        try {
          await admin.delete(`/api/v2/admin/users/${id}`);
        } catch {
          /* swallow — registry sweep will catch leaks */
        }
      }
    }
    await admin?.dispose();
  });

  // ─── G17 ────────────────────────────────────────────────────────────────────

  test('G17 — bulk-deactivate flips selected users to inactive', async () => {
    const ids: string[] = [];
    for (const tag of ['a', 'b', 'c', 'd']) {
      const email = `e2e-${PROD_RUN_ID.toLowerCase()}-bulk-${tag}-${Date.now()}@example.invalid`;
      const create = await admin.post('/api/v2/admin/users', {
        data: {
          name: `[${PROD_RUN_ID}] bulk-${tag}`,
          email,
          password: 'TestPass123!',
          role: 'student',
          status: 'active',
        },
      });
      expect(create.status(), `create ${tag} returned ${create.status()}`).toBe(201);
      const id = (await create.json()).data._id;
      ids.push(id);
      cleanupUserIds.push(id);
    }

    // Deactivate the first 3
    const targetIds = ids.slice(0, 3);
    const res = await admin.post('/api/v2/admin/users/bulk-deactivate', {
      data: { ids: targetIds },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(3);

    // Spot-check
    for (const id of targetIds) {
      const det = await admin.get(`/api/v2/admin/users/${id}`);
      expect(det.ok()).toBeTruthy();
      expect((await det.json()).data.status).toBe('inactive');
    }
    const untouched = await admin.get(`/api/v2/admin/users/${ids[3]}`);
    expect((await untouched.json()).data.status).toBe('active');
  });

  test('G17 — bulk-export returns text/csv with the right columns', async () => {
    const id1 = cleanupUserIds[0];
    const id2 = cleanupUserIds[1];
    const res = await admin.post('/api/v2/admin/users/bulk-export', {
      data: { ids: [id1, id2] },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('name,email,role,status,phone,createdAt,enrolmentCount');
    expect(csv).toContain(`[${PROD_RUN_ID}] bulk-a`);
  });

  test('G17 — bulk-deactivate rejects > 100 ids with 400', async () => {
    const fakeIds = Array.from({ length: 101 }, (_, i) =>
      `aaaaaaaaaaaaaaaaaaaaaaaa${String(i).padStart(2, '0')}`,
    );
    const res = await admin.post('/api/v2/admin/users/bulk-deactivate', {
      data: { ids: fakeIds },
    });
    expect(res.status()).toBe(400);
  });

  test('G17 — non-admin role gets 403 on bulk endpoints', async () => {
    const assessor = await makeApiContext(PROD_USERS.assessor);
    try {
      const r = await assessor.post('/api/v2/admin/users/bulk-deactivate', {
        data: { ids: ['x'] },
      });
      expect(r.status()).toBe(403);
    } finally {
      await assessor.dispose();
    }
  });

  // ─── G9 ─────────────────────────────────────────────────────────────────────

  test('G9 — empty-state testid renders when admin search has no matches', async ({ browser }) => {
    // Reuse the admin storage state from prod-auth-setup so we don't pay the
    // cold-start sign-in cost a second time.
    const ctx = await browser.newContext({
      baseURL: 'https://ncfe-lms.onrender.com',
      storageState: ADMIN_STORAGE,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    // Wait for the initial fetch to settle so the search input is interactive.
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/v2/admin/users') && resp.status() === 200,
      { timeout: 30_000 },
    );
    const searchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v2/admin/users') &&
        resp.url().includes('XQXQXQXNOMATCH-zzz'),
      { timeout: 30_000 },
    );
    await page.fill('input[placeholder*="Search by name"]', 'XQXQXQXNOMATCH-zzz');
    await searchPromise;
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({
      timeout: 15_000,
    });

    await ctx.close();
  });
});
