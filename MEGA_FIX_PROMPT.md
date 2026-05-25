# NCFE LMS — Comprehensive UI + Backend Gap Resolution, Production Verification, and User Guide Generation

You are doing the final big quality pass on the NCFE LMS Next.js app deployed at `https://ncfe-lms.onrender.com`. Production is currently green (39/39 prod E2E specs passing as of `tests/PROD_REPORT.md`). The repo is at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Render auto-deploys on push to `main`.

This run has four phases: **audit → fix → verify on production → write the user guide**. Total wall-clock budget: 10–14 hours unattended. Same non-destructive rules as previous runs: production database is shared, every test entity needs `RUN_ID` tagging + cleanup, James Bond demo user (`7777jamesbond7777@gmail.com`) and his enrolment must NEVER be touched.

Read these before starting:
- `tests/PROD_REPORT.md` and `tests/DEMO_SUMMARY.md` (current production state)
- `tests/BUG_LOG.md` (already-known issues, mostly resolved)
- `docs/britethink-dashboard-architecture.txt` (assessor + student dashboard spec)
- `docs/BRITEthink_Dashboard_Architecture_student.doc` (student-specific spec)
- `STUDENT_DASHBOARD_PLAN.md` (role-aware unification plan)

---

## ⚠️ Out of scope — do NOT touch these

The user has explicitly excluded these areas. Do not implement, modify, or "improve" them under any circumstances:

1. **No self-service password reset.** `/forgot-password` stays disabled / redirects to "contact admin". Do not build the email-link reset flow.
2. **No force-change-password-on-first-login.** Admin-set passwords are intentionally permanent until admin resets them again. Do not add `mustChangePassword` field, do not add middleware redirect, do not add a `/profile/change-password` page.
3. **No self-service password change anywhere.** Profile editing must NOT include a "change my password" option. Only the existing admin reset flow (admin → user list → Reset Password) modifies passwords.
4. **No IQA dashboard improvements.** Skip any UX work on `/iqa/*` routes. The existing IQA functionality stays exactly as it is — sampling, decisions, standardisation, EQA readiness, IQA documents, IQA actions. Do not add filters, exports, or polish to IQA pages even if the audit flags them.

These four exclusions are non-negotiable. If your audit identifies issues in these areas, document them in the audit report but do NOT fix them.

---

## Phase 1 — UI + backend gap audit (read-only, ~60–90 min)

Walk every page of the deployed app as each role (admin, assessor, student) and produce a structured audit. **Do not fix anything yet.** Skip IQA pages per the exclusion above.

### Method

Sign in as each role on `https://ncfe-lms.onrender.com` and click through every page, modal, dropdown, and form. For each surface, compare the live implementation against:

1. The architecture spec docs (above).
2. Standard UX patterns (loading states, empty states, error states, confirm-before-destructive, copy-to-clipboard feedback, keyboard accessibility, focus management, responsive behaviour).
3. The 19 gaps explicitly listed in §2 below.
4. Anything else you'd flag as a real-user friction point.

For backend, additionally:
- Read every Mongoose model in `src/models/` and look for orphan-on-parent-delete risks (no cascade where there should be one).
- Verify indexes on common query patterns (enrolments by assessor, evidence by learner+unit, audit logs by date range, assessments by status).
- Inspect HTTP response headers from a sample of routes — list any missing security headers.
- Inspect a sample of API routes — note any missing input validation, rate limiting, or auth gates.

### Output

Write `tests/UI_AUDIT.md` with this structure (one section per route/area, severity P0/P1/P2/P3 per gap):

```
## /admin/users
- [P0] Create-user form has no inline option to enrol the student into a qualification — covered by G1.
- [P1] No role-change option for existing users — covered by G16.
...

## Backend / src/models/
- [P1] Deleting an Enrolment doesn't cascade to its associated WorkHoursLog rows — covered by G20.
...
```

Severity rubric:
- **P0** — admin or student literally cannot complete a workflow without unreasonable clicks, OR data integrity is at risk. Must fix.
- **P1** — workflow works but UX is annoying enough that a real user will mention it. Should fix.
- **P2** — polish / consistency / minor friction. Nice to have.
- **P3** — feature gap that's a separate roadmap item. Document and move on.

