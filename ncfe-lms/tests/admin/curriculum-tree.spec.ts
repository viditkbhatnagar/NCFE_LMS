import { test, expect, isRoleAvailable } from '../fixtures/base';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage: admin can stand up a fresh qualification tree
// (qualification → unit → LO → AC) end-to-end and tear it back down.
// Never touches the existing NCFE qualification.

test.describe('Admin — curriculum tree CRUD', () => {
  test.skip(!isRoleAvailable('admin'), 'admin auth-setup did not succeed');

  test('admin creates qualification → 2 units → LO → 2 ACs each, edits, deletes bottom-up', async ({
    request,
    created,
  }) => {
    test.setTimeout(120_000);

    // === Qualification ===
    const qualResp = await request.post('/api/v2/admin/qualifications', {
      data: {
        title: `[E2E-${RUN_ID}] curriculum-tree qualification`,
        level: 3,
        code: `E2E-${RUN_ID}`,
        awardingBody: 'NCFE/CACHE',
        description: `[${RUN_ID}] generated qualification for curriculum-tree spec`,
        status: 'active',
      },
    });
    expect(qualResp.status()).toBe(201);
    const qualBody = await qualResp.json();
    const qualId = qualBody.data._id as string;
    expect(qualId).toBeTruthy();
    created.trackAdmin('admin-qualification', qualId);

    // === Units (2) ===
    const unitIds: string[] = [];
    for (const idx of [1, 2]) {
      const resp = await request.post('/api/v2/admin/units', {
        data: {
          unitReference: `E2E-${RUN_ID}-U${idx}`,
          title: `[${RUN_ID}] Unit ${idx}`,
          description: `[${RUN_ID}] unit ${idx} description`,
          qualificationId: qualId,
        },
      });
      expect(resp.status()).toBe(201);
      const id = (await resp.json()).data._id as string;
      unitIds.push(id);
      created.trackAdmin('admin-unit', id);
    }

    // === Learning outcomes + ACs ===
    const acIds: string[] = [];
    const loIds: string[] = [];
    for (const [unitIdx, unitId] of unitIds.entries()) {
      const loResp = await request.post('/api/v2/admin/learning-outcomes', {
        data: {
          unitId,
          loNumber: `LO${unitIdx + 1}`,
          description: `[${RUN_ID}] outcome for unit ${unitIdx + 1}`,
        },
      });
      expect(loResp.status()).toBe(201);
      const loId = (await loResp.json()).data._id as string;
      loIds.push(loId);
      created.trackAdmin('admin-learning-outcome', loId);

      for (const acIdx of [1, 2]) {
        const acResp = await request.post('/api/v2/admin/assessment-criteria', {
          data: {
            learningOutcomeId: loId,
            unitId,
            qualificationId: qualId,
            acNumber: `${unitIdx + 1}.${acIdx}`,
            description: `[${RUN_ID}] AC ${unitIdx + 1}.${acIdx}`,
            evidenceRequirements: '',
          },
        });
        expect(acResp.status()).toBe(201);
        const acId = (await acResp.json()).data._id as string;
        acIds.push(acId);
        created.trackAdmin('admin-assessment-criteria', acId);
      }
    }

    expect(unitIds).toHaveLength(2);
    expect(loIds).toHaveLength(2);
    expect(acIds).toHaveLength(4);

    // === Edit one of each ===
    const qualEdit = await request.put(`/api/v2/admin/qualifications/${qualId}`, {
      data: { description: `[${RUN_ID}] description updated` },
    });
    expect(qualEdit.ok()).toBeTruthy();

    const unitEdit = await request.put(`/api/v2/admin/units/${unitIds[0]}`, {
      data: { title: `[${RUN_ID}] Unit 1 (edited)` },
    });
    expect(unitEdit.ok()).toBeTruthy();

    // === Delete bottom-up: ACs → LOs → Units → Qualification ===
    for (const id of acIds) {
      const r = await request.delete(`/api/v2/admin/assessment-criteria/${id}`);
      expect(r.ok(), `AC delete ${id} returned ${r.status()}`).toBeTruthy();
    }
    for (const id of loIds) {
      const r = await request.delete(`/api/v2/admin/learning-outcomes/${id}`);
      expect(r.ok(), `LO delete ${id} returned ${r.status()}`).toBeTruthy();
    }
    for (const id of unitIds) {
      const r = await request.delete(`/api/v2/admin/units/${id}`);
      expect(r.ok(), `Unit delete ${id} returned ${r.status()}`).toBeTruthy();
    }
    const qualDel = await request.delete(`/api/v2/admin/qualifications/${qualId}`);
    expect(qualDel.ok(), `Qualification delete returned ${qualDel.status()}`).toBeTruthy();
  });
});
