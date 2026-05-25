# NCFE LMS — Remaining Gap Resolution + G5 Rollback + Production Verification

You are doing the next phase of the UX/backend quality pass on the NCFE LMS Next.js app deployed at `https://ncfe-lms.onrender.com`. The previous run (see `tests/UI_GAPS_REPORT.md` and the latest SHIP commit `db1b274`+) deployed 10 gaps successfully but **inadvertently implemented G5 (force-change-password-on-first-login) which the user has explicitly rejected**. This run rolls G5 back and addresses the 12 still-open gaps.

Repo root: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Render auto-deploys on push to `main`. Same non-destructive rules as before: production database is shared, `RUN_ID` tag every test entity, James Bond demo user (`7777jamesbond7777@gmail.com`) and his enrolment must NEVER be touched.

Read first:
- `tests/UI_GAPS_REPORT.md` (what just deployed, including the G5 implementation that needs rollback)
- `tests/PROD_REPORT.md` (the 39 prod tests still in scope as regression baseline)
- `docs/USER_GUIDE.md` (already exists, will be updated incrementally — do not regenerate from scratch)

Total wall-clock budget: 8–11 hours unattended.

---

## Phase 0 — G5 ROLLBACK (do this FIRST, before anything else, ~45 min)

The user's directive is explicit: **admin generates a password, sends it to the student, the student keeps that password forever until admin resets it again.** No force-change-on-first-login. No self-service password reset. No self-service password change anywhere.

The previous run implemented G5 ("force-change-on-first-login + middleware redirect + change-password page + endpoint"). Roll it ALL back in a single dedicated commit.

### What to remove

1. **Middleware redirect logic.** Find any code in `src/middleware.ts` (or in route layouts / page wrappers) that redirects logged-in users with `mustChangePassword === true` to `/profile/change-password`. Remove the redirect. Test that signing in with any user goes straight to their normal home.
2. **The `/profile/change-password` page.** Delete the file (likely `src/app/(dashboard)/profile/change-password/page.tsx` or similar). Delete any imports / routes referencing it.
3. **The change-password API endpoint.** Delete the route file (likely `src/app/api/v2/users/me/change-password/route.ts` or similar). Remove any helper functions added for it that aren't used elsewhere.
4. **Setting `mustChangePassword: true` in user creation and password reset.** Find the lines in `src/app/api/v2/admin/users/route.ts` (POST handler) and `src/app/api/v2/admin/users/[id]/reset-password/route.ts` (POST handler) where this field is set, and remove them.
5. **Any UI surfaces that reference the field.** Profile page may have a "you must change your password" banner — remove. Admin user list may have a "first-login pending" badge — remove.
6. **The `mustChangePassword` field on the User model.** Remove the field from `src/models/User.ts` (it's safe to remove because the feature is being killed and the data hasn't been depended on elsewhere). If you'd rather keep the field as an unused additive (more conservative), fine — but ensure NO code reads or writes it after this rollback.
7. **Tests.** Delete any specs that test the force-change behaviour (`tests/admin/force-change-password.spec.ts` or similar in any test directory). Remove imports of those specs from any test runner config.

### Data safety step (mandatory)

Before pushing the rollback, run a one-shot script that sets `mustChangePassword: false` on every user in the production database who has it set to `true`. This ensures any users created during the previous run who received the flag won't be stuck in a redirect loop after the rollback (they'd have nowhere to go since the change-password page is being deleted).

Implement this as a tiny script `scripts/disable-must-change-password.ts` that connects to Mongo using `MONGODB_URI` from `.env.local`, runs `User.updateMany({ mustChangePassword: true }, { $unset: { mustChangePassword: '' } })`, prints the count, disconnects. Run it ONCE locally before the push.

After the field is removed from the model and the DB is cleaned, the field essentially doesn't exist anywhere. Clean rollback.

### Verification

After the rollback:
- Sign in as James Bond on the deployed (post-rollback) build → asserted to land on `/c` directly, not `/profile/change-password`. **This is the most important verification — if James Bond is force-redirected to a deleted page tomorrow, the demo breaks.**
- Sign in as any of the other pre-existing users (Jyothi, Vidit, Peter, Bruce, admin) → asserted to land on their normal home.
- Create a new test `[E2E-${RUN_ID}]` student via admin → sign in as that student → asserted to land on `/c`, not on a change-password page.

### Commit and deploy