After the audit, print a one-line summary in chat with P0/P1/P2/P3 counts. Wait for nothing — proceed straight to Phase 2.

---

## Phase 2 — Fix the gaps (in priority order, ~6–8 hours)

Fix every P0 and every P1. Skip P2 and P3 unless trivial (≤ 5 lines, no test risk). Each fix is its own logical commit so the deploy diff is reviewable.

### The 19 named gaps

These MUST be in your fix list. Each is described with enough detail to implement directly. If the audit reveals reason to deprioritise one, document the reason and proceed.

#### G1 — Combined create-and-enrol student flow [P0]

On `/admin/users` Add User form, when role dropdown = `student`, reveal three optional fields:
- Qualification (dropdown of all active qualifications)
- Assessor (dropdown of users with role=assessor or admin)
- Cohort (text input, defaults to current quarter like `2026-Q2`)

If all three are filled: POST creates user → POST creates enrolment → success modal shows credentials AND an "Enrolled in [course] under [assessor], cohort [cohort]" confirmation line. Welcome email body should mention the course they're enrolled in.

If left blank: create user only (current behaviour, backwards compatible). Welcome email sends without course mention.

If only some filled (e.g. qualification picked but no assessor): client-side validation, don't submit either.

If user creation succeeds but enrolment creation fails: surface as a yellow warning in the success modal (`User created, but enrolment failed: <reason>. Enrol manually via /admin/enrolments.`). Don't roll back the user.

#### G2 — Inline "Enrol in another course" on user list rows [P0]

For every user row whose role is `student`, add an "Enrol" action in the row's menu (next to Edit / Reset password / Resend welcome / Delete). Click → modal with the same three fields as G1. Saves a new enrolment for that existing user. Triggers the new "added to course" email from G7.

Show enrolment count beside the student's name in the list (e.g. `James Bond · 1 course`) so admin can see at a glance who's enrolled where.

#### G3 — User detail / view enrolments [P0]

Currently `/admin/users` is a flat list. Add either a row-expansion or a `/admin/users/[id]` detail view (pick whichever fits the codebase style — read `/admin/courses/[id]/page.tsx` for the existing detail-view convention) that shows:

- The user's profile fields
- All their enrolments: qualification, assessor, cohort, status, enrolled-at date
- Per-enrolment actions: edit (change assessor/cohort/status), withdraw, view in dashboard

#### G6 — Profile editing (NO password change) [P0]

