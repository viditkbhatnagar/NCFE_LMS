# Follow-up message — paste into the running Claude Code session after password generator finishes

Once the password generator is committed and deployed, **extend scope** to the Brevo email integration. The full spec is at `/Users/viditkbhatnagar/codes/NCFE_LMS/BREVO_EMAIL_PROMPT.md` — read it and execute it.

A few things have already been set up so you can skip those steps:

- `.env.local` already contains `BREVO_API_KEY`, `BREVO_SENDER_EMAIL=intern@learnerseducation.com`, `BREVO_SENDER_NAME=Learners Education NCFE LMS`, and `APP_BASE_URL=https://ncfe-lms.onrender.com`. Do not re-add or modify them.
- The same four variables are already configured in the Render dashboard for production.
- The Brevo sender (`intern@learnerseducation.com`) is verified.
- Domain authentication is intentionally NOT done yet — emails will send via single-sender. Don't try to fix the deliverability warning.

**In addition to the tests in `BREVO_EMAIL_PROMPT.md`, add these email-functionality tests to the admin-create-student flow:**

1. **End-to-end "real email send" test** — `tests/admin/email-real-send.spec.ts`. Sign in as admin, create a `[E2E-${RUN_ID}]` student with email `intern+e2e-${RUN_ID}@learnerseducation.com` (the `+tag` form lets the same Gmail/Brevo mailbox receive it without a separate inbox). Assert the API response has `emailSent: true` and a non-`logged-only` `messageId`. Then verify via Brevo's API directly that the email was accepted: `GET https://api.brevo.com/v3/smtp/statistics/events?email=intern+e2e-${RUN_ID}@learnerseducation.com&limit=10` with the API key in the `api-key` header. Expect at least one event of type `request` or `delivered`. Cleanup: soft-delete the user.

2. **Audit log verification** — after the create above, assert `AuditLog.findOne({ entityId: <newUserId>, action: 'EMAIL_SENT' })` exists and has `newValue.template === 'welcome'` and a populated `messageId`. Verify the password is NOT present anywhere in the audit log document.

3. **Reset password email round-trip** — admin resets password for the same user, asserts a second `EMAIL_SENT` audit log entry with `template: 'password_reset'`, asserts a Brevo event for that send.

4. **Resend welcome round-trip** — admin clicks "Resend welcome email" on the same user. Asserts a third audit-log entry, a third Brevo event, and that the new password returned in the response is different from the previous two.

5. **Soft-fail behaviour** — temporarily override `BREVO_API_KEY` in the test env to an obviously-invalid value (e.g. `xkeysib-INVALID`), create another `[E2E-${RUN_ID}]` user. Assert: API still returns 201 with `emailSent: false` and a populated `emailError`, the user IS created in Mongo, the audit log has `EMAIL_FAILED`. Restore the real key after.

