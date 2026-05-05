# NCFE LMS — UI Gap Audit

| | |
| --- | --- |
| Audit timestamp | 2026-05-06 |
| Production URL | `https://ncfe-lms.onrender.com` |
| Method | Read-only review of every routed page + middleware + email + User schema, mapped against [`docs/britethink-dashboard-architecture.txt`](../docs/britethink-dashboard-architecture.txt) and [`STUDENT_DASHBOARD_PLAN.md`](../STUDENT_DASHBOARD_PLAN.md) |

User instruction (this run): **do NOT add self-service forgot-password for students.** G4 from the brief is dropped; `/forgot-password` keeps the contact-administrator view from Phase 1.6.

---

## Severity rubric

- **P0** — workflow broken or data integrity at risk. Must fix this run.
- **P1** — workflow works but real users will complain. Should fix.
- **P2** — polish, consistency, minor friction. Nice to have.
- **P3** — feature gap that's a separate roadmap item. Document and defer.

---

## /admin/dashboard
- [P3] Skeleton + empty + error states all present. No gaps.

## /admin/users
- [**P0**] *(G1)* Create-user form has no inline option to enrol the student into a qualification — admin has to navigate to `/admin/enrolments` separately. → Add optional Qualification + Assessor + Cohort fields when role=`student`; create both rows in one flow with a soft-fail seam if enrolment fails.
- [**P0**] *(G2)* No inline "Enrol in another course" action on student rows; re-enrolling existing users is a separate page trip. → Add an "Enrol" row action that opens a mini-modal with qualification + assessor + cohort pickers.
- [**P0**] *(G2)* No enrolment-count badge beside student names. → Show `· N courses` chip after each student's name.
- [**P0**] *(G3)* No `/admin/users/[id]` detail view or row expansion that shows the user's enrolments + per-enrolment edit/withdraw actions. → Add a detail page mirroring the `/admin/courses/[id]` convention.
- [P2] Role/search filters are not preserved across reloads — they're React state only, not URL params. → Use `useSearchParams` + `router.replace` to sync.
- [P2] No fetch-failure UI on list load (`page.tsx:476`); silent on network errors. → Add retry banner.

## /admin/courses
- [P2] No fetch-failure UI on list load. → Add retry banner.

## /admin/courses/[id]
- [**P1**] *(G10)* No bulk CSV curriculum import — Units/LOs/ACs must be added one at a time. → Add an "Import curriculum (CSV)" button with preview-then-commit flow.
- [**P1**] Inline Delete buttons on Unit / LO / AC have NO confirmation dialog (`page.tsx:233-236, 285-289, 333-338`) — one misclick destroys part of the curriculum tree. → Use `ConfirmDialog` for all three.
- [P1] Delete failures are silent (no toast, no banner). → Surface error.
- [P2] "Loading…" text instead of card-shaped skeleton. → Skeleton.

## /admin/enrolments
- [P3] Loading + empty + confirm dialogs all present. No P0/P1 gaps. Simple "Loading…" instead of skeleton (P3).

## /admin/audit-logs
- [**P1**] *(G8)* No date-range filter, no user filter, no CSV export — admins can't audit "what did Bruce do last Thursday" without scrolling. → Add date-range picker, user search-as-you-type, "Export filtered to CSV" (admin-only, audit-logged as `AUDIT_EXPORTED`).
- [P2] No timestamp-sort toggle (always desc). → Add asc/desc toggle on the timestamp column.

## /c/[slug] (assessor home)
- [P2] Empty-state cards on Recent Assessments / Recent Evidence / Recent Materials show plain text — spec calls for icon + friendly message + CTA. → Add empty-state component with icon + CTA arrow.

## /c/[slug]/assessment
- [**P1**] Delete confirmation uses native `window.confirm()` in `AssessmentDetailPanel:53` — inconsistent with the branded `ConfirmDialog` used elsewhere. → Replace with `ConfirmDialog`.
- [P2] Loading skeleton is a centred spinner, not a card-shaped placeholder matching the eventual grid layout. → Card skeletons.

## /c/[slug]/portfolio
- [P3] Empty state, role-gating, ConfirmDialog on delete all present. No gaps.

## /c/[slug]/progress
- [P3] Empty state, loading, role-aware drill-down all present. No gaps.

## /c/[slug]/members
- [P2] Empty state is plain "No team members found" text — no icon, no message context. → Add empty-state icon + helper line.
- [P2] Loading is a generic spinner; not skeleton-shaped. → Card-row skeletons.

## /c/[slug]/work-hours
- [**P1**] Delete confirmation uses a "click again to confirm" toast pattern (`page.tsx:181-191`) — non-standard, surprising. → Replace with `ConfirmDialog`.

## /c/[slug]/materials
- [**P1**] Delete confirmation uses the toast-confirm pattern (`page.tsx:216-226`). → Replace with `ConfirmDialog`.

## /c/[slug]/course-documents
- [**P1**] Delete confirmation uses the toast-confirm pattern. → Replace with `ConfirmDialog`.

## /c/[slug]/personal-documents
- [P3] Uses `ConfirmDialog` correctly — gold-standard pattern for the rest to follow.

## /c/[slug]/notifications
- [P3] Skeleton + empty + pagination all present. No gaps.

## /dashboard (student)
- [P3] Pure redirect to `/c`. Appropriate.

## /profile (cross-role)
- [**P0**] *(G6)* Profile is read-only — no edit form for name, phone, avatar, password. → Add edit-mode UI with name/phone/avatar/change-password flows. Avatar uses existing S3 `uploadFile` helper. PUT endpoint at `/api/v2/users/me`.
- [**P0**] *(G6)* `/api/v2/users/me` (self-service GET + PUT) does NOT exist. Only the admin-controlled `/api/v2/admin/users/[id]` exists today. → Create the route.
- [**P0**] *(G7)* No notification-preferences toggles. → Add three toggles (sign-off, IQA decision, new enrolment) writing to `notificationPreferences` field on User.