The existing `/profile` page is read-only or thin. Make it allow:
- Edit name, phone (NOT email — that's the login identifier and changing it is risky)
- Upload avatar — image only, max 2 MB, stored on S3 like other uploads, displayed in the top-nav user-avatar dropdown
- Manage notification preferences (the opt-outs from G7)

**Do NOT include a "change my password" option** — admin-controlled passwords only. If a user wants their password changed, they contact admin who uses the existing reset flow.

Add `PUT /api/v2/users/me` for the profile fields and a `POST /api/v2/users/me/avatar` for the avatar upload. Reuse existing upload helper.

#### G7 — Email notifications for key events (using existing Brevo) [P0]

Currently only welcome + password reset trigger emails. Add three more, each using the same `send()` helper in `src/lib/email.ts` and following the same soft-fail + audit-log pattern:

- **Assessor signs off an assessment** → email the student. Subject: `Your assessment has been reviewed`. Body: greeting, assessment title, a one-line "your assessor has reviewed your work", optional remarks excerpt (truncate at 200 chars), button linking to the assessment in the student dashboard.
- **IQA submits a decision** → email both the assessor and the student. Subject: `IQA decision recorded for [assessment title]`. Body: decision type (approved / action_required / reassessment_required) shown prominently, IQA's comment, button to the assessment.
- **Admin enrols a student in a course** (i.e. via G1 or G2) → email the student. Subject: `You've been enrolled in [course]`. Body: course title, assessor name, cohort, login button.

Each email type is opt-out-able per user. Add `notificationPreferences` field to User schema (additive, default `{ signOff: true, iqaDecision: true, newEnrolment: true }` — opt-in by default). The Profile page (G6) shows three toggle checkboxes for these. If a user has opted out of a category, skip that send.

Templates inline in `src/lib/email.ts`. Audit-log every send/failure with `EMAIL_SENT` / `EMAIL_FAILED` and the template name. Never log the email body or the user's password.

#### G8 — Audit log filters and CSV export [P1]

`/admin/audit-logs` likely has limited filtering. Add:
- Filter by action (dropdown of distinct actions present in the data — populate by querying `db.auditlogs.distinct('action')` once and caching in component state)
- Filter by entity type (User, Assessment, Enrolment, etc.)
- Filter by user (search-as-you-type input that resolves to a userId)
- Filter by date range (two date pickers: from / to)
- Sort by timestamp (default desc, switchable)
- Pagination (50 per page)
- Export the current filtered view to CSV (admin-only, audit-logged as `AUDIT_EXPORTED`). CSV columns: timestamp, action, entityType, entityId, userId (resolved to email), oldValue (JSON-stringified), newValue (JSON-stringified).

#### G9 — Empty states and loading skeletons across the app [P1]

Walk every list page (assessment list, evidence portfolio, materials, course documents, personal documents, work hours, notifications, audit logs, users, enrolments, qualifications, course detail). For each:
- If it currently shows a blank screen / "no items" raw text on empty: add a friendly empty state with a relevant icon (use `lucide-react` if available, otherwise inline SVG), a one-line explanation of what should be there, and a relevant CTA button (e.g. "Add your first user" on /admin/users empty state).
- If it shows nothing during loading: add a skeleton matching the eventual layout (use the existing skeleton pattern from `/admin/dashboard/page.tsx`).
- If an API error returns nothing: add an error state with a "Retry" button.

Group all these changes into one commit if there's no individual logic risk. Add `data-testid="empty-state"` to each empty state for the test in §3.2.

#### G10 — Bulk curriculum import via CSV [P1]

On `/admin/courses/[id]`, add an "Import curriculum from CSV" button. Spec:
- 4-column CSV: `Unit Reference, LO Number, AC Number, Description`
- Optional 5th column: `Evidence Requirements`
- POST `/api/v2/admin/qualifications/[id]/curriculum/import` with the parsed JSON (server-side parsing + validation)
- Backend creates Units (deduped by unitReference within the qualification), then LOs (deduped by loNumber within unit), then ACs (deduped by acNumber within LO). Returns `{ unitsCreated, unitsSkipped, losCreated, losSkipped, acsCreated, acsSkipped, errors }`.
- UI shows preview before commit ("This will create 3 units, 12 LOs, 47 ACs. 0 will be skipped as duplicates. Confirm?") with a Confirm button that submits.
- Provide a downloadable CSV template (one button: "Download template CSV") that produces a one-row example file.

If time tight, ship without the preview UI (just import + show result counts in a toast). Don't ship without dedup logic — that's the whole point.

#### G11 — Per-criterion comments on assessments [P0]

Currently `Remark` is at the assessment level. Add the ability to leave a comment on a specific Assessment Criteria mapped to an assessment.

Schema (additive — new collection):
```
CriterionComment:
  _id
  assessmentId (ref Assessment)
  criteriaId (ref AssessmentCriteria)
  content: string
  createdBy: ref User
  createdAt: Date
  updatedAt: Date
```

API:
- `GET /api/v2/assessments/[id]/criteria-comments?criteriaId=X` — list
- `POST /api/v2/assessments/[id]/criteria-comments` — create (assessor or IQA only)
- `DELETE /api/v2/assessments/[id]/criteria-comments/[commentId]` — only the author can delete

UI: in the assessment detail panel, each mapped criterion chip becomes expandable. When expanded, shows a thread of comments with timestamps + author, plus an input to add a new comment. Students see comments in read-only mode.

#### G12 — Witness testimony structured fields [P1]

When evidence has type `witness_testimony`, the current Evidence model just has a generic file + label. Real-world practice requires structured witness data. Add (additive):

Schema additions to Evidence:
```
witnessName: string (optional)
witnessRole: string (optional)
witnessEmployer: string (optional)
witnessEmail: string (optional)
witnessStatement: string (optional, long text)
```

These fields are surfaced on the evidence upload form ONLY when the evidence type would be `witness_testimony` — meaning when uploading evidence the student picks a "kind" (this may not exist yet — if not, add a "kind" dropdown to the evidence upload form with the existing `AssessmentKind` enum), and if kind is `witness_testimony`, show the four witness fields.

Display: in evidence preview modal and in the evidence row, show the witness block prominently for witness-testimony evidence.

#### G13 — Required-vs-completed work hours indicator [P1]

The current Work Hours page tracks logged hours but doesn't compare against a required total. Add:

Schema addition to Qualification:
```
requiredWorkHours: number (optional, e.g. 30)
```

UI: the Work Hours page now shows a progress bar at the top: `12h 30m / 30h required` with a percentage. Below the cap, the bar is brand-coloured; at or above, it's green with a "Requirement met" label.

Admin can set `requiredWorkHours` on the qualification edit form in `/admin/courses` create/edit dialog (new optional field).

If `requiredWorkHours` is 0 or null, hide the progress bar (legacy behaviour).

#### G14 — PDF export of an assessment [P1]

An assessor often needs a printable assessment record for portfolio audits. Add:

- New endpoint `GET /api/v2/assessments/[id]/pdf` — auth-gated to assessor (must be the assignee or admin) and student (must be the learner).
- Generates a PDF containing: assessment title, kind, date, plan/intent, plan/implementation, mapped criteria with their per-criterion comments (G11), mapped evidence list (filename + label), sign-offs, remarks, and IQA decision if present.
- Use `pdfkit` or `@react-pdf/renderer` (whichever is lighter — `pdfkit` is fewer deps).
- Set `Content-Disposition: attachment; filename="assessment-<id>.pdf"` so the browser downloads it.

UI: in the assessment detail panel, add a "Download PDF" button next to the existing actions.

#### G15 — Video thumbnails [P2 — only if time permits]

When a video is uploaded as evidence, generate a poster frame and store its S3 URL on the Evidence record.

- Server-side: after the upload completes, if `fileType` starts with `video/`, run `ffmpeg -i <stream> -ss 00:00:01 -frames:v 1 <out>.jpg` to grab a frame at 1 second, upload the JPG to S3 with key suffix `.thumbnail.jpg`, store the URL on `Evidence.thumbnailUrl`.
- Use the local `ffmpeg` binary (already available at `/usr/bin/ffmpeg` per previous runs).
- For very long videos or unusual codecs, ffmpeg may fail — that's fine, soft-fail and store no thumbnail.
- UI: evidence list / portfolio shows the thumbnail instead of a generic file icon for videos that have one.

This is P2 because it's the most complex (involves spawning an ffmpeg child process, re-uploading to S3, handling failures). If you're 6 hours into Phase 2 and haven't started it yet, skip it.

#### G16 — Role change for existing users [P1]

Admin currently can't promote a student to assessor or vice-versa cleanly through the UI. Add:

- In the user edit dialog (admin/users → Edit), the role dropdown is now editable (it may currently be read-only or absent).
- When role changes from student to non-student: warn ("This user has 2 active enrolments. Changing role will withdraw them from all courses. Continue?"), and on confirm, set all the user's enrolments to `status: 'withdrawn'`.
- When role changes from non-student to student: no automatic enrolment (admin uses G2 to enrol).
- Audit-log every role change with `USER_ROLE_CHANGED`, oldValue and newValue showing before/after roles.

#### G17 — Bulk operations [P2]

In `/admin/users`, add:
- Checkbox column to select multiple rows.
- Bulk action menu (top-right when ≥1 row selected): "Bulk deactivate", "Export selected to CSV", "Resend welcome to selected".
- Bulk deactivate sets `status: 'inactive'` for all selected (soft-delete pattern). Confirm dialog shows count.
- Export to CSV downloads a file with: name, email, role, status, phone, createdAt, enrolmentCount.

Same pattern available on `/admin/enrolments`: bulk withdraw, bulk export.

#### G18 — Cookie consent banner + privacy policy stub [P1]

If this system holds real student PII in the EU/UK, GDPR essentially requires both. Add:

- **Cookie banner**: shown to all users on first page load (whether logged in or not). Two buttons: "Accept all" and "Reject non-essential". Only essential cookies (NextAuth session) are set if they reject. The choice is persisted in a `cookie_consent` cookie (1 year TTL). Banner doesn't reappear after a choice is made.
- **Privacy policy page**: new route `/privacy` (public, no auth). Static markdown rendered as HTML, includes: data controller (Learners Education), data we collect (name, email, phone, evidence files, work hours), legal basis (legitimate interest for training delivery + consent for marketing if any), sub-processors (Brevo, AWS, MongoDB Atlas, Render), retention (placeholder: "until withdrawn or 7 years post-completion, whichever is later"), user rights (access, rectification, erasure — link to admin contact).
- **Footer link** to `/privacy` on every page.

Stub copy is fine — admin will replace it with their actual privacy policy. Do NOT make legal claims that aren't true (e.g. don't claim GDPR compliance — say "intended to comply with").

