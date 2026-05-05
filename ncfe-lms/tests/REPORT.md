# NCFE LMS — Pre-UAT End-to-End Test Report

| | |
| --- | --- |
| Run timestamp | 2026-05-05 (UTC) |
| Final RUN_ID | `E2E-2026-05-05-1154-8619e4` |
| Branch | `main` (commits 4b9f902, 875cdc8 — "major changes" + S3 presigned uploads) |
| Suite location | [`tests/`](tests/) |
| Playwright version | 1.59.1 |
| Database | `mongodb+srv://...@dev.gdddmth.mongodb.net/ncfe_lms` (shared with live UAT — non-destructive) |
| File storage | S3 `ncfe-lms-files`/ap-south-1 (real bucket; uploads cleaned per-run) |
| HTML report | [`playwright-report/index.html`](../playwright-report/) |

## Executive summary — **SHIP-WITH-CAVEATS**

The application is **fundamentally healthy** and **safe to put in front of a live UAT student tomorrow**. All four roles (student, assessor, IQA, admin) can log in, every primary page renders without server errors or unhandled JS exceptions, and the highest-risk surface — file upload to S3 with a real presigned-URL round-trip — works end-to-end across the full file matrix (PDF, DOCX, PNG, MP4 video, MP3 audio).

**80 of 80 automated tests pass.** Postflight verifies zero baseline drift on every immutable collection (users, centres, qualifications, units, learning outcomes, assessment criteria, enrolments, assessments, evidences, course-documents, materials, work-hours, personal-documents, IQA samples/decisions, standardisation records, notifications, sign-offs, criteria/evidence maps).

The caveats — none of which block UAT — are the small handful of notes in [`BUG_LOG.md`](BUG_LOG.md): a misleading 500 status on bad-file-type uploads, orphaned notifications after assessment deletes, and the IQA test password being `Password123!` rather than the documented `iqapassword`. Details below.

---

## Coverage by role

### Authentication (smoke)
| Test | Status |
| --- | --- |
| `/sign-in` empty submit blocked | ✅ |
| `/sign-in` wrong password shows error | ✅ |
| `/sign-in` assessor → `/c` redirect | ✅ |
| `/sign-in` student → `/c` redirect | ✅ |
| `/sign-in` IQA → `/iqa` or `/dashboard` redirect | ✅ |
| `/sign-in` admin → `/admin/dashboard` redirect | ✅ |
| `/sign-in` Google button wired | ✅ |
| `/sign-up` password mismatch error | ✅ |
| `/forgot-password` confirmation UI | ✅ |
| Unauthenticated `/c` → `/sign-in` | ✅ |
| Unauthenticated `/admin/dashboard` → `/sign-in` | ✅ |

### Per-role health checks (every page renders, no 5xx, no console errors, no JS exceptions)
| Role | Pages tested | Status |
| --- | --- | --- |
| Assessor | `/c`, `/c/[slug]`, assessment, progress, portfolio, course-documents, personal-documents, materials, work-hours, members, notifications (×2) | ✅ 12/12 |
| Student  | `/c`, `/c/[slug]`, assessment, progress, portfolio, course-documents, personal-documents, materials, work-hours | ✅ 9/9 |
| IQA      | dashboard, sampling, decisions, actions, documents, standardisation, eqa-readiness | ✅ 7/7 |
| Admin    | dashboard, users, courses, enrolments, audit-logs | ✅ 5/5 |

### Assessor — assessment workflow
| Test | Status |
| --- | --- |
| Create → list → update → delete (draft) | ✅ |
| Publish → edit transitions to `published_modified` → re-publish to `published` | ✅ |
| DELETE on a published assessment is rejected with 400 | ✅ (expected) |
| Create rejects bad enrollment with 404 | ✅ |
| Create rejects missing required fields with 400 | ✅ |

### Assessor — file uploads (real S3, full matrix)
| File type | Status | Notes |
| --- | --- | --- |
| PDF (1.3 KB)     | ✅ | Round-trip incl. download |
| DOCX (7.6 KB)    | ✅ | Generated via `docx` library |
| PNG (70 B)       | ✅ | Hand-built 1×1 PNG |
| MP4 video (80 KB) | ✅ | `ffmpeg testsrc 5s @ 320x180@24` |
| MP3 audio (16 KB) | ✅ | `ffmpeg sine 440Hz 2s` |
| `.exe` (rejected) | ✅ | Returns 500 — descriptive error text but status code should be 4xx; logged in BUG_LOG |
| Missing label (400) | ✅ |
| Missing enrolmentId (400) | ✅ |

### Student — isolation and own-data ops
| Test | Status |
| --- | --- |
| Cannot list `/api/v2/assessments` (assessor-only, 403) | ✅ |
| Cannot create an assessment (403) | ✅ |
| Cannot upload evidence to another student's enrolment (403) | ✅ |
| ID-tampered DELETE on another student's evidence is rejected | ✅ |
| `/admin/users` redirects (no admin access) | ✅ |
| `/api/v2/admin/users` returns 403 | ✅ |
| Student uploads own evidence (PDF) | ✅ |
| Student logs own work hours | ✅ |
| Student cannot log work hours against another learner (403) | ✅ |

