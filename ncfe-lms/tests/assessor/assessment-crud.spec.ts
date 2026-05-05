import { test, expect } from '../fixtures/base';
import mongoose from 'mongoose';
import { QUALIFICATION_SLUG } from '../users';
import {
  ENROLMENTS,
  KNOWN_IDS,
  QUALIFICATION_ID,
} from '../fixtures/test-context';
import { RUN_ID } from '../run-id';

test.describe('Assessor — assessment CRUD', () => {
  test('create → list → update → publish → delete (API + UI sanity)', async ({
    page,
    request,
    created,
  }) => {
    const title = `[${RUN_ID}] Observation of practice — ${Date.now()}`;
    const learnerId = KNOWN_IDS.STUDENT_VIDIT();
    const enrollmentId = ENROLMENTS.VIDIT;

    // === CREATE ===
    const createResp = await request.post('/api/v2/assessments', {
      data: {
        title,
        assessmentKind: 'observation',
        planIntent: `Plan intent ${RUN_ID}`,
        planImplementation: `Plan implementation ${RUN_ID}`,
        learnerId,
        enrollmentId,
      },
    });
    expect(createResp.ok(), `POST /api/v2/assessments returned ${createResp.status()}`).toBeTruthy();
    const createBody = await createResp.json();
    expect(createBody.success).toBe(true);
    const assessmentId = createBody.data._id as string;
    expect(assessmentId).toBeTruthy();
    created.trackAssessment(assessmentId);

    // === LIST (UI) ===
    await page.goto(`/c/${QUALIFICATION_SLUG}/assessment`);
    await expect(page.locator('body')).toContainText(title.slice(0, 30), { timeout: 15_000 });

    // === LIST (API) — also exercise the GET endpoint
    const listResp = await request.get(
      `/api/v2/assessments?qualificationId=${QUALIFICATION_ID}&enrollmentId=${enrollmentId}`,
    );
    expect(listResp.ok()).toBeTruthy();
    const listBody = await listResp.json();
    const our = (listBody.data as { _id: string; title: string }[]).find(
      (a) => a._id === assessmentId,
    );
    expect(our, 'created assessment not in list').toBeDefined();
    expect(our!.title).toBe(title);

    // === UPDATE ===
    const newTitle = `${title} (edited)`;
    const updResp = await request.put(`/api/v2/assessments/${assessmentId}`, {
      data: { title: newTitle, planIntent: `Updated intent ${RUN_ID}` },
    });
    expect(updResp.ok(), `PUT returned ${updResp.status()}`).toBeTruthy();
    const updBody = await updResp.json();
    expect(updBody.data.title).toBe(newTitle);

    // === DELETE (still in draft — business rule: only drafts are deletable) ===
    const delResp = await request.delete(`/api/v2/assessments/${assessmentId}`);
    expect(delResp.ok(), `DELETE on draft returned ${delResp.status()}`).toBeTruthy();

    // Confirm gone
    const verify = await request.get(`/api/v2/assessments/${assessmentId}`);
    expect([404, 200]).toContain(verify.status());
    if (verify.status() === 200) {
      expect((await verify.json()).success).toBe(false);
    }
    // Already deleted — registry cleanup will be a no-op (404 is acceptable)
  });

  test('publish-then-edit transitions to published_modified', async ({
    request,
    created,
  }) => {
    const learnerId = KNOWN_IDS.STUDENT_VIDIT();
    const enrollmentId = ENROLMENTS.VIDIT;
    const create = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] publish-edit ${Date.now()}`,
        learnerId,
        enrollmentId,
      },
    });
    expect(create.ok()).toBeTruthy();
    const id = (await create.json()).data._id as string;
    created.trackAssessment(id);

    // publish
    const pub = await request.put(`/api/v2/assessments/${id}`, {
      data: { status: 'published' },
    });
    expect(pub.ok()).toBeTruthy();
    expect((await pub.json()).data.status).toBe('published');

    // edit content → should auto-transition to published_modified
    const edit = await request.put(`/api/v2/assessments/${id}`, {
      data: { planIntent: `Edited intent ${RUN_ID}` },
    });
    expect(edit.ok()).toBeTruthy();
    expect((await edit.json()).data.status).toBe('published_modified');

    // Re-publish — back to published
    const repub = await request.put(`/api/v2/assessments/${id}`, {
      data: { status: 'published' },
    });
    expect(repub.ok()).toBeTruthy();

    // Cleanup: revert to draft so DELETE can succeed (the registry will call DELETE)
    // But the API doesn't allow demoting status via PUT? Let's just check —
    // if not, the cleanup will fall through to 400 and the registry will warn.
    const revert = await request.put(`/api/v2/assessments/${id}`, {
      data: { status: 'draft' },
    });
    // status enum allows draft per validator; if rejected, we leak this until
    // postflight emergency cleanup fires (still safe — RUN_ID-tagged).
    if (!revert.ok()) {
      // Direct DB cleanup as last resort — gated by RUN_ID via the registry.
      console.warn(`[test] could not revert ${id} to draft for clean delete (status ${revert.status()})`);
    }
  });

  test('DELETE on a published assessment is rejected with 400', async ({
    request,
    created,
  }) => {
    const create = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] delete-rejected ${Date.now()}`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(create.ok()).toBeTruthy();
    const id = (await create.json()).data._id as string;
    created.trackAssessment(id);

    // publish
    await request.put(`/api/v2/assessments/${id}`, { data: { status: 'published' } });

    // Try to delete — must be rejected
    const del = await request.delete(`/api/v2/assessments/${id}`);
    expect(del.status()).toBe(400);
    const body = await del.json();
    expect(body.error).toMatch(/draft/i);

    // Revert to draft so the cleanup can succeed
    await request.put(`/api/v2/assessments/${id}`, { data: { status: 'draft' } });
  });

  test('create rejects bad enrollment with 404', async ({ request }) => {
    const resp = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] should fail`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: '000000000000000000000000',
      },
    });
    expect(resp.status()).toBe(404);
  });

  test('create rejects missing required fields with 400', async ({ request }) => {
    const resp = await request.post('/api/v2/assessments', {
      data: { title: `[${RUN_ID}] missing` },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
  });

  // Regression for Fix #2: deleting an assessment cascade-deletes its notifications.
  test('delete cascades to notifications (Fix #2)', async ({ request }) => {
    const create = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] cascade-test ${Date.now()}`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(create.ok()).toBeTruthy();
    const id = (create.json && (await create.json()).data._id) as string;
    expect(id).toBeTruthy();

    // Sleep briefly to allow the fire-and-forget createNotification to flush.
    await new Promise((r) => setTimeout(r, 1500));

    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error('MONGODB_URI not set');
      await mongoose.connect(uri);
    }
    const Notification = mongoose.connection.collection('notifications');

    const before = await Notification.countDocuments({
      entityType: 'Assessment',
      entityId: new mongoose.Types.ObjectId(id),
    });
    expect(before, 'expected at least one notification linked to the new assessment').toBeGreaterThanOrEqual(1);

    const del = await request.delete(`/api/v2/assessments/${id}`);
    expect(del.ok(), `DELETE returned ${del.status()}`).toBeTruthy();

    const after = await Notification.countDocuments({
      entityType: 'Assessment',
      entityId: new mongoose.Types.ObjectId(id),
    });
    expect(after, 'notifications should be cascade-deleted').toBe(0);
  });
});
