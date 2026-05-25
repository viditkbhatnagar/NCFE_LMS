# NCFE LMS — Final UAT Validation: Local Fixes → Deploy → Production E2E

You are running the final pre-launch QA cycle for the NCFE LMS Next.js app. The build is deployed at `https://ncfe-lms.onrender.com`. Render auto-deploys whenever code lands on the `main` branch. The live UAT student logs in tomorrow morning.

This run has **two strict phases** that must not overlap. Phase 1 is local: fix every known bug from the previous run, add the deferred test coverage, run everything green locally. Phase 2 is production: deploy, wait for Render, then run the full real-world workflow against the deployed URL — black-box, no in-flight code fixes.

Repo root: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Read `tests/REPORT.md` and `tests/BUG_LOG.md` from the previous run before starting — they explain what's already been validated and what was deferred.

The non-destructive rules from the previous prompt still apply: production database (`mongodb+srv://...@dev.gdddmth.mongodb.net/ncfe_lms`) and production S3 bucket (`ncfe-lms-files`) are shared. Every entity created during testing must carry a unique `RUN_ID` tag and be deleted in `afterEach`. The same `tests/preflight.ts` and `tests/postflight.ts` baseline-count check applies to this run.

---

## Phase 1 — Local fixes and deferred test coverage

Goal: make the deployed code behave correctly for every flow the live student will touch tomorrow, then deploy once.

### 1.1 Code fixes (apply in this order)

**Fix #1 — Bad-file uploads return 500 instead of 4xx.** In `src/app/api/v2/evidence/upload/route.ts` and any other upload route that surfaces this, the `try/catch` around `uploadFile()` should distinguish validation errors from genuine server errors. Throwing strings from `src/lib/upload.ts` (`File type ... is not allowed`, `File size exceeds ...`) should be caught and returned as `400` with `{ error: <message> }`. Genuine S3 / filesystem failures stay as `500`. Add a regression test: upload `bad.exe` and a >2 GB stream → assert 400.

**Fix #2 — Orphan notifications when an assessment is deleted.** `DELETE /api/v2/assessments/[id]/route.ts` currently removes the assessment but leaves rows in `Notification`, `AssessmentCriteriaMap`, `AssessmentEvidenceMap`, `SignOff`, and `Remark` referencing it. Wrap the deletion in a transaction (or sequential awaits if transactions aren't enabled on the cluster) that cascades to all four. Verify by creating an assessment, generating a notification (sign-off triggers one), deleting the assessment, then querying `Notification.find({ entityId: assessmentId })` — should be empty. Add a regression test for it.

**Fix #3 — Missing DELETE endpoints.** Create the following routes (mirror the existing `course-documents/[id]/route.ts` pattern):

- `DELETE /api/v2/personal-documents/[id]/route.ts` — student or assessor (assessor scoped to their own learners) can delete; deletes the S3 object via `deleteFile()` then the Mongo doc.
- `DELETE /api/iqa/samples/[id]/route.ts` — IQA-only.
- `DELETE /api/iqa/decisions/[id]/route.ts` — IQA-only.
- `DELETE /api/iqa/standardisation/[id]/route.ts` — IQA-only.
- `DELETE /api/iqa/documents/[id]/route.ts` — IQA-only; deletes S3 object too.

Then add the corresponding "Delete" buttons + confirm dialogs on:

- `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx` — visible to the document's owner.
- `src/app/(dashboard)/iqa/sampling/page.tsx`, `iqa/decisions/page.tsx`, `iqa/standardisation/page.tsx`, `iqa/documents/page.tsx`.

Use the existing `ConfirmDialog` component from `src/components/admin/`.

**Fix #4 — IQA password mismatch (data fix, not code).** Production has `iqa@test.com` with password `Password123!`, but the launch credentials email lists `iqapassword`. Reset the password to match the email. Don't write a one-off script — do it through the admin UI as a real workflow exercise: sign in as `admin@learnerseducation.com / passwordadmin`, go to `/admin/users`, find Bruce / iqa@test.com, click "Reset password", set to `iqapassword`. Verify by signing in as IQA with the new password. This validates the admin reset-password flow at the same time.

