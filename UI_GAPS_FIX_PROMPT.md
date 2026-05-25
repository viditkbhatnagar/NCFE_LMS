# NCFE LMS — UI Gap Audit, Fix, Verify on Production, and User Guide Generation

You are doing a comprehensive UX-quality pass on the NCFE LMS Next.js app deployed at `https://ncfe-lms.onrender.com`. Production is currently green (39/39 prod E2E specs passing as of the last run, see `tests/PROD_REPORT.md`). The repo is at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Render auto-deploys on push to `main`.

This run has four phases: **audit → fix → verify on production → write the user guide**. Total wall-clock budget: 8–12 hours unattended. Same non-destructive rules as previous runs apply (production database is shared, every test entity needs `RUN_ID` tagging + cleanup, James Bond demo user at `7777jamesbond7777@gmail.com` and his enrolment must NEVER be touched).

Read these before starting:
- `tests/PROD_REPORT.md` and `tests/DEMO_SUMMARY.md` (current state)
- `tests/BUG_LOG.md` (already-known issues, may have been resolved)
- `docs/britethink-dashboard-architecture.txt` (the spec for the assessor + student dashboard — the source of truth for what the UI is supposed to look like)
- `docs/BRITEthink_Dashboard_Architecture_student.doc` (student-specific spec)
- `STUDENT_DASHBOARD_PLAN.md` (the role-aware unification plan)

---

## Phase 1 — UI gap audit (read-only, ~60–90 min)

Walk every page of the deployed app as each role and produce a structured audit. **Do not fix anything yet.**

### Method

Sign in as each role on `https://ncfe-lms.onrender.com` and click through every page, modal, dropdown, and form. For each surface, compare the live implementation against:

1. The architecture spec docs (above)
2. Standard UX patterns (loading states, empty states, error states, confirm-before-destructive, copy-to-clipboard feedback, keyboard accessibility, focus management, responsive behaviour)
3. The seven gaps the user has explicitly named or implied through the conversation (listed in §2 below)
4. Anything else you'd flag as a "this would frustrate a real user" moment

### Output

Write `tests/UI_AUDIT.md` with the following structure. Be specific — name the route, name the element, describe the gap in one sentence, propose the fix in one sentence, rate severity P0/P1/P2/P3:

```
## /admin/users
- [P0] Create-user form has no inline option to enrol the student into a qualification — admin has to navigate to /admin/enrolments separately. → Add optional Qualification + Assessor + Cohort fields when role=student; create both rows in one transaction.
- [P1] User list has no inline "Enrol" action button — re-enrolling existing users is a separate page trip. → Add Enrol action to row menu, opens mini-modal with qualification + assessor pickers.
- [P2] User search is title-only, doesn't search by phone or by enrolment status. → Extend search to phone; add filter by "has enrolments" / "no enrolments".
- [P3] No bulk import (CSV) for users. → Defer to next sprint.

## /admin/courses
- ...
```

Severity rubric:
- **P0** — admin or student literally cannot complete a workflow without an unreasonable amount of clicking, OR data integrity is at risk. Must fix.
- **P1** — workflow works but UX is annoying enough that a real user will mention it. Should fix.
- **P2** — polish / consistency / minor friction. Nice to have.
- **P3** — feature gap that's a separate roadmap item. Document and move on.

After the audit, print a short summary in chat with the count of P0/P1/P2/P3 issues. Wait for nothing — proceed straight to Phase 2.

---

## Phase 2 — Fix the gaps (in priority order, ~4–6 hours)

Fix every P0 and every P1. Skip P2 and P3 unless they're trivial (≤ 5 lines of code with no test risk). Each fix is its own logical commit so the deploy diff is reviewable.

### Known gaps to address (these MUST be in your fix list — if the audit didn't catch one of these, add it)

These are gaps the user has explicitly raised or that are documented in `tests/DEMO_SUMMARY.md`'s next-week list. Treat all as P0 unless the audit reveals reason otherwise.

**G1 — Combined create-and-enrol student flow.**
On `/admin/users` Add User form, when role dropdown = `student`, reveal three optional fields:
- Qualification (dropdown of all active qualifications)
- Assessor (dropdown of users with role=assessor or admin)
- Cohort (text input, defaults to current quarter like `2026-Q2`)

If all three are filled: POST creates user → POST creates enrolment → success modal shows credentials AND a "Enrolled in [course] under [assessor], cohort [cohort]" confirmation line. Welcome email body should mention the course they're enrolled in.

If left blank: create user only (current behaviour, backwards compatible). Welcome email sends without course mention.

