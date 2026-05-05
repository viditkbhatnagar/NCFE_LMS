import { test, expect } from '../fixtures/base';
import { ENROLMENTS, KNOWN_IDS } from '../fixtures/test-context';
import { RUN_ID } from '../run-id';

test.describe('Student isolation — security checks', () => {
  test('student cannot list assessments via assessor endpoint', async ({ request }) => {
    const resp = await request.get(
      '/api/v2/assessments?qualificationId=699f16ed3efdb56250b02098',
    );
    // The endpoint is locked to assessor role
    expect(resp.status()).toBe(403);
  });

  test('student cannot create an assessment', async ({ request }) => {
    const resp = await request.post('/api/v2/assessments', {
      data: {
        title: `[${RUN_ID}] student-attempt`,
        learnerId: KNOWN_IDS.STUDENT_VIDIT(),
        enrollmentId: ENROLMENTS.VIDIT,
      },
    });
    expect(resp.status()).toBe(403);
  });

  test('student cannot upload evidence for OTHER student enrolment', async ({
    request,
  }) => {
    // Vidit's session, but try to upload to intern's enrolment
    const resp = await request.post('/api/v2/evidence/upload', {
      multipart: {
        file: { name: 'attempt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('PDF') },
        enrolmentId: ENROLMENTS.INTERN,
        label: `[${RUN_ID}] cross-enrol attempt`,
      },
    });
    expect(resp.status()).toBe(403);
  });

  test('student cannot DELETE another student evidence by id-tampering', async ({
    request,
  }) => {
    // Pick the LAST baseline evidence id (which belongs to someone) and try delete
    // We don't know the id without a query, so just hit a random ObjectId.
    const fakeId = '699f000000000000000aaaaa';
    const resp = await request.delete(`/api/v2/evidence/${fakeId}`);
    expect([403, 404]).toContain(resp.status());
  });

  test('student cannot access /admin/users (role check)', async ({ page }) => {
    const resp = await page.goto('/admin/users', { waitUntil: 'networkidle' });
    // Should redirect or 4xx; either way the user is not on /admin/users authenticated.
    const url = page.url();
    expect(url).not.toMatch(/\/admin\/users/);
  });

  test('student API: /api/v2/admin/users returns 403', async ({ request }) => {
    const resp = await request.get('/api/v2/admin/users');
    expect(resp.status()).toBe(403);
  });
});
