import { test, expect } from '../fixtures/base';
import * as fs from 'fs';
import { QUALIFICATION_ID } from '../fixtures/test-context';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';
import { RUN_ID } from '../run-id';

// Phase 1 deferred coverage. Exercises folder + file CRUD via API. Full UI
// (grid/list toggle, breadcrumb, preview modal) coverage deferred pending
// data-testid additions.

test.describe('Assessor — course documents CRUD', () => {
  test('create folder → upload file into it → rename → delete', async ({ request, created }) => {
    // Folder — JSON body
    const folderResp = await request.post('/api/v2/course-documents', {
      data: {
        fileName: `[${RUN_ID}] folder-test`,
        qualificationId: QUALIFICATION_ID,
      },
    });
    expect(folderResp.status()).toBe(201);
    const folder = (await folderResp.json()).data;
    expect(folder.isFolder).toBe(true);
    const folderId = folder._id as string;
    created.track({ kind: 'course-document', id: folderId });

    // Upload file inside folder — multipart body
    const buf = fs.readFileSync(FILE_PATHS.PDF);
    const fileResp = await request.post('/api/v2/course-documents', {
      multipart: {
        file: { name: `${RUN_ID}-coursedoc.pdf`, mimeType: FILE_INFO.PDF.mime, buffer: buf },
        qualificationId: QUALIFICATION_ID,
        folderId,
      },
    });
    expect(fileResp.status()).toBe(201);
    const file = (await fileResp.json()).data;
    const fileId = file._id as string;
    created.track({ kind: 'course-document', id: fileId, storageKey: file.storageKey });

    // Rename via PUT
    const renamed = await request.put(`/api/v2/course-documents/${fileId}`, {
      data: { fileName: `[${RUN_ID}] renamed.pdf` },
    });
    expect(renamed.ok()).toBeTruthy();
    expect((await renamed.json()).data.fileName).toBe(`[${RUN_ID}] renamed.pdf`);

    // Download
    const dl = await request.get(`/api/v2/course-documents/${fileId}/download`);
    expect([200, 302]).toContain(dl.status());

    // Delete file then folder
    const delFile = await request.delete(`/api/v2/course-documents/${fileId}`);
    expect(delFile.status()).toBe(200);

    const delFolder = await request.delete(`/api/v2/course-documents/${folderId}`);
    expect(delFolder.status()).toBe(200);
  });
});