If only some filled: validation error, don't create either.

The flow must be transactional in spirit — if enrolment creation fails after user is created, surface the error in the success modal as a yellow warning (`User created, but enrolment failed: <reason>. Enrol manually via /admin/enrolments.`) and let admin fix it. Don't roll back the user.

**G2 — "Enrol in another course" action on user list rows.**
For every user row whose role is `student`, add an "Enrol" action in the row's menu (next to Edit / Reset password / Resend welcome / Delete). Click → modal with the same three fields as G1. Saves a new enrolment for that existing user.

Show enrolment count beside the student's name in the list (e.g. `James Bond · 1 course`) so admin can see at a glance who's enrolled where.

**G3 — User detail / "view enrolments" view.**
Currently `/admin/users` is a flat list. Add a row-expansion or a `/admin/users/[id]` detail view that shows:
- The user's profile fields
- All their enrolments (qualification, assessor, cohort, status, enrolled-at date)
- Actions per enrolment: edit (change assessor/cohort/status), withdraw, view in dashboard

Pick whichever pattern (expansion vs detail page) fits the existing codebase style — read `/admin/courses/[id]/page.tsx` for the existing detail-view convention.

**G4 — Re-enable self-service password reset with Brevo.**
Currently `/forgot-password` redirects to "contact admin". Re-enable a real flow:
- Form: enter email → submit
- Backend: if email exists, generate a single-use token (15-min TTL, store in a new lightweight `PasswordResetToken` collection or in-memory if simpler), send via Brevo using a new `sendPasswordResetLinkEmail()` template
- Email body: greeting + "click here to reset, expires in 15 minutes" + button linking to `/reset-password?token=<token>`
- New page `/reset-password?token=...`: validates token → form to set new password → updates user → invalidates token → redirects to sign-in
- If email doesn't exist, return generic success message (don't leak which emails are registered)

Soft-fail: if Brevo down, log to audit, return success message anyway (user gets nothing in inbox; they retry). Add a Playwright test for the full flow including expired-token rejection.

**G5 — Force change password on first login.**
Add a `mustChangePassword: boolean` field to the User schema (default `false`). Set to `true` in the admin user-create endpoint and in the password-reset endpoint (so admin-set passwords always require change on next login). Middleware redirects logged-in users with `mustChangePassword=true` to `/profile/change-password` for any route except that one. Form: current password + new password (with the same Generate/Copy/Eye triplet as admin create) + confirm. On submit: validates current, updates new, sets `mustChangePassword=false`, redirects to role home.

