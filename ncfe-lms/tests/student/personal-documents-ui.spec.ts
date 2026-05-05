import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage: student uploads, lists, downloads, and deletes
// their own personal document via the new DELETE endpoint (Fix #3).

test.describe('Student — personal documents own-data lifecycle', () => {
  test('upload → list → download → delete (own document)', async ({ request, created }) => {
    const buf = fs.readFileSync(FILE_PATHS.PDF);

    // === UPLOAD ===
    const uploadResp = await request.post('/api/v2/personal-documents', {
      multipart: {
        file: { name: `${RUN_ID}-cv.pdf`, mimeType: FILE_INFO.PDF.mime, buffer: buf },
      },
    });
    expect(
      uploadResp.status(),
      `upload returned ${uploadResp.status()}: ${await uploadResp.text().catch(() => '')}`,
    ).toBe(201);
    const uploaded = (await uploadResp.json()).data;
    expect(uploaded._id).toBeTruthy();
    const docId = uploaded._id as string;
    created.track({ kind: 'personal-document', id: docId, storageKey: uploaded.storageKey });

    // === LIST — student auto-scopes to own ===
    const listResp = await request.get('/api/v2/personal-documents');
    expect(listResp.ok()).toBeTruthy();
    const list = (await listResp.json()).data as { _id: string }[];
    expect(list.find((d) => d._id === docId), 'uploaded doc should appear in own list').toBeDefined();

    // === DOWNLOAD ===
    const dl = await request.get(`/api/v2/personal-documents/${docId}/download`);
    expect([200, 302]).toContain(dl.status());

    // === DELETE (Fix #3 endpoint) ===
    const del = await request.delete(`/api/v2/personal-documents/${docId}`);
    expect(del.status()).toBe(200);
    expect((await del.json()).success).toBe(true);

    // Verify gone
    const list2 = await request.get('/api/v2/personal-documents');
    const stillThere = ((await list2.json()).data as { _id: string }[]).find((d) => d._id === docId);
    expect(stillThere).toBeUndefined();
  });
});
