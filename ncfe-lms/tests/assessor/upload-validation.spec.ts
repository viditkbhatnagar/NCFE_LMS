import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { ENROLMENTS, UNITS } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

// Regression for Fix #1: validation errors at upload time return exactly 400, not 500.
// Previously returned 500 with descriptive text — see tests/BUG_LOG.md row "APP BUG: ... returns 500".

test.describe('Assessor — upload validation returns 4xx (Fix #1)', () => {
  test('rejects bad file extension (.exe) with 400', async ({ request }) => {
    const buf = fs.readFileSync(FILE_PATHS.EXE);
    const resp = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: 'bad.exe', mimeType: FILE_INFO.EXE.mime, buffer: buf },
        enrolmentId: ENROLMENTS.VIDIT,
        unitId: UNITS.UNIT_301,
        label: `[${RUN_ID}] disallowed extension`,
      },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not allowed/i);
  });

  // The >2 GB regression case — a 2.1 GB fixture exists on disk
  // (tests/fixtures/files/oversized.pdf), but Playwright's APIRequestContext
  // buffers multipart bodies internally and rejects with "data is too long"
  // when the buffer would exceed Node's 2 GiB Buffer cap. Streaming via
  // fs.createReadStream hits the same internal buffering. Documented as
  // untestable through Playwright in tests/BUG_LOG.md; the size validation
  // branch shares the same try/catch with the bad-extension branch above, so
  // the bad.exe → 400 test is the de-facto regression for this fix.
  test.skip('rejects oversized file (>2 GB) with 400 — UNTESTABLE in Playwright', () => {});
});
