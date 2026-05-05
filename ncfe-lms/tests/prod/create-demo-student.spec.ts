// One-shot script: creates the James Bond demo student on production,
// enrols them in the existing NCFE qualification under Jyothi, and writes
// the captured auto-generated password to tests/DEMO_CREDENTIALS.md.
//
// Run: npx playwright test --config=playwright.prod.config.ts --grep "James Bond demo"
//
// Idempotent: if the user already exists, the script reports the existing
// user id and exits without trying to recreate (admin DELETE is soft-delete
// so any prior partial run leaves the row reusable).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const DEMO = {
  name: 'James Bond',
  email: '7777jamesbond7777@gmail.com',
  role: 'student',
  cohortId: '2026-Q1',
};

const NCFE_QUAL_TITLE = 'NCFE Level 3 Certificate in Assessing Vocational Achievement';
const ASSESSOR_EMAIL = 'jyothi@learnerseducation.com';

test.describe.configure({ mode: 'serial' });

test('James Bond demo student — create + enrol on production', async ({ page }) => {
  test.setTimeout(180_000);

  // Idempotent guard: if DEMO_CREDENTIALS.md already exists, skip unless
  // FORCE_DEMO_RESET=1 is set. Avoids overwriting a captured password
  // when this spec re-runs as part of the full prod suite.
  const credPathEarly = path.join(__dirname, '..', 'DEMO_CREDENTIALS.md');
  if (fs.existsSync(credPathEarly) && process.env.FORCE_DEMO_RESET !== '1') {
    test.skip(true, `${credPathEarly} already exists; set FORCE_DEMO_RESET=1 to refresh.`);
  }

  await page.goto('/admin/users');
  await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible({ timeout: 30_000 });

  // Check if the demo user already exists; reuse if so.
  let demoUserId: string | null = null;
  let demoPassword: string | null = null;

  const existingResp = await page.request.get(`/api/v2/admin/users?search=7777jamesbond7777`);
  const existingBody = await existingResp.json();
  const existing = (existingBody.data as Array<{ _id: string; email: string }>).find(
    (u) => u.email === DEMO.email,
  );

  if (existing) {
    demoUserId = existing._id;
    console.log(`[demo] User already exists with _id=${demoUserId}; will Resend welcome to capture a fresh password.`);

    // Use the new resend-welcome endpoint to get a fresh password without manual UI work
    const resend = await page.request.post(`/api/v2/admin/users/${demoUserId}/resend-welcome`);
    expect(resend.ok(), `resend-welcome failed: ${await resend.text().catch(() => '')}`).toBeTruthy();
    const resendBody = await resend.json();
    demoPassword = resendBody.password;
    expect(demoPassword).toBeTruthy();
  } else {
    // Create via UI to validate the full Phase 1.5 + 1.6 flow end-to-end
    await page.getByRole('button', { name: 'Add User' }).click();
    await page.getByLabel('Name').fill(DEMO.name);
    await page.getByLabel('Email').fill(DEMO.email);
    // Default role is student; confirm

    const passwordInput = page.getByLabel('Password', { exact: true });
    await expect(passwordInput).toBeVisible();
    demoPassword = await passwordInput.inputValue();
    expect(demoPassword!.length).toBe(14);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('User created')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Email sent to/i)).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    const list = await page.request.get(`/api/v2/admin/users?search=7777jamesbond7777`);
    const body = await list.json();
    demoUserId = (body.data as Array<{ _id: string; email: string }>).find(
      (u) => u.email === DEMO.email,
    )?._id ?? null;
    expect(demoUserId).toBeTruthy();
  }

  // ENROL — find the assessor and qualification ids
  const assessorList = await page.request.get(`/api/v2/admin/users?search=jyothi`);
  const assessorBody = await assessorList.json();
  const assessor = (assessorBody.data as Array<{ _id: string; email: string }>).find(
    (u) => u.email === ASSESSOR_EMAIL,
  );
  expect(assessor, 'assessor jyothi not found').toBeTruthy();

  const qualList = await page.request.get(`/api/v2/admin/qualifications?search=NCFE+Level+3`);
  const qualBody = await qualList.json();
  const qualification = (qualBody.data as Array<{ _id: string; title: string }>).find(
    (q) => q.title === NCFE_QUAL_TITLE,
  );
  expect(qualification, 'NCFE Level 3 qualification not found').toBeTruthy();

  // Check existing enrolment
  const existingEnrolResp = await page.request.get(
    `/api/v2/admin/enrolments?qualificationId=${qualification!._id}`,
  );
  const existingEnrolBody = await existingEnrolResp.json();
  const alreadyEnrolled = (existingEnrolBody.data as Array<{ userId: { _id: string }; _id: string }>).find(
    (e) => e.userId._id === demoUserId,
  );

  if (alreadyEnrolled) {
    console.log(`[demo] Enrolment already exists with _id=${alreadyEnrolled._id}; skipping create.`);
  } else {
    const enrolResp = await page.request.post('/api/v2/admin/enrolments', {
      data: {
        userId: demoUserId,
        qualificationId: qualification!._id,
        assessorId: assessor!._id,
        cohortId: DEMO.cohortId,
        status: 'in_progress',
      },
    });
    expect(
      enrolResp.ok(),
      `enrolment create returned ${enrolResp.status()}: ${await enrolResp.text().catch(() => '')}`,
    ).toBeTruthy();
  }

  // Write to DEMO_CREDENTIALS.md (gitignored)
  const credPath = path.join(__dirname, '..', 'DEMO_CREDENTIALS.md');
  const block = `# Demo credentials — generated ${new Date().toISOString()}

Sign-in URL: https://ncfe-lms.onrender.com/sign-in

## James Bond (demo student — for tomorrow's UAT)

- **Email:** ${DEMO.email}
- **Password:** ${demoPassword}
- **Role:** student
- **Enrolled in:** ${NCFE_QUAL_TITLE}
- **Assessor:** Jyothi (${ASSESSOR_EMAIL})

⚠️ This file is gitignored. Do NOT commit. Do NOT delete this user — it's the demo account.

## Other accounts (unchanged)

| Role | Email | Password |
|---|---|---|
| Admin | admin@learnerseducation.com | passwordadmin |
| Assessor (Jyothi) | jyothi@learnerseducation.com | password123 |
| Student (Vidit) | bhatnagar007vidit@gmail.com | password |
| Student (Peter) | intern@learnerseducation.com | password |
| IQA (Bruce) | iqa@test.com | iqapassword |
`;
  fs.writeFileSync(credPath, block);
  console.log(`[demo] Wrote credentials to ${credPath}`);
});