Single commit: `revert: G5 — remove force-change-password-on-first-login per directive (admin-controlled passwords only)`. Push to `main`. Wait for Render deploy. Run the three verification sign-ins on production. **If the rollback verification fails, stop and escalate before continuing to Phase 1** — a broken rollback is worse than no rollback.

After the rollback is verified live, update `docs/USER_GUIDE.md` to remove any mention of "first-login password change" if it was added by the previous run. The guide should now describe the password flow as: admin creates user → admin generates password → email sent → student logs in with that password and keeps using it.

---

## Phase 1 — Confirm scope of remaining gaps (read-only, ~20 min)

Before fixing anything new, walk the deployed (post-rollback) app once as admin + assessor + student to verify:

- The 8 gaps deployed by the previous run (G1, G2, G3, G6, G7, G8, G9-confirm-dialog, G10) are still working after the rollback.
- The 12 remaining gaps below are still applicable (i.e. nothing in the previous run accidentally overlapped with them).

Append a short section to `tests/UI_GAPS_REPORT.md` titled "Phase 0 + 1 verification" listing what you verified. Do not produce a fresh `UI_AUDIT.md`.

---

## Phase 2 — Fix the 12 remaining gaps (in priority order, ~5–7 hours)

Each is its own logical commit. Push to `main` in batches of 4–5 commits at most, so a Render deploy failure can be diagnosed against a smaller surface.

### G9-mega — Empty states + loading skeletons across list pages [P1]

The previous run's "G9" was something different (confirm dialog standardisation). The mega-spec G9 is still open. Walk every list page (assessment list, evidence portfolio, materials, course documents, personal documents, work hours, notifications, audit logs, users, enrolments, qualifications, course detail). For each:

- Empty state: friendly icon, one-line explanation, relevant CTA button. Add `data-testid="empty-state"`.
- Loading skeleton: matches the eventual layout (use the existing skeleton pattern from `/admin/dashboard/page.tsx`).
- Error state: retry button.

Group the changes into one commit if there's no individual logic risk. This is grunt work but high-impact.

### G11 — Per-criterion comments on assessments [P0]

Currently `Remark` is at the assessment level. Add comments on a specific Assessment Criteria mapped to an assessment.

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
- `GET /api/v2/assessments/[id]/criteria-comments?criteriaId=X` — list (assessor, IQA, student-as-learner)
- `POST /api/v2/assessments/[id]/criteria-comments` — create (assessor or IQA only)
- `DELETE /api/v2/assessments/[id]/criteria-comments/[commentId]` — only the author can delete

UI: in the assessment detail panel, each mapped criterion chip becomes expandable. When expanded, shows a thread of comments with timestamps + author, plus an input to add a new comment. Students see comments in read-only mode.

### G12 — Witness testimony structured fields [P1]

When evidence has type `witness_testimony`, the current Evidence model is generic. Add (additive) to Evidence:

```
witnessName: string (optional)
witnessRole: string (optional)
witnessEmployer: string (optional)
witnessEmail: string (optional)
witnessStatement: string (optional, long text)
```

Surfaced on the evidence upload form ONLY when the evidence kind is `witness_testimony`. If the form doesn't already have a kind dropdown, add one with the existing `AssessmentKind` enum values.

Display: in evidence preview modal and the evidence row, show the witness block prominently for witness-testimony evidence.

### G13 — Required-vs-completed work hours indicator [P1]

Schema addition to Qualification (additive, optional):

```
requiredWorkHours: number (optional, e.g. 30)
```

UI: the Work Hours page shows a progress bar at the top: `12h 30m / 30h required` with percentage. Below cap, brand-coloured; at or above, green with "Requirement met" label. Hide if `requiredWorkHours` is 0 or null.

Admin sets `requiredWorkHours` on the qualification edit form in `/admin/courses` create/edit dialog (new optional field).

### G14 — PDF export of an assessment [P1]

New endpoint `GET /api/v2/assessments/[id]/pdf` — auth-gated to assessor (assignee or admin) and student (the learner) and IQA. Generates a PDF containing: assessment title, kind, date, plan/intent, plan/implementation, mapped criteria with their per-criterion comments (G11), mapped evidence list (filename + label), sign-offs, remarks, and IQA decision if present.

Use `pdfkit` (lighter dependency than `@react-pdf/renderer`). Set `Content-Disposition: attachment; filename="assessment-<id>.pdf"`.

UI: in the assessment detail panel, add a "Download PDF" button next to existing actions.

### G15 — Video thumbnails [P2 — only if time permits]

