# BRITEthink Student Dashboard — Phased Build Plan

## Strategy

Both the assessor architecture doc and student architecture doc specify **identical route names** and sidebar navigation. The current assessor code deviates in two routes (`/assessments` instead of `/assessment`, `/documents` instead of `/course-documents`). We fix this first, then make all pages role-aware so both assessor and student share the same URLs.

### Route Map (after Phase 0 fix)

| URL Path | Assessor | Student | Approach |
|----------|----------|---------|----------|
| `/c` | Course selector | Course selector | Shared, different API per role |
| `/c/[slug]` | Home (all learners) | Home (own data) | Shared, role-aware |
| `/c/[slug]/assessment` | Assessment list (CRUD) | Assessment list (read-only) | **Shared, role-aware** |
| `/c/[slug]/assessment/[id]` | Detail panel (full edit) | Detail panel (read-only + learner sign-off) | **Shared, role-aware** |
| `/c/[slug]/progress` | Learner progress | Own progress | Shared, role-aware |
| `/c/[slug]/portfolio` | Manage evidence | Upload own evidence | Shared, role-aware |
| `/c/[slug]/course-documents` | Upload/manage files | Browse/download (read-only) | **Shared, role-aware** |
| `/c/[slug]/personal-documents` | View student docs | Upload own docs | Shared, role-aware |
| `/c/[slug]/materials` | Upload/manage | Browse (read-only) | Shared, role-aware |
| `/c/[slug]/work-hours` | Record for learner | Record own | Shared, role-aware |
| `/c/[slug]/members` | Members page | — | Assessor-only (accessed via home arrow) |

### Sidebar (identical for both roles, per both docs)

1. Home → `/c/{slug}`
2. Assessment → `/c/{slug}/assessment`
3. Progress → `/c/{slug}/progress`
4. Portfolio → `/c/{slug}/portfolio`
5. *[divider]*
6. Course Documents → `/c/{slug}/course-documents`
7. Personal Documents → `/c/{slug}/personal-documents`
8. Materials → `/c/{slug}/materials`
9. Work Hours → `/c/{slug}/work-hours`

---

## Phase 0: Fix Assessor Route Names

### What to do
Rename two assessor routes to match both architecture docs. This is a prerequisite before adding student support.

### Changes

**1. Rename assessment route directory:**
- `src/app/(assessor-dashboard)/c/[slug]/assessments/` → `src/app/(assessor-dashboard)/c/[slug]/assessment/`
- This changes the URL from `/c/{slug}/assessments` to `/c/{slug}/assessment`

**2. Rename documents route directory:**
- `src/app/(assessor-dashboard)/c/[slug]/documents/` → `src/app/(assessor-dashboard)/c/[slug]/course-documents/`
- This changes the URL from `/c/{slug}/documents` to `/c/{slug}/course-documents`

**3. Update sidebar paths:**
- `src/components/assessor/AssessorIconSidebar.tsx` — Change `/assessments` → `/assessment` and `/documents` → `/course-documents` in the `navIcons` array

**4. Update all internal links and references:**
- Home page (`c/[slug]/page.tsx`): "View all" links to assessments and documents
- Any component that links to `/assessments` or `/documents`
- Search results component if it links to assessment pages
- API route references if any hardcode these paths

