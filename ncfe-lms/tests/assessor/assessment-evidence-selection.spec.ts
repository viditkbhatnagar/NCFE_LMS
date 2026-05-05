import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { ENROLMENTS, KNOWN_IDS, UNITS } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage. Drives the evidence-selection flow at the API
// level. UI walk-through deferred pending data-testids in the assessor detail
// panel.

test.describe('Assessor — assessment evidence selection', () => {
  test('link existing evidence + upload-then-link round-trip', async ({ request, created }) => {
    // === Create assessment ===
    const create = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] evidence-selection-test ${Date.now()}`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(create.ok()).toBeTruthy();
    const assessmentId = (await create.json()).data._id as string;
    created.trackAssessment(assessmentId);

    // === Path A: link an existing piece of evidence (upload one first as the seed). ===
    const buf = fs.readFileSync(FILE_PATHS.PDF);
    const upload = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: `${RUN_ID}-evid.pdf`, mimeType: FILE_INFO.PDF.mime, buffer: buf },
        enrolmentId: ENROLMENTS.VIDIT,
        unitId: UNITS.UNIT_301,
        label: `[${RUN_ID}] evidence-selection seed`,
      },
    });
    expect(upload.status()).toBe(201);
    const ev1Id = (await upload.json()).data._id as string;
    created.trackEvidence(ev1Id);

    const linkResp = await request.put(`/api/v2/assessments/${assessmentId}/evidence-mapping`, {
      data: { evidenceIds: [ev1Id] },
    });
    expect(linkResp.ok(), `link returned ${linkResp.status()}`).toBeTruthy();

    const extractIds = (rows: unknown): string[] => {
      const arr = rows as Array<{ evidenceId?: string | { _id: string } }>;
      return arr.map((r) =>
        typeof r.evidenceId === 'string' ? r.evidenceId : r.evidenceId?._id ?? '',
      );
    };

    const get1 = await request.get(`/api/v2/assessments/${assessmentId}/evidence-mapping`);
    const linked1 = extractIds((await get1.json()).data);
    expect(linked1).toContain(ev1Id);

    // === Path B: upload a 2nd piece of evidence and link both. ===
    const buf2 = fs.readFileSync(FILE_PATHS.DOCX);
    const upload2 = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: `${RUN_ID}-evid.docx`, mimeType: FILE_INFO.DOCX.mime, buffer: buf2 },
        enrolmentId: ENROLMENTS.VIDIT,
        unitId: UNITS.UNIT_301,
        label: `[${RUN_ID}] evidence-selection second`,
      },
    });
    expect(upload2.status()).toBe(201);
    const ev2Id = (await upload2.json()).data._id as string;
    created.trackEvidence(ev2Id);

    const link2 = await request.put(`/api/v2/assessments/${assessmentId}/evidence-mapping`, {
      data: { evidenceIds: [ev1Id, ev2Id] },
    });
    expect(link2.ok()).toBeTruthy();

    const get2 = await request.get(`/api/v2/assessments/${assessmentId}/evidence-mapping`);
    const linked2 = extractIds((await get2.json()).data);
    expect(new Set(linked2)).toEqual(new Set([ev1Id, ev2Id]));

    // Unlink one
    const unlink = await request.put(`/api/v2/assessments/${assessmentId}/evidence-mapping`, {
      data: { evidenceIds: [ev2Id] },
    });
    expect(unlink.ok()).toBeTruthy();
    const get3 = await request.get(`/api/v2/assessments/${assessmentId}/evidence-mapping`);
    const linked3 = extractIds((await get3.json()).data);
    expect(linked3).toEqual([ev2Id]);
  });
});
