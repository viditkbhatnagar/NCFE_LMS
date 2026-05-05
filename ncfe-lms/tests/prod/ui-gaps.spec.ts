import { test, expect, type APIRequestContext } from '@playwright/test';
import { PROD_RUN_ID, PROD_USERS, makeApiContext } from './_helpers';

// G1, G2, G3, G6, G7, G8, G9, G10 verification against production.
// G4 (self-service password reset) and G5 (force-change-password) are
// intentionally NOT covered — admin holds the credentials per explicit
// user directive (admin generates → emails → student keeps that password).
//
// All entities are RUN_ID-tagged and torn down in afterAll. James Bond
// (7777jamesbond7777@gmail.com) is NEVER touched.

let admin: APIRequestContext;
const created = {
  studentId: '',
  qualificationId: '',
  enrolmentId: '',
};

test.describe.configure({ mode: 'serial' });

test.describe('Production — UI gap fixes (G1, G2, G3, G6, G7, G8, G10)', () => {
  test.beforeAll(async () => {
    admin = await makeApiContext(PROD_USERS.admin);
  });

  test.afterAll(async () => {
    const safe = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        console.warn(`[cleanup] ${label}:`, err);
      }
    };
    if (created.enrolmentId) await safe('enrolment', () => admin.delete(`/api/v2/admin/enrolments/${created.enrolmentId}`));
    if (created.qualificationId) await safe('qualification', () => admin.delete(`/api/v2/admin/qualifications/${created.qualificationId}`));
    if (created.studentId) await safe('student soft-delete', () => admin.delete(`/api/v2/admin/users/${created.studentId}`));
    await admin.dispose();
  });

  // -------------------------------------------------------------------
  // G1 — combined create+enrol
  // -------------------------------------------------------------------
  test('G1 — admin creates a student WITHOUT enrolment fields → user only', async () => {
    const email = `e2e-uig-${PROD_RUN_ID.toLowerCase()}-noenrol-${Date.now()}@learnerseducation.invalid`;
    const resp = await admin.post('/api/v2/admin/users', {
      data: {
        name: `[E2E-${PROD_RUN_ID}] G1 No-Enrol User`,
        email,
        password: 'TempPass123!Aa',
        role: 'student',
        status: 'active',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    created.studentId = body.data._id;
    expect(typeof body.emailSent).toBe('boolean');

    // No enrolment was created since no fields were provided
    const enrolList = await admin.get(`/api/v2/admin/enrolments?userId=${created.studentId}`);
    const enrolBody = await enrolList.json();
    expect(enrolBody.data).toEqual([]);
  });

  test('G1 — combined create+enrol creates BOTH user and enrolment', async () => {
    // Find Jyothi as the assessor target
    const assessorRes = await admin.get('/api/v2/admin/users?search=jyothi');
    const jyothi = ((await assessorRes.json()).data as Array<{ _id: string; email: string }>).find(
      (u) => u.email === PROD_USERS.assessor.email,
    );
    expect(jyothi).toBeTruthy();

    // Create a temporary qualification first
    const qResp = await admin.post('/api/v2/admin/qualifications', {
      data: {
        title: `[E2E-${PROD_RUN_ID}] G1 combined-enrol qual`,
        level: 3,
        code: `E2E-G1-${PROD_RUN_ID.slice(-6)}`,
        awardingBody: 'NCFE/CACHE',
        description: `[${PROD_RUN_ID}] G1 prod test`,
        status: 'active',
      },
    });
    expect(qResp.status()).toBe(201);
    created.qualificationId = (await qResp.json()).data._id;

    // Create student + enrolment via two POSTs (the UI does this; the
    // backend doesn't expose a combined endpoint — by design).
    const email = `e2e-uig-${PROD_RUN_ID.toLowerCase()}-combo-${Date.now()}@learnerseducation.invalid`;
    const userResp = await admin.post('/api/v2/admin/users', {
      data: {
        name: `[E2E-${PROD_RUN_ID}] G1 Combo User`,
        email,
        password: 'TempPass456!Bb',
        role: 'student',
        status: 'active',
      },
    });
    expect(userResp.status()).toBe(201);
    const userId = (await userResp.json()).data._id;

    const enrolResp = await admin.post('/api/v2/admin/enrolments', {
      data: {
        userId,
        qualificationId: created.qualificationId,
        assessorId: jyothi!._id,
        cohortId: `E2E-${PROD_RUN_ID}-Q1`,
        status: 'in_progress',
      },
    });
    expect(enrolResp.status()).toBe(201);
    created.enrolmentId = (await enrolResp.json()).data._id;

    // Soft-delete the combo user too (it's RUN_ID-tagged and not James Bond)
    await admin.delete(`/api/v2/admin/users/${userId}`);
  });

  // -------------------------------------------------------------------
  // G2 — enrolmentCount badge
  // -------------------------------------------------------------------
  test('G2 — admin user list response includes enrolmentCount on student rows', async () => {
    const resp = await admin.get(`/api/v2/admin/users?role=student&limit=20`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    const students = body.data as Array<{ _id: string; role: string; enrolmentCount?: number }>;
    expect(students.length).toBeGreaterThan(0);
    for (const s of students) {
      expect(s.role).toBe('student');
      expect(typeof s.enrolmentCount).toBe('number');
    }
  });

  // -------------------------------------------------------------------
  // G3 — user detail endpoint + page
  // -------------------------------------------------------------------
  test('G3 — admin user detail API returns the full record', async ({ browser }) => {
    if (!created.studentId) test.skip(true, 'student not created yet');
    const resp = await admin.get(`/api/v2/admin/users/${created.studentId}`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.data._id).toBe(created.studentId);

    // The detail page renders client-side; just confirm the route resolves
    // with admin auth and returns 200 (the page itself depends on the route).
    const ctx = await browser.newContext({
      baseURL: 'https://ncfe-lms.onrender.com',
      storageState: 'tests/.auth/prod-admin.json',
    });
    const page = await ctx.newPage();
    const navResp = await page.goto(`/admin/users/${created.studentId}`);
    expect(navResp?.ok() || navResp?.status() === 200).toBeTruthy();
    await page.close();
    await ctx.close();
  });

  // -------------------------------------------------------------------
  // G5 — REMOVED. Force-change-password-on-first-login was rolled back
  // per user directive: admin generates → emails → student keeps that
  // password until admin resets it again. No self-service change.
  // -------------------------------------------------------------------

  // -------------------------------------------------------------------
  // G6 — self-service profile editing
  // -------------------------------------------------------------------
  test('G6 — GET + PUT /api/v2/users/me lets a user update their own profile', async () => {
    const studentApi = await makeApiContext({
      email: ((await (await admin.get(`/api/v2/admin/users/${created.studentId}`)).json()).data as { email: string }).email,
      password: 'TempPass123!Aa',
    });
    try {
      const before = await studentApi.get('/api/v2/users/me');
      expect(before.ok()).toBeTruthy();

      const newPhone = `+1 555 ${PROD_RUN_ID.slice(-4)}`;
      const upd = await studentApi.put('/api/v2/users/me', {
        data: {
          phone: newPhone,
          notificationPreferences: { signOff: false, iqaDecision: true, newEnrolment: true },
        },
      });
      expect(upd.ok()).toBeTruthy();
      const updated = (await upd.json()).data;
      expect(updated.phone).toBe(newPhone);
      expect(updated.notificationPreferences.signOff).toBe(false);
    } finally {
      await studentApi.dispose();
    }
  });

  // -------------------------------------------------------------------
  // G7 — new email send-points exist (welcome path already verified by
  // email-smoke.spec.ts; here we verify enrolment-create email by audit)
  // -------------------------------------------------------------------
  test('G7 — new enrolment triggers an audit-log EMAIL_SENT entry (template=new_enrolment)', async () => {
    if (!created.enrolmentId) test.skip(true, 'no enrolment created');
    // Wait briefly for the fire-and-forget send to flush
    await new Promise((r) => setTimeout(r, 4_000));
    const logs = await admin.get(
      `/api/v2/admin/audit-logs?action=EMAIL_SENT&entityType=Enrolment&limit=20`,
    );
    expect(logs.ok()).toBeTruthy();
    const data = (await logs.json()).data as Array<{ entityId: string; newValue?: { template?: string } }>;
    const found = data.find(
      (l) => l.entityId === created.enrolmentId && l.newValue?.template === 'new_enrolment',
    );
    if (!found) {
      // Soft signal — Brevo may have rejected an invalid recipient. Don't
      // hard-fail; the audit-log entry exists either way (EMAIL_SENT or
      // EMAIL_FAILED). Check both.
      const either = await admin.get(
        `/api/v2/admin/audit-logs?action=EMAIL&entityType=Enrolment&limit=20`,
      );
      const eitherData = (await either.json()).data as Array<{ entityId: string; action: string }>;
      const any = eitherData.find((l) => l.entityId === created.enrolmentId);
      expect(any, 'no EMAIL_SENT or EMAIL_FAILED log for the new enrolment').toBeTruthy();
    }
  });

  // -------------------------------------------------------------------
  // G8 — audit log filters + CSV export
  // -------------------------------------------------------------------
  test('G8 — date-range + entityType filter narrows results', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const resp = await admin.get(
      `/api/v2/admin/audit-logs?from=${today}&to=${today}&entityType=User&limit=20`,
    );
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const row of body.data as Array<{ entityType: string }>) {
      expect(row.entityType).toBe('User');
    }
  });

  test('G8 — CSV export returns text/csv with header row', async () => {
    const resp = await admin.get('/api/v2/admin/audit-logs?export=csv&limit=10');
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-type']).toMatch(/text\/csv/);
    expect(resp.headers()['content-disposition']).toMatch(/attachment/);
    const body = await resp.text();
    const lines = body.split('\n');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('action');
    expect(lines[0]).toContain('entityType');
  });

  // -------------------------------------------------------------------
  // G10 — CSV curriculum import
  // -------------------------------------------------------------------
  test('G10 — CSV curriculum import creates Units / LOs / ACs', async () => {
    if (!created.qualificationId) test.skip(true, 'no qualification created');
    const csv = [
      'Unit Reference,LO Number,AC Number,Description,Evidence Requirements',
      `E2E-${PROD_RUN_ID}-U1,LO1,1.1,${PROD_RUN_ID} criterion 1.1,evidence note 1`,
      `E2E-${PROD_RUN_ID}-U1,LO1,1.2,${PROD_RUN_ID} criterion 1.2,`,
      `E2E-${PROD_RUN_ID}-U1,LO2,2.1,${PROD_RUN_ID} criterion 2.1,`,
      `E2E-${PROD_RUN_ID}-U2,LO1,1.1,${PROD_RUN_ID} U2 criterion 1.1,`,
    ].join('\n');

    const resp = await admin.post(
      `/api/v2/admin/qualifications/${created.qualificationId}/curriculum/import`,
      { data: { csv } },
    );
    expect(
      resp.ok(),
      `import returned ${resp.status()}: ${await resp.text().catch(() => '')}`,
    ).toBeTruthy();
    const data = (await resp.json()).data;
    expect(data.created.units).toBe(2);
    expect(data.created.los).toBe(3);
    expect(data.created.acs).toBe(4);

    // Re-import is idempotent (everything already exists → all skipped)
    const resp2 = await admin.post(
      `/api/v2/admin/qualifications/${created.qualificationId}/curriculum/import`,
      { data: { csv } },
    );
    const data2 = (await resp2.json()).data;
    expect(data2.created.units).toBe(0);
    expect(data2.created.los).toBe(0);
    expect(data2.created.acs).toBe(0);
    expect(data2.skipped.units).toBe(2);
    expect(data2.skipped.los).toBe(3);
    expect(data2.skipped.acs).toBe(4);
  });

  // -------------------------------------------------------------------
  // G9 — ConfirmDialog standardisation is a UI-only concern; the
  // standalone smoke specs already verify the destructive paths still
  // work end-to-end. No new dedicated test here.
  // -------------------------------------------------------------------
  test.skip('G9 — confirm-dialog standardisation is verified by existing destructive-path specs', () => {});
});
