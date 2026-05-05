import { test, expect } from '../fixtures/base';
import { isRoleAvailable } from '../fixtures/base';
import { RUN_ID } from '../run-id';
import { apiAs } from '../fixtures/api-client';

test.describe('Admin — G17 bulk operations on users', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  async function createTaggedUser(
    request: import('@playwright/test').APIRequestContext,
    suffix: string,
  ): Promise<string> {
    const email = `e2e-${RUN_ID.toLowerCase()}-bulk-${suffix}-${Date.now()}@example.invalid`;
    const create = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] bulk-${suffix}`,
        email,
        password: 'TestPass123!',
        role: 'student',
        status: 'active',
      },
    });
    expect(create.status()).toBe(201);
    const body = await create.json();
    return body.data._id;
  }

  test('bulk-deactivate flips selected users to inactive', async ({ request, created }) => {
    const ids = await Promise.all(
      ['a', 'b', 'c', 'd'].map((s) => createTaggedUser(request, s)),
    );
    ids.forEach((id) => created.trackAdmin('admin-user', id));

    // Deactivate the first 3 only
    const targetIds = ids.slice(0, 3);
    const res = await request.post('/api/v2/admin/users/bulk-deactivate', {
      data: { ids: targetIds },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(3);

    // Confirm states
    for (const id of targetIds) {
      const det = await request.get(`/api/v2/admin/users/${id}`);
      expect(det.ok()).toBeTruthy();
      const d = await det.json();
      expect(d.data.status).toBe('inactive');
    }
    const untouched = await request.get(`/api/v2/admin/users/${ids[3]}`);
    expect((await untouched.json()).data.status).toBe('active');
  });

  test('bulk-export returns a CSV body matching selected ids', async ({ request, created }) => {
    const id1 = await createTaggedUser(request, 'csv-1');
    const id2 = await createTaggedUser(request, 'csv-2');
    created.trackAdmin('admin-user', id1);
    created.trackAdmin('admin-user', id2);

    const res = await request.post('/api/v2/admin/users/bulk-export', {
      data: { ids: [id1, id2] },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('name,email,role,status,phone,createdAt,enrolmentCount');
    expect(csv).toContain(`[${RUN_ID}] bulk-csv-1`);
    expect(csv).toContain(`[${RUN_ID}] bulk-csv-2`);
  });

  test('bulk-deactivate rejects > 100 ids with 400', async ({ request }) => {
    const fakeIds = Array.from({ length: 101 }, (_, i) => `aaaaaaaaaaaaaaaaaaaaaaaa${String(i).padStart(2, '0')}`);
    const res = await request.post('/api/v2/admin/users/bulk-deactivate', {
      data: { ids: fakeIds },
    });
    expect(res.status()).toBe(400);
  });

  test('bulk endpoints require admin role', async () => {
    const assessor = await apiAs('assessor');
    try {
      const r = await assessor.post('/api/v2/admin/users/bulk-deactivate', {
        data: { ids: ['x'] },
      });
      expect(r.status()).toBe(403);
    } finally {
      await assessor.dispose();
    }
  });
});

test.describe('Admin — G17 bulk operations on enrolments', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  test('bulk-export endpoint returns CSV', async ({ request }) => {
    // Read existing enrolments and pick up to 2 to export
    const list = await request.get('/api/v2/admin/enrolments?limit=2');
    expect(list.ok()).toBeTruthy();
    const ids = (await list.json()).data?.map((e: { _id: string }) => e._id) ?? [];
    if (ids.length === 0) {
      test.skip(true, 'no enrolments available to test export');
      return;
    }

    const res = await request.post('/api/v2/admin/enrolments/bulk-export', {
      data: { ids },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('studentName,studentEmail,qualificationTitle');
  });
});
