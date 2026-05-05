# NCFE LMS — Tomorrow's UAT Demo Brief

**Production URL:** [https://ncfe-lms.onrender.com/sign-in](https://ncfe-lms.onrender.com/sign-in)

This document is the operating manual for tomorrow's UAT demo. Read it once front-to-back before the session.

---

## Credentials

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Admin | — | `admin@learnerseducation.com` | `passwordadmin` |
| Assessor | Jyothi | `jyothi@learnerseducation.com` | `password123` |
| Student | Vidit | `bhatnagar007vidit@gmail.com` | `password` |
| Student | Peter | `intern@learnerseducation.com` | `password` |
| **Student (DEMO)** | **James Bond** | **`7777jamesbond7777@gmail.com`** | **see `tests/DEMO_CREDENTIALS.md`** (gitignored) |
| IQA | Bruce | `iqa@test.com` | `iqapassword` |

> The James Bond password is auto-generated and lives only in [tests/DEMO_CREDENTIALS.md](DEMO_CREDENTIALS.md) on the laptop running tomorrow's demo. It was set at deploy time and is also in the welcome email at `7777jamesbond7777@gmail.com` (check spam — single-sender Brevo deliverability not yet domain-authenticated).

---

## What was just deployed in this session

- **Auto-generated 14-character passwords** on admin user create. The form pre-fills a fresh crypto-random password (lowercase, uppercase, digit, symbol; no `0/O/o/I/l/1`, no whitespace or quotes). Inline **Generate / Copy / Eye toggle** buttons. Manual entry remains supported as a fallback.
- **Post-create credentials modal** showing Name / Email / Role / Password with a "**Copy all credentials**" button that puts a 4-line block on the clipboard:
  ```
  Name: <name>
  Email: <email>
  Password: <password>
  Login: https://ncfe-lms.onrender.com/sign-in
  ```
- **Same UX on the Reset Password dialog** — fresh password pre-filled, post-reset credentials modal.
- **Brevo welcome email** auto-sent on user create with the credentials and login URL.
- **Brevo password-reset email** auto-sent on admin reset.
- **"Resend welcome email" button** on each user row (generates a fresh password, updates the user, re-emails — for cases where the original email was lost or the user can't find their password).
- **Self-service password reset is removed.** Students cannot reset their own password — `/forgot-password` now displays a "Contact your administrator" message. Only admin holds the credentials.
- **All email sends are audit-logged** as `EMAIL_SENT` or `EMAIL_FAILED` with `template`, `messageId`, and timestamp. No plaintext password is ever stored in audit logs.
- **Soft-fail on email errors** — user creation never blocks because Brevo is unreachable. The success modal switches to an amber warning so the admin shares credentials manually.
- **Pre-launch UAT fixes:** upload validation errors return 400 not 500; deleting an assessment cascades to its notifications; five new `DELETE` endpoints (personal-documents, IQA samples/decisions/standardisation/documents) plus their UI buttons.

---

## End-to-end demo script

The flow below mirrors a complete real-world day for a learner. Run it in order; each step takes roughly 1–3 minutes.

### Step 1 — Show admin already created James Bond (~30s)

You already created James Bond before the demo. Just narrate it:

> "Yesterday I clicked 'Add User' on `/admin/users`, typed his name + email, clicked **Generate** to auto-fill a secure password, and submitted. The success modal showed his credentials and confirmed an email was sent. He received a welcome email within seconds with his login details — let's open his inbox now."

### Step 2 — Confirm welcome email arrived (~30s)

Open the inbox at [7777jamesbond7777@gmail.com](https://mail.google.com). Search **`Welcome to NCFE LMS`**. The email body should contain:

- Greeting with his name
- Email + password in a monospaced credentials block
- A green **Sign in to NCFE LMS** button → `https://ncfe-lms.onrender.com/sign-in`
- A note that if he forgets his password he should contact the administrator

> If the email is in spam: that's expected. Single-sender Brevo verification works but doesn't guarantee inbox placement; domain authentication is a next-week task.

### Step 3 — Sign in as James Bond → tour the student dashboard (~2 min)

- Sign in with the credentials from `tests/DEMO_CREDENTIALS.md`.
- Lands on `/c`. Show the **NCFE Level 3 Certificate in Assessing Vocational Achievement** course card.
- Click into the course → show the sidebar (Assessments, Progress, Portfolio, Documents, Materials, Work Hours, Personal Docs).
- Briefly show the empty Portfolio + Progress pages — "everything is fresh; we're about to fill it in."
- Sign out.

### Step 4 — Sign in as Jyothi → plan an assessment for James Bond (~3 min)

- `https://ncfe-lms.onrender.com/sign-in` → `jyothi@learnerseducation.com / password123`.
- `/c` → click the NCFE qualification.
- Open the **learner dropdown** in the top bar → select **James Bond**.
- Go to `/c/{slug}/assessment`.
- Click **+ Create an Assessment**.
- Fill: title `Demo observation — James Bond`, kind `observation`, plan/intent and plan/implementation in a sentence each.
- Open the **Criteria Mapping** modal. Tick at least 3 criteria across 2 different units. Save. The chips render in the detail panel.
- Sign out.

### Step 5 — Sign in as James Bond → upload portfolio evidence (~3 min)

- Sign in as James Bond.
- Course → **Portfolio** → pick the unit Jyothi mapped → **Upload evidence**.
- Upload a PDF (label it `Observation notes`) and an image (label it `Site photo`).
- Submit each evidence (`draft` → `submitted`).
- Go to **Work Hours** → log 2 h today, note `Practice session for observation`.
- Go to **Personal Documents** → upload a CV-like file. Show the new **Delete** button (the one we just shipped).
- Sign out.

### Step 6 — Sign in as Jyothi → link evidence + sign off (~2 min)

- Re-sign in as Jyothi → re-select James Bond.
- Open the same assessment. Open the **Evidence Selection** modal → tick the two pieces James just uploaded → save.
- Add a remark: `Strong observation — all criteria met.`
- Click the **assessor sign-off** button. Status → `published`, `publishCount: 1`.
- Sign out.

### Step 7 — Sign in as James Bond → learner sign-off (~1 min)

- Open the same assessment in read-only mode.
- Show all the chips, evidence links, remark from Jyothi.
- Click the **learner sign-off** button. Status updates.
- Sign out.

### Step 8 — Sign in as Bruce (IQA) → sample + decide (~2 min)

- `iqa@test.com / iqapassword` (the password we reset today).
- Go to `/iqa/sampling` → find the assessment → submit a decision: **approved**, comment `Sampled — meets standards.`
- View `/iqa/decisions` to see the decision tile.
- Sign out.

### Step 9 — Sign in as Admin → audit trail (~1 min)

- `admin@learnerseducation.com / passwordadmin`.
- Go to `/admin/audit-logs`. Filter by **today**. Point at the entries:
  - `USER_CREATED` (James Bond)
  - `EMAIL_SENT` (welcome)
  - `ASSESSMENT_CREATED`, `ASSESSMENT_PUBLISHED`
  - `EVIDENCE_UPLOADED` ×2
  - `IQA_DECISION_CREATED`
- "Every meaningful action in the system is auditable. The audit log only ever records action metadata — passwords are never stored in it."

---

## Pre-demo checklist (run 5 minutes before)

- [ ] Open `https://ncfe-lms.onrender.com/` once to wake Render (cold-start can be 30–60 s on first hit).
- [ ] Confirm `tests/DEMO_CREDENTIALS.md` is on the demo laptop and the password matches the one in James Bond's inbox.
- [ ] Sign into the Gmail inbox at `7777jamesbond7777@gmail.com`. Move the welcome email to Inbox if it landed in spam.
- [ ] Have `tests/DEMO_SUMMARY.md` open in a tab so you can refer to step numbers.

---

## Known caveats

| | |
| --- | --- |
| **Cold start** | Render deploy can sleep after 15 min idle. First request after sleep takes 30–60 s. Wake the app 2 min before the demo. |
| **Email deliverability** | Single-sender Brevo verification is in place but domain authentication isn't done yet — emails may land in spam. Pre-warn the audience. |
| **Soft-delete** | Admin "delete user" is a soft-delete (sets `status: inactive`, the row stays). By design for audit recovery. James Bond must NOT be soft-deleted. |
| **Self-service reset** | Disabled by design — only admin holds the password. `/forgot-password` redirects to a "contact your administrator" message. |
| **Large file upload** | 144 MB MP4 round-trip is tested and works against S3 via presigned URLs. Files >2 GB are rejected at the route handler. |
| **Cross-browser** | Smoke tested in Chromium only against production. Firefox/Safari coverage exists locally (`smoke-firefox`, `smoke-webkit` projects). |
| **Mobile** | Mobile viewport polish is a known follow-up. Login + course home are usable on `375 × 667` but not optimised. |
| **No "must change password on first login"** | Students keep the admin-issued password until admin resets it. |

---

## Test summary — what's been verified against production

| Suite | Tests | Result |
| --- | --- | --- |
| Local Phase 1 (full Playwright suite) | 108 | 108 passing |
| Phase 1.5 password generator (UI + unit) | 8 | 8 passing |
| Phase 1.6 email integration (unit + integration + real Brevo round-trip) | 13 | 13 passing |
| Production Phase 2 smoke + transient-user + email-event verification + James Bond demo + verify-login | 13 (+1 idempotent skip) | 13 passing |

The Brevo `/v3/smtp/statistics/events` endpoint confirmed acceptance of every welcome and reset email sent during the test suite.

---

## Open follow-ups (next-week list)

- **Brevo domain authentication** for `learnerseducation.com` (improves deliverability, gets emails out of spam).
- **API key rotation** — the current Brevo API key was shared in a chat session; rotate before any external launch.
- **Force-change-password-on-first-login** UX so the admin-issued password isn't long-lived.
- **Cross-browser prod smoke** (Firefox, Safari).
- **Mobile viewport polish.**
- **Stub UI for IQA Standardisation + Centre Documents pages** — APIs (incl. DELETE) exist; list views are placeholders.
- **2 GB upload regression test** — currently untestable in Playwright (`request.formData()` buffers larger than Node's 2 GiB Buffer cap). Documented in `tests/BUG_LOG.md`. Browser-side upload uses presigned URLs which stream — that path is exercised by the 144 MB recording fixture.