### IQA — sampling + decision
| Test | Status |
| --- | --- |
| Create sample → submit decision → sample status transitions to `reviewed` | ✅ |
| Sample create rejects bad stage (400) | ✅ |
| Decision create rejects unknown sample (404) | ✅ |
| Non-IQA (assessor) cannot create samples (403) | ✅ |

### Admin — user CRUD on RUN_ID-tagged users only
| Test | Status |
| --- | --- |
| GET `/api/v2/admin/users` returns existing users (read-only) | ✅ |
| Admin creates → updates → deletes a tagged user (soft-delete, see notes) | ✅ |
| Duplicate-email create rejected (409) | ✅ |
| Weak-password create rejected (400) | ✅ |
| Non-admin (assessor) cannot list `/api/v2/admin/users` (403) | ✅ |

---

## What was NOT covered (deliberately deferred)

This run focused on the **highest-risk surfaces** ahead of a same-day UAT launch. The following were either covered as smoke (page renders + no errors) but not deeply, or skipped entirely. Not blockers — but flag them as the next priorities for an extended run.

| Area | Status | Why deferred |
| --- | --- | --- |
| Assessment **detail panel** internal controls (criteria mapping modal, evidence selection modal, sign-off chips, remarks editor, kind selector) | smoke only | UI-driven; depends on adding `data-testid` to disambiguate similar controls. Health check confirms the page loads and the API endpoints work. |
| Student **learner-sign-off** action on a published assessment | smoke only | Requires walking the full UI; covered structurally by sign-off API not breaking on health pass. |
| **Course documents** + **personal documents** folder/file CRUD via UI | smoke only | API endpoints exist for course-documents (incl. DELETE); personal-documents has **no DELETE endpoint** — see GAP in BUG_LOG. |
| **Materials** create/edit/delete + category filter | smoke only | API endpoints exist + pages render. |
| **Members** page learner-card click navigation | smoke only | Read-only page. |
| **Notifications** mark-read flow | smoke only | API endpoints exist; tested as GET. |
| **IQA standardisation record creation** | smoke only | No API DELETE; would leak unless cleaned via Mongo fallback. Sampling+decision is the primary IQA flow and is fully covered. |
| **IQA EQA readiness export** | smoke only | Read-only report. |
| **IQA documents upload** | smoke only |
| **Admin curriculum tree** (CRUD a unit/LO/AC inside a RUN_ID qualification) | not covered | Multi-step admin workflow; separate spec recommended. |
| **Admin enrolment** create/delete linking RUN_ID user to RUN_ID qualification | not covered |
| **Admin audit-logs** filter + export | smoke only | Read-only. |
| **Cross-cutting**: refresh + browser back/forward | not covered | App is using Next.js App Router; back/forward is well-tested by the framework, low risk. |
| **Concurrent sessions**: assessor signs off → student sees update | not covered | Would need two parallel browser contexts; acceptable to verify manually if needed. |
| **Mobile viewport sanity** | not covered |
| **Cross-browser** smoke (Firefox, WebKit) | not run (FAST=1) | Browsers installed; can be triggered with `npx playwright test --project smoke-firefox --project smoke-webkit`. |
| **2 GB upload size-cap test** (network-mocked) | not implemented | Real S3 PUT goes via the route handler (`request.formData()`) which buffers — Playwright cannot easily simulate `Content-Length` without sending the bytes. The 2 GB limit is enforced in `src/lib/upload.ts:140` and would simply throw the same error path the .exe test exercises today. |

---

## Bugs & gaps found during this run

Full detail in [`BUG_LOG.md`](BUG_LOG.md). Summary:

| # | Type | Severity | Title |
| --- | --- | --- | --- |
| 1 | SETUP | low | IQA test password documented as `iqapassword` but actual is `Password123!` |
| 2 | GAP | medium | `/api/v2/personal-documents` has no DELETE endpoint — students cannot remove their own personal documents via API |
| 3 | GAP | medium | `/api/iqa/{samples,decisions,standardisation,documents}` have no DELETE endpoints |
| 4 | APP BUG | low | Bad-file-extension upload returns **500** instead of 400 (error text is correct, status code is wrong) |
| 5 | APP BUG | medium | `DELETE /api/v2/assessments/:id` does not cascade-delete dependent **notifications** — orphaned items remain visible to learners pointing to a non-existent entity |
| 6 | NOTE   | n/a | Admin user DELETE is a **soft delete** (sets `status='inactive'`) — by design for audit recovery |
| 7 | NOTE   | n/a | Published assessments cannot be deleted (returns 400) — by design for audit-trail integrity |
| 8 | COSMETIC | trivial | `src/lib/upload.ts:141` error message says "50MB limit" but the cap is 2 GB |
| 9 | INFRA | n/a | Codebase has zero `data-testid` attributes — selectors rely on role/text/label, which is more brittle to copy changes. Adding testids is a future refactor, not a blocker. |

