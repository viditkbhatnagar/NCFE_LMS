import { test, expect } from '../fixtures/base';
import { isRoleAvailable } from '../fixtures/base';
import { RUN_ID } from '../run-id';
import { apiAs } from '../fixtures/api-client';

test.describe('Admin — user CRUD on RUN_ID-tagged users only', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  test('GET /admin/users returns existing users (read-only)', async ({ request }) => {
    const resp = await request.get('/api/v2/admin/users');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination?.total).toBeGreaterThanOrEqual(7); // baseline
  });

  test('admin creates → updates → deletes a tagged user', async ({ request, created }) => {
    const email = `e2e-${RUN_ID.toLowerCase()}-${Date.now()}@example.invalid`;
    const create = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] E2E Test User`,
        email,
        password: 'TestPass123!',
        role: 'student',
        status: 'active',
      },
    });
    expect(
      create.status(),
      `admin user create returned ${create.status()}: ${await create.text().catch(() => '')}`,
    ).toBe(201);
    const body = await create.json();
    const id = body.data._id || body.data.id;
    expect(id).toBeTruthy();
    created.trackAdmin('admin-user', id);

    // Update
    const update = await request.put(`/api/v2/admin/users/${id}`, {
      data: { name: `[${RUN_ID}] E2E Renamed`, status: 'inactive' },
    });
    expect(update.ok()).toBeTruthy();
    const updBody = await update.json();
    expect(updBody.data.name).toBe(`[${RUN_ID}] E2E Renamed`);
    expect(updBody.data.status).toBe('inactive');

    // Delete (registry afterEach also covers this; we want to assert it works)
    const del = await request.delete(`/api/v2/admin/users/${id}`);
    expect(del.ok(), `admin user delete returned ${del.status()}`).toBeTruthy();
  });

  test('admin user create rejects duplicate email with 409', async ({ request, created }) => {
    const email = `e2e-${RUN_ID.toLowerCase()}-dup-${Date.now()}@example.invalid`;
    const r1 = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] dup1`,
        email,
        password: 'TestPass123!',
        role: 'student',
      },
    });
    expect(r1.status()).toBe(201);
    const id = (await r1.json()).data._id;
    created.trackAdmin('admin-user', id);

    const r2 = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] dup2`,
        email,
        password: 'TestPass123!',
        role: 'student',
      },
    });
    expect(r2.status()).toBe(409);
  });

  test('admin user create rejects weak password with 400', async ({ request }) => {
    const resp = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] weak`,
        email: `e2e-${RUN_ID.toLowerCase()}-weak@example.invalid`,
        password: 'short',
        role: 'student',
      },
    });
    expect(resp.status()).toBe(400);
  });

  test('non-admin (assessor) cannot list /api/v2/admin/users (403)', async () => {
    const assessorReq = await apiAs('assessor');
    try {
      const resp = await assessorReq.get('/api/v2/admin/users');
      expect(resp.status()).toBe(403);
    } finally {
      await assessorReq.dispose();
    }
  });
});
