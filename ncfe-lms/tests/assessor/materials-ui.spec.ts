import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { QUALIFICATION_ID } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage. Drives material upload + category metadata + edit
// + filter + delete. Full UI walk-through deferred pending data-testids.

test.describe('Assessor — learning materials CRUD', () => {
  test('upload with category + description → edit → filter → delete', async ({ request, created }) => {
    const buf = fs.readFileSync(FILE_PATHS.PDF);

    const upload = await request.post('/api/v2/materials', {
      multipart: {
        file: { name: `${RUN_ID}-mat.pdf`, mimeType: FILE_INFO.PDF.mime, buffer: buf },
        qualificationId: QUALIFICATION_ID,
        title: `[${RUN_ID}] handbook material`,
        category: 'manual',
        description: `[${RUN_ID}] uploaded by E2E suite`,
      },
    });
    expect(
      upload.status(),
      `material upload returned ${upload.status()}: ${await upload.text().catch(() => '')}`,
    ).toBe(201);
    const material = (await upload.json()).data;
    const id = material._id as string;
    created.track({ kind: 'material', id, storageKey: material.storageKey });
    expect(material.category).toBe('manual');

    // Edit (rename) — the API exposes fileRenameSchema only at the moment
    const edited = await request.put(`/api/v2/materials/${id}`, {
      data: { fileName: `[${RUN_ID}] handbook material (revised)` },
    });
    expect(edited.ok(), `material rename returned ${edited.status()}`).toBeTruthy();

    // Filter list by category — verify the original 'manual' filter still finds it
    const filtered = await request.get(
      `/api/v2/materials?qualificationId=${QUALIFICATION_ID}&category=manual`,
    );
    expect(filtered.ok()).toBeTruthy();
    const list = (await filtered.json()).data as { _id: string; category: string }[];
    const our = list.find((m) => m._id === id);
    expect(our, 'our material should appear in manual-filtered list').toBeDefined();

    // Download
    const dl = await request.get(`/api/v2/materials/${id}/download`);
    expect([200, 302]).toContain(dl.status());

    // Delete
    const del = await request.delete(`/api/v2/materials/${id}`);
    expect(del.status()).toBe(200);
  });
});
