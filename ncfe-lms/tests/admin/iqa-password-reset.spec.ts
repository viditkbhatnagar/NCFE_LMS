import mongoose from 'mongoose';
import { test, expect, isRoleAvailable } from '../fixtures/base';

// Fix #4: reset the IQA password via the admin reset-password flow.
// Run once with `npx playwright test --project admin --grep "Fix #4"`.
// Effectively a one-shot data fixup; documented as the real-world admin
// reset-password workflow exercise.
//
// G5 update: the admin reset-password endpoint now sets
// mustChangePassword=true so admin-issued credentials force a change on
// next login. For the test fixture user we deliberately clear that flag
// after the reset so the existing Playwright suite can sign in directly.

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

    // Clear mustChangePassword for this fixture user (post-G5 the reset
    // endpoint sets it true, but the test fixture needs direct sign-in).
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }
    await mongoose.connection.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(iqaUser!._id) },
      { $set: { mustChangePassword: false } },
    );
  });
});
