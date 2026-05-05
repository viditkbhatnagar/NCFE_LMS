import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import * as path from 'path';
import { ENROLMENTS, UNITS } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO, type FileKey } from '../fixtures/files';
import { RUN_ID } from '../run-id';

interface UploadOk {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
}

async function uploadEvidence(
  request: import('@playwright/test').APIRequestContext,
  fileKey: FileKey,
  enrolmentId: string,
  unitId: string,
): Promise<{ status: number; body: { success: boolean; data?: UploadOk; error?: string } }> {
  const filePath = FILE_PATHS[fileKey];
  const info = FILE_INFO[fileKey];
  const buf = fs.readFileSync(filePath);
  const taggedName = `${RUN_ID}_${path.basename(filePath)}`;
  const resp = await request.post('/api/v2/evidence/upload', {
    multipart: {
      file: { name: taggedName, mimeType: info.mime, buffer: buf },
      enrolmentId,
      unitId,
      label: `[${RUN_ID}] ${fileKey} fixture`,
      description: `E2E uploaded ${fileKey}`,
    },
    timeout: 90_000,
  });
  return {
    status: resp.status(),
    body: await resp.json().catch(() => ({ success: false, error: '<non-json>' })) as never,
  };
}

const ALLOWED_MATRIX: { key: FileKey; description: string }[] = [
  { key: 'PDF', description: 'PDF (application/pdf)' },
  { key: 'DOCX', description: 'DOCX (Word)' },
  { key: 'PNG', description: 'PNG image' },
  { key: 'MP4', description: 'MP4 video' },
  { key: 'MP3', description: 'MP3 audio' },
];

test.describe('Assessor — portfolio file upload matrix (S3)', () => {
  for (const item of ALLOWED_MATRIX) {
    test(`uploads ${item.description}`, async ({ request, created }) => {
      const result = await uploadEvidence(
        request,
        item.key,
        ENROLMENTS.VIDIT,
        UNITS.UNIT_301,
      );
      expect(
        result.status,
        `${item.key} upload returned ${result.status}: ${JSON.stringify(result.body).slice(0, 300)}`,
      ).toBe(201);
      expect(result.body.success).toBe(true);
      const evidenceId = result.body.data!._id;
      expect(evidenceId).toBeTruthy();
      created.trackEvidence(evidenceId);

      // Verify the evidence is downloadable
      const downloadResp = await request.get(`/api/v2/evidence/${evidenceId}/download`);
      expect(
        [200, 302],
        `download status ${downloadResp.status()}`,
      ).toContain(downloadResp.status());
    });
  }

  test('rejects bad.exe with 400', async ({ request }) => {
    const result = await uploadEvidence(request, 'EXE', ENROLMENTS.VIDIT, UNITS.UNIT_301);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toMatch(/not allowed/i);
  });

  test('rejects upload without label (400)', async ({ request }) => {
    const buf = fs.readFileSync(FILE_PATHS.PDF);
    const resp = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: 'no-label.pdf', mimeType: 'application/pdf', buffer: buf },
        enrolmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(resp.status()).toBe(400);
  });

  test('rejects upload without enrolmentId (400)', async ({ request }) => {
    const buf = fs.readFileSync(FILE_PATHS.PDF);
    const resp = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: 'no-enrol.pdf', mimeType: 'application/pdf', buffer: buf },
        label: `[${RUN_ID}] no-enrol`,
      },
    });
    expect(resp.status()).toBe(400);
  });
});