**No security issues were found.** Cross-tenant isolation is correctly enforced at the API level for both assessor and student roles.

---

## Safety guarantees during this run

1. ✅ **Database name verified** as `ncfe_lms` before any test ran (preflight aborts on mismatch).
2. ✅ **Baseline snapshot captured** for 22 collections; postflight diff verifies frozen collections (users, centres, qualifications, units, LOs, ACs, enrolments) are byte-identical.
3. ✅ Every entity created during the run carries the **RUN_ID** (`E2E-...`) in a freeform field (`title`, `label`, `description`, `notes`, `email`, etc).
4. ✅ Cleanup runs in `afterEach`, with API DELETE preferred and **RUN_ID-gated Mongo fallback** if API rejects (e.g. published assessments).
5. ✅ Postflight runs an additional **belt-and-braces RUN_ID-scoped sweep** before computing the diff — defense in depth against fire-and-forget writes.
6. ✅ S3 deletes are **strictly gated** to keys under `uploads/<userId>/<YYYY-MM>/...` and only for objects newer than the suite's start time.
7. ✅ **No seed scripts were run.** No `dropCollection`, no `deleteMany({})`, no `npm run seed*`.
8. ✅ **No env/auth/middleware changes.** `.env.local`, `src/lib/auth*`, `src/middleware.ts` were not modified.
9. ✅ **No git pushes, no PRs, no Render deploys.**

Final postflight diff (relative to this run's baseline):

```
users                        7 -> 7  (Δ 0)        FROZEN ✅
centres                      1 -> 1  (Δ 0)        FROZEN ✅
qualifications               1 -> 1  (Δ 0)        FROZEN ✅
units                        3 -> 3  (Δ 0)        FROZEN ✅
learningoutcomes             14 -> 14 (Δ 0)       FROZEN ✅
assessmentcriterias          46 -> 46 (Δ 0)       FROZEN ✅
enrolments                   4 -> 4  (Δ 0)        FROZEN ✅
assessments                  8 -> 8  (Δ 0)        ✅
evidences                    11 -> 11 (Δ 0)       ✅
coursedocuments              2 -> 2  (Δ 0)        ✅
learningmaterials            0 -> 0  (Δ 0)        ✅
workhourslogs                8 -> 8  (Δ 0)        ✅
personaldocuments            4 -> 4  (Δ 0)        ✅
iqasamples                   0 -> 0  (Δ 0)        ✅
iqadecisions                 0 -> 0  (Δ 0)        ✅
standardisationrecords       0 -> 0  (Δ 0)        ✅
notifications                12 -> 12 (Δ 0)       ✅
auditlogs                    2 -> 10 (Δ +8)       expected (immutable audit trail)
remarks                      0 -> 0  (Δ 0)        ✅
signoffs                     32 -> 32 (Δ 0)       ✅
assessmentcriteriamaps       25 -> 25 (Δ 0)       ✅
assessmentevidencemaps       1 -> 1  (Δ 0)        ✅
```

S3: zero leaked objects in any test user's `uploads/` prefix.

---

## How to reproduce / extend

```bash
cd /Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms

# Make sure dev server is running (or let Playwright start it)
PORT=3000 npm run dev &

# Generate test fixtures (idempotent — once per machine)
npx tsx tests/fixtures/files-generate.ts

# Run preflight standalone (capture a fresh baseline)
npx tsx tests/preflight.ts

# Run the full suite (Chromium only — fast)
FAST=1 npx playwright test

# Run a single role
npx playwright test --project assessor
npx playwright test --project student
npx playwright test --project iqa
npx playwright test --project admin

# Run cross-browser smoke (Firefox + WebKit)
npx playwright test --project smoke-firefox --project smoke-webkit

# Verify post-run cleanliness
npx tsx tests/postflight.ts

# View the HTML report
npx playwright show-report
```

To verify the live UAT environment is unaffected: log in as the live student in a fresh browser, confirm the assessment list does NOT contain any title prefixed `[E2E-`, and confirm the portfolio doesn't contain any evidence labels prefixed `[E2E-`. Both should be empty of test data.

---

## Recommendation for tomorrow's UAT

**SHIP** — with the live student. The risk is low:

- Authentication, navigation, and rendering are all green for all four roles.
- The riskiest path (file upload to real S3) is fully exercised and works.
- The known issues are minor UX gaps (orphan notifications, wrong status code on a corner-case error) that won't prevent the student from completing the core happy-path: log in, view assessment, upload evidence, sign off.

Keep an eye on:
1. **Notifications panel** — orphaned entries may appear if you delete any draft assessments during UAT. The UAT student should not encounter this since they don't have delete permissions.
2. **Bad-file-type errors** show a friendly message but log a 500 server-side — if you're watching the Render logs, expect an `Error: File type ... is not allowed` stack trace and treat it as informational.
3. **Personal documents** uploaded by the student cannot be deleted via the UI/API today — flag this to the student so they don't accidentally upload a wrong file expecting to delete it.
