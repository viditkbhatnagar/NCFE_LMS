import { test, expect } from '../fixtures/base';
import {
  ENROLMENTS,
  KNOWN_IDS,
  QUALIFICATION_ID,
  UNITS,
} from '../fixtures/test-context';
import { RUN_ID } from '../run-id';
import { apiAs } from '../fixtures/api-client';

test.describe('IQA — sampling and decision workflow', () => {
  test('IQA creates a sample and submits a decision (full round-trip)', async ({
    request,
    created,
  }) => {
    // === Create IQA sample ===
    // RUN_ID is embedded in assessmentMethodsSampled so the registry can clean
    // it up via the JSON.stringify-based RUN_ID check.
    const sampleResp = await request.post('/api/iqa/samples', {
      data: {
        assessorId: KNOWN_IDS.ASSESSOR_JYOTHI(),
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        unitId: UNITS.UNIT_301,
        qualificationId: QUALIFICATION_ID,
        assessmentMethodsSampled: ['observation', `tag:${RUN_ID}`],
        stage: 'mid',
      },
    });
    expect(
      sampleResp.status(),
      `IQA sample create returned ${sampleResp.status()}: ${await sampleResp.text().catch(() => '')}`,
    ).toBe(201);
    const sampleBody = await sampleResp.json();
    const sampleId = sampleBody.data._id as string;
    expect(sampleId).toBeTruthy();
    created.track({ kind: 'iqa-sample', id: sampleId });

    // === GET — sample appears in list ===
    const listResp = await request.get('/api/iqa/samples?limit=50');
    expect(listResp.ok()).toBeTruthy();
    const listBody = await listResp.json();
    const found = (listBody.data as { _id: string }[]).find((s) => s._id === sampleId);
    expect(found, 'created sample not in list').toBeDefined();

    // === Submit decision ===
    const decisionResp = await request.post('/api/iqa/decisions', {
      data: {
        iqaSampleId: sampleId,
        decision: 'approved',
        rationale: `Rationale ${RUN_ID} — observation evidence is sufficient.`,
        actionsForAssessor: '',
      },
    });
    expect(
      decisionResp.status(),
      `IQA decision create returned ${decisionResp.status()}`,
    ).toBe(201);
    const decisionBody = await decisionResp.json();
    const decisionId = decisionBody.data._id as string;
    created.track({ kind: 'iqa-decision', id: decisionId });

    // === Sample status moved to 'reviewed' ===
    const verifyList = await request.get('/api/iqa/samples?limit=50');
    const verifyBody = await verifyList.json();
    const updated = (verifyBody.data as { _id: string; status: string }[]).find(
      (s) => s._id === sampleId,
    );
    expect(updated?.status).toBe('reviewed');
  });

  test('IQA sample create rejects bad stage with 400', async ({ request }) => {
    const resp = await request.post('/api/iqa/samples', {
      data: {
        assessorId: KNOWN_IDS.ASSESSOR_JYOTHI(),
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        unitId: UNITS.UNIT_301,
        qualificationId: QUALIFICATION_ID,
        assessmentMethodsSampled: ['observation'],
        stage: 'invalid-stage',
      },
    });
    expect(resp.status()).toBe(400);
  });

  test('IQA decision create rejects unknown sample with 404', async ({ request }) => {
    const resp = await request.post('/api/iqa/decisions', {
      data: {
        iqaSampleId: '000000000000000000000000',
        decision: 'approved',
        rationale: `[${RUN_ID}] should fail`,
      },
    });
    expect(resp.status()).toBe(404);
  });

  test('non-IQA cannot create samples (assessor role check)', async () => {
    const assessorReq = await apiAs('assessor');
    try {
      const resp = await assessorReq.post('/api/iqa/samples', {
        data: {
          assessorId: KNOWN_IDS.ASSESSOR_JYOTHI(),
          learnerId: KNOWN_IDS.STUDENT_VIDIT(),
          unitId: UNITS.UNIT_301,
          qualificationId: QUALIFICATION_ID,
          assessmentMethodsSampled: ['observation'],
          stage: 'early',
        },
      });
      expect(resp.status()).toBe(403);
    } finally {
      await assessorReq.dispose();
    }
  });

  // Regression for Fix #3: new DELETE endpoints exist for samples + decisions.
  test('DELETE on IQA sample also cascades linked decisions', async ({ request }) => {
    const create = await request.post('/api/iqa/samples', {
      data: {
        assessorId: KNOWN_IDS.ASSESSOR_JYOTHI(),
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        unitId: UNITS.UNIT_301,
        qualificationId: QUALIFICATION_ID,
        assessmentMethodsSampled: ['observation', `tag:${RUN_ID}`],
        stage: 'early',
      },
    });
    expect(create.status()).toBe(201);
    const sampleId = (await create.json()).data._id as string;

    const decisionResp = await request.post('/api/iqa/decisions', {
      data: {
        iqaSampleId: sampleId,
        decision: 'approved',
        rationale: `[${RUN_ID}] cascade-test`,
      },
    });
    expect(decisionResp.status()).toBe(201);
    const decisionId = (await decisionResp.json()).data._id as string;

    const del = await request.delete(`/api/iqa/samples/${sampleId}`);
    expect(del.status()).toBe(200);
    expect((await del.json()).success).toBe(true);

    // Decision must be gone via cascade
    const verifyDecisions = await request.get('/api/iqa/decisions');
    const decisions = (await verifyDecisions.json()).data as { _id: string }[];
    const stillThere = decisions.find((d) => d._id === decisionId);
    expect(stillThere, 'decision should have been cascade-deleted').toBeUndefined();
  });

  test('DELETE on IQA decision alone reverts sample status to pending', async ({ request, created }) => {
    const create = await request.post('/api/iqa/samples', {
      data: {
        assessorId: KNOWN_IDS.ASSESSOR_JYOTHI(),
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        unitId: UNITS.UNIT_301,
        qualificationId: QUALIFICATION_ID,
        assessmentMethodsSampled: ['observation', `tag:${RUN_ID}`],
        stage: 'early',
      },
    });
    expect(create.status()).toBe(201);
    const sampleId = (await create.json()).data._id as string;
    created.track({ kind: 'iqa-sample', id: sampleId });

    const decResp = await request.post('/api/iqa/decisions', {
      data: { iqaSampleId: sampleId, decision: 'approved', rationale: `[${RUN_ID}] revert` },
    });
    expect(decResp.status()).toBe(201);
    const decisionId = (await decResp.json()).data._id as string;

    const del = await request.delete(`/api/iqa/decisions/${decisionId}`);
    expect(del.status()).toBe(200);

    const list = await request.get('/api/iqa/samples?limit=50');
    const updated = ((await list.json()).data as { _id: string; status: string }[]).find(
      (s) => s._id === sampleId,
    );
    expect(updated?.status).toBe('pending');
  });
});