After every fix: print `FIX: <file> — <one-line summary>` to the chat. Commit each fix as a separate logical change so the diff is easy to review.

### 1.2 Deferred test coverage from the previous run

Add the following spec files. Same RUN_ID + cleanup rules as before. Run against `http://localhost:3000`.

- `tests/assessor/assessment-criteria-mapping.spec.ts` — open detail panel → Criteria Mapping modal → expand every unit → tick at least 3 ACs across 2 units → save → assert chips appear in panel and `AssessmentCriteriaMap` rows exist for the assessment → un-tick one → assert chip removed and DB row gone.
- `tests/assessor/assessment-evidence-selection.spec.ts` — open Evidence Selection modal → both paths: (a) pick existing portfolio evidence and link → assert link appears + `AssessmentEvidenceMap` row created; (b) trigger upload-from-modal flow → assert new evidence is created and immediately linked.
- `tests/assessor/course-documents-ui.spec.ts` — full UI CRUD: new folder, breadcrumb navigation, file upload, view-mode toggle (grid/list), preview modal, download, rename, delete.
- `tests/assessor/materials-ui.spec.ts` — upload material with category + description, edit metadata, filter by category, download, delete.
- `tests/student/personal-documents-ui.spec.ts` — student uploads, sees own list, downloads, deletes (via Fix #3 above).
- `tests/iqa/standardisation-create.spec.ts` — full create flow with multi-assessor record.
- `tests/admin/curriculum-tree.spec.ts` — admin creates a `[E2E-${RUN_ID}]` qualification, adds 2 units, each with 1 LO with 2 ACs, edits, then deletes bottom-up. Do NOT touch the existing NCFE qualification.

### 1.3 Combined local run

Run preflight → full suite (existing + new specs) → postflight. Required outcome:

- All specs pass.
- Postflight reports zero baseline drift on `User`, `Qualification`, `Unit`, `LearningOutcome`, `AssessmentCriteria`, `Enrolment`. (`Assessment`, `Evidence`, `Notification`, `IQADecision` etc. should also return to baseline after cleanup; if they don't, the cleanup leaked.)
- Zero leftover S3 objects under the test users' prefixes.

If anything fails: fix it, log it, retry. **Do not deploy with red tests.**

### 1.4 Deploy

When local is green:

1. `git status` — review what's currently uncommitted. Expect to see (a) test infrastructure from the previous run (`playwright.config.ts`, `tests/`, `package.json` + `package-lock.json` from `@playwright/test` install), and (b) tonight's work (the four code fixes in `src/`, the seven new specs).
2. **Update `.gitignore` first.** Add the following lines if they aren't already there: `test-results/`, `playwright-report/`, `screenshots/`, `tests/baseline.json`, `tests/.runId`. Stage `.gitignore` separately so the cleanup is its own logical change.
3. `git add` only the files you actually modified or intentionally created. Do not stage `node_modules`, `test-results/`, `playwright-report/`, `screenshots/`, `tests/baseline.json`, or anything in `.aws/`.
4. Commit. Two commits, in this order, makes the deploy diff easier to review:
   - `chore(test): add Playwright E2E infrastructure and specs` — the test infra + all spec files
   - `fix(uat): pre-launch fixes (#1 upload 4xx, #2 cascade-delete notifications, #3 missing DELETE endpoints, #4 IQA password reset via admin)` — the four `src/` fixes
5. `git push origin main`.
5. Poll Render. The deploy URL is `https://ncfe-lms.onrender.com`. Wait for the new commit hash to be live by hitting `https://ncfe-lms.onrender.com/api/auth/session` and confirming the server is responding without errors. Render builds typically take 3–8 minutes; allow up to 15 before assuming a stuck build. If the build fails, read the Render logs (the user will paste them in if asked) and roll back by reverting the commit.
6. Run a 30-second post-deploy smoke check against production: GET the home page, GET `/sign-in`, sign in as Jyothi, hit `/c`, sign out. If any of these fail, **stop and report** — do not proceed to Phase 2.

---

## Phase 2 — Production end-to-end full workflow

Goal: validate the full real-world UAT path against the deployed Render app, not localhost. Black-box. No fix-and-retest loop — bugs found here are logged for tomorrow-morning hot-patches, not fixed in-flight.

### 2.1 Configure Playwright for production

Create `playwright.prod.config.ts`:

- `baseURL: 'https://ncfe-lms.onrender.com'`
- `use.actionTimeout: 60_000` (Render free tier cold starts can be 30–60 s)
- `use.navigationTimeout: 90_000`
- `use.video: 'retain-on-failure'`
- `use.trace: 'on-first-retry'`
- One project, Chromium only (cross-browser smoke is deferred).
- No `webServer` entry — production is already running.

Run with `npx playwright test --config=playwright.prod.config.ts`.

### 2.2 Cold-start warm-up

Before any spec runs, hit `https://ncfe-lms.onrender.com/api/auth/session` once and wait for a response. Render free tier sleeps after 15 minutes idle and the first request after sleep takes 30–60 seconds. Subsequent tests should run at normal latency.

### 2.3 Production smoke

`tests/prod/smoke.spec.ts`:

1. All 5 role logins succeed: admin, Jyothi, Vidit, Peter, Bruce. Each redirects to the right home (admin → `/admin/dashboard`, assessor/student → `/c`, IQA → `/dashboard`).
2. `/sign-in`, `/sign-up`, `/forgot-password` all render without console errors.
3. From each role's home page: zero unexpected 4xx / 5xx in the network log.

If smoke fails, **stop**. The deploy is broken; report and abort.

### 2.4 The full onboarding-to-IQA workflow (the main event)

`tests/prod/full-workflow.spec.ts` — one long test that walks the canonical UAT path on production. Single `test.describe.configure({ mode: 'serial' })` block; each step depends on the previous.

Generate fixture files first:

- `tests/fixtures/recording.mp4` — 150 MB H.264 MP4 simulating a real student observation recording. Generate with `ffmpeg -f lavfi -i testsrc=duration=240:size=1280x720:rate=30 -c:v libx264 -b:v 5000k -pix_fmt yuv420p tests/fixtures/recording.mp4` (4-minute 720p clip ≈ 150 MB). If that comes out far from 150 MB, adjust duration.
- `tests/fixtures/audio-statement.mp3` — 30-second MP3 (`ffmpeg -f lavfi -i sine=frequency=1000:duration=30 -ar 44100 -b:a 192k tests/fixtures/audio-statement.mp3`).
- Reuse `tiny.pdf`, `sample.docx`, `image.png` from Phase 1.

The workflow:

**Setup as admin**

1. Sign in as `admin@learnerseducation.com / passwordadmin`.
2. Create a new student via `/admin/users`: name `E2E Student ${RUN_ID}`, email `e2e-student-${RUN_ID}@learnerseducation.invalid`, password `Tempe2e123!`, role `student`. Verify the user appears in the list.
3. Create a temporary qualification via `/admin/courses`: title `[E2E-${RUN_ID}] UAT Test Qualification`, level 3, code `E2E-${RUN_ID}`. Then add one unit (`Unit E2E-1`), one learning outcome (`E2E-LO1: Test outcome`), three assessment criteria (`E2E-AC-1.1`, `E2E-AC-1.2`, `E2E-AC-1.3`).
4. Create an enrolment via `/admin/enrolments`: link the new student to the new qualification, assign Jyothi as assessor, cohort `E2E-${RUN_ID}`, status `in_progress`.
5. Verify the audit log at `/admin/audit-logs` shows entries for user-created, qualification-created, enrolment-created in the last few minutes.
6. Sign out.

**Plan the assessment (Jyothi)**

7. Sign in as `jyothi@learnerseducation.com / password123`.
8. From `/c`, find the new `[E2E-${RUN_ID}] UAT Test Qualification` course card and click in.
9. Open the learner dropdown — verify the new test student appears. Select them.
10. Go to `/c/{slug}/assessment`. Click "+ Create an Assessment". Pick the test student.
11. In the detail panel: set title `${RUN_ID} - Real-world Observation`, set assessment kind to `observation`, fill plan/intent, fill plan/implementation.
12. Open the Criteria Mapping modal — tick all 3 of the `E2E-AC-*` criteria. Save. Verify the chips render.
13. Sign out.

**Student work (the live student persona)**

14. Sign in as the new student (`e2e-student-${RUN_ID}@learnerseducation.invalid / Tempe2e123!`).
15. Navigate to the same course → portfolio page.
16. Upload **all five** evidence files in sequence, each tagged with the run id in its label:
    - `tiny.pdf` as evidence with label `${RUN_ID} - PDF observation notes`.
    - `sample.docx` as `${RUN_ID} - Reflective account`.
    - `image.png` as `${RUN_ID} - Site photo`.
    - **`recording.mp4` as `${RUN_ID} - Live observation recording`** — this is the headline test. Use the standard upload UI; if the app uses presigned URLs, the upload goes direct to S3. Allow up to 5 minutes. Assert the upload completes, the evidence row appears, and `storageKey` is non-null.
    - `audio-statement.mp3` as `${RUN_ID} - Witness statement audio`.
17. Open each piece of evidence's preview modal and assert the right player renders:
    - PDF → embedded PDF viewer (`<iframe>` or PDF.js canvas).
    - Image → `<img>` with non-zero `naturalWidth`.
    - **Video → `<video>` element, `readyState >= 1`, `videoWidth > 0`. Click play, wait 2 seconds, assert `currentTime > 0` (i.e. it actually plays from S3 via the signed URL).**
    - Audio → `<audio>` element similarly.
18. Trigger a download for each piece of evidence and assert the downloaded file's byte size matches what was uploaded (within 1% tolerance).
19. Submit each piece of evidence (move from `draft` → `submitted`).
20. Go to work-hours: log a 2-hour entry against today's date with note `${RUN_ID} - workshop session`.
21. Go to personal-documents: upload `sample.docx` as `${RUN_ID} - personal CV`. Verify the new Delete button (from Fix #3) is present and enabled — but **do not click it yet**.
22. Sign out.

**Assess (Jyothi)**

23. Sign in as Jyothi.
24. Open the same assessment.
25. Open the Evidence Selection modal — link all 5 of the student's submitted evidence to the assessment. Save. Assert all chips render in the detail panel.
26. Add a remark: `${RUN_ID} - All criteria met, recording is clear.`
27. Sign off as assessor. Status should become `published`, `publishCount = 1`.
28. Verify a notification was generated for the student (visible on Jyothi's notifications page or the student's after sign-in). Check via API: `GET /api/notifications` should return a row whose body contains the run id.
29. Sign out.

**Learner sign-off (student)**

30. Sign in as the test student again.
31. Open the same assessment in read-only mode. Verify all chips, evidence, and the assessor's remark render correctly.
32. Click the learner sign-off button. Confirm. Status updates.
33. Sign out.

**IQA review**

34. Sign in as `iqa@test.com / iqapassword` (the password Fix #4 just reset to).
35. Go to `/iqa/sampling`. Find the `${RUN_ID}` assessment. Open it.
36. Submit IQA decision: type `approved`, comment `${RUN_ID} - Sampled and approved.`
37. Verify the decision appears on `/iqa/decisions`.
38. Sign out.

**Audit and cleanup (admin)**

39. Sign in as admin.
40. View `/admin/audit-logs`. Filter by today. Assert at least 6 entries tagged with the test student id or the run id (user create, enrolment create, assessment create, sign-off, IQA decision, etc.).
41. **Now run the cleanup test student deletion path:** on `/admin/users`, click Delete on the test student. Confirm. Note that this is a soft-delete (sets `status: 'inactive'`) by design — the row stays. That's expected and documented.
42. Sign out.

**Programmatic cleanup (afterAll)**

43. Delete every entity created during this workflow, in dependency order: IQA decision → assessment criteria mappings → assessment evidence mappings → notifications → assessment → all 5 evidence (deletes S3 objects too) → personal document (deletes S3 object too) → work-hours log → enrolment → all 3 ACs → 1 LO → 1 unit → qualification.
44. The test student remains as a soft-deleted (`status: 'inactive'`) row. Document this in the report — it's not a leak, it's the soft-delete-by-design behaviour.
45. Run S3 listing under the test student's id prefix. Should be empty.

### 2.5 In-depth UI checks (parallelisable)

Run these as separate spec files alongside the workflow:

- `tests/prod/search.spec.ts` — sign in as Jyothi, type `${RUN_ID}` in the search bar (after the workflow created the test student and assessment), assert results group by Members / Assessments / Evidence and clicking each navigates correctly.
- `tests/prod/notifications.spec.ts` — verify notification badge count, mark single read, mark all read, on production.
- `tests/prod/file-preview.spec.ts` — opens already-uploaded fixtures in preview modal on production and asserts the production-served fonts and CDN assets render (no broken images, no missing icons).
- `tests/prod/mobile-smoke.spec.ts` — viewport `375x667`, sign-in works, course home is at minimum legible, sidebar is collapsed/accessible. Don't block launch on minor regressions; log them.
- `tests/prod/role-isolation.spec.ts` — Vidit (real student) cannot URL-tamper into the test student's enrolment. Test student cannot URL-tamper into Peter's enrolment.

### 2.6 Cross-cutting assertions throughout Phase 2

For every test:

- Listen for `console.error` and `pageerror` events. Any unhandled error → test fails.
- Listen for network responses with status >= 400 that weren't deliberately triggered (e.g. our bad-file 400 test). Any unexpected non-2xx → test fails. Allow-list the deliberately-tested 4xx via comments.
- Assert no request takes longer than 60 seconds (cold-start tolerance) except the 150 MB upload, which gets 5 minutes.

---

## Output

Write these files in the repo root:

1. **`tests/PROD_REPORT.md`** — overall pass/fail, ship recommendation, list of bugs found in Phase 2 grouped by "must fix before student logs in" vs "fix this week".
2. **`tests/PROD_BUG_LOG.md`** — full triage of every Phase 2 finding.
3. **`tests/PHASE1_DIFF_SUMMARY.md`** — list of every code change from Phase 1, with file paths and one-line rationale, so the user can review the deploy commit.
4. **`playwright-report/`** — the HTML report.
5. **`screenshots/prod/`** — every page captured against the production URL.

Print a one-paragraph executive summary in chat at the end. Format:

> **SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP.** Phase 1 fixes deployed: <count> commits to main, all green locally. Phase 2 against production: <pass>/<total> passing. Headline finding: <single most important thing>. Cleanup: <leftover entity counts> — <description>. Read tests/PROD_REPORT.md for the full picture.

---

## Hard constraints (recap)

- Same non-destructive rules as the previous run: never reset the database, never modify pre-existing users/qualifications/units/LOs/ACs/enrolments, every entity carries `RUN_ID`, every upload is cleaned up.
- Phase 1 ends with a single push to `main`. No partial deploys, no force-pushes, no rebases.
- Phase 2 is **black-box only**. If a production bug is found, do not attempt a hot-fix — log it, classify severity, move on.
- The test student created in step 2 is a soft-delete only (admin DELETE is `status: 'inactive'`). Document the leftover row in the report. Do not work around the soft-delete via direct Mongo access.
- Stop and ask if any step would require: a database schema change, a write to `.env*`, a force-push, a deploy outside the normal `git push origin main` flow, or deleting any pre-existing record.

Begin by reading the previous `tests/REPORT.md` and `tests/BUG_LOG.md`, confirming the four code fixes are not yet applied, then start Phase 1.
