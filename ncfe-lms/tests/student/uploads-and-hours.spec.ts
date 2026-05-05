import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { ENROLMENTS, KNOWN_IDS, UNITS } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

test.describe('Student — own uploads and work-hours', () => {
  test('student uploads evidence to own enrolment (PDF)', async ({ request, created }) => {
    const buf = fs.readFileSync(FILE_PATHS.PDF);
    const resp = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: {
          name: `${RUN_ID}_student.pdf`,
          mimeType: FILE_INFO.PDF.mime,
          buffer: buf,
        },
        enrolmentId: ENROLMENTS.VIDIT,
        unitId: UNITS.UNIT_301,
        label: `[${RUN_ID}] student PDF self-upload`,
      },
    });
    expect(resp.status(), `student upload returned ${resp.status()}`).toBe(201);
    const body = await resp.json();
    created.trackEvidence(body.data._id);
  });

  test('student logs work hours', async ({ request, created }) => {
    const resp = await request.post('/api/v2/work-hours', {
      data: {
        enrollmentId: ENROLMENTS.VIDIT,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        date: new Date().toISOString().slice(0, 10),
        hours: 2,
        minutes: 30,
        notes: `[${RUN_ID}] student logged hours`,
      },
    });
    expect(resp.status(), `work-hours create returned ${resp.status()}`).toBe(201);
    const body = await resp.json();
    const id = body.data?._id || body.data?.id;
    expect(id).toBeTruthy();
    created.track({ kind: 'work-hours', id });
  });

  test('student cannot log work hours against another learner', async ({ request }) => {
    const resp = await request.post('/api/v2/work-hours', {
      data: {
        enrollmentId: ENROLMENTS.INTERN,
        learnerId: KNOWN_IDS.STUDENT_INTERN(),
        date: new Date().toISOString().slice(0, 10),
        hours: 1,
        minutes: 0,
        notes: `[${RUN_ID}] cross-attempt`,
      },
    });
    expect(resp.status()).toBe(403);
  });
});
