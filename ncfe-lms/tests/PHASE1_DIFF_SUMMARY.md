# Phase 1 Diff Summary

Every code change pushed to `main` in this session, in the order they were committed. The 6 commits were pushed together; the deploy at `db1b274` is what's now live.

---

## Commit 1 — `b366d7e` — `chore: gitignore Playwright artefacts and test fixtures`

| File | Why |
| --- | --- |
| `ncfe-lms/.gitignore` | Add `test-results/`, `playwright-report/`, `screenshots/`, `tests/baseline*.json`, `tests/.auth/`, `tests/cleanup-failures.jsonl`, `tests/console-issues.jsonl`, `tests/postflight-report.json`, `tests/playwright-results.json`, `tests/fixtures/files/`, `tests/DEMO_CREDENTIALS.md`. Cleanup before the test infra commit lands. |

---

## Commit 2 — `bd6f79e` — `chore(test): add Playwright E2E infrastructure and specs`

The whole `tests/` tree (~3,800 LoC) plus `playwright.config.ts`, `package.json` + `package-lock.json` (Playwright deps), and one tsconfig adjustment.

| File | Why |
| --- | --- |
| `ncfe-lms/playwright.config.ts` | New. 7 projects: auth-setup, smoke, assessor, student, iqa, admin, cross, unit. webServer reuses local dev server. |
| `ncfe-lms/package.json` + `package-lock.json` | Add `@playwright/test`, `pdfkit`, `docx` test deps. |
| `ncfe-lms/tsconfig.json` | Exclude `tests/`, `playwright.config.ts`, `playwright.prod.config.ts` from the Next.js build's TypeScript pass — they have their own runtime via Playwright's transformer and don't need to compile in the production build. Without this, `tests/postflight.ts` blocks `npm run build` on Render. |
| `ncfe-lms/tests/preflight.ts` + `postflight.ts` | Snapshot 22 collections + S3, RUN_ID generation, leak detection, defense-in-depth pre-cleanup sweep. |
| `ncfe-lms/tests/fixtures/created-registry.ts` | LIFO cleanup with API DELETE first, RUN_ID-gated Mongo fallback, S3 deletion. |
| `ncfe-lms/tests/fixtures/auth.setup.ts` + `api-client.ts` + `base.ts` + `test-context.ts` + `files.ts` + `files-generate.ts` | Auth state per role, baseline IDs, fixture files. |
| `ncfe-lms/tests/{smoke,assessor,student,iqa,admin,unit,cross}/*.spec.ts` | 100+ spec tests across 8 categories. |
| `ncfe-lms/tests/users.ts` | Test credentials. |

---

## Commit 3 — `1aeb73f` — `fix(uat): pre-launch fixes (#1 upload 4xx, #2 cascade-delete notifications, #3 missing DELETE endpoints)`

### Fix #1 — Upload validation errors return 400 instead of 500
| File | Change |
| --- | --- |
| `src/lib/upload.ts:141` | Error message: `"File size exceeds 50MB limit"` → `"File size exceeds 2GB limit"` (the actual `MAX_FILE_SIZE`). |
| `src/app/api/v2/evidence/upload/route.ts:159–170` | Catch block now distinguishes validation (returns 400) from server error (returns 500), via heuristic `message.includes('size exceeds') \|\| message.includes('not allowed')`. |
| `src/app/api/v2/materials/route.ts:215–226` | Same. |
| `src/app/api/v2/course-documents/route.ts:198–209` | Same. |
| `src/app/api/evidence/upload/route.ts:97–105` | Legacy route — same fix. |
| `src/app/api/v2/personal-documents/route.ts:199–203` | Updated heuristic from `'50MB'` to `'size exceeds'` to match the new error message. |

### Fix #2 — Cascade-delete notifications when an assessment is deleted
| File | Change |
| --- | --- |
| `src/app/api/v2/assessments/[id]/route.ts:11` | Add `import Notification from '@/models/Notification'`. |
| `src/app/api/v2/assessments/[id]/route.ts:251–256` | Existing `Promise.all` cascade now also includes `Notification.deleteMany({ entityType: 'Assessment', entityId: id })`. |

### Fix #3 — Five new DELETE endpoints + UI buttons
| File | Change |
| --- | --- |
| `src/app/api/v2/personal-documents/[id]/route.ts` | NEW. DELETE handler scoped to student (own docs only) or assessor (must own enrolment). Calls `deleteFile()` for S3 cleanup. |
| `src/app/api/iqa/samples/[id]/route.ts:79–110` | Extended with DELETE that cascades to linked `IQADecision` records. |
| `src/app/api/iqa/decisions/[id]/route.ts` | NEW. DELETE handler. If no remaining decisions on the parent sample, reverts sample status from `reviewed` to `pending`. |
| `src/app/api/iqa/standardisation/[id]/route.ts` | NEW. DELETE handler. |
| `src/app/api/iqa/documents/[id]/route.ts` | NEW. DELETE handler with S3 cleanup via `deleteFile()`. |
| `src/app/(assessor-dashboard)/c/[slug]/personal-documents/page.tsx` | Wire `onDelete` callback into FileGrid + FileListView; add `ConfirmDialog` for the delete confirm flow. |
| `src/app/(dashboard)/iqa/sampling/page.tsx` | Add Delete button per sample card + `ConfirmDialog`. |
| `src/app/(dashboard)/iqa/decisions/page.tsx` | Add Delete button per decision card + `ConfirmDialog`. |

