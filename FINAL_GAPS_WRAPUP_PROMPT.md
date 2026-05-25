# NCFE LMS — Final Gap Wrap-up: G9-mega + G15 + G17 + Cross-Browser/Mobile Re-run

You are closing the last three deferred items from the previous run (see `tests/UI_GAPS_REPORT.md`) so the platform reaches a fully-shipped baseline with zero known UX gaps. The user has explicitly said "no skipping of anything" — every gap on the list ships in this run.

Repo root: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Production URL: `https://ncfe-lms.onrender.com`. Render auto-deploys on push to `main`. Same non-destructive rules as before: production database is shared, every test entity carries `RUN_ID`, **James Bond demo user (`7777jamesbond7777@gmail.com`) and his enrolment must NEVER be touched.**

Read first:
- `tests/UI_GAPS_REPORT.md` (deferred-item rationale)
- `tests/PROD_REPORT.md` (regression baseline — all prior prod specs must keep passing)
- `docs/USER_GUIDE.md` (will receive incremental additions, not full regeneration)

Total wall-clock budget: 7–9 hours unattended.

---

## ⚠️ Out of scope (do NOT touch)

These exclusions remain non-negotiable from previous runs:

1. **No self-service password reset.** `/forgot-password` stays disabled.
2. **No force-change-password-on-first-login.** Was rolled back; do not re-introduce. The `mustChangePassword` field is gone.
3. **No self-service password change anywhere.** Profile editing must NOT include a password-change option.
4. **No IQA dashboard improvements.** Skip any UX work on `/iqa/*` routes.
5. **No re-implementation of already-deployed gaps** (G1, G2, G3, G6, G7, G8, G10, G11, G12, G13, G14, G16, G18, G19, G20, G21, G22, plus G9-confirm-dialog standardisation from the first run). Verify they still work; don't touch the code.

---

## Phase 0 — Pre-flight (5 min)

Before writing any code:

1. Sign in once as James Bond (`7777jamesbond7777@gmail.com`) on `https://ncfe-lms.onrender.com` to confirm the post-rollback state holds. Land on `/c` directly. **If this fails, stop and escalate.**
2. Confirm the latest commit on `main` matches `bf497ee` (or whatever the SHIP-WITH-CAVEATS report referenced as the final commit). If the local working copy is out of sync, `git pull origin main` first.
3. Run `npm install` in case any new deps from the previous run aren't installed locally.
4. Run the full local Playwright suite once as a regression baseline. **Must be all green.** If anything is red, fix the local environment before proceeding — don't ship a regression on top of red baseline.

---

## Phase 1 — G9-mega: Empty states + loading skeletons + error states across all list pages (~1.5–2 hours)

Walk every list/feed page in the deployed app and add three things to each:

### Pattern to apply

For every list page, the data fetch has three terminal states. Address each:

1. **Loading** — skeleton matching the eventual layout. Use the existing skeleton pattern from `/admin/dashboard/page.tsx` (rectangular shimmer divs in the same grid layout). Make it visually quiet — no spinner.
2. **Empty** — the API returned successfully but with zero rows. Show a centred block with: an icon (use `lucide-react` if it's already a dep, otherwise inline SVG that matches the page theme), a one-line headline ("No assessments yet"), a one-line explanation ("When your assessor creates an assessment, it'll show up here."), and a CTA button if and only if the user has permission to create one ("Create an assessment" for assessor on assessment list, etc.). Add `data-testid="empty-state"` to the wrapper div.
3. **Error** — fetch failed (network error or non-2xx). Show: an alert icon, "Couldn't load this page", a one-line explanation, and a "Retry" button that re-runs the fetch. Add `data-testid="error-state"`.

### Pages to cover (16 total — verify by walking the deployed app)

Admin dashboard:
- `/admin/users`
- `/admin/enrolments`
- `/admin/courses` (qualifications list)
- `/admin/courses/[id]` — units list, LOs list (when expanded), ACs list (when expanded)
- `/admin/audit-logs`

Assessor / Student (BRITEthink dashboard):
- `/c` (course selector)
- `/c/[slug]/assessment` (assessment list)
- `/c/[slug]/progress` (per-learner progress)
- `/c/[slug]/portfolio` (evidence list)
- `/c/[slug]/course-documents` (file manager)
- `/c/[slug]/personal-documents`
- `/c/[slug]/materials`
- `/c/[slug]/work-hours`
- `/c/[slug]/members`
- `/c/[slug]/notifications` and `/c/notifications`

For the home page `/c/[slug]` (the four summary cards): each card individually needs empty/loading/error treatment. The card-level pattern is fine — doesn't need a full-page skeleton.

If the audit reveals a list page I missed, treat it the same way.

### Implementation notes

- Don't refactor existing list components beyond what's needed for the three states. One commit per ~4 pages keeps the diff reviewable.
- Empty-state copy should be plain English, no marketing-speak. "You haven't uploaded any evidence yet" not "Your portfolio is awaiting your first contribution."
- CTA buttons in empty states must respect role permissions — students don't see "Create assessment" because they can't create assessments; only assessor + admin do.
- Error states reuse the same retry handler the page already has.

### Tests

For each page, add a Playwright test that:
- Mocks the fetch to return `[]` → assert `[data-testid="empty-state"]` visible.
- Mocks the fetch to return a 500 → assert `[data-testid="error-state"]` visible and Retry button works.
- Lets the fetch succeed normally → assert the list renders.

Group all G9 tests into `tests/admin/empty-states.spec.ts` and `tests/assessor/empty-states.spec.ts` for clarity.

### Commit

Group into 3–4 commits by area: `feat(ui): G9 — empty/loading/error states for admin list pages`, `feat(ui): G9 — empty/loading/error states for course dashboard pages`, `feat(ui): G9 — empty/loading/error states for file manager pages`.

---

## Phase 2 — G15: Video thumbnails on evidence (~2–3 hours)

When a video is uploaded as evidence, generate a poster frame at 1 second and store its S3 URL on the Evidence record. Display in evidence lists / portfolio in place of the generic file icon.

### Schema (additive)

Add to `Evidence`:
```
thumbnailUrl: string (optional)
thumbnailStorageKey: string (optional)
```

### Server-side flow

After a successful evidence upload (in `src/app/api/v2/evidence/upload/route.ts`):

1. Check `fileType.startsWith('video/')`. If not, skip thumbnail generation entirely.
2. If it's a video, after the main S3 upload completes:
   - Download the video from S3 to a temporary local file (use `os.tmpdir()` for the path).
   - Spawn `ffmpeg -i <tempfile> -ss 00:00:01 -frames:v 1 -q:v 2 <thumbpath>.jpg`. Use `child_process.spawn` with `'/usr/bin/ffmpeg'` (the path verified in earlier runs).
   - Cap ffmpeg execution at 30 seconds. If it exceeds, kill and skip thumbnail.
   - Upload the resulting JPG to S3 with key `<original-key>.thumbnail.jpg`.
   - Set `thumbnailUrl` (signed URL helper) and `thumbnailStorageKey` on the Evidence record.
   - Clean up the temp video and temp JPG.
3. **Soft-fail every step.** Any error (download fails, ffmpeg crashes, upload fails) → log a warning, leave thumbnail fields null, return success on the upload (the video itself is fine, just no thumbnail).

For files where ffmpeg can't read the codec (rare but possible — `.mkv` with weird audio, etc.), log "thumbnail-skip: ffmpeg failed for <storageKey>" and continue.

### Async vs synchronous decision

Doing this synchronously inside the upload request means the user waits 2–10 extra seconds. Doing it asynchronously means the user gets a response immediately but the thumbnail appears later.

Pick **synchronous** for now — simpler, no background-worker setup. Cap the total upload+thumbnail latency at 60 seconds to match existing presigned-URL TTL. If profiling later shows this is a bottleneck, refactor to async with a `thumbnailPending: true` field. Document this decision in the commit message.

### UI

In every place where evidence is rendered as a card/row (portfolio toolbar, assessment detail panel evidence list, evidence selection modal, recent-evidence card on home page):

- If `thumbnailUrl` is present, render a 64×64 (or row-appropriate size) `<img>` with the thumbnail URL.
- If absent (non-video, or video where thumbnail generation failed), keep the existing generic file icon.
- Lazy-load thumbnails (`loading="lazy"`) since the portfolio can have dozens.

### Cascade

When evidence is deleted, also delete `thumbnailStorageKey` from S3 in the same DELETE handler.

### Tests

`tests/assessor/video-thumbnails.spec.ts`:
- Upload a `[E2E-${RUN_ID}]` video evidence → wait → assert `Evidence.thumbnailUrl` is non-null and `thumbnailStorageKey` is set.
- Render the evidence card → assert `<img>` with the thumbnail src is visible.
- Delete the evidence → assert the thumbnail S3 object is also gone.
- Upload a malformed "video" (rename a text file to `.mp4`) → assert evidence is created but `thumbnailUrl` is null (soft-fail confirmed).

### Production verification consideration

The 144 MB MP4 fixture from the previous run should now produce a thumbnail. Re-run the headline workflow spec on production and assert thumbnail appears.

---

## Phase 3 — G17: Bulk operations on user + enrolment lists (~2–3 hours)

### `/admin/users` enhancements

Add to the user list:

1. **Checkbox column** as the leftmost column. A header checkbox toggles select-all for the current page.
2. **Bulk action toolbar** — appears at the top of the table (or as a sticky banner) when ≥1 row is selected. Shows the selection count ("3 selected") and a dropdown with these actions:
   - **Bulk deactivate** — sets `status: 'inactive'` for all selected users (soft-delete pattern). Confirm dialog with selection count: "Deactivate 3 users? They'll lose access immediately."
   - **Resend welcome email to selected** — for each selected student, generate a fresh password (using existing `generatePassword()` helper), update password, send welcome email. Shows progress modal during the run; reports counts at the end ("Sent 3 emails. 0 failures.")
   - **Export selected to CSV** — downloads a CSV with columns: name, email, role, status, phone, createdAt, enrolmentCount. Filename: `users-export-<timestamp>.csv`.
3. **Filter shortcuts** above the list: "All" / "Active only" / "Inactive only" / "Students" / "Assessors" / "Admins" — quick-filter chips that update the filter without typing in search.

### `/admin/enrolments` enhancements

Same pattern, different actions:

1. Checkbox column + select-all + bulk toolbar.
2. Bulk actions:
   - **Bulk withdraw** — sets `status: 'withdrawn'` for all selected enrolments. Confirm dialog.
   - **Export selected to CSV** — columns: studentName, studentEmail, qualificationTitle, assessorName, cohort, status, enrolledAt.
3. Same filter chips: "All" / "In progress" / "Completed" / "Withdrawn".

### API endpoints

Two new routes (admin-only via `withAuth(['admin'])`):

- `POST /api/v2/admin/users/bulk-deactivate` — body `{ ids: string[] }`. Returns `{ updated: count }`. Audit-log each deactivation as `USER_DEACTIVATED_BULK`.
- `POST /api/v2/admin/users/bulk-resend-welcome` — body `{ ids: string[] }`. Returns `{ sent: count, failed: [{id, error}] }`. Audit-log each.
- `POST /api/v2/admin/users/bulk-export` — body `{ ids: string[] }`. Returns `text/csv`. Audit-log as `USERS_EXPORTED`.
- Same three for `/api/v2/admin/enrolments/bulk-*`.

For the export endpoints, do the CSV string construction server-side — easier than client-side and respects auth boundaries.

### Limits

- Max 100 IDs per bulk request (return 400 with friendly error if exceeded). The UI hides the bulk menu and shows a tooltip if select count exceeds 100.
- For bulk-resend-welcome, apply the existing rate limiter at 10 ops per minute (already in `src/lib/rate-limit.ts` from G22).

### Tests

`tests/admin/bulk-ops-users.spec.ts` and `tests/admin/bulk-ops-enrolments.spec.ts`:
- Create 3 `[E2E-${RUN_ID}]` test users → select all → bulk deactivate → assert all 3 are `status: 'inactive'`.
- Select 2 → resend welcome → assert 2 emails queued in Brevo events API (with the run-id substring).
- Export selected → assert CSV downloads with the right rows and columns.
- Bulk operations should not affect James Bond — the test must explicitly create its own users and bulk-act only on those.

### Commit

Two commits: `feat(admin): G17 — bulk operations on user list` and `feat(admin): G17 — bulk operations on enrolment list`.

---

## Phase 4 — Local verification + push to main (~30 min)

After all three gaps are committed locally:

1. Run the full local Playwright suite. Must be all green — including all the previously-passing 100+ specs.
2. `npm run build` — must succeed (catches TypeScript errors).
3. `npm run lint` — must pass.
4. Push to `main` in two batches if comfortable: G9 specs first, then G15+G17. Or one batch if the diff is clean.
5. Wait for Render deploy. Health check: hit `https://ncfe-lms.onrender.com/api/auth/session` and confirm 200.
6. Run a 30-second post-deploy manual smoke: sign in as admin, create a `[smoke-${timestamp}]` user, verify nothing's exploded. Delete the smoke user.

---

## Phase 5 — Production verification (~2 hours)

### 5.1 Regression check (mandatory)

Re-run the entire prod E2E suite from previous runs:
- The original 39 specs from the very first prod run.
- The 65 specs from the G1-G10 run.
- The 11 + 8 specs from the G11-G22 run.

**Any regression here is a deploy blocker.** Fix and redeploy before continuing.

### 5.2 New prod specs

`tests/prod/final-gaps.spec.ts`:

- **G9**: Visit each of the 16 list pages with no data (use a brand-new `[E2E-${RUN_ID}]` test student and qualification so all lists are empty for them) → assert `[data-testid="empty-state"]` is visible on each. Verify CTA buttons render only for users with permission.
- **G15**: Upload a 5-second test video → wait up to 60 s → fetch the evidence record → assert `thumbnailUrl` is set and the URL returns a 200 image.
- **G17**: Create 4 `[E2E-${RUN_ID}]` test users → bulk deactivate 3 → assert 3 are inactive, 1 remains active. Bulk export 2 → assert CSV body. Bulk resend welcome to 2 → assert 2 Brevo events queued.

### 5.3 Cross-browser smoke (re-run, mandatory this time)

The previous run deferred this because "no UI changes meaningful enough to invalidate prior smoke". G9 + G17 add visible UI; G15 changes evidence rendering. Re-run cross-browser smoke now:
- Chromium + Firefox + WebKit projects in `playwright.prod.config.ts`.
- Smoke = sign-in for each role, course tour, evidence upload (small file), assessment plan, sign-off, IQA decision.
- Document any browser-specific findings in the report. Fix Chromium regressions; log Firefox/WebKit-only ones for next sprint.

### 5.4 Mobile viewport pass (re-run)

iPhone 13 viewport. Re-run sign-in, course tour, assessment list, evidence upload, **and the new bulk-action UI** on mobile. The bulk action toolbar in particular needs verification — it might overflow on narrow viewports. Fix critical mobile regressions; log minor ones.

### 5.5 Final report

Append a new section to `tests/UI_GAPS_REPORT.md`: "Final wrap-up — G9-mega + G15 + G17". Include:
- Per-gap status: implemented + tested + deployed.
- Cross-browser findings.
- Mobile findings.
- Final SHIP / SHIP-WITH-CAVEATS recommendation.
- A "fully-shipped baseline" statement: every named gap from the original mega-prompt G1-G22 (excluding G4/G5 which are intentionally not implemented, and excluding G9-confirm-dialog which is the previous run's overloaded G9) is now live.

---

## Phase 6 — User guide final update (~30 min)

Update `docs/USER_GUIDE.md` (incremental, not regeneration). Add:

1. **Empty states** — one sentence in the "Navigating the app" section: "Pages with no data show a friendly placeholder with guidance on what to do next."
2. **Video thumbnails** — in the Student → Upload evidence section: "When you upload a video, a preview thumbnail is generated automatically and shown in your portfolio."
3. **Bulk operations** — in the Admin → Manage users section, a new subsection: "Selecting multiple users at once". Two screenshots: the multi-select state, and the bulk-deactivate confirm dialog. Three sentences explaining the actions.
4. **Bulk operations on enrolments** — same pattern in Admin → Manage enrolments.
5. **Update the FAQ** with two new entries:
   - "How do I deactivate multiple students at once?" → Answer about bulk operations.
   - "Why don't I see a thumbnail for my video evidence?" → Answer that thumbnails generate on upload but if the video file is corrupted or has an unusual codec, a generic file icon shows instead.

Capture only the new screenshots needed (~3–4). Save to `docs/screenshots/`.

Also update the "Recently shipped features" subsection at the top of the user guide with the three new items, marked as "now live".

---

## Phase 7 — Final summary in chat

> SHIP. All remaining gaps shipped: G9-mega (empty/loading/error states across 16 list pages), G15 (video thumbnails on evidence with ffmpeg + S3 + soft-fail), G17 (bulk operations on user + enrolment lists with deactivate/withdraw/export/resend-welcome). Production verification: <P>/<T> specs passing across Chromium + Firefox + WebKit + mobile (iPhone 13). Regression check on prior <N> specs: zero failures. James Bond demo verified to sign in directly post-deploy. User guide updated at docs/USER_GUIDE.md with empty-state, thumbnail, and bulk-ops sections + 2 new FAQ entries. The platform now has a fully-shipped baseline against the original G1–G22 spec (excluding G4 / G5 which are intentionally not implemented per directive).

---

## Hard constraints

- Same non-destructive rules: production database is shared; `RUN_ID` tag every test entity; clean up in `afterEach` and `afterAll`; never modify pre-existing users / qualifications / units / LOs / ACs / enrolments outside test scope.
- **DO NOT touch James Bond (`7777jamesbond7777@gmail.com`) or his enrolment, ever.** The Phase 0 verification is the only time you interact with him.
- **DO NOT re-introduce** rolled-back features: no `mustChangePassword`, no `/profile/change-password`, no force-redirect middleware, no `/forgot-password` flow.
- **DO NOT re-implement** any of the 17 already-shipped gaps. Verify only.
- **DO NOT touch IQA dashboard pages.**
- Schema changes ONLY additive — `thumbnailUrl`, `thumbnailStorageKey` on Evidence are the only new fields in this run.
- Email failures soft-fail every time. Bulk-resend-welcome surfaces individual failures in the response, never throws.
- Brevo API key, Mongo URI, AWS creds — never log them, never echo them in audit logs, never include them in screenshots.
- If a fix would require >2 hours and you're 5 hours into Phase 1+2+3, defer the LOWEST-priority remaining piece (G15 video thumbnails has the highest implementation complexity — defer that before deferring G9 grunt work or G17 admin features).
- Two retry attempts max on a failed Render deploy, then revert and escalate.
- If Phase 5 finds a regression in any previously-passing test, **stop and fix** before continuing.

Begin with Phase 0. Verify James Bond is healthy on production before writing any code.