This is an additive schema change (optional field with default), which is allowed under the non-destructive rules. Test the flow for newly-created users + the case where the field is missing on existing users (treat as `false`, don't force them).

**G6 — Profile editing and avatar.**
The existing `/profile` page is read-only or thin. Make it allow:
- Edit name, phone (not email — that's the login identifier and changing it is risky)
- Change password (any time, not just first-login)
- Upload avatar — image only, max 2 MB, stored on S3 like other uploads, displayed in the top-nav user-avatar dropdown

PUT endpoint at `/api/v2/users/me` for the profile fields; reuse existing upload helper for the avatar.

**G7 — Email notifications for key events (using existing Brevo).**
Currently only welcome + password reset trigger emails. Add three more:
- When an assessor signs off an assessment → email the student: subject `Your assessment has been reviewed`, body links to the assessment and shows assessor's remarks excerpt.
- When IQA submits a decision → email both the assessor and the student: subject `IQA decision recorded for [assessment title]`, body shows decision type (approved / action_required / reassessment_required) and IQA's comment.
- When admin creates an enrolment for an existing user (i.e. student is added to a NEW course) → email the student: `You've been enrolled in [course]`.

Each uses the same `send()` helper in `src/lib/email.ts`. Templates inline in the same file to keep it simple. Audit-log every send. Soft-fail.

A user setting (in `/profile`) lets users opt out of these notifications — defaults to opt-in, stored on the user document as `notificationPreferences: { signOff: bool, iqaDecision: bool, newEnrolment: bool }`. If the user has opted out of a category, skip the send.

**G8 — Audit log filters and search.**
`/admin/audit-logs` likely has limited filtering. Add:
- Filter by action (dropdown of distinct actions present in the data)
- Filter by entity type (User, Assessment, Enrolment, etc.)
- Filter by user (search-as-you-type)
- Filter by date range
- Sort by timestamp (default desc, switchable)
- Pagination
- Export the current filtered view to CSV (admin-only, audit-logged as `AUDIT_EXPORTED`)

**G9 — Empty states and loading skeletons across the app.**
Walk every list page (assessment list, evidence portfolio, materials, course documents, personal documents, work hours, notifications, audit logs, users, enrolments, qualifications). For each:
- If it currently shows a blank screen / "no items" raw text on empty: add a friendly empty state with an icon, a one-line explanation, and a relevant CTA button.
- If it shows nothing during loading: add a skeleton matching the eventual layout (use the existing skeleton patterns from `/admin/dashboard/page.tsx`).
- If an API error returns nothing: add an error state with retry button.

This is grunt work but high-impact for UX. Group all the empty/loading state changes into one commit if there's no individual logic risk.

**G10 — Bulk curriculum import (CSV).**
On `/admin/courses/[id]`, add an "Import curriculum from CSV" button. Spec:
- 4-column CSV: `Unit Reference, LO Number, AC Number, Description`
- Optional 5th: `Evidence Requirements`
- POST `/api/v2/admin/qualifications/[id]/curriculum/import` with the parsed JSON
- Backend creates Units (deduped by unitReference within the qualification), then LOs (deduped by loNumber within unit), then ACs (deduped by acNumber within LO). Returns counts created/skipped/errored.
- UI shows preview before commit ("This will create 3 units, 12 LOs, 47 ACs. Confirm?") and a dry-run toggle.

Mark this G10 as P1 (not P0) — it's only critical if the user is onboarding many qualifications. Build it but if time is tight, ship it without the dry-run preview and add that next iteration.

### Implementation rules (apply to all fixes)

- One logical commit per gap (G1, G2, ...). Commit message format: `feat(ui): G1 — combined create-and-enrol student flow`.
- No schema-breaking changes. Additive new fields (`mustChangePassword`, `notificationPreferences`, `avatarUrl`) are fine — make them optional with sensible defaults.
- Use existing patterns: `withAuth` for API routes, Zod validators in `src/lib/validators.ts`, existing modal styling, existing form input components.
- Add or extend Playwright tests for every fix. Tests must run against `localhost:3000` first, all green.
- After all gaps are fixed and local tests pass, commit + push to `main`. Wait for Render deploy. Health check.

---

## Phase 3 — Production verification (~1–2 hours)

After deploy goes green:

### 3.1 Re-run the existing prod E2E suite
The `playwright.prod.config.ts` and the existing prod specs from the previous run should still pass. Run them. **Any regression here is a deploy blocker** — fix before continuing.

### 3.2 New prod specs for the gaps you just fixed
Add `tests/prod/ui-gaps.spec.ts` covering G1–G10 against `https://ncfe-lms.onrender.com`. Same RUN_ID + cleanup rules. Specifically:
- G1: Admin creates `[E2E-${RUN_ID}] Test Student` with all three enrolment fields filled → assert user exists, enrolment exists, welcome email mentions course (verify via Brevo events API). Cleanup: delete enrolment + soft-delete user.
- G2: Admin enrols an existing test student in a `[E2E-${RUN_ID}]` test qualification (create the qualification first, cleanup after).
- G3: Open user detail / expansion → assert enrolment list renders with correct count.
- G4: Submit forgot-password for a real test email → assert email arrives with token link → click link → reset → sign in with new password.
- G5: Newly-created user signs in → asserted to be redirected to `/profile/change-password` → cannot navigate elsewhere → after change, normal navigation works.
- G6: User edits name/phone, uploads avatar (PNG ≤2 MB), changes password.
- G7: Assessor signs off assessment → assert email queued in Brevo for the student. IQA decides → assert two emails (assessor + student) queued.
- G8: Audit log: filter by action, entity type, user, date range. Export to CSV → assert response is text/csv with expected columns.
- G9: Visit ten list pages with no data; assert each has a non-empty empty-state element (test by data-testid).
- G10: POST a CSV with 2 units, 6 LOs, 12 ACs → assert dry-run preview returns counts → assert commit creates exactly those entities.

### 3.3 Cross-browser smoke
Add a Firefox + WebKit project to `playwright.prod.config.ts`. Run a thinner smoke (just sign-in for each role + the headline workflow from the previous run) on all three engines.

### 3.4 Mobile viewport pass
Add a mobile project (`devices['iPhone 13']`). Re-run sign-in, course tour, assessment list, and one evidence upload on mobile. Document any visual regressions in the report; fix only critical ones (broken layout, hidden buttons, illegible text).

### 3.5 Final report
Write `tests/UI_GAPS_REPORT.md`:
- Counts: gaps audited, fixed, deferred. P0/P1/P2/P3 breakdown before/after.
- Per-gap status: implemented + tested + deployed, or skipped (with reason).
- New cross-browser / mobile findings.
- Anything that broke during this run and is now red.
- Final SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP recommendation.

---

## Phase 4 — User guide generation (~60–90 min)

Generate `docs/USER_GUIDE.md` — a single comprehensive document for the people who will actually use the system. Structure:

### Section 1: Overview (1 page)
- What the system is, who it's for, the data model in plain English (Centre → Qualification → Unit → LO → AC; Users have Roles and Enrolments).
- Production URL.
- Where to get help.

### Section 2: Getting started by role (separate sub-section per role)

For each of `admin`, `assessor`, `student`, `iqa`:
- Their home page, with annotated screenshot
- The 3–5 most common tasks, each with:
  - Step-by-step click path
  - Screenshot of the key screen
  - Common mistakes and how to recover

For example, **Admin → Onboard a new student** would walk through:
- Navigate to /admin/users
- Click Add User
- Fill name, email, role=student
- Reveal the three enrolment fields, pick qualification + assessor + cohort
- Click Generate to make a password
- Submit
- Copy credentials from success modal and verify the welcome email

### Section 3: Workflows (cross-role)

The full assessment lifecycle, walked through as a single narrative with screenshots from each role's perspective:
1. Admin onboards student
2. Assessor plans assessment
3. Student uploads evidence
4. Assessor maps evidence to criteria
5. Both sign off
6. IQA reviews and decides
7. Admin checks audit log

### Section 4: Reference

- All keyboard shortcuts (if any exist; document none if none)
- File upload limits and accepted formats (per `src/lib/upload.ts`)
- Email notification triggers (which actions send which emails to whom)
- Roles and what each can see / do (matrix table)
- FAQ — at least 10 entries based on the audit findings (questions like "How do I add a student to multiple courses?", "Why didn't my welcome email arrive?", "What happens when I delete a user?", etc.)

### Screenshots
Use Playwright (or the existing screenshot infrastructure in `scripts/screenshot-dashboard.mjs`) to capture each screenshot **from the production URL** with realistic data. Save to `docs/screenshots/`. Use 1440×900 desktop unless documenting mobile-specific behaviour. Reference them in the markdown via relative paths.

For credential redaction in screenshots (passwords, real emails), blur or replace before saving. The James Bond demo account is fine to show.

### Save and link
- `docs/USER_GUIDE.md` — the main file
- `docs/USER_GUIDE_INDEX.md` — short ToC for navigation
- Update the repo `README.md` with a one-line link: "User guide: see [docs/USER_GUIDE.md](docs/USER_GUIDE.md)"

---

## Output and final summary

When done, print in chat:

> SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP. UI gap audit found <X> issues; fixed <Y> P0+P1; deferred <Z> P2+P3. Production verification: <P>/<T> specs passing across <N> browsers and mobile. New features deployed: G1 (combined create+enrol), G2 (inline enrol), G3 (user detail), G4 (self-service password reset), G5 (force-change-on-first-login), G6 (profile editing), G7 (email notifications), G8 (audit log filters), G9 (empty/loading states), G10 (CSV curriculum import). User guide at docs/USER_GUIDE.md. Read tests/UI_GAPS_REPORT.md for the full triage.

---

## Hard constraints (non-negotiable)

- Same non-destructive rules as previous runs: production database is shared; `RUN_ID` tag every test entity; clean up in `afterEach` and `afterAll`; never modify pre-existing users / qualifications / units / LOs / ACs / enrolments outside test scope.
- **DO NOT touch James Bond (`7777jamesbond7777@gmail.com`) or his enrolment, ever.**
- Never reset, drop, or `deleteMany({})` on `ncfe_lms` collections.
- Schema changes are allowed ONLY if additive (new optional fields with defaults). Field renames, type changes, removals are forbidden.
- Email failures must never block user creation, password reset, or any other flow. Soft-fail every time.
- Brevo API key, Mongo URI, AWS creds — never log them, never echo them in audit logs, never include them in screenshots.
- If a fix would require >2 hours of work and you're 4 hours into Phase 2, defer it to next sprint with a clear note in the report. Don't get stuck.
- If the production deploy fails after push, two retry attempts max, then revert and escalate.
- If during Phase 3 you find a regression that breaks a previously-passing test from `tests/PROD_REPORT.md`, **stop and fix** before continuing. Don't ship a regression.

Begin with Phase 1 (audit). Take screenshots as you go — they're useful for the user guide later.