## /profile/change-password (cross-role) — does not exist
- [**P0**] *(G5)* No `/profile/change-password` page. → Create it (current password + new password with Generate/Copy/Eye + confirm; clears `mustChangePassword` flag on success).

## /notifications (student)
- [P2] Loading skeleton uses generic rectangles, not notification-card-shaped. → Card-shaped skeleton.
- [P2] No "load more" / pagination. → Add load-more.

## /messages
- [P2] Loading + empty states use plain text. → Add icon + helper.

## /courses (student)
- [P2] Progress ring is a hardcoded 0% placeholder. → Fetch real progress.
- [P2] Loading skeleton uses generic rectangles. → Card-shaped.

## /portfolio (student)
- [P2] Loading skeleton uses generic rectangles. → Card-shaped.

## /iqa/dashboard
- [P2] No error-state fallback if API fails (only loading skeleton). → Add retry banner.

## /iqa/sampling
- [P3] Empty + ConfirmDialog all present. No gaps.

## /iqa/sampling/[id]
- [P1] Missing error fallback if sample fetch fails (only renders "Sample not found" 404). → Add retry banner for fetch errors.

## /iqa/decisions
- [P3] Uses ConfirmDialog correctly. No gaps.

## /iqa/actions
- [P3] Stub page (placeholder card only). Roadmap.

## /iqa/standardisation
- [P3] Stub page. APIs (incl. DELETE) exist. List view is roadmap (deferred from previous run).

## /iqa/documents
- [P3] Stub page. Same as standardisation.

## /iqa/eqa-readiness
- [P1] Readiness checks are all hardcoded as "pending" — no API call to compute actual status. → Wire to a `/api/iqa/eqa-readiness` endpoint OR mark as roadmap.
- [P1] "Export audit log" button has no `onClick` — clicking does nothing. → Wire to G8's CSV-export endpoint.

## /sign-in
- [P2] No "show password" toggle on the password input. → Add eye-icon toggle.
- [P3] No failed-attempt lockout. (Auth provider is NextAuth credentials; out of scope tonight.)

## /sign-up
- [P3] Validation present.

## /forgot-password
- [P3] **Static "Contact your administrator" view (by design — explicit user instruction).** No change.

---

## Cross-cutting

### Middleware (`src/middleware.ts`)
- [**P0**] *(G5)* No redirect for users with `mustChangePassword=true`. → After auth check, if `auth?.user.mustChangePassword === true` and the path isn't `/profile/change-password` or an auth API, redirect.
- [P2] No special handling for IQA path group beyond role check.

### Auth (`src/lib/auth.config.ts`, `src/lib/auth.ts`)
- [**P0**] *(G5)* Session JWT does not include `mustChangePassword`. → Add to the `jwt` callback and the `session` callback so middleware can read it.

### User schema (`src/models/User.ts`)
- [**P0**] *(G5)* No `mustChangePassword` field. → Add `mustChangePassword: { type: Boolean, default: false }`.
- [**P0**] *(G7)* No `notificationPreferences` field. → Add `{ signOff: Boolean(default=true), iqaDecision: Boolean(default=true), newEnrolment: Boolean(default=true) }`.
- [P2] *(G6)* Existing `avatar` field is unused — UI doesn't surface it and there's no upload endpoint. → Add upload endpoint, render in top-nav avatar.

### Email (`src/lib/email.ts`)
- [**P0**] *(G7)* Only welcome + password-reset templates exist. → Add `sendSignOffEmail`, `sendIqaDecisionEmail`, `sendNewEnrolmentEmail` with corresponding HTML templates.
- [**P0**] *(G7)* Sign-off / IQA-decide / enrolment-create routes don't call any email send. → Wire each route + audit-log + soft-fail.

### Top-nav avatar dropdown
- [P2] Missing user email, "Manage your account" → /profile link, and organization switcher. → Add the missing rows.

### Delete-confirm consistency
- [**P1**] Five different patterns in use: `ConfirmDialog` (gold standard), inline modal, `window.confirm`, "click delete again" toast, no confirm at all. → Standardise on `ConfirmDialog` (G9 sweep).

### Empty/loading state consistency
- [P1] At least 8 list pages use plain text or generic rectangles instead of icon + helper / card-shaped skeleton. Group into a single `ListEmptyState` + `CardSkeleton` reusable.

---

## Counts

| Severity | Count | Will fix this run |
| --- | --- | --- |
| **P0** | **15** | All 15 (G1, G2 ×2, G3, G5 ×4, G6 ×3, G7 ×4) |
| **P1** | **11** | All 11 (G8, G10, delete-confirm consistency on 5 pages, EQA-readiness wiring, sampling[id] error state, courses[id] confirm) |
| **P2** | **22** | Subset only — G9 sweep covers most empty/skeleton items; trivial polish (avatar dropdown email row, sort toggle) folded into related commits |
| **P3** | **8** | Deferred — roadmap items: stub IQA pages, lockout, real progress ring, real-readiness compute, SignUp lockout |
| **TOTAL** | **56** | **~40+ fixed in this run** |

> **G4 (self-service password reset) is intentionally NOT in scope** — students keep the admin-issued password per explicit user instruction.

Read `tests/UI_AUDIT.md` (this file) for surface-by-surface breakdown. Phase 2 commits start with G5 (P0, schema + middleware + page) and proceed in priority order.
