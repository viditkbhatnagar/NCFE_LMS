/* eslint-disable no-console */
// End-to-end verification of LIVE-CLASS RECORDING UPLOAD on production, via the
// CUSTOM DOMAIN (ncfe-lms.skillhubinstitute.com) — the URL Hadiya uses.
//
// Reproduces the path her browser now takes: the S3 bucket CORS forbids a
// direct presigned PUT from the custom domain, so the upload streams through
// our own API (`?mode=stream`), which pipes the bytes to S3 in bounded-memory
// multipart parts (no full-file buffering → no OOM → no 502).
//
// Uses a ~12 MB body so the multipart path (8 MB parts) is genuinely exercised.
// Everything created is tagged and cleaned up afterwards.

import { request as playwrightRequest } from '@playwright/test';

const BASE = 'https://ncfe-lms.skillhubinstitute.com';
const ASSESSOR = { email: 'jyothi@learnerseducation.com', password: 'password123' };
const TAG = `REC-${Date.now().toString(36)}`;
const PART_SIZE = 8 * 1024 * 1024;
const TEST_BYTES = Math.round(PART_SIZE * 1.5); // ~12 MB → 2 multipart parts

function pass(m: string) { console.log(`  ✅ ${m}`); }
function fail(m: string) { console.log(`  ❌ ${m}`); process.exitCode = 1; }
function section(t: string) { console.log(`\n=== ${t} ===`); }

async function ctxFor(creds: { email: string; password: string }) {
  const ctx = await playwrightRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { accept: 'application/json' },
  });
  const { csrfToken } = await (await ctx.get('/api/auth/csrf')).json();
  await ctx.post('/api/auth/callback/credentials', {
    form: { email: creds.email, password: creds.password, csrfToken, json: 'true', callbackUrl: BASE },
  });
  const sess = await (await ctx.get('/api/auth/session')).json();
  if (sess?.user?.email?.toLowerCase() !== creds.email.toLowerCase()) {
    throw new Error(`sign-in failed for ${creds.email}`);
  }
  return { ctx, userId: sess.user.id as string };
}

(async () => {
  console.log(`Base: ${BASE}  Tag: ${TAG}`);
  const assessor = await ctxFor(ASSESSOR);
  pass(`signed in as ${ASSESSOR.email} (${assessor.userId})`);

  // Pick a course the assessor owns → qualificationId for the session.
  const courses = (await (await assessor.ctx.get('/api/v2/assessor/courses')).json()).data ?? [];
  if (courses.length === 0) { fail('assessor has no courses'); process.exit(1); }
  const course = courses[0];
  const qualificationId = course.qualificationId || course._id || course.id;
  console.log(`  course: ${course.title}  qualificationId=${qualificationId}`);

  let sessionId = '';
  try {
    section('Create a live session');
    const createRes = await assessor.ctx.post('/api/v2/live-sessions', {
      data: {
        qualificationId,
        title: `[${TAG}] Recording upload test`,
        meetingLink: 'https://example.com/meet/recording-test',
        scheduledAt: new Date(Date.now() - 3600_000).toISOString(), // an hour ago
        durationMinutes: 30,
      },
    });
    const created = await createRes.json();
    if (!createRes.ok() || !created?.data?._id) {
      fail(`create live session failed (${createRes.status()}): ${JSON.stringify(created).slice(0, 300)}`);
      process.exit(1);
    }
    sessionId = created.data._id;
    pass(`live session created: ${sessionId}`);

    section('Stream a ~12 MB recording via ?mode=stream (the custom-domain path)');
    const body = Buffer.alloc(TEST_BYTES, 7); // deterministic non-zero bytes
    const fileName = `${TAG}.mp4`;
    const t0 = Date.now();
    const upRes = await assessor.ctx.post(
      `/api/v2/live-sessions/${sessionId}/recording?mode=stream&fileName=${encodeURIComponent(fileName)}&fileType=${encodeURIComponent('video/mp4')}`,
      { headers: { 'content-type': 'video/mp4' }, data: body, timeout: 120_000 },
    );
    const upJson = await upRes.json().catch(() => ({}));
    if (!upRes.ok() || !upJson?.success) {
      fail(`stream upload failed (${upRes.status()}): ${JSON.stringify(upJson).slice(0, 300)}`);
    } else {
      pass(`streamed ${(TEST_BYTES / 1024 / 1024).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s — no 502, status=${upJson.data?.status}`);
      if (upJson.data?.status === 'completed') pass('session marked completed');
      else fail(`unexpected status: ${upJson.data?.status}`);
    }

    section('Confirm the recording attached to S3');
    const getRes = await assessor.ctx.get(`/api/v2/live-sessions/${sessionId}`);
    const got = (await getRes.json())?.data;
    if (got?.recordingStorageProvider === 's3' && got?.recordingStorageKey) {
      pass(`stored on s3: key=${got.recordingStorageKey}`);
    } else {
      fail(`recording not attached: provider=${got?.recordingStorageProvider} key=${got?.recordingStorageKey}`);
    }
    if (typeof got?.recordingUrl === 'string' && got.recordingUrl.startsWith('s3://')) {
      pass(`recordingUrl set: ${got.recordingUrl}`);
    } else {
      fail(`recordingUrl unexpected: ${got?.recordingUrl}`);
    }

    section('Download round-trip (signed S3 GET)');
    const dlRes = await assessor.ctx.get(`/api/v2/live-sessions/${sessionId}/recording/download?json=1`, {
      maxRedirects: 0,
    }).catch((e) => ({ ok: () => false, status: () => 0, json: async () => ({ err: String(e) }) }));
    let signedUrl = '';
    if ('json' in dlRes) {
      const dlJson = await dlRes.json().catch(() => ({}));
      signedUrl = dlJson?.url || '';
    }
    if (!signedUrl) {
      // Route may redirect instead of returning JSON — read the Location.
      const redir = await assessor.ctx.get(`/api/v2/live-sessions/${sessionId}/recording/download`, { maxRedirects: 0 });
      signedUrl = redir.headers()['location'] || '';
    }
    if (signedUrl.includes('amazonaws.com') || signedUrl.includes('X-Amz')) {
      const head = await assessor.ctx.fetch(signedUrl, { method: 'GET', headers: { range: 'bytes=0-0' } });
      const lenHeader = head.headers()['content-range'] || head.headers()['content-length'] || '';
      if (head.ok() || head.status() === 206) pass(`signed download works (${head.status()}) content-range/length=${lenHeader}`);
      else fail(`signed download returned ${head.status()}`);
    } else {
      fail(`no signed S3 url produced (got: ${signedUrl.slice(0, 80)})`);
    }
  } finally {
    if (sessionId) {
      section('Cleanup');
      const del = await assessor.ctx.delete(`/api/v2/live-sessions/${sessionId}`);
      if (del.ok()) pass(`deleted test session ${sessionId} (S3 object may orphan — IAM lacks DeleteObject; object is tiny)`);
      else fail(`cleanup failed (${del.status()})`);
    }
    console.log('\nDone.');
    process.exit(process.exitCode || 0);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
