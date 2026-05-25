# NCFE LMS — End-to-End Pre-Launch Test Prompt (for Claude Code)

You are running an autonomous QA loop against the NCFE LMS Next.js app before tomorrow's UAT launch with a live student. Your job is to (1) build a comprehensive Playwright test suite covering **every page, every button, every modal, every upload/download** for all four roles, (2) run it, (3) when something fails, debug → fix the underlying code → re-run that test → keep going, and (4) produce a final pass/fail report.

Do not stop until either every test is green, or you have a documented blocker you cannot resolve without me. Use up to 8 hours of wall time if needed.

---

## 1. Project context (do not skip)

Repo root: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`

- **Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, MongoDB (Mongoose 9), NextAuth v5 JWT, AWS S3 for file storage (env-switchable to local).
- **Roles:** `student`, `assessor`, `iqa`, `admin`.
- **Sign-in routes:** `/sign-in`, `/sign-up`, `/forgot-password`.
- **Post-login redirect:** admin → `/admin/dashboard`; assessor & student → `/c`; iqa → `/dashboard` (which falls through to legacy IQA pages).
- **BRITEthink dashboard:** `/c` (course selector) → `/c/{slug}` (home) → sidebar links to `assessment`, `progress`, `portfolio`, `course-documents`, `personal-documents`, `materials`, `work-hours`, `members`, `notifications`.
- **Legacy IQA pages:** `/iqa/dashboard`, `/iqa/sampling`, `/iqa/sampling/[id]`, `/iqa/decisions`, `/iqa/actions`, `/iqa/documents`, `/iqa/standardisation`, `/iqa/eqa-readiness`.
- **Admin pages:** `/admin/dashboard`, `/admin/users`, `/admin/courses`, `/admin/courses/[id]`, `/admin/enrolments`, `/admin/audit-logs`.
- **API:** `/api/*` (legacy) and `/api/v2/*` (current). Both must keep working — exercise them via the UI.

Read these for additional context before writing tests:
- `CLAUDE.md`
- `STUDENT_DASHBOARD_PLAN.md`
- `SCREENSHOT_PROMPT.md` (has selectors and the qualification slug)
- `docs/britethink-dashboard-architecture.txt` (full UI spec — element labels, dropdowns, modal contents)
- `scripts/seed-uat.ts` (canonical seed data)

---

## 2. Test environment setup

### 2.1 Database — READ THIS FIRST (NON-DESTRUCTIVE MODE)

⚠️ **HARD CONSTRAINT:** `.env.local` points at `mongodb+srv://...@dev.gdddmth.mongodb.net/ncfe_lms` — the SAME database the live Render UAT instance reads from and that a real student will use tomorrow. The user has explicitly chosen to test against this database. That means:

**Forbidden — never, under any circumstances:**

- ❌ Run `npm run seed`, `npm run seed:reset`, `npm run seed:uat`, `npm run seed:uat:reset`, or any script that calls `dropCollection`, `deleteMany({})`, or unconditional `findOneAndDelete`.
- ❌ Modify `.env.local`, `.env`, or environment variables that change `MONGODB_URI`.
- ❌ Edit, rename, deactivate, change the password of, or delete any of the pre-existing users listed below.
- ❌ Edit, delete, or rename the existing qualification, units, learning outcomes, or assessment criteria.
- ❌ Touch, rename, or delete any pre-existing assessment, evidence, document, material, work-hour entry, IQA sample, or notification that was not created by this test run.
- ❌ Delete or overwrite anything in S3 under a key prefix that wasn't created by this test run.

**Allowed:**

- ✅ Read everything via the UI / API.
- ✅ **Create** new test entities (assessments, evidence, documents, materials, work-hours, IQA decisions, etc.) tagged so they're identifiable.
- ✅ **Modify and then delete** entities the test itself just created in the same `it()` block.

**The "owned-by-this-run" tagging rule (mandatory):**

Generate a `RUN_ID` once at suite startup, e.g. `E2E-2026-05-05-1430-ab12`. Every entity created during the run must include the run ID in a way that makes ownership unambiguous and easy to filter:

- Assessment titles → `[${RUN_ID}] <descriptive name>`
- Evidence labels / file names → `${RUN_ID}_<original>`
- Document / material titles → `[${RUN_ID}] ...`
- Folder names → `[${RUN_ID}] folder`
- S3 keys → ensure the upload path includes the test user's id (it already does via `buildS3Key`); additionally store the `RUN_ID` in the entity's metadata field so cleanup can find S3 objects via the entity, not by scanning the bucket.
- Notifications / messages → include the run ID in the body.

**Cleanup is mandatory and must be defensive:**

- `afterEach` deletes anything that test created, identified by `RUN_ID`. Use the app's own DELETE API endpoints, not direct Mongo calls, so you exercise that code path too.
- `afterAll` runs a final sweep: list every entity whose title/label/name contains the run ID, and DELETE each. If anything remains, log it loudly in the report.
- For S3: `afterEach` must call `DeleteObjectCommand` for every `storageKey` it uploaded, retrieved from the entity record before the entity is deleted.
- A safety net: at suite END, the run script must abort with a red error if `Assessment.countDocuments({ title: /\[E2E-/ })` returns anything, because that means cleanup leaked.

**Existing users (already in the database — DO NOT re-seed, DO NOT change passwords):**

| Role | Email | Password |
|---|---|---|
| Assessor | `jyothi@learnerseducation.com` | `password123` |
| Student | `bhatnagar007vidit@gmail.com` | `password` |
| Student | `intern@learnerseducation.com` | `password` |
| IQA | `iqa@test.com` | `iqapassword` |
| Admin | `admin@learnerseducation.com` | `passwordadmin` (try this; if login fails, skip the admin suite and report) |

**Pre-flight check before the FIRST test runs (mandatory):**

Write a script `tests/preflight.ts` that:

1. Connects to Mongo using the URI in `.env.local`.
2. Asserts `db.databaseName === 'ncfe_lms'` and prints it. If it isn't, abort.
3. Records baseline counts: `User`, `Qualification`, `Unit`, `LearningOutcome`, `AssessmentCriteria`, `Enrolment`, `Assessment`, `Evidence`, `IQASample`, `IQADecision`. Save to `tests/baseline.json`.
4. After the full suite runs, run `tests/postflight.ts` which re-reads those counts and **fails the run** if any of them differ from baseline (specifically: pre-existing User / Qualification / Unit / LO / AC / Enrolment counts must be unchanged; Assessment / Evidence counts may only be HIGHER if cleanup hasn't completed yet, and must drop back to baseline after the final sweep).

Qualification slug: `ncfe-level-3-certificate-in-assessing-vocational-achievement`.

### 2.2 Dev server

Start it once and reuse:

```bash
PORT=3000 npm run dev
```

Wait for `ready in` log line before starting tests. Configure Playwright's `webServer` so retries restart it cleanly.

### 2.3 File storage

`.env.local` has `FILE_STORAGE_PROVIDER=s3` with bucket `ncfe-lms-files` (region `ap-south-1`) and AWS creds in `.aws/config` + `.aws/credentials`. Tests will hit the **same S3 bucket production uses**. Verifying the real S3 round-trip (PUT via presigned URL → GET via signed URL → download body) is exactly what we want.

**Mandatory cleanup, same rules as Mongo:**

- Every uploaded object must be deleted from S3 in `afterEach`, identified by the `storageKey` field on the entity it backs (read it before you delete the entity).
- Pre-flight S3 audit: list `s3://ncfe-lms-files/uploads/` with the test users' user-ids and snapshot the keys. After the suite, re-list and assert the new key set is empty (i.e. test only added objects that were then deleted).
- **Never** delete an S3 object whose key prefix doesn't include the test user's id AND a timestamp newer than the suite's start time. The `buildS3Key` helper already gives you both — use them as the gate.
- If S3 creds load but the bucket is unreachable, fail fast — do NOT silently fall back to local storage, because that would let tests pass while production is broken.

### 2.4 Test fixtures

Generate these once in `tests/fixtures/`:

- `tiny.pdf` — 1-page valid PDF (use `pdfkit` or commit a real one)
- `sample.docx` — small Word doc (use the `docx` package which is already a dependency)
- `image.png` — 200×200 PNG
- `video.mp4` — short MP4 (~2–5 MB). `ffmpeg` is installed at `/usr/bin/ffmpeg`; generate it once with `ffmpeg -f lavfi -i testsrc=duration=5:size=640x360:rate=24 -c:v libx264 -pix_fmt yuv420p tests/fixtures/video.mp4`. Used to verify the video upload + presigned-download path.
- `audio.mp3` — short audio file
- `bad.exe` — fake binary to verify the upload type-rejection path
- `huge.bin` — 2.1 GB sparse file to verify the size-limit path (the cap is 2 GB in `src/lib/upload.ts`). If creating 2 GB on disk is expensive, mock the request body size at the network layer instead.

### 2.5 Tooling

```bash
npm install --save-dev @playwright/test
npx playwright install chromium firefox webkit
```

Use Playwright's projects to run all three engines on the smoke suite, Chromium-only for the long-tail flows. Configure trace/video on first retry.

---

## 3. What to test — by role

For every page below: **navigate, screenshot, then click every button / open every dropdown / submit every form / verify the resulting toast or state change / verify the row updates / verify the API was called and returned 2xx.** Use `page.waitForResponse` to assert API contracts, not just UI state.

### 3.1 Authentication (no role)

- `/sign-in`: empty submit → validation error; wrong password → "Invalid email or password"; correct credentials redirect by role (admin → `/admin/dashboard`, assessor/student → `/c`, iqa → `/dashboard`); Google sign-in button is wired (skip the OAuth round-trip, just assert `signIn('google'…)` is called).
- `/sign-up`: validation, successful registration creates user with role `student`, redirects to `/sign-in` or `/dashboard`.
- `/forgot-password`: submission produces the expected confirmation UI (even if no email is actually sent).
- Logged-in user visiting `/sign-in` redirects to their role home.
- Logged-out user visiting `/c` redirects to `/sign-in`.
- Direct URL hop: student visiting `/admin/users` → 403 / redirect; assessor visiting `/admin/users` → 403 / redirect.

### 3.2 Assessor (`jyothi@learnerseducation.com`)

#### Course selector `/c`
- Course card renders with title, code, level, learner count.
- Click card → routes to `/c/{slug}`.

#### Home `/c/{slug}`
- Four summary cards render: My Learners, Recent Assessments, Recent Evidence, Recent Materials.
- "View all" arrows navigate to the right routes (`/members`, `/assessment`, `/portfolio`, `/materials`).
- Clicking a recent-assessment card opens its detail panel on the assessment page.

#### Top nav
- BRITEthink logo links home.
- Search bar: type "Vidit" → dropdown shows Members / Assessments / Evidence sections; clicking a result navigates correctly. Empty state for nonsense query.
- Avatar dropdown: greeting, email, "Manage your account", "Sign out". Sign out clears the session and redirects to `/sign-in`.

#### Sub-header
- Course name shown.
- Learners dropdown: "All", "Vidit", "Peter (intern)". Selecting a learner sets `?currentEnrollmentId=...` and refetches.

#### Sidebar (8 icons)
For each: hover → tooltip; click → correct route; active state highlighted.

#### Assessment `/c/{slug}/assessment`
- Empty state when no assessments.
- "+ Create an Assessment" → learner selection modal → pick learner → new assessment row appears.
- Cards grouped by date.
- Click a card → right-side detail panel opens.
- **Inside the detail panel test every control:**
  - Title field edits + autosaves.
  - Date picker.
  - Assessment kind dropdown (7 options: observation / professional_discussion / reflective_account / verbal_assessment / written_assessment / work_product / witness_testimony).
  - Plan: Intent textarea.
  - Plan: Implementation textarea.
  - Criteria mapping modal: open it, expand units → LOs → ACs, tick a few criteria, save, confirm chips appear in the panel.
  - Evidence selection modal: pick existing evidence; also test the "upload new evidence" path inside it.
  - Evidence upload modal: drag/drop AND file-picker; upload **PDF, DOCX, PNG, MP4 (video), MP3 (audio)** — each must succeed and become selectable.
  - Bad-file rejection: upload `bad.exe` → expect a friendly error.
  - Size rejection: attempt the 2 GB+ file → expect a 413/size error.
  - Remarks: add remark, see it appear with timestamp + author.
  - Sign-off rows: assessor → "Sign off" button toggles state; verify learner sign-off cannot be flipped by assessor.
  - Publish: status moves draft → published; second edit → published_modified; publishCount increments.
  - Delete (if available).

#### Progress `/c/{slug}/progress`
- Per-learner progress: unit cards expand to LOs → ACs.
- AC marked met after assessor signs an assessment that maps to it.
- "All learners" view aggregates correctly.

#### Portfolio `/c/{slug}/portfolio`
- Toolbar: search, filter, sort, view-mode toggle.
- Upload evidence: same matrix as 3.2 detail-panel uploads.
- Edit evidence label/description.
- Delete evidence (with confirm dialog).
- Click an evidence card → preview modal renders the right player (image preview, PDF viewer, video element, audio element).
- Download → file actually arrives (read response body length).

#### Course Documents `/c/{slug}/course-documents`
- New folder modal (creates folder, breadcrumb updates).
- Upload file (test PDF + video).
- Drag-and-drop into folder.
- Download.
- Rename / delete.
- File grid ⇄ list view toggle.
- Breadcrumb navigation back up the tree.

#### Personal Documents `/c/{slug}/personal-documents`
- Same shape as Course Documents but scoped to the selected learner.

#### Materials `/c/{slug}/materials`
- Upload material with category + description.
- Filter by category.
- Download.
- Edit metadata, delete.

#### Work Hours `/c/{slug}/work-hours`
- Day navigator (prev/next/today).
- Add entry: date, hours, minutes, notes → row appears.
- Edit entry, delete entry.
- Totals update.

#### Members `/c/{slug}/members`
- Team Members section (assessor + IQA).
- Learner Groups grouped by cohort.
- Click a learner card → routes to that learner's home view.

#### Notifications `/c/{slug}/notifications` and `/c/notifications`
- List renders, unread count badge in nav matches.
- Mark single read → badge decrements.
- Mark all read → badge zero.

### 3.3 Student (`bhatnagar007vidit@gmail.com`)

Same `/c/{slug}/*` routes, but verify role-aware behaviour:

- Default learner is the student themselves; learner dropdown is hidden or shows only self.
- Assessment page: read-only, **except** the learner-sign-off control on assessment detail must work.
- Portfolio: can upload own evidence (full file matrix), edit own labels, delete own draft evidence (not assessed evidence).
- Personal Documents: can upload own.
- Course Documents + Materials: read-only — verify upload/new-folder controls are absent or disabled.
- Work Hours: can record own.
- Members route: 403 or sidebar entry hidden.
- Verify a student cannot access another student's data by URL-tampering `?currentEnrollmentId=`.

Also test the **second** student account (`intern@learnerseducation.com`) — confirm they only see their own enrolment, not Vidit's.

### 3.4 IQA (`iqa@test.com`)

- `/iqa/dashboard`: KPI cards render.
- `/iqa/sampling`: list of samples with status (pending/reviewed/completed); filter by stage (early/mid/late).
- `/iqa/sampling/[id]`: open a sample → see assessor decision + evidence; submit IQA decision (`approved` / `action_required` / `reassessment_required`) with comments → row updates.
- `/iqa/decisions`: history list, filter, click into a decision.
- `/iqa/actions`: pending action items.
- `/iqa/documents`: upload + download IQA-scoped docs.
- `/iqa/standardisation`: create a standardisation record (multi-assessor consistency check).
- `/iqa/eqa-readiness`: coverage report renders, export action works if present.
- `/iqa/coverage` (API) / coverage view: percentage matches DB.

### 3.5 Admin (`admin@learnerseducation.com` / `passwordadmin` — try this; skip suite if login fails)

⚠️ **Restricted to non-destructive operations against existing data:**

- `/admin/dashboard`: stats cards render, recent audit logs render. ✅ read-only.
- `/admin/users`:
  - List + search + filter ✅ read-only.
  - **Create user**: only with `RUN_ID` prefix on name/email (e.g. `e2e-${RUN_ID}@example.invalid`). Then edit own-created → deactivate own-created → delete own-created. ✅
  - ❌ Do NOT edit, deactivate, reset-password, or delete any pre-existing user. Verify the buttons exist and are enabled, but don't click them.
- `/admin/courses`:
  - List ✅ read-only.
  - **Create qualification** with `[${RUN_ID}]` in the title → edit own → delete own. ✅
  - ❌ Do NOT touch the existing NCFE Level 3 qualification.
- `/admin/courses/[id]` (curriculum tree):
  - Only operate on the qualification this test run created. CRUD a unit → LO → AC inside it, then delete bottom-up.
  - ❌ Do NOT add/edit/delete units, LOs, or ACs on the existing NCFE qualification.
- `/admin/enrolments`:
  - List ✅ read-only.
  - **Create enrolment** linking the test student to the test qualification you just created. Then delete it.
  - ❌ Do NOT modify or delete the existing two student enrolments under Jyothi.
- `/admin/audit-logs`:
  - List, filter, export ✅ read-only.

### 3.6 Cross-cutting

- **Browser back/forward** between any two pages should not leave stale state.
- **Refresh** any page while logged in should land on the same page (not redirect to `/sign-in`).
- **Concurrent sessions:** assessor signs off an assessment in tab A; student in tab B refreshes and sees the new sign-off.
- **Mobile viewport** (`375×667`) — at minimum, sign-in, course home, and assessment detail must be usable; flag layout regressions but don't block launch on them.
- **Console / network errors:** every test should fail if `console.error` fired or any request returned 4xx/5xx unintentionally. Allow-list expected errors only with a comment.

---

## 4. Test architecture

```
tests/
  fixtures/
    auth.ts              # storageState per role (signed-in cookie)
    files.ts             # paths to tiny.pdf, sample.docx, image.png, video.mp4, audio.mp3, bad.exe
    seed-helpers.ts      # API helpers to reset a learner's evidence between tests
  smoke/
    auth.spec.ts
    role-redirects.spec.ts
  assessor/
    home.spec.ts
    assessment-crud.spec.ts
    assessment-detail.spec.ts
    progress.spec.ts
    portfolio.spec.ts
    course-documents.spec.ts
    personal-documents.spec.ts
    materials.spec.ts
    work-hours.spec.ts
    members.spec.ts
    notifications.spec.ts
    search.spec.ts
  student/
    home.spec.ts
    assessment-readonly.spec.ts
    portfolio-uploads.spec.ts          # full file matrix incl. video
    personal-documents.spec.ts
    work-hours.spec.ts
    isolation.spec.ts                  # URL-tampering checks
  iqa/
    sampling.spec.ts
    decisions.spec.ts
    standardisation.spec.ts
    eqa-readiness.spec.ts
    documents.spec.ts
  admin/
    users.spec.ts
    courses-curriculum.spec.ts
    enrolments.spec.ts
    audit-logs.spec.ts
  cross/
    refresh-and-back.spec.ts
    concurrent-sessions.spec.ts
playwright.config.ts
```

Use Playwright **projects** so each role has its own `storageState` and you don't re-sign-in per test. Run `globalSetup` to do the four sign-ins once and persist storage state.

Common helpers to write:
- `signIn(page, role)` — used only inside globalSetup.
- `uploadFile(page, locator, fixture)` — wraps `setInputFiles` with retries.
- `expectDownload(page, action)` — asserts a download event with non-zero size and correct filename.
- `seedReset(role)` — hits an admin-only API or runs the npm seed script between suites.

---

## 5. The bug-fix loop (this is the part that matters)

After your first full run, you will get failures. For each failure:

1. **Reproduce in isolation** — run just that spec with `--headed --slowmo` if needed.
2. **Categorise the root cause:**
   - **A. Test bug** — selector wrong, race condition, fixture issue. Fix the test.
   - **B. App bug** — API 500, wrong validation, missing button, broken route. Fix the app code.
   - **C. Spec ambiguity** — UI deviates from what was specified. Default to fixing the app to match `docs/britethink-dashboard-architecture.txt` and `STUDENT_DASHBOARD_PLAN.md`. If still ambiguous, log it and move on.
3. **Fix it.** Make the smallest reasonable change. For app fixes, use the patterns in `CLAUDE.md`:
   - Mongoose models use the `mongoose.models.X || mongoose.model('X', schema)` registration guard.
   - API routes start with `const { session, error } = await withAuth([...])`.
   - Validation uses Zod in `src/lib/validators.ts`.
4. **Verify:** rerun the failing spec. If green, run the full suite for that role to catch regressions.
5. **Log it** in `tests/BUG_LOG.md` with: spec name, symptom, root cause, file changed, commit message proposed.
6. Continue until no failures remain or you've documented a blocker.

**Hard rules during the fix loop:**
- Never `expect(...).toPass()` away a real bug. If the assertion is correct, fix the app.
- Never disable / `.skip` a test to make CI green — mark `.fixme` with a comment if and only if the bug is logged and assigned to a human.
- **Never** delete or modify pre-existing data in the shared `ncfe_lms` database. If a bug fix would require a data migration on existing records (e.g. backfilling a new field), STOP and surface it to the user — do not write the migration yourself.
- **Never** change a Mongoose schema field type, remove a field, or rename a collection — the live DB has data shaped against the current schema. Additive changes (new optional fields with defaults) are okay; breaking changes are not. If the bug needs a breaking schema change, log it as a human-required blocker.
- Don't change unrelated code. One bug per commit-equivalent.
- Before any `git`-committable code change, print a one-line diff summary to the chat: `FIX: <file>:<line> — <what & why>`. The user is watching the run.

---

## 6. Output you must produce

At the end of the run, write these files to the repo root:

1. **`tests/REPORT.md`** — Markdown summary:
   - Run timestamp, total / passed / failed / fixed-during-run counts.
   - Per-role table: page → buttons tested → pass/fail.
   - List of bugs found and fixed (with file paths).
   - List of bugs found and **not** fixed (blockers — needs human).
   - List of features that aren't implemented at all (so we know what to cut from UAT).
2. **`tests/BUG_LOG.md`** — chronological log of every fix you made.
3. **`playwright-report/`** — the HTML report. Mention the path in `REPORT.md`.
4. **Screenshots of every page** in `screenshots/` (reuse the naming convention from `SCREENSHOT_PROMPT.md` — extend it for student, IQA, admin).

Print a one-paragraph executive summary in the chat at the end so I can decide whether to ship.

---

## 7. Guardrails

- **Do not** push to git or deploy to Render.
- **Do not** modify `.env.local`, `.env`, or any environment variable that changes `MONGODB_URI` / `FILE_STORAGE_PROVIDER` / `AWS_*`.
- **Do not** run `npm run seed*` or any script that calls `dropCollection`, `deleteMany({})`, or unconditional cascade deletes against the live `ncfe_lms` database. The user has explicitly opted in to testing against this database non-destructively.
- **Do not** modify or delete any pre-existing record (users, qualifications, units, LOs, ACs, enrolments, assessments, evidence, documents, materials, work-hours, IQA samples/decisions, notifications, audit logs). Only touch records this test run created, identified by the `RUN_ID` tag.
- **Do not** leave S3 test objects behind — every upload test must clean up its `storageKey` in `afterEach`, and the `afterAll` sweep must verify zero leftovers.
- **Do not** silently skip a destructive button (e.g. "Delete user", "Reset password" on existing users). Visit the screen, assert the button is present and enabled, but **do not click it** on pre-existing data. Log "verified-but-not-clicked" in the report so we know the control exists.
- **Do** ask me before touching any code under `src/lib/auth*`, `src/middleware.ts`, or anything that changes role permissions — those are security-sensitive.
- **Do** stop and report if you find a security issue: a student seeing another student's data, an unauthenticated API returning real records, or a path-traversal in the upload code.

Begin by reading the four context files listed in §1, then setting up Playwright. Confirm the seed ran, the dev server is up, and the four storage states load before writing the first test. Then go.
