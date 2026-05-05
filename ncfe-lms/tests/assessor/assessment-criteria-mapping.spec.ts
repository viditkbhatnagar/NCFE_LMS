import { test, expect } from '../fixtures/base';
import { ENROLMENTS, KNOWN_IDS, QUALIFICATION_ID } from '../fixtures/test-context';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage. Drives the criteria-mapping flow at the API
// level (the same endpoint the modal calls). UI walk-through remains deferred
// pending data-testid additions in the assessor detail panel.

test.describe('Assessor — assessment criteria mapping', () => {
  test('map 3 ACs across 2 units → save → un-tick one → save', async ({ request, created }) => {
    // Fetch the qualification's criteria tree to pick 3 ACs across 2 units
    const treeResp = await request.get(`/api/v2/qualifications/${QUALIFICATION_ID}/criteria-tree`);
    expect(treeResp.ok(), `tree fetch returned ${treeResp.status()}`).toBeTruthy();
    const tree = (await treeResp.json()).data as Array<{
      _id: string;
      learningOutcomes: Array<{
        _id: string;
        assessmentCriteria: Array<{ _id: string; acNumber: string }>;
      }>;
    }>;

    // Take up to 2 ACs per unit so we span ≥ 2 units when 3 are collected.
    const collected: { acId: string; unitId: string }[] = [];
    for (const unit of tree) {
      let perUnit = 0;
      for (const lo of unit.learningOutcomes) {
        for (const ac of lo.assessmentCriteria) {
          if (perUnit >= 2) break;
          collected.push({ acId: ac._id, unitId: unit._id });
          perUnit += 1;
          if (collected.length >= 3) break;
        }
        if (collected.length >= 3 || perUnit >= 2) break;
      }
      if (collected.length >= 3) break;
    }
    expect(collected.length).toBe(3);
    const distinctUnits = new Set(collected.map((c) => c.unitId));
    expect(distinctUnits.size, 'should span at least 2 units').toBeGreaterThanOrEqual(2);

    // Create assessment
    const create = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] criteria-mapping-test ${Date.now()}`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(create.ok()).toBeTruthy();
    const assessmentId = (await create.json()).data._id as string;
    created.trackAssessment(assessmentId);

    // Map 3 ACs
    const acIds = collected.map((c) => c.acId);
    const mapResp = await request.put(`/api/v2/assessments/${assessmentId}/criteria-mapping`, {
      data: { criteriaIds: acIds },
    });
    expect(mapResp.ok(), `mapping save returned ${mapResp.status()}: ${await mapResp.text().catch(() => '')}`).toBeTruthy();

    // Verify GET returns the same
    const get1 = await request.get(`/api/v2/assessments/${assessmentId}/criteria-mapping`);
    const ids1 = (await get1.json()).data as string[];
    expect(new Set(ids1)).toEqual(new Set(acIds));

    // Un-tick one — submit only 2 IDs, the missing one should be removed
    const reduced = acIds.slice(0, 2);
    const unmapResp = await request.put(`/api/v2/assessments/${assessmentId}/criteria-mapping`, {
      data: { criteriaIds: reduced },
    });
    expect(unmapResp.ok()).toBeTruthy();

    const get2 = await request.get(`/api/v2/assessments/${assessmentId}/criteria-mapping`);
    const ids2 = (await get2.json()).data as string[];
    expect(new Set(ids2)).toEqual(new Set(reduced));
    expect(ids2).not.toContain(acIds[2]);
  });
});