When a video is uploaded as evidence, generate a poster frame and store its S3 URL on the Evidence record.

- Server-side after upload completes: if `fileType` starts with `video/`, run `ffmpeg -i <stream> -ss 00:00:01 -frames:v 1 <out>.jpg`, upload JPG to S3 with key suffix `.thumbnail.jpg`, store URL on `Evidence.thumbnailUrl`.
- Use local `ffmpeg` at `/usr/bin/ffmpeg`.
- Soft-fail on errors (no thumbnail = generic icon, not a fatal upload failure).
- UI: evidence list / portfolio shows the thumbnail instead of a generic file icon for videos that have one.

This is P2 because it's the most complex (child process, re-upload, error handling). If you're 5 hours into Phase 2 and haven't started it, defer.

### G16 — Role change for existing users [P1]

In the user edit dialog (admin/users → Edit), the role dropdown is now editable (it may currently be read-only or absent).

- Role student → non-student: warn ("This user has 2 active enrolments. Changing role will withdraw them from all courses. Continue?"), and on confirm, set all the user's enrolments to `status: 'withdrawn'`.
- Role non-student → student: no automatic enrolment (admin uses the existing G2 inline-enrol).
- Audit-log every change with `USER_ROLE_CHANGED`, oldValue and newValue showing before/after.

### G17 — Bulk operations [P2]

In `/admin/users`, add:
- Checkbox column for multi-select.
- Bulk action menu (top-right when ≥1 selected): "Bulk deactivate", "Export selected to CSV", "Resend welcome to selected".
- Bulk deactivate sets `status: 'inactive'` for all selected (soft-delete).
- Export CSV with: name, email, role, status, phone, createdAt, enrolmentCount.

Same pattern on `/admin/enrolments`: bulk withdraw, bulk export.

### G18 — Cookie consent banner + privacy policy stub [P1]

- **Cookie banner**: shown on first page load (logged in or not). Two buttons: "Accept all" / "Reject non-essential". Persist choice in `cookie_consent` cookie (1y TTL). Banner doesn't reappear after a choice.
- **Privacy policy page**: new public route `/privacy`. Static markdown rendered as HTML, includes: data controller (Learners Education / NCFE LMS), data we collect, legal basis, sub-processors (Brevo, AWS, MongoDB Atlas, Render), retention placeholder ("until withdrawn or 7 years post-completion"), user rights (link to admin contact).
- **Footer link** to `/privacy` on every page.

Stub copy is fine. Do NOT make legal claims that aren't true (no "GDPR compliant" — say "intended to comply with").

### G19 — HTTP security headers [P1]

Add via `next.config.ts` `headers()` function:
- `Content-Security-Policy` — start permissive (`default-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; ...`) and tighten over time. Don't break inline scripts.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

Verify against existing NextAuth / Next.js defaults before adding — don't duplicate or conflict.

### G20 — Cascade-delete audit and fixes [P0]

Read every Mongoose model. For each parent → child relationship, verify the parent's DELETE handler cleans up children. Document and fix orphan paths.

