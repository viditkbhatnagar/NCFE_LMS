import { test, expect } from '@playwright/test';
import { PROD_USERS, makeApiContext } from './_helpers';

// Cross-tenant isolation on production. A student must NOT be able to
// list assessments belonging to another learner's enrolment, fetch
// other learners' evidence, or list /api/v2/admin/users.

test('Vidit (student) cannot list assessments belonging to other enrolments', async () => {
  test.setTimeout(60_000);
  const studentApi = await makeApiContext(PROD_USERS.studentReal);
  try {
    // Student API should be locked out of /api/v2/assessments (assessor-only)
    const resp = await studentApi.get('/api/v2/assessments?limit=1');
    expect([403, 401]).toContain(resp.status());
  } finally {
    await studentApi.dispose();
  }
});

test('Vidit (student) cannot list /api/v2/admin/users', async () => {
  const studentApi = await makeApiContext(PROD_USERS.studentReal);
  try {
    const resp = await studentApi.get('/api/v2/admin/users');
    expect([403, 401]).toContain(resp.status());
  } finally {
    await studentApi.dispose();
  }
});

test('Vidit cannot list /api/iqa/samples', async () => {
  const studentApi = await makeApiContext(PROD_USERS.studentReal);
  try {
    const resp = await studentApi.get('/api/iqa/samples');
    expect([403, 401]).toContain(resp.status());
  } finally {
    await studentApi.dispose();
  }
});

test('Vidit cannot delete an admin-controlled qualification', async () => {
  const studentApi = await makeApiContext(PROD_USERS.studentReal);
  try {
    // Use a clearly-fake id; should reject on auth before id resolution
    const resp = await studentApi.delete('/api/v2/admin/qualifications/000000000000000000000000');
    expect([403, 401]).toContain(resp.status());
  } finally {
    await studentApi.dispose();
  }
});
