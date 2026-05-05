// One-shot data fix: clear mustChangePassword for the existing test-fixture
// users so the existing Playwright suite's sign-in flow doesn't redirect to
// /profile/change-password. Run once locally; safe to leave around as
// idempotent.
//
// Affected accounts (test fixtures only):
// - admin@learnerseducation.com
// - jyothi@learnerseducation.com
// - bhatnagar007vidit@gmail.com
// - intern@learnerseducation.com
// - iqa@test.com
//
// James Bond (7777jamesbond7777@gmail.com) is intentionally NOT cleared —
// the demo flow expects the new behaviour. Other admin-created users keep
// the flag.
import mongoose from 'mongoose';
import './env';

const FIXTURE_EMAILS = [
  'admin@learnerseducation.com',
  'jyothi@learnerseducation.com',
  'bhatnagar007vidit@gmail.com',
  'intern@learnerseducation.com',
  'iqa@test.com',
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const result = await mongoose.connection
    .collection('users')
    .updateMany({ email: { $in: FIXTURE_EMAILS } }, { $set: { mustChangePassword: false } });
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
  await mongoose.disconnect();
})();