Specifically check (find others too):
- **User deleted** → Assessments, Evidence, Enrolments, Notifications cascade. AuditLog stays (compliance). Cascade is run when admin DELETE soft-deletes — but since soft-delete keeps the row, the cascade should mark dependent rows as withdrawn/inactive, not hard-delete.
- **Qualification deleted** (soft-delete) → Units, LOs, ACs stay accessible (they're under the soft-deleted parent).
- **Enrolment deleted** → Assessments, Evidence, Work Hours related to this enrolment cascade delete.
- **Unit / LO / AC deleted** → child entities cascade.
- **Assessment deleted** → CriteriaMappings, EvidenceMappings, SignOffs, Remarks, **CriterionComments (G11)**, Notifications cascade.

For each fix: update the relevant DELETE route to perform cascade in dependency order. Use `Promise.all` for sibling deletes, sequential for parent-child. Add Playwright tests that delete a parent and verify all children are gone.

### G21 — Index optimisation [P1]

Read every Mongoose model and verify indexes match query patterns:
- `Enrolment`: `{ assessorId: 1 }`, `{ qualificationId: 1 }`, `{ userId: 1 }`, `{ userId: 1, qualificationId: 1 }` (compound)
- `Evidence`: `{ uploadedBy: 1 }`, `{ unitId: 1 }`, `{ status: 1 }`, possibly `{ uploadedBy: 1, status: 1 }`
- `Assessment`: verify `{ assessorId: 1 }`, `{ learnerId: 1 }`, `{ enrollmentId: 1 }`, `{ status: 1 }`, `{ date: -1 }`. Add `{ qualificationId: 1, status: 1 }` for dashboard query.
- `AuditLog`: `{ timestamp: -1 }`, `{ action: 1 }`, `{ entityType: 1, entityId: 1 }`, `{ userId: 1 }`
- `Notification`: `{ userId: 1, read: 1, createdAt: -1 }` (compound)
- `WorkHoursLog`: `{ enrollmentId: 1 }`, `{ learnerId: 1 }`, `{ date: -1 }`
- `CriterionComment` (new from G11): `{ assessmentId: 1, criteriaId: 1, createdAt: -1 }`

Add missing via `Schema.index(...)`. Verify by querying Atlas after deploy or running `db.collection.getIndexes()` in a test setup hook.

### G22 — API rate limiting [P1]

Implement `src/lib/rate-limit.ts` with a sliding-window counter keyed by `(userId or IP, route)` — store in a `Map` cleared every minute.

Apply via a higher-order wrapper around route handlers, similar to `withAuth`. Defaults:
- 60 requests/min per user per route (most routes)
- 10/min for upload routes
- 5/min for unauthenticated paths (sign-in, etc.)

Returns 429 with `Retry-After` header and a friendly JSON error.

This is in-memory, so it doesn't survive horizontal scaling — but you have one Render instance, so it's fine.

### Implementation rules

- One logical commit per gap (`G11`, `G12`, …). Commit message format: `feat(workflow): G11 — per-criterion comments on assessments` or `fix(backend): G20 — cascade-delete on assessment deletion`.
- No schema-breaking changes. Only additive new fields/collections.
- Use existing patterns: `withAuth`, Zod validators in `src/lib/validators.ts`, existing modal styling, audit-log helper.
- Add Playwright tests for every fix. Local suite must be all green before each batch push.
- `BREVO_SENDER_NAME` on Render is still flagged as needing manual update from previous run (`NCFE LMS`). Note this in the report; don't try to update Render env vars from code.

---

## Phase 3 — Production verification (~1.5 hours)

After the final deploy goes green:

### 3.1 Regression check
Re-run the existing prod E2E suite from the previous runs (39 + 65 specs). **Any regression is a deploy blocker** — fix and redeploy before continuing.

### 3.2 New prod specs for G9-mega + G11–G22
Add `tests/prod/remaining-gaps.spec.ts` (or split per-gap if more readable) covering:

- **G9-mega**: Visit ten list pages with no data; assert each has `[data-testid="empty-state"]`.
- **G11**: Add 2 comments on different criteria of a `[E2E-${RUN_ID}]` test assessment → assert they appear in criteria expansion → student sees them read-only. Cleanup.
- **G12**: Upload witness-testimony evidence with witness fields filled → assert evidence record has witness data → preview modal shows it.
- **G13**: Set `requiredWorkHours=20` on a `[E2E-${RUN_ID}]` test qualification, log 5h → assert progress bar shows 25%. Log another 16h → "Requirement met".
- **G14**: GET `/api/v2/assessments/[id]/pdf` → assert response is `application/pdf` and starts with `%PDF`. Verify basic structure with a small PDF parser.
- **G15** (if shipped): Upload a test video → wait → assert thumbnail URL is set on Evidence record.
- **G16**: Admin promotes `[E2E-${RUN_ID}]` student to assessor → assert role changed AND all their enrolments are `status: 'withdrawn'`.
- **G17**: Select 3 test users → bulk deactivate → assert all 3 are inactive. Bulk export → assert CSV.
- **G18**: Visit `/privacy` → 200 + content. Visit `/sign-in` → cookie banner appears. Click "Accept all" → reload → banner doesn't reappear.
- **G19**: Inspect response headers on `/sign-in` and `/api/auth/session` → assert presence of CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS.
- **G20**: Create test enrolment with assessment + evidence + work hours → delete enrolment → assert all three children gone.
- **G21**: Verify indexes via `db.collection.getIndexes()` in a test setup hook.
- **G22**: Hammer `/api/v2/admin/stats` 70 times in a minute as one user → assert 429 returned for requests after the limit.

### 3.3 G5 rollback verification (mandatory)
Re-test on production:
- Sign in as James Bond → land on `/c` directly. Assert NOT redirected to `/profile/change-password`.
- Visit `/profile/change-password` directly → 404.
- Create a new test student → sign in as them → land on `/c` directly.
- Inspect a User document via the UI or API → assert no `mustChangePassword` field present.

### 3.4 Cross-browser smoke
Re-run the existing cross-browser smoke (Chromium + Firefox + WebKit). Should all pass; if anything broke after the changes, fix Chromium regressions, log Firefox/WebKit-only issues for next sprint.

### 3.5 Mobile viewport pass
Re-run the existing mobile smoke. Same standard.

### 3.6 Final report
Append to `tests/UI_GAPS_REPORT.md` (don't overwrite the previous run's section):
- New section: "Phase 0 — G5 rollback (executed)" with what was removed and verification results.
- New section: "Phase 2-remaining — gap fixes" with per-gap status (deployed / deferred + reason).
- Cross-browser and mobile findings.
- Final SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP recommendation.

---

## Phase 4 — User guide incremental update (~30 min)

Update `docs/USER_GUIDE.md` (don't regenerate from scratch):

1. **Remove G5 references.** Any mention of "first-login password change" or "change your password before continuing" — strip out. The password section now reads: admin generates → student receives → student logs in with that password and keeps it. If a password change is needed, contact admin.
2. **Add new feature mentions** in the relevant role sections:
   - Assessor → "Per-criterion comments" subsection (G11) with screenshot.
   - Assessor / Student → "PDF export of an assessment" (G14).
   - Student / Assessor → "Witness testimony fields" (G12) when uploading witness evidence.
   - Student → "Work hours progress" (G13).
   - Admin → "Bulk operations" (G17) and "Role change for existing users" (G16).
3. **Update the FAQ** with two new entries:
   - "Can I (the student) change my password?" → "No, by design. Contact your administrator who can reset it."
   - "What happens when I log in for the first time?" → "You go directly to your course list. You're not asked to change your password (admin controls that)."
4. **Update the matrix table** if any new role permissions emerged from G16.

Capture only the new screenshots needed (no full re-screenshot pass). Save to `docs/screenshots/`.

---

## Final summary in chat

> SHIP / SHIP-WITH-CAVEATS / DO-NOT-SHIP. G5 rolled back successfully (all force-change-password code + middleware + page + endpoint removed; field cleared from all users). 12 remaining gaps addressed: G9-mega (empty states + skeletons), G11 (per-criterion comments), G12 (witness fields), G13 (work hours progress), G14 (PDF export), G15 (video thumbnails — shipped/deferred), G16 (role change), G17 (bulk operations), G18 (cookie consent + privacy stub), G19 (security headers), G20 (cascade-delete audit), G21 (indexes), G22 (rate limiting). Production verification: <P>/<T> specs passing across Chromium + Firefox + WebKit + mobile. James Bond verified to log in directly without password-change redirect. User guide at docs/USER_GUIDE.md updated. Read tests/UI_GAPS_REPORT.md for the full triage.

---

## Hard constraints

- Same non-destructive rules: production database is shared; `RUN_ID` tag every test entity; clean up in `afterEach` and `afterAll`; never modify pre-existing users / qualifications / units / LOs / ACs / enrolments outside test scope.
- **DO NOT touch James Bond (`7777jamesbond7777@gmail.com`) or his enrolment, ever.** Verifying he logs in correctly post-rollback is the only allowed interaction.
- **DO NOT re-introduce any of these (excluded by user directive):**
  - Self-service password reset (`/forgot-password` stays disabled)
  - Force-change-password-on-first-login
  - Self-service password change anywhere
  - IQA dashboard improvements
- **DO NOT re-implement any of the 8 gaps already deployed by the previous run** (G1, G2, G3, G6, G7, G8, G9-confirm-dialog, G10). Verify they still work; don't touch them.
- Schema changes ONLY additive — new optional fields, new collections. No renames, type changes, or removals (except the deliberate `mustChangePassword` field removal in Phase 0).
- Email failures soft-fail every time.
- Brevo API key, Mongo URI, AWS creds — never log them, never echo them in audit logs, never include them in screenshots.
- If a fix would require >2 hours and you're 5 hours into Phase 2, defer to next sprint with a documented reason.
- Two retry attempts max on a failed Render deploy, then revert and escalate.
- If Phase 3 finds a regression in any previously-passing test, **stop and fix** before continuing. Don't ship a regression.

Begin with **Phase 0 — G5 rollback**. The James Bond demo is tomorrow morning. The rollback must be verified live before anything else happens.