For all five, follow the standard non-destructive rules: RUN_ID tagging, soft-delete cleanup of any test users (admin DELETE is soft-delete by design — that's expected, document any leftover inactive rows in the report).

**Build + commit + deploy:**

- Bundle the Brevo integration into a separate logical commit on top of the password-generator commit, so the deploy diff is reviewable: `feat(email): Brevo welcome + reset + resend with audit logging and soft-fail`. Then a second commit for the new specs: `test(email): integration + real-send tests for admin user emails`.
- Push both commits in one `git push origin main`. Render will deploy.

**Real production smoke test:** sign in as admin at `https://ncfe-lms.onrender.com`, create one transient smoke user with email `intern+prodsmoke-${timestamp}@learnerseducation.com`, password auto-generated, role `student`. Verify the success modal shows "Email sent ✓". Then poll Brevo's `/v3/smtp/statistics/events` endpoint to confirm delivery. **Delete this transient smoke user** when verified.

---

**After the smoke test passes — create the permanent demo student:**

This user is intentional and persistent — it will be used for the real UAT demo tomorrow and **must NOT be deleted as part of any cleanup**.

Sign in as admin on production (`https://ncfe-lms.onrender.com`). Go to `/admin/users` → Add User. Fill in exactly:

- **Name:** `James Bond` (or whatever name fits — keep it clearly demo-like)
- **Email:** `7777jamesbond7777@gmail.com`
- **Role:** `student`
- **Password:** click **Generate** to use the auto-password feature you just deployed (this validates the full flow end-to-end)
- **Status:** `active`

Submit. The success modal should show:
- The auto-generated password
- "Email sent ✓"
- The "Copy all credentials" button

**Capture the generated password** — Claude Code must read it from the success modal before the modal closes (it's the same value the form had on submit; store it in a local variable). Save it to `tests/DEMO_CREDENTIALS.md` (this file is gitignored — add `DEMO_CREDENTIALS.md` to `.gitignore` first if it isn't already).

Now enrol this student in the existing NCFE qualification so they can log in and immediately have a course to look at:

- Go to `/admin/enrolments` → Add Enrolment.
- Student: `James Bond / 7777jamesbond7777@gmail.com`.
- Qualification: `NCFE Level 3 Certificate in Assessing Vocational Achievement` (the existing one — slug `ncfe-level-3-certificate-in-assessing-vocational-achievement`).
- Assessor: `Jyothi`.
- Cohort: `2026-Q1` (matches the other student enrolments).
- Status: `in_progress`.
- Save.

Verify by signing out, signing in as `7777jamesbond7777@gmail.com` with the captured password. Confirm:
- Login succeeds, redirects to `/c`.
- The NCFE Level 3 course card is visible.
- Clicking into it shows the course home page with the right sidebar.
- Sign out.

⚠️ **Do NOT delete this student or its enrolment.** It's the demo account for tomorrow.

---

**Final deliverable — `tests/DEMO_SUMMARY.md`:**

Generate a launch-ready document containing:

1. **Production URL:** `https://ncfe-lms.onrender.com/sign-in`
2. **All credentials table** — every existing user with role and password:
   - Admin: `admin@learnerseducation.com / passwordadmin`
   - Assessor (Jyothi): `jyothi@learnerseducation.com / password123`
   - Student (Vidit): `bhatnagar007vidit@gmail.com / password`
   - Student (Peter): `intern@learnerseducation.com / password`
   - Student (Demo — James Bond): `7777jamesbond7777@gmail.com / <captured-password>`
   - IQA (Bruce): `iqa@test.com / iqapassword` (after the password reset fix; if reset didn't happen, fall back to `Password123!`)
3. **What was just deployed in this session:**
   - Auto-generated 14-char passwords on admin user create (excluding ambiguous chars).
   - Reveal/copy/regenerate buttons + post-create success modal showing credentials.
   - Brevo welcome email + password-reset email + resend-welcome action, audit-logged, soft-fail behaviour.
   - Same UX on the password reset dialog.
4. **End-to-end demo script** — a step-by-step walkthrough an exec or external auditor could read and follow:
   - Step 1: Show admin creating James Bond (already done) — note the email arrival in the live demo.
   - Step 2: Sign in as James Bond → tour the student dashboard.
   - Step 3: Sign in as Jyothi → create an assessment for James Bond, plan it, map criteria.
   - Step 4: Sign in as James Bond → upload portfolio evidence (PDF + image).
   - Step 5: Sign in as Jyothi → map evidence, sign off.
   - Step 6: Sign in as James Bond → learner sign-off.
   - Step 7: Sign in as Bruce (IQA) → sample, decide.
   - Step 8: Sign in as Admin → audit log.
   - For each step give the URL to land on and the specific button to click.
5. **Inbox check instructions:** "Open `7777jamesbond7777@gmail.com`. Search for `Welcome to NCFE LMS`. The credentials block should match what's in this file. If the email is in spam, that's expected with single-sender Brevo verification — domain authentication will fix it (next-week task)."
6. **Known caveats for tomorrow's launch:**
   - Render free tier cold-start: first request after 15 min idle takes 30–60 s. Open the production URL 2 minutes before the demo to warm it up.
   - Welcome emails may land in spam (single-sender deliverability). Pre-warn the demo audience.
   - Admin DELETE is soft-delete (sets `status: 'inactive'`) — by design.
   - 150 MB MP4 upload tested and works; very large files (>500 MB) untested.
   - No "must change password on first login" enforcement yet — students keep admin-generated password until they reset it themselves.
7. **What's still open / next-week list:**
   - Brevo domain authentication for `learnerseducation.com` (improves deliverability).
   - API key rotation (current one was shared in chat).
   - Force-change-password-on-first-login UX.
   - Cross-browser smoke (Firefox, Safari).
   - Mobile viewport polish.
   - Anything else the production E2E run flags as deferred.

Save it to `tests/DEMO_SUMMARY.md`. Print its full contents in chat at the end so the user can copy it directly.

**Final one-line summary in chat:**

`Done. Password generator + Brevo emails + tests deployed. Demo student James Bond <7777jamesbond7777@gmail.com> created and enrolled under Jyothi. Welcome email sent — confirm receipt in the Gmail inbox. Full demo brief in tests/DEMO_SUMMARY.md.`
