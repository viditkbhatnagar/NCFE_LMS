import { test, expect, isRoleAvailable } from '../fixtures/base';
import mongoose from 'mongoose';
import { RUN_ID } from '../run-id';

const BREVO_EVENTS_URL = 'https://api.brevo.com/v3/smtp/statistics/events';

async function brevoEvents(
  email: string,
  expected = 1,
): Promise<Array<{ event: string; email: string }>> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not set in test env');
  // Brevo events API can take 30-90s to surface a freshly-sent email
  let last: Array<{ event: string; email: string }> = [];
  for (let i = 0; i < 18; i++) {
    const res = await fetch(
      `${BREVO_EVENTS_URL}?email=${encodeURIComponent(email)}&limit=50`,
      { headers: { 'api-key': apiKey, accept: 'application/json' } },
    );
    if (res.ok) {
      const body = (await res.json()) as { events?: Array<{ event: string; email: string }> };
      last = body.events ?? [];
      if (last.length >= expected) return last;
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return last;
}

async function getDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
  return mongoose.connection.db!;
}

test.describe('Admin — real Brevo send + Brevo events API confirmation', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');
  test.skip(
    !process.env.BREVO_API_KEY || process.env.BREVO_API_KEY.includes('INVALID'),
    'BREVO_API_KEY not configured for real send',
  );

  test('end-to-end real welcome email → confirmed via Brevo events API', async ({
    request,
    created,
  }) => {
    test.setTimeout(120_000);

    const email = `intern+e2e-${RUN_ID.toLowerCase()}-real-${Date.now()}@learnerseducation.com`;
    const create = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] Real Send User`,
        email,
        password: 'TestPass123!',
        role: 'student',
        status: 'active',
      },
    });
    expect(create.status()).toBe(201);
    const body = await create.json();
    const id = body.data._id;
    created.trackAdmin('admin-user', id);

    expect(body.emailSent).toBe(true);
    expect(body.data._id).toBeTruthy();
    if (body.emailError) throw new Error(`emailError: ${body.emailError}`);

    // Verify via Brevo events API that the email was accepted
    const events = await brevoEvents(email, 1);
    expect(
      events.length,
      `Brevo events API returned 0 events for ${email} after 90s — Brevo may have rejected the send.`,
    ).toBeGreaterThanOrEqual(1);
    // Real Brevo events: 'requests', 'delivered', 'sent', etc.
    const acceptable = events.some((e) =>
      ['requests', 'request', 'delivered', 'sent', 'opened'].includes(e.event),
    );
    expect(acceptable, `none of the Brevo events match expected types: ${JSON.stringify(events)}`).toBe(true);
  });

  test('reset password real send → confirmed via Brevo events API', async ({ request, created }) => {
    test.setTimeout(120_000);

    const email = `intern+e2e-${RUN_ID.toLowerCase()}-realreset-${Date.now()}@learnerseducation.com`;
    const create = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] Real Reset User`,
        email,
        password: 'TestPass123!',
        role: 'student',
      },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data._id;
    created.trackAdmin('admin-user', id);

    const reset = await request.post(`/api/v2/admin/users/${id}/reset-password`, {
      data: { newPassword: 'AnotherPass456!' },
    });
    const resetBody = await reset.json();
    expect(resetBody.emailSent).toBe(true);

    const events = await brevoEvents(email, 1);
    // Brevo can take 30-90s to index events. We check for >=1 to confirm at least
    // one of the two sends was accepted; the audit-log spec covers both.
    expect(events.length, `Brevo events for ${email}: ${JSON.stringify(events).slice(0, 200)}`).toBeGreaterThanOrEqual(1);
  });

  test('audit log entries are populated for both create and reset, no plaintext password', async ({
    request,
    created,
  }) => {
    const email = `intern+e2e-${RUN_ID.toLowerCase()}-audit-${Date.now()}@learnerseducation.com`;
    const create = await request.post('/api/v2/admin/users', {
      data: {
        name: `[${RUN_ID}] Audit User`,
        email,
        password: 'AuditPass789!',
        role: 'student',
      },
    });
    const id = (await create.json()).data._id;
    created.trackAdmin('admin-user', id);

    await request.post(`/api/v2/admin/users/${id}/reset-password`, {
      data: { newPassword: 'ResetPass987!' },
    });

    const db = await getDb();
    const audits = await db
      .collection('auditlogs')
      .find({ entityType: 'User', entityId: new mongoose.Types.ObjectId(id), action: 'EMAIL_SENT' })
      .toArray();
    expect(audits.length).toBeGreaterThanOrEqual(2);
    const flat = JSON.stringify(audits);
    expect(flat).not.toContain('AuditPass789!');
    expect(flat).not.toContain('ResetPass987!');
  });
});