#### G19 — HTTP security headers [P1]

Audit current response headers on a sample of routes (sign-in, course home, an API route). For each missing standard header, add it:
- `Content-Security-Policy` — start permissive (`default-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; ...`) and tighten over time. Don't break any inline scripts the app already uses.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (none of these are used; deny by default)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Render serves over HTTPS)

Implement via `next.config.ts` `headers()` function. Don't add headers that conflict with what NextAuth or Next.js already sets — verify before adding.

#### G20 — Cascade-delete audit and fixes [P0]

Read every Mongoose model. For each parent → child relationship, verify the parent's DELETE handler cleans up children. Document and fix orphan paths.

Specifically check (this list isn't exhaustive — find others):
- User deleted → what happens to their Assessments, Evidence, Enrolments, Notifications, AuditLog entries? (Audit logs should be retained for compliance — leave them. Everything else: cascade.)
- Qualification deleted (soft-delete) → Units, LOs, ACs should be soft-marked too (or stay accessible since soft-delete is recoverable).
- Enrolment deleted → Assessments, Evidence, Work Hours related to this enrolment should cascade delete.
- Unit / LO / AC deleted → child entities cascade.
- Assessment deleted → CriteriaMappings, EvidenceMappings, SignOffs, Remarks, CriterionComments (G11), Notifications cascade.

For each fix: update the relevant DELETE route to perform the cascade in dependency order. Use `Promise.all` for sibling deletes, sequential for parent-child. Add Playwright tests that delete a parent and verify all children are gone.

#### G21 — Index optimisation [P1]

Read every Mongoose model and verify indexes match query patterns:
- `Enrolment`: `{ assessorId: 1 }`, `{ qualificationId: 1 }`, `{ userId: 1 }`, `{ userId: 1, qualificationId: 1 }` (compound, for "is this user already enrolled?")
- `Evidence`: `{ uploadedBy: 1 }`, `{ unitId: 1 }`, `{ status: 1 }`, possibly `{ uploadedBy: 1, status: 1 }`
- `Assessment`: already has `{ assessorId: 1 }`, `{ learnerId: 1 }`, `{ enrollmentId: 1 }`, `{ status: 1 }`, `{ date: -1 }` — verify these and add `{ qualificationId: 1, status: 1 }` for the dashboard query.
- `AuditLog`: `{ timestamp: -1 }`, `{ action: 1 }`, `{ entityType: 1, entityId: 1 }`, `{ userId: 1 }`
- `Notification`: `{ userId: 1, read: 1, createdAt: -1 }` (compound, for the "unread count" query)
- `WorkHoursLog`: `{ enrollmentId: 1 }`, `{ learnerId: 1 }`, `{ date: -1 }`

Add missing ones via `Schema.index(...)`. Models reload with the new indexes on next deploy. Verify by querying Atlas after deploy.

#### G22 — API rate limiting [P1]

Add a simple in-memory rate limiter for API routes — protects against accidental polling and basic abuse. Don't use Redis; in-memory is enough for a single Render instance.

- Implement `src/lib/rate-limit.ts` with a sliding-window counter keyed by `(userId or IP, route)` — store in a `Map` cleared every minute.
- Apply via a higher-order wrapper around route handlers, similar to `withAuth`. Default: 60 requests per minute per user per route.
- Higher limits for upload routes (10/min) and lower for password-reset / login routes (5/min on the unauthenticated paths).
- Returns 429 with `Retry-After` header and a friendly JSON error.

This won't survive horizontal scaling (each instance has its own Map) but is fine for one Render instance and far better than nothing.

### Implementation rules (apply to all fixes)

- One logical commit per gap (`G1`, `G2`, …, `G22`). Commit message format: `feat(ui): G1 — combined create-and-enrol student flow` or `fix(backend): G20 — cascade-delete on user deletion`.
- No schema-breaking changes. Additive new fields (`notificationPreferences`, `avatarUrl`, `requiredWorkHours`, `thumbnailUrl`, witness fields) are fine — make them optional with sensible defaults.
- New collections (`CriterionComment` for G11) are also additive — no migration needed.
- Use existing patterns: `withAuth` for API routes, Zod validators in `src/lib/validators.ts`, existing modal styling, existing form input components, existing audit-log helper.
- Add or extend Playwright tests for every fix. Tests must run against `localhost:3000` first, all green.
- Commit as you go. Don't accumulate 19 uncommitted changes — push to `main` in batches of 5–6 commits at most so a Render deploy failure can be diagnosed against a smaller surface.

### Local verification before any production push

After each batch of commits, run the full local suite: `npx playwright test` (the Phase 1 + Phase 1.5 + Phase 1.6 suites that already exist). Must be all green before pushing. If any pre-existing test fails after one of your changes, that's a regression — fix it before the push.

---

## Phase 3 — Production verification (~1–2 hours)

After the final deploy goes green:

### 3.1 Re-run the existing prod E2E suite
The `playwright.prod.config.ts` and the 39 prod specs from the previous run must still pass. **Any regression here is a deploy blocker** — fix and redeploy before continuing.

### 3.2 New prod specs for the gaps you fixed
Add `tests/prod/ui-gaps.spec.ts` (or split across multiple files) covering G1–G22 against `https://ncfe-lms.onrender.com`. Same RUN_ID + cleanup rules. Specifically:
- G1: Admin creates `[E2E-${RUN_ID}] Test Student` with all three enrolment fields filled → assert user exists, enrolment exists, welcome email mentions course (verify via Brevo events API). Cleanup.
- G2: Admin enrols an existing test student in a `[E2E-${RUN_ID}]` test qualification (create the qualification first, cleanup after).
- G3: Open user detail / expansion → assert enrolment list renders with correct count.
- G6: User edits name + phone via /profile, uploads avatar (PNG ≤2 MB), confirms avatar appears in nav. Verify there is NO password change UI (negative assertion — test fails if one exists).
- G7: Assessor signs off assessment → assert email queued in Brevo for the student. IQA decides → assert two emails (assessor + student) queued. Toggle off `signOff` notification preference for a user → assessor signs off → assert no email sent for that user.
- G8: Audit log: filter by action, entity type, user, date range. Export → assert response is text/csv with expected columns and row count matches filter.
- G9: Visit ten list pages with no data; assert each has `[data-testid="empty-state"]`.
- G10: POST a CSV with 2 units, 6 LOs, 12 ACs → assert preview shows correct counts → confirm → assert exactly those entities created. Cleanup.
- G11: Add 2 comments on different criteria of a test assessment → assert they appear in the criteria expansion → student can see them in read-only.
- G12: Upload witness-testimony evidence with witness fields filled → assert evidence record has witness data → assert preview modal shows it.
- G13: Set requiredWorkHours=20 on a test qualification, log 5h → assert progress bar shows 25%. Log another 16h → assert "Requirement met".
- G14: GET /api/v2/assessments/[id]/pdf → assert response is application/pdf and starts with `%PDF`. Save to disk and check basic structure.
- G15 (if shipped): Upload a video → assert thumbnail URL is set on the Evidence record after a few seconds.
- G16: Admin promotes a `[E2E-${RUN_ID}]` student to assessor → assert role changed AND all their enrolments are now `status: 'withdrawn'`.
- G17: Select 3 test users → bulk deactivate → assert all 3 have `status: 'inactive'`. Bulk export → assert CSV contains all 3.
- G18: Visit /privacy → 200 + content. Visit /sign-in → cookie banner appears. Click "Accept all" → reload → banner doesn't reappear.
- G19: Inspect response headers on /sign-in and /api/auth/session → assert presence of CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS.
- G20: Create a test enrolment with associated assessment + evidence + work hours → delete enrolment → assert all three children are gone.
- G21: Verify indexes by hitting Atlas API or running `db.collection.getIndexes()` via the Mongoose connection in a test setup hook.
- G22: Hammer `/api/v2/admin/stats` 70 times in a minute as one user → assert 429 returned for requests after the limit.

### 3.3 Cross-browser smoke
Add a Firefox + WebKit project to `playwright.prod.config.ts`. Run a thinner smoke (just sign-in for each role + the headline workflow from the previous run) on all three engines. Document any browser-specific findings in the report; fix Chromium-only regressions, log Firefox/WebKit-only ones for next sprint.

### 3.4 Mobile viewport pass
Add a mobile project (`devices['iPhone 13']`). Re-run sign-in, course tour, assessment list, and one evidence upload on mobile. Document any visual regressions; fix only critical ones (broken layout, hidden buttons, illegible text).

### 3.5 Final report
Write `tests/UI_GAPS_REPORT.md`:
- Counts: gaps audited, fixed, deferred. P0/P1/P2/P3 breakdown before/after.
- Per-gap status: implemented + tested + deployed, or skipped (with reason).
- New cross-browser / mobile findings.
- Anything that broke during this run and is now red.
- Final SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP recommendation.

---

## Phase 4 — User guide generation (~60–90 min)

Generate `docs/USER_GUIDE.md` — a single comprehensive document for the people who will actually use the system. Use Playwright (or `scripts/screenshot-dashboard.mjs`) to capture screenshots **from the production URL** with the new UI in place. Save them to `docs/screenshots/`. Use 1440×900 desktop unless documenting mobile.

### Section 1: Overview (1 page)
- What the system is, who it's for, the data model in plain English (Centre → Qualification → Unit → LO → AC; Users have Roles and Enrolments).
- Production URL.
- Where to get help (admin contact).

### Section 2: Getting started — by role

For each of `admin`, `assessor`, `student` (skip IQA per scope):
- Their home page, with annotated screenshot
- The 3–5 most common tasks, each with:
  - Step-by-step click path
  - Screenshot of the key screen
  - Common mistakes and how to recover

For example, **Admin → Onboard a new student** would walk through:
- Navigate to /admin/users → click Add User
- Fill name, email, role=student
- The new G1 enrolment fields appear — pick qualification + assessor + cohort
- Click Generate to make a password
- Submit → success modal shows credentials + email-sent confirmation
- Verify the welcome email arrived in the student's inbox

### Section 3: Workflows (cross-role)

The full assessment lifecycle, walked through as a single narrative with screenshots from each role's perspective:
1. Admin onboards student (now in one step thanks to G1)
2. Assessor plans assessment
3. Student uploads evidence (mention the new witness-testimony fields if witness type, video thumbnails if applicable)
4. Assessor maps evidence to criteria, leaves per-criterion comments (G11)
5. Both sign off
6. Student receives sign-off email (G7)
7. IQA reviews and decides (brief mention — not a deep section)
8. Student + assessor both receive IQA decision email (G7)
9. Admin checks audit log (mention the new filters from G8)

### Section 4: Reference

- File upload limits and accepted formats (per `src/lib/upload.ts`)
- Email notification triggers — table: action → who gets email → can they opt out?
- Roles and what each can see / do (matrix table: rows = features, cols = admin/assessor/student/IQA, cells = read/write/none)
- Curriculum CSV import format (G10) — show a sample CSV
- FAQ — at least 12 entries covering questions like:
  - "How do I add a student to multiple courses?" (G2)
  - "Why didn't my welcome email arrive?" (spam folder, single-sender Brevo, domain auth not set up)
  - "How do I reset a student's password?" (admin-only via reset button)
  - "Can students reset their own passwords?" (no — by design, contact admin)
  - "What happens when I delete a user?" (soft-delete, see G20 cascade behaviour)
  - "How do I import an existing curriculum?" (G10 CSV import)
  - "How do I export the audit log?" (G8 CSV export)
  - "How do I change a user's role?" (G16, with consequences)
  - etc.

### Section 5: Admin operational notes
- How to onboard a new Centre (currently UI doesn't support — flag as roadmap)
- How to bulk import users (G10 CSV pattern, or future bulk-import-users feature)
- How to handle GDPR data subject requests (currently manual — flag as roadmap)
- Render cold-start behaviour (30–60 s after 15 min idle)
- Email deliverability (single-sender Brevo, domain auth as next step)

### Save and link
- `docs/USER_GUIDE.md` — the main file
- `docs/USER_GUIDE_INDEX.md` — short ToC for navigation
- Update the repo `README.md` with a one-line link: "User guide: see [docs/USER_GUIDE.md](docs/USER_GUIDE.md)"

For credential redaction in screenshots: blur or mask passwords and any real student emails (other than James Bond's demo email which is fine to show). Use the `[REDACTED]` overlay or a blur filter.

---

## Output and final summary

When done, print in chat:

> SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP. UI + backend gap audit found <X> issues; fixed <Y> of P0+P1; deferred <Z> P2+P3. Production verification: <P>/<T> specs passing across <N> browsers and mobile. New features deployed: G1 (combined create+enrol), G2 (inline enrol), G3 (user detail), G6 (profile editing without password change), G7 (email notifications), G8 (audit log filters + CSV), G9 (empty/loading states), G10 (CSV curriculum import), G11 (per-criterion comments), G12 (witness fields), G13 (work hours progress), G14 (PDF export), G15 (video thumbnails — shipped/deferred), G16 (role change), G17 (bulk operations), G18 (cookie consent + privacy stub), G19 (security headers), G20 (cascade-delete fixes), G21 (indexes), G22 (rate limiting). User guide at docs/USER_GUIDE.md. Read tests/UI_GAPS_REPORT.md for the full triage.

---

## Hard constraints (non-negotiable)

- Same non-destructive rules as previous runs: production database is shared; `RUN_ID` tag every test entity; clean up in `afterEach` and `afterAll`; never modify pre-existing users / qualifications / units / LOs / ACs / enrolments outside test scope.
- **DO NOT touch James Bond (`7777jamesbond7777@gmail.com`) or his enrolment, ever.**
- **DO NOT implement anything in the §"Out of scope" section** (no self-service password reset, no force-change-password, no self-service password change, no IQA dashboard improvements).
- Never reset, drop, or `deleteMany({})` on `ncfe_lms` collections.
- Schema changes ONLY additive — new optional fields with defaults, or new collections. Field renames, type changes, removals are forbidden.
- Email failures must never block user creation, profile edits, or any other flow. Soft-fail every time.
- Brevo API key, Mongo URI, AWS creds — never log them, never echo them in audit logs, never include them in screenshots.
- If a fix would require >2 hours of work and you're 6 hours into Phase 2, defer it to next sprint with a clear note in the report. Don't get stuck.
- If the production deploy fails after push, two retry attempts max, then revert and escalate.
- If during Phase 3 you find a regression that breaks a previously-passing test from `tests/PROD_REPORT.md`, **stop and fix** before continuing. Don't ship a regression.
- Before pushing the FINAL batch of commits to `main`, output a single squashed diff summary of all schema additions and middleware changes for the user to eyeball. Wait for nothing — proceed after printing.

Begin with Phase 1 (audit). Take screenshots as you go — they're useful for the user guide later.
