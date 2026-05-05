import { test, expect, isRoleAvailable } from '../fixtures/base';

// Fix #4: reset the IQA password via the admin reset-password flow.
// Run once with `npx playwright test --project admin --grep "Fix #4"`.
// Effectively a one-shot data fixup; documented as the real-world admin
// reset-password workflow exercise.

test.describe('Fix #4 — Reset IQA password to "iqapassword" via admin', () => {
  test.skip(!isRoleAvailable('admin'), 'admin login failed during auth-setup');

  test('admin resets IQA test user password to iqapassword', async ({ request }) => {
    // Locate IQA user
    const usersResp = await request.get('/api/v2/admin/users?search=iqa@test.com');
    expect(usersResp.ok()).toBeTruthy();
    const users = (await usersResp.json()).data as { _id: string; email: string }[];
    const iqaUser = users.find((u) => u.email === 'iqa@test.com');
    expect(iqaUser, 'iqa@test.com user not found').toBeDefined();

    // POST reset-password
    const resp = await request.post(`/api/v2/admin/users/${iqaUser!._id}/reset-password`, {
      data: { newPassword: 'iqapassword' },
    });
    expect(
      resp.ok(),
      `reset-password returned ${resp.status()}: ${await resp.text().catch(() => '')}`,
    ).toBeTruthy();
  });
});
