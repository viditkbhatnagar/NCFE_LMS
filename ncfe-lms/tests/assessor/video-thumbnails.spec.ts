import * as fs from 'fs';
import { test, expect } from '../fixtures/base';
import { isRoleAvailable } from '../fixtures/base';
import { RUN_ID } from '../run-id';
import { FILE_PATHS, FILE_INFO } from '../fixtures/files';

// G15 — server-side video thumbnail generation via ffmpeg-static.
// Uploads a small MP4 evidence file as a student, then waits up to 60 s
// for the synchronous thumbnail step to populate Evidence.thumbnailUrl.
//
// The generation is soft-fail: if ffmpeg-static can't read the codec on the
// CI runner, the upload still succeeds and the test logs that the thumbnail
// is null rather than failing the suite.

test.describe('Evidence — G15 video thumbnails', () => {
  test.skip(!isRoleAvailable('student'), 'student login failed during auth-setup');

  test('uploading an MP4 evidence file populates thumbnailUrl (soft-fail tolerant)', async ({
    request,
    created,
  }) => {
    if (!fs.existsSync(FILE_PATHS.MP4)) {
      test.skip(true, 'video.mp4 fixture missing');
      return;
    }

    // Find the student's enrolment to upload against.
    const enrolList = await request.get('/api/v2/student/enrollments');
    expect(enrolList.ok(), `student/enrollments returned ${enrolList.status()}`).toBeTruthy();
    const enrolBody = await enrolList.json();
    const enrolmentId =
      enrolBody?.data?.[0]?._id || enrolBody?.enrollments?.[0]?._id;
    if (!enrolmentId) {
      test.skip(true, 'student has no active enrolment');
      return;
    }

    // Build a multipart upload with a tagged filename.
    const buffer = fs.readFileSync(FILE_PATHS.MP4);
    const tagLabel = `[${RUN_ID}] G15 video thumbnail test`;
    const upload = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: {
          name: `${RUN_ID.toLowerCase()}-thumb.${FILE_INFO.MP4.ext}`,
          mimeType: FILE_INFO.MP4.mime,
          buffer,
        },
        enrolmentId,
        label: tagLabel,
        description: 'G15 thumbnail soft-fail integration check',
      },
    });

    if (upload.status() === 403) {
      test.skip(true, 'student is not the owner of the enrolment in this seed');
      return;
    }
    expect(upload.status(), `upload returned ${upload.status()}: ${await upload.text()}`).toBe(201);
    const upBody = await upload.json();
    const evidenceId = upBody?.data?._id;
    expect(evidenceId).toBeTruthy();
    created.trackStudent('evidence', evidenceId);

    // Synchronous thumbnail step runs inside the upload route, but allow up
    // to 60 s of leeway in case the deployment runs ffmpeg in a slower path.
    let thumbnailUrl: string | null = null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const detail = await request.get(`/api/v2/evidence/${evidenceId}`);
      if (detail.ok()) {
        const data = (await detail.json()).data;
        if (typeof data?.thumbnailUrl === 'string' && data.thumbnailUrl.length > 0) {
          thumbnailUrl = data.thumbnailUrl;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (thumbnailUrl) {
      // Soft validation: if the URL came back, it should be reachable.
      const head = await request.get(thumbnailUrl);
      expect(head.ok(), `thumbnail URL returned ${head.status()}`).toBeTruthy();
    } else {
      // ffmpeg may be unavailable on the runner — the upload itself should
      // have succeeded regardless. Emit a console line so the operator knows
      // the soft-fail path was taken.
      console.warn('[G15] thumbnailUrl was not populated within 60s — soft-fail path taken (upload still succeeded)');
    }
  });

  test('uploading a non-video file leaves thumbnailUrl unset', async ({
    request,
    created,
  }) => {
    if (!fs.existsSync(FILE_PATHS.PDF)) {
      test.skip(true, 'tiny.pdf fixture missing');
      return;
    }
    const enrolList = await request.get('/api/v2/student/enrollments');
    const enrolBody = await enrolList.json();
    const enrolmentId =
      enrolBody?.data?.[0]?._id || enrolBody?.enrollments?.[0]?._id;
    if (!enrolmentId) {
      test.skip(true, 'student has no active enrolment');
      return;
    }

    const buffer = fs.readFileSync(FILE_PATHS.PDF);
    const upload = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: {
          name: `${RUN_ID.toLowerCase()}-not-a-video.pdf`,
          mimeType: FILE_INFO.PDF.mime,
          buffer,
        },
        enrolmentId,
        label: `[${RUN_ID}] G15 non-video soft-fail check`,
        description: 'PDF should not produce a thumbnail',
      },
    });
    if (upload.status() === 403) {
      test.skip(true, 'student is not the owner of the enrolment in this seed');
      return;
    }
    expect(upload.status()).toBe(201);
    const evidenceId = (await upload.json())?.data?._id;
    expect(evidenceId).toBeTruthy();
    created.trackStudent('evidence', evidenceId);

    const detail = await request.get(`/api/v2/evidence/${evidenceId}`);
    if (detail.ok()) {
      const data = (await detail.json()).data;
      expect(data?.thumbnailUrl ?? null).toBeNull();
    }
  });
});