> **Deliberate non-changes:** the IQA `standardisation` and `documents` pages are bare stubs (no list rendering). Building list views was scope-creep on the night before UAT; the API DELETE endpoints unblock cleanup helpers + future UI.

---

## Commit 4 — `200264b` — `feat(admin): auto-generate passwords on user create + reset, with reveal/copy UX`

| File | Change |
| --- | --- |
| `src/lib/password-generator.ts` | NEW. 14-char crypto-random password using `globalThis.crypto.getRandomValues`. Composition guarantees ≥1 lower / upper / digit / symbol. Excludes ambiguous chars (`0/O/o/I/l/1`) and copy-paste-unfriendly chars (whitespace, quotes, backslash, backtick). |
| `src/app/(admin-dashboard)/admin/users/page.tsx` | Major rewrite of the create-user form's password field: pre-fills via `generatePassword()`, adds inline **Generate / Copy / Eye** icon buttons, caption explaining manual entry remains supported. Adds **post-create credentials modal** with Name / Email / Role / Password and a **Copy all credentials** action. Same generator UX on the **Reset Password** dialog plus a smaller post-reset modal. Added `aria-label` to Name, Email, and Password inputs for testability. |

---

## Commit 5 — `fcb8787` — `feat(email): Brevo welcome + reset + resend with audit logging and soft-fail`

| File | Change |
| --- | --- |
| `src/lib/email.ts` | NEW. Thin wrapper around `@getbrevo/brevo` `BrevoClient`. Lazy-init the client, cache module-level. Exports `sendWelcomeEmail`, `sendPasswordResetEmail`, `welcomeHtml`, `resetHtml`. Returns `{ ok, messageId | error }`; never throws. Without `BREVO_API_KEY` it falls back to `logged-only` mode. Inline-styled mobile-responsive HTML templates with credentials block + CTA button. |
| `src/app/api/v2/admin/users/route.ts:8` | Add `import { sendWelcomeEmail } from '@/lib/email'`. |
| `src/app/api/v2/admin/users/route.ts:84–113` | After `User.create` succeeds, send the welcome email, audit-log `EMAIL_SENT` or `EMAIL_FAILED` with template + messageId/error (no plaintext password). Response now includes `emailSent: boolean` and (on failure) `emailError: string`. User creation never blocks on email. |
| `src/app/api/v2/admin/users/[id]/reset-password/route.ts:8,40–60` | Same wiring with `sendPasswordResetEmail`. Response includes `emailSent` + optional `emailError`. |
| `src/app/api/v2/admin/users/[id]/resend-welcome/route.ts` | NEW endpoint. Admin-only. Generates a fresh password via `generatePassword()`, updates the user's `passwordHash`, sends a fresh welcome email, audit-logs the trigger. Returns `{ success, password, emailSent, emailError? }`. |
| `src/app/(admin-dashboard)/admin/users/page.tsx` | Surfaces `emailSent` on both success modals (green check for sent, amber warning for failed). Adds a **Resend** button on each user row that calls the new endpoint and reuses the success modal. |
| `src/app/(auth)/forgot-password/page.tsx` | Replaced the old (stubbed) self-service reset form with a static "Contact your administrator" view. Students cannot self-reset because admin must hold credentials to support learners. |
| `src/app/(auth)/sign-in/page.tsx` | Sign-in page link copy updated from "Forgot password?" to "Forgot password? Contact admin". |
| `package.json` + `package-lock.json` | Add `@getbrevo/brevo@^5.0.4`. |

---

## Commit 6 — `db1b274` — `test(email): integration + real-send tests for admin user emails`

| File | Why |
| --- | --- |
| `tests/unit/email.spec.ts` | NEW. Unit tests for `src/lib/email.ts`: logged-only mode, soft-fail with invalid key, template HTML contains every input value (regression guard against template typos). |
| `tests/admin/email-integration.spec.ts` | NEW. API-level: create + reset + resend flows assert `emailSent` and the matching `EMAIL_SENT` audit log entry with template, messageId, and no plaintext password. |
| `tests/admin/email-real-send.spec.ts` | NEW. Real Brevo round-trip via `+e2e` plus-addressing. Polls Brevo's `/v3/smtp/statistics/events` API to confirm acceptance. |
| `tests/smoke/auth.spec.ts:75–82` | Updated forgot-password smoke test to assert the new contact-administrator copy (the previous form-submission path no longer exists). |

---

## Build verification

- `npm run build` — clean ✓ (Render auto-deploys on push, build succeeds).
- `npm run lint` — clean ✓ (no new lint warnings).
- `npx tsc --noEmit` for `src/` — 0 errors ✓.
- Local Playwright suite — 108 / 108 passing ✓.
- Production Phase 2 — 13 / 13 passing ✓.