**5. Verify API routes are unaffected:**
- API routes live at `/api/v2/assessments/` (API paths don't change, only page routes)

### Files to rename
- `src/app/(assessor-dashboard)/c/[slug]/assessments/` → `assessment/`
- `src/app/(assessor-dashboard)/c/[slug]/documents/` → `course-documents/`

### Files to modify
- `src/components/assessor/AssessorIconSidebar.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/page.tsx` (home page links)
- Any other files referencing `/assessments` or `/documents` page routes

### Verification
1. `npm run build` passes
2. Log in as assessor → `/c/{slug}/assessment` shows assessment list (was `/assessments`)
3. `/c/{slug}/course-documents` shows course documents (was `/documents`)
4. All sidebar links work with new paths
5. Home page "View all" arrows link to correct new paths
6. Assessment detail panel still opens correctly

---

## Phase 1: Foundation & Layout Adaptation

### What to build
Make the BRITEthink dashboard shell work for students. After this phase, a student can log in, see their courses at `/c`, click into one, and see the correct sidebar + header — but pages will still show assessor-only content.

### Changes required

**1. Auth redirect update:**
- `src/lib/auth.config.ts` — In the `authorized` callback, redirect logged-in students to `/c` instead of `/dashboard` (same as assessors).

**2. Layout role gate:**
- `src/app/(assessor-dashboard)/layout.tsx` — Accept both `assessor` and `student` roles (currently rejects non-assessors). Pass `userRole` to `AssessorDashboardShell`.

**3. Course-level layout:**
- `src/app/(assessor-dashboard)/c/[slug]/layout.tsx` — Accept `student` role. If student: fetch `Enrolment.find({ userId: user.id, qualificationId })` (student's own enrollment). If assessor: keep existing logic (`assessorId === user.id`). Pass `userRole` to `AssessorCourseProvider`.

**4. Context adaptation:**
- `src/contexts/AssessorCourseContext.tsx` — Add `userRole: UserRole` to context type, provider props, and context value.

**5. Shell & navigation updates:**
- `AssessorDashboardShell.tsx` — Accept and forward `userRole` prop.
- `AssessorTopNav.tsx` — Accept `userRole`. Show "Learner" instead of "Assessor" in avatar dropdown when student.
- `AssessorSubHeader.tsx` — Get `userRole` from context. If student: hide learner dropdown, just show course name. If assessor: keep current.
- `AssessorIconSidebar.tsx` — Sidebar paths are now identical for both roles (after Phase 0 fix). No changes needed here beyond what Phase 0 did.

**6. Course selector:**
- `src/app/(assessor-dashboard)/c/page.tsx` — Make role-aware. Student: fetch from `/api/v2/student/courses`. Assessor: keep current.
- **New API:** `src/app/api/v2/student/courses/route.ts` — GET. Auth: `withAuth(['student'])`. Query `Enrolment.find({ userId }).populate('qualificationId')`. Return deduplicated `{ _id, title, slug, code, level }`.

### Files to modify
- `src/lib/auth.config.ts`
- `src/app/(assessor-dashboard)/layout.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/layout.tsx`
- `src/contexts/AssessorCourseContext.tsx`
- `src/components/assessor/AssessorDashboardShell.tsx`
- `src/components/assessor/AssessorTopNav.tsx`
- `src/components/assessor/AssessorSubHeader.tsx`
- `src/app/(assessor-dashboard)/c/page.tsx`

### Files to create
- `src/app/api/v2/student/courses/route.ts`

### Verification
1. `npm run build` passes
2. Log in as assessor — everything works as before
3. Log in as student → redirected to `/c` → sees enrolled courses → can enter a course → sees correct header/sidebar, no learner dropdown
4. Student avatar dropdown shows "Learner" role

---

## Phase 2: Home + Progress + Members

### What to build
Student home dashboard and progress page. Both are shared pages that become role-aware.

### Changes required

**1. Home page (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/page.tsx` — Get `userRole` from context. Student: fetch from `/api/v2/dashboard/student/{enrollmentId}`. Assessor: keep current. Response shape is the same `AssessorHomeDashboard` type so existing components (`HomeLearnerCard`, `HomeRecentCard`) work.
- **New API:** `src/app/api/v2/dashboard/student/[enrollmentId]/route.ts` — Auth: `withAuth(['student'])`. Verify enrollment belongs to student. Return `{ assessors, learners, recentAssessments, recentEvidence, recentMaterials }` scoped to student's data.

**2. Progress page (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/progress/page.tsx` — Get `userRole`. Student: always uses own enrollment, no learner selection needed. Assessor: keeps current.
- **API update:** `src/app/api/v2/progress/[enrollmentId]/route.ts` — Add `student` to `withAuth(['assessor', 'student'])`. If student, verify enrollment ownership.

### Files to modify
- `src/app/(assessor-dashboard)/c/[slug]/page.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/progress/page.tsx`
- `src/app/api/v2/progress/[enrollmentId]/route.ts`

### Files to create
- `src/app/api/v2/dashboard/student/[enrollmentId]/route.ts`

### Verification
1. Student home shows members, recent assessments/evidence/materials
2. Student progress shows own progress (units, LOs, ACs)
3. Assessor home and progress unchanged
4. `npm run build` passes

---

## Phase 3: Assessments (Role-Aware)

### What to build
Make the assessment list page and detail panel role-aware. This is the most complex phase.

Both roles now share `/c/{slug}/assessment`. Assessor: full CRUD, create button, edit, delete, publish. Student: read-only list, read-only detail with learner sign-off and remarks.

### Changes required

**1. Assessment list page (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/assessment/page.tsx` — Get `userRole` from context.
  - Student: fetch from `/api/v2/assessments?enrollmentId={id}&learnerId={userId}` (or new student endpoint). Hide "+ Create Assessment" button. Cards are not editable.
  - Assessor: keep current behavior (fetch by qualificationId + enrollmentId, show create button).
- **New API:** `src/app/api/v2/student/assessments/route.ts` — GET. Auth: `withAuth(['student'])`. Query assessments where `learnerId === session.user.id`. Return `AssessmentListItem[]`.

**2. Assessment detail panel (role-aware):**
The existing `AssessmentDetailPanel` needs a `readOnly` mode OR create a `StudentAssessmentDetailPanel` component.

**Recommended: Add `readOnly` prop to existing sub-components:**
- `DetailHeader` — readOnly: hide delete button, publish toggle, make title non-editable, date non-clickable
- `AssessmentKindSelector` — readOnly: show selected kind highlighted but not clickable
- `PlanSection` — readOnly: render as display text, not editable textarea
- `EvidenceMappingSection` — readOnly: no add/remove, no upload button (or show disabled with tooltip "You don't have permission to upload evidence for this assessment")
- `CriteriaMappingSection` — readOnly: no edit mapping button, show mapped criteria as display-only
- `SignOffStatusSection` — Student CAN sign off as "learner" role. Keep interactive for the learner sign-off card.
- `RemarksSection` — Student CAN add remarks. Keep interactive.

Either refactor existing `AssessmentDetailPanel` to accept `readOnly` prop, or create `StudentAssessmentDetailPanel` that reuses sub-components with `readOnly={true}`.

**3. API updates:**
- `src/app/api/v2/assessments/[id]/route.ts` (GET) — Add `student` to allowed roles. If student, verify `assessment.learnerId === session.user.id`.
- `src/app/api/v2/assessments/[id]/sign-off/route.ts` — Add `student`. If student, only allow `role: 'learner'`.
- `src/app/api/v2/assessments/[id]/remarks/route.ts` — Add `student`. If student, verify they are the learner.

### Key files to reference
- Assessment list: `src/app/(assessor-dashboard)/c/[slug]/assessment/page.tsx` (renamed in Phase 0)
- Detail panel: `src/components/assessor/assessment-detail/AssessmentDetailPanel.tsx`
- Sub-components: `src/components/assessor/assessment-detail/` (DetailHeader, AssessmentKindSelector, PlanSection, EvidenceMappingSection, CriteriaMappingSection, SignOffStatusSection, RemarksSection)
- Assessment card: `src/components/assessor/AssessmentCard.tsx`
- Utils: `src/lib/assessment-utils.ts`
- Types: `src/types/index.ts`

### Design notes from student doc
- Student assessment detail: all fields read-only except sign-off (learner can sign) and remarks (learner can add)
- "Upload Evidence" button disabled with tooltip "You don't have permission to upload evidence for this assessment"
- Learner sign-off card has purple/violet border highlight when signed
- Sign-off order: 1. Assessor, 2. IQA, 3. EQA, 4. Learner

### Files to create
- `src/app/api/v2/student/assessments/route.ts`
- Possibly `src/components/assessor/assessment-detail/StudentAssessmentDetailPanel.tsx`

### Files to modify
- `src/app/(assessor-dashboard)/c/[slug]/assessment/page.tsx`
- Assessment detail sub-components (add `readOnly` prop)
- `src/app/api/v2/assessments/[id]/route.ts`
- `src/app/api/v2/assessments/[id]/sign-off/route.ts`
- `src/app/api/v2/assessments/[id]/remarks/route.ts`

### Verification
1. Student at `/c/{slug}/assessment` sees their assessments (no create button)
2. Click assessment → detail panel: read-only title/date/kind/plan/evidence/criteria
3. Student can sign off as "learner"
4. Student can add remarks
5. Assessor at same URL: full CRUD still works
6. `npm run build` passes

---

## Phase 4: Portfolio + Evidence

### What to build
Make the portfolio page role-aware. Student can view and upload their own evidence.

### Changes required

**1. Portfolio page (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/portfolio/page.tsx` — Get `userRole`.
  - Student: uses own `currentEnrollmentId`, shows "Upload Evidence" button, can upload.
  - Assessor: keeps current behavior.

**2. API updates:**
- `src/app/api/v2/portfolio/[enrollmentId]/route.ts` (GET) — Add `student`. If student, verify enrollment ownership.
- Evidence upload API — Add `student`. If student, auto-set `learnerId` from session.

### Files to modify
- `src/app/(assessor-dashboard)/c/[slug]/portfolio/page.tsx`
- `src/app/api/v2/portfolio/[enrollmentId]/route.ts`
- Evidence upload API route(s)

### Verification
1. Student at `/c/{slug}/portfolio` sees own evidence
2. Student can upload evidence
3. Filters/sort/view modes work
4. Assessor portfolio unchanged
5. `npm run build` passes

---

## Phase 5: Documents + Materials + Work Hours + Search + Polish

### What to build
Remaining shared pages + global search + polish.

### Changes required

**1. Course Documents (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/course-documents/page.tsx` (renamed in Phase 0) — Get `userRole`.
  - Student: read-only (no upload, no new folder, no rename, no delete). Just browse and download.
  - Assessor: keeps current CRUD.
- **API:** `src/app/api/v2/course-documents/route.ts` — GET: add `student`. POST/PUT/DELETE: keep assessor-only.

**2. Personal Documents (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx` — Get `userRole`.
  - Student: shows OWN documents, CAN upload.
  - Assessor: views selected student's documents (current behavior).
- **API:** Add `student` to allowed roles. If student, auto-scope to own docs.

**3. Materials (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/materials/page.tsx` — Both read-only. Ensure API allows student role.
  - Student: no upload, no new folder, just browse.
  - Assessor: has upload/manage (current behavior).
- **API:** Add `student` to GET. Keep POST/PUT/DELETE assessor-only.

**4. Work Hours (role-aware):**
- `src/app/(assessor-dashboard)/c/[slug]/work-hours/page.tsx` — Get `userRole`.
  - Student: records OWN hours (no learner selection modal, auto-set from session).
  - Assessor: records for selected learner (current behavior).
- **API:** Add `student` to CRUD. If student, auto-set learnerId, verify ownership.

**5. Global Search (student scope):**
- `src/app/api/v2/search/route.ts` — Add `student`. If student, scope to own assessments/evidence and course members.

**6. Polish:**
- All empty states match docs
- Floating chat button visible for students
- Sidebar active states correct
- Full end-to-end navigation test

### Files to modify
- `src/app/(assessor-dashboard)/c/[slug]/course-documents/page.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/materials/page.tsx`
- `src/app/(assessor-dashboard)/c/[slug]/work-hours/page.tsx`
- `src/app/api/v2/course-documents/route.ts`
- `src/app/api/v2/personal-documents/route.ts`
- `src/app/api/v2/materials/route.ts`
- `src/app/api/v2/work-hours/route.ts`
- `src/app/api/v2/search/route.ts`

### Verification
1. Student: course-documents (read-only), personal-documents (upload), materials (read-only), work-hours (CRUD own)
2. Global search returns student-scoped results
3. All assessor pages unchanged
4. Full e2e: student logs in → `/c` → course → all 8 pages work
5. `npm run build` passes

---

## Superprompts for Each Phase

> Copy the relevant superprompt into a new Claude Code chat to execute that phase.

---

### SUPERPROMPT — Phase 0: Fix Assessor Route Names

```
## Task: BRITEthink — Phase 0: Fix Assessor Route Names to Match Architecture Doc

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
The BRITEthink assessor dashboard is built at route group `(assessor-dashboard)` serving `/c/{slug}/*`. However, two route directory names deviate from the architecture doc:

| Current Code | Architecture Doc Says | Fix |
|---|---|---|
| `/c/{slug}/assessments` (plural) | `/c/{slug}/assessment` (singular) | Rename directory |
| `/c/{slug}/documents` | `/c/{slug}/course-documents` | Rename directory |

These must be fixed BEFORE adding student support, because the student architecture doc uses the same route names as the assessor doc.

### What to do

#### 1. Rename assessment route directory
- Rename `src/app/(assessor-dashboard)/c/[slug]/assessments/` → `src/app/(assessor-dashboard)/c/[slug]/assessment/`
- This changes the page URL from `/c/{slug}/assessments` to `/c/{slug}/assessment`
- The `page.tsx` inside should remain unchanged (just the directory name changes)

#### 2. Rename documents route directory
- Rename `src/app/(assessor-dashboard)/c/[slug]/documents/` → `src/app/(assessor-dashboard)/c/[slug]/course-documents/`
- This changes the page URL from `/c/{slug}/documents` to `/c/{slug}/course-documents`

#### 3. Update sidebar navigation paths
**File:** `src/components/assessor/AssessorIconSidebar.tsx`
- Find the `navIcons` array
- Change the Assessment item path from `'/assessments'` to `'/assessment'`
- Change the Course Documents item path from `'/documents'` to `'/course-documents'`

#### 4. Update all internal links referencing old paths
Search the entire codebase for references to `/assessments` and `/documents` that are page route links (not API routes — API routes at `/api/v2/assessments/` stay unchanged).

Key files to check:
- **Home page:** `src/app/(assessor-dashboard)/c/[slug]/page.tsx` — the "View all" arrow buttons link to assessments and documents pages
- **Search results:** `src/components/assessor/SearchResults.tsx` — may link to assessment detail pages
- **Any component** that uses `Link` or `router.push` with these paths
- **Assessment detail panel** — check if it constructs URLs with `/assessments/`

**Important:** API routes (`/api/v2/assessments/`, `/api/v2/course-documents/`) must NOT be renamed. Only page route directories change.

#### 5. Verify the API route for course documents
Check if the API route is at `/api/v2/course-documents/` or `/api/v2/documents/`. The API should stay at whatever path it currently uses — we're only renaming page routes, not API routes.

### Patterns to follow
- Mongoose models: `mongoose.models.X || mongoose.model()` guard
- Path alias: `@/*` → `./src/*`

### Test credentials
- Assessor: `assessor@test.com` / `Password123!`
- Student: `student@test.com` / `Password123!`

### Verification checklist
1. `npm run build` passes with zero errors
2. Log in as assessor → navigate to `/c/{slug}/assessment` → assessment list works (was `/assessments`)
3. Click an assessment → detail panel opens at `/c/{slug}/assessment/{id}`
4. Navigate to `/c/{slug}/course-documents` → course documents page works (was `/documents`)
5. Home page "View all" arrows link to new paths
6. Sidebar highlights correctly on the new paths
7. Search results link to correct assessment URLs
8. Old URLs `/c/{slug}/assessments` and `/c/{slug}/documents` should 404 (confirm they don't silently resolve)
9. All API routes still work (no changes to `/api/v2/*`)
```

---

### SUPERPROMPT — Phase 1: Foundation & Layout Adaptation

```
## Task: BRITEthink Student Dashboard — Phase 1: Foundation & Layout Adaptation

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
The BRITEthink dashboard at route group `(assessor-dashboard)` serves `/c/{slug}/*`. In a previous phase, the assessor routes were fixed to match the architecture doc (`/assessment` singular, `/course-documents`). Now we need to make the dashboard **role-aware** so students can also use `/c/{slug}/*` with their own data.

Both assessors and students share the **same sidebar navigation** (same 8 items, same paths). The differences are purely behavioral — assessors manage learners' data, students see/manage their own.

### What to do in this phase

**Goal:** A student can log in, get redirected to `/c`, see their enrolled courses, click into one, and see the correct header + sidebar + sub-header — but page content will be built in later phases.

#### 1. Auth redirect
**File:** `src/lib/auth.config.ts`
- In the `authorized` callback, redirect logged-in students to `/c` (currently only assessors go to `/c`, students go to `/dashboard`).

#### 2. Layout role gate
**File:** `src/app/(assessor-dashboard)/layout.tsx`
- Currently: rejects anyone whose role is not `'assessor'`.
- Change: accept both `'assessor'` and `'student'` roles.
- Pass `userRole` as a prop to `AssessorDashboardShell`.

#### 3. Course-level layout
**File:** `src/app/(assessor-dashboard)/c/[slug]/layout.tsx`
- Currently: rejects non-assessors, fetches enrollments where `assessorId === session.user.id`.
- Change: accept `'student'` too.
- If role is `'student'`: fetch `Enrolment.find({ userId: user.id, qualificationId: qualification._id })` — student's own enrollment(s).
- If role is `'assessor'`: keep existing logic.
- Pass `userRole` to `AssessorCourseProvider`.

#### 4. Context
**File:** `src/contexts/AssessorCourseContext.tsx`
- Add `userRole: UserRole` to `AssessorCourseContextType` interface.
- Add `userRole` to `ProviderProps`.
- Pass through context value.
- Import `UserRole` from `@/types`.

#### 5. Shell component
**File:** `src/components/assessor/AssessorDashboardShell.tsx`
- Accept `userRole` prop (default `'assessor'`).
- Forward `userRole` to `AssessorTopNav` and `AssessorIconSidebar`.

#### 6. Top navigation
**File:** `src/components/assessor/AssessorTopNav.tsx`
- Accept `userRole` prop.
- In avatar dropdown: show "Learner" when `userRole === 'student'`, "Assessor" when assessor.

#### 7. Sub-header
**File:** `src/components/assessor/AssessorSubHeader.tsx`
- Get `userRole` from context.
- If student: hide learner dropdown, just show qualification title.
- If assessor: keep current learner dropdown.

#### 8. Sidebar
**File:** `src/components/assessor/AssessorIconSidebar.tsx`
- The sidebar paths are already correct for both roles (same 8 items). No path changes needed.
- BUT: accept `userRole` prop and pass it through for future per-role conditional rendering (e.g., hiding "Members" arrow on some pages).

#### 9. Course selector
**File:** `src/app/(assessor-dashboard)/c/page.tsx`
- Make role-aware. This page is OUTSIDE `/c/[slug]` so no course context. Get role from session (`useSession`) or pass from layout.
- Student: fetch from `/api/v2/student/courses`.
- Assessor: keep current `/api/v2/assessor/courses`.

#### 10. New API
**Create:** `src/app/api/v2/student/courses/route.ts`
- GET handler. Auth: `withAuth(['student'])`.
- Query: `Enrolment.find({ userId: session.user.id }).populate('qualificationId')`.
- Deduplicate by qualificationId.
- Return: `Array<{ _id, title, slug, code, level }>` — same shape as assessor courses endpoint.

### Patterns to follow
- Mongoose models: `mongoose.models.X || mongoose.model()` guard
- API auth: `const { session, error } = await withAuth(['student']); if (error) return error;`
- Path alias: `@/*` → `./src/*`
- Components: `'use client'` directive, Tailwind CSS 4

### Test credentials
- Assessor: `assessor@test.com` / `Password123!`
- Student: `student@test.com` / `Password123!`

### Verification checklist
1. `npm run build` passes
2. Assessor: log in → `/c` → select course → everything works as before
3. Student: log in → redirected to `/c` → sees enrolled courses
4. Student: click course → `/c/{slug}` → sees sidebar with all 8 nav items, correct header
5. Student sub-header: course name only, NO learner dropdown
6. Student avatar dropdown: shows "Learner" role label
```

---

### SUPERPROMPT — Phase 2: Home + Progress + Members

```
## Task: BRITEthink Student Dashboard — Phase 2: Home + Progress + Members

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
Phase 0 fixed route names (`/assessment` singular, `/course-documents`). Phase 1 made the dashboard role-aware — both assessors and students access `/c/{slug}/*`. Layout, sidebar, header, sub-header, and context all adapt based on `userRole` (from `useAssessorCourse().userRole`).

### What to do in this phase

**Goal:** Student home page shows course overview with members, recent assessments/evidence/materials. Progress page shows their own learning progress.

#### 1. Home page (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/page.tsx`
- Get `userRole` and `currentEnrollmentId` from `useAssessorCourse()`.
- If student: fetch from `/api/v2/dashboard/student/{enrollmentId}`.
- If assessor: keep current `/api/v2/dashboard/assessor/{qualificationId}`.
- Response shape should match `AssessorHomeDashboard` type so `HomeLearnerCard` and `HomeRecentCard` components work for both.

#### 2. Student dashboard API
**Create:** `src/app/api/v2/dashboard/student/[enrollmentId]/route.ts`
- Auth: `withAuth(['student'])`
- Verify enrollment belongs to `session.user.id`
- Return `AssessorHomeDashboard` shape:
  - `assessors`: student's assessor(s)
  - `learners`: fellow learners in same qualification
  - `recentAssessments`: latest 5 where `learnerId === student.id`
  - `recentEvidence`: latest 5 evidence for this enrollment
  - `recentMaterials`: latest 5 materials for this qualification

#### 3. Progress page (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/progress/page.tsx`
- Get `userRole`. Student: always uses own enrollment, no learner selection UI. Assessor: keeps current behavior.

#### 4. Progress API update
**File:** `src/app/api/v2/progress/[enrollmentId]/route.ts`
- Change to `withAuth(['assessor', 'student'])`. If student, verify enrollment ownership.

### Key files to reference
- Home: `src/app/(assessor-dashboard)/c/[slug]/page.tsx`
- Home components: `src/components/assessor/HomeLearnerCard.tsx`, `HomeRecentCard.tsx`
- Progress: `src/app/(assessor-dashboard)/c/[slug]/progress/page.tsx`
- Assessor dashboard API: `src/app/api/v2/dashboard/assessor/[qualificationId]/route.ts` (reference for response shape)
- Types: `src/types/index.ts` (AssessorHomeDashboard, ProgressUnit, etc.)

### Test credentials
- Student: `student@test.com` / `Password123!`
- Assessor: `assessor@test.com` / `Password123!`

### Verification
1. `npm run build` passes
2. Student at `/c/{slug}` sees home with members, recent assessments/evidence/materials
3. Student at `/c/{slug}/progress` sees own progress
4. Assessor home and progress unchanged
```

---

### SUPERPROMPT — Phase 3: Assessments (Role-Aware)

```
## Task: BRITEthink Student Dashboard — Phase 3: Assessments (Role-Aware)

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
Phases 0-2 are complete. Route names fixed. Dashboard is role-aware. Home + progress work for students. Now the most complex part: the assessment page at `/c/{slug}/assessment` must serve both roles.

- **Assessor:** Full CRUD. Create button, edit fields, auto-save, delete, publish, manage criteria/evidence, sign-off, remarks.
- **Student:** Read-only list + read-only detail. NO create, NO edit, NO delete. CAN sign off as "learner". CAN add remarks.

### What to do

#### 1. Assessment list page (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/assessment/page.tsx`
- Get `userRole` from `useAssessorCourse()`.
- If student:
  - Fetch from `/api/v2/student/assessments?enrollmentId={id}` (new API)
  - Hide "+ Create Assessment" button
  - Cards are clickable (open detail) but not editable
- If assessor: keep current behavior

#### 2. Assessment detail panel (role-aware)
The detail panel at `src/components/assessor/assessment-detail/AssessmentDetailPanel.tsx` currently has full edit capability. For students, it should be read-only except for sign-off and remarks.

**Two approaches (pick the cleaner one):**

**Option A — Add `readOnly` prop to existing panel + sub-components:**
- `AssessmentDetailPanel`: accept `readOnly` boolean, pass down to sub-components
- `DetailHeader`: readOnly → title not editable, date not clickable, no delete button, no publish/draft toggle, no auto-save
- `AssessmentKindSelector`: readOnly → show selected kind highlighted, not clickable
- `PlanSection`: readOnly → display text, not editable textarea
- `EvidenceMappingSection`: readOnly → no add/remove buttons. Upload button shows but disabled with tooltip "You don't have permission to upload evidence for this assessment"
- `CriteriaMappingSection`: readOnly → no "Edit Mapping" button, show mapped criteria display-only
- `SignOffStatusSection`: Student CAN sign off as "learner". If readOnly and role is student, only the learner sign-off button is active.
- `RemarksSection`: Student CAN add remarks. Keep interactive for both roles.

**Option B — Create separate StudentAssessmentDetailPanel:**
- New component that reuses sub-components with readOnly props
- More isolated but more code duplication

Option A is preferred for maintainability.

#### 3. Student assessments API
**Create:** `src/app/api/v2/student/assessments/route.ts`
- GET. Auth: `withAuth(['student'])`.
- Query param: `enrollmentId` (required).
- Verify enrollment belongs to student.
- Query: `Assessment.find({ enrollmentId, learnerId: session.user.id })` with same population as assessor list endpoint (populate learnerId, enrollmentId, get criteria count, sign-off summaries).
- Return `AssessmentListItem[]`.

#### 4. API updates for student access
**`src/app/api/v2/assessments/[id]/route.ts` (GET):**
- Change to `withAuth(['assessor', 'student'])`.
- If student, verify `assessment.learnerId` matches `session.user.id`.

**`src/app/api/v2/assessments/[id]/sign-off/route.ts` (POST):**
- Add `student` to allowed roles.
- If student, only allow `{ role: 'learner' }`. Return 403 for other roles.

**`src/app/api/v2/assessments/[id]/remarks/route.ts` (POST):**
- Add `student`. Verify student is the learner on this assessment.

### Key files to reference
- Assessment list: `src/app/(assessor-dashboard)/c/[slug]/assessment/page.tsx`
- Detail panel: `src/components/assessor/assessment-detail/AssessmentDetailPanel.tsx`
- Sub-components in `src/components/assessor/assessment-detail/`: DetailHeader, AssessmentKindSelector, PlanSection, EvidenceMappingSection, CriteriaMappingSection, SignOffStatusSection, RemarksSection
- Assessment card: `src/components/assessor/AssessmentCard.tsx`
- Utils: `src/lib/assessment-utils.ts` (TYPE_CONFIG, groupByTimePeriod, formatAssessmentDate)
- Types: `src/types/index.ts` (AssessmentListItem, FullAssessmentDetail, SignOffEntry, RemarkEntry)

### Design notes from student architecture doc
- Assessment type badges: PD (blue/teal), RA (purple), WP (amber), WA (blue darker), VA (blue lighter), O (gray), WT (gray)
- Criteria dots: green = mapped, gray = not mapped
- Sign-off order: 1. Assessor, 2. IQA, 3. EQA, 4. Learner
- Learner sign-off card: purple/violet border highlight when signed
- Upload Evidence button: disabled with tooltip "You don't have permission to upload evidence for this assessment"
- Chronological grouping: LAST MONTH, LAST 6 MONTHS, then by MONTH YEAR
- Cards show "Evidence: 🔗 N" and "Remarks: 💬 N" only if count > 0

### Test credentials
- Student: `student@test.com` / `Password123!`
- Assessor: `assessor@test.com` / `Password123!`

### Verification
1. `npm run build` passes
2. Student at `/c/{slug}/assessment`: sees assessments grouped by time, NO create button
3. Student clicks assessment → detail panel with read-only fields (title, date, kind, plan, criteria, evidence)
4. Student can sign off as "learner" → status updates
5. Student can add remarks → appears in thread
6. Student CANNOT: edit title, change date, select kind, manage criteria/evidence, delete, toggle publish
7. Assessor at same URL: full CRUD still works
```

---

### SUPERPROMPT — Phase 4: Portfolio + Evidence

```
## Task: BRITEthink Student Dashboard — Phase 4: Portfolio + Evidence

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
Phases 0-3 complete. Dashboard is role-aware. Home, progress, and assessments all work for students. Now: portfolio/evidence page at `/c/{slug}/portfolio`.

Both roles share this page. Assessor: manages learner evidence. Student: views and uploads own evidence.

### What to do

#### 1. Portfolio page (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/portfolio/page.tsx`
- Get `userRole` from `useAssessorCourse()`.
- Student: uses own `currentEnrollmentId`, shows "Upload Evidence" button (CAN upload), fetches from same `/api/v2/portfolio/{enrollmentId}`.
- Assessor: keeps current behavior.
- Toolbar, grid/list views, filters work for both.

#### 2. Portfolio API update
**File:** `src/app/api/v2/portfolio/[enrollmentId]/route.ts`
- GET: `withAuth(['assessor', 'student'])`. If student, verify `enrollment.userId === session.user.id`.

#### 3. Evidence upload API update
Find the evidence upload API (likely `src/app/api/v2/evidence/upload/route.ts` or within portfolio routes).
- Add `student` to allowed roles.
- If student: auto-set `learnerId` from session. Verify enrollment ownership.

### Key files to reference
- Portfolio page: `src/app/(assessor-dashboard)/c/[slug]/portfolio/page.tsx`
- Portfolio toolbar: `src/components/assessor/PortfolioToolbar.tsx`
- Evidence card: `src/components/assessor/EvidenceCard.tsx`
- Evidence upload modal: search `src/components/assessor/` for upload components
- Upload utility: `src/lib/upload.ts`
- Types: `src/types/index.ts` (PortfolioEvidence, EvidenceStatus)

### Design notes from student doc
- Toolbar: "Select an evidence item to perform actions" + "Upload Evidence" button + "All Status" + "All Files" + "Date Sort" + Grid/List toggles
- Evidence grouped by time: "Last Month", "Last 6 Months", "August 2025", etc.
- File card: type icon, file name, size, relative date, viewer (eye + avatar), uploader (download + avatar)

### Test credentials
- Student: `student@test.com` / `Password123!`
- Assessor: `assessor@test.com` / `Password123!`

### Verification
1. `npm run build` passes
2. Student at `/c/{slug}/portfolio`: sees own evidence, can filter/sort/toggle views
3. Student clicks "Upload Evidence" → modal → uploads file → appears in list
4. Assessor portfolio unchanged
```

---

### SUPERPROMPT — Phase 5: Documents + Materials + Work Hours + Search + Polish

```
## Task: BRITEthink Student Dashboard — Phase 5: Documents, Materials, Work Hours, Search & Polish

You are working on the NCFE LMS project at `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MongoDB/Mongoose 9, NextAuth v5 (JWT).

### Background
Phases 0-4 complete. Route names fixed, dashboard role-aware, home/progress/assessments/portfolio all work for students. This final phase makes the remaining 4 shared pages role-aware and adds search + polish.

### What to do

#### 1. Course Documents (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/course-documents/page.tsx`
- Get `userRole`. Student: **read-only** (no upload, no new folder, no rename, no delete). Assessor: keeps current CRUD.
- Hide action buttons for students. File browsing/downloading works for both.
- **API:** `src/app/api/v2/course-documents/route.ts` — GET: add `student` to `withAuth`. POST/PUT/DELETE: keep `assessor` only.

#### 2. Personal Documents (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx`
- Get `userRole`. Student: shows OWN docs, CAN upload ("Upload Files" button). Assessor: views selected student's docs (current behavior).
- **API:** Add `student` to allowed roles. If student, auto-scope to own documents for GET, auto-set userId for POST.

#### 3. Materials (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/materials/page.tsx`
- Student: **read-only** (no upload, no new folder). Assessor: keeps current management capabilities.
- **API:** Add `student` to GET. Keep POST/PUT/DELETE assessor-only.

#### 4. Work Hours (role-aware)
**File:** `src/app/(assessor-dashboard)/c/[slug]/work-hours/page.tsx`
- Get `userRole`.
- Student: records OWN hours. "+ New" button creates entry for self (no learner selection modal — skip straight to form). Uses own `enrollmentId`.
- Assessor: records for selected learner (current behavior — learner modal first).
- **API:** `src/app/api/v2/work-hours/route.ts` — Add `student` to CRUD. If student: auto-set learnerId/enrollmentId from session/context, verify ownership for PUT/DELETE.

#### 5. Global Search (student scope)
**File:** `src/app/api/v2/search/route.ts`
- Add `student` to `withAuth(['assessor', 'student'])`.
- If student: scope results to own assessments, own evidence, and course members for their qualification.
- `AssessorTopNav` already calls this API — should work once API is role-aware.

#### 6. Polish & consistency
- Verify ALL empty states match both docs' patterns:
  - Course Docs: "No course documents found" + "No course documents are available for this course yet."
  - Personal Docs: "No personal documents found" + "No personal documents are available yet."
  - Work Hours: "No time logs for this date"
  - Portfolio: "No evidence found" + "No evidence has been uploaded yet."
  - Materials: "No materials found" + "No materials have been uploaded to this course yet."
- Floating chat button visible for students (already in shell)
- Sidebar active states correct for all pages
- Full navigation test across all 8 pages for student
- No broken links or 404s

### Key files to reference
- Course docs page: `src/app/(assessor-dashboard)/c/[slug]/course-documents/page.tsx`
- File components: `src/components/assessor/FileGrid.tsx`, `FileCard.tsx`, `FileListView.tsx`, `FileBreadcrumbs.tsx`, `FileManagerToolbar.tsx`
- Personal docs: `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx`
- Materials: `src/app/(assessor-dashboard)/c/[slug]/materials/page.tsx`
- Work hours: `src/app/(assessor-dashboard)/c/[slug]/work-hours/page.tsx`
- Work hours components: `src/components/assessor/WorkHourEntry.tsx`, `DayNavigator.tsx`, `WorkHourEntryForm.tsx`
- Search API: `src/app/api/v2/search/route.ts`
- All relevant API routes in `src/app/api/v2/`

### Design notes from student doc
- Course Documents: No upload. "Select a file to see actions" + "All Files" + Grid/List.
- Personal Documents: HAS "Upload Files" button. Empty: "No personal documents found".
- Materials: No upload. Folders + files.
- Work Hours: "+ New" button + date navigation (< Previous Day | date | Next Day >). Empty: "No time logs for this date".

### Test credentials
- Student: `student@test.com` / `Password123!`
- Assessor: `assessor@test.com` / `Password123!`

### Verification
1. `npm run build` passes
2. Student: `/c/{slug}/course-documents` — browse files (read-only)
3. Student: `/c/{slug}/personal-documents` — view + upload own docs
4. Student: `/c/{slug}/materials` — browse materials (read-only)
5. Student: `/c/{slug}/work-hours` — create/edit/delete own entries
6. Global search works for student scope
7. All assessor pages unchanged
8. **Full e2e:** student logs in → `/c` → select course → navigate ALL 8 sidebar pages → everything works
9. Empty states display correctly on all pages
10. Sidebar active states correct for all routes
```

---

## Summary

| Phase | Focus | Key Work |
|-------|-------|----------|
| **0** | Fix assessor routes | Rename `/assessments` → `/assessment`, `/documents` → `/course-documents`, update all links |
| **1** | Foundation | Auth redirect, layout/context/shell role-aware, student course API, course selector |
| **2** | Home + Progress | Home page role-aware, student dashboard API, progress page + API |
| **3** | Assessments | List page role-aware, detail panel readOnly mode, student assessments API, sign-off + remarks for student |
| **4** | Portfolio | Portfolio page role-aware, evidence upload for students |
| **5** | Remaining + Polish | Course docs, personal docs, materials, work hours — all role-aware. Search. Polish. |
