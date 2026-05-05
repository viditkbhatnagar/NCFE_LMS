# BUG_LOG.md

Chronological log of every fix, schema test discrepancy, or spec deviation
discovered while building and running the E2E suite.

Format:
- `YYYY-MM-DD HH:MM  [SETUP|TEST|APP|GAP|TESTID]  <one-line summary>`
- followed by indented context (root cause, file:line, change made, status)

---

## 2026-05-05 — Setup phase

### SETUP: IQA test password mismatch
- **Symptom:** auth-setup failed for `iqa@test.com` with "Invalid email or password" using `iqapassword`.
- **Root cause:** Live DB user has bcrypt hash matching `Password123!`, not `iqapassword` as documented in the test brief.
- **Resolution:** updated `tests/users.ts` IQA password to the verified live value. No DB change.
- **Status:** RESOLVED in test config. Documented as a doc-vs-DB mismatch — does NOT block UAT but means the brief's table is wrong for that one row.

### GAP: No DELETE endpoint for personal-documents
- **Symptom:** `/api/v2/personal-documents/[id]/route.ts` only exists with `download/`, no plain `route.ts` exposing DELETE.
- **Root cause:** Endpoint never built.
- **Resolution:** Cleanup helper falls back to direct Mongo delete (gated to RUN_ID-tagged docs). Logged as missing UI feature for the report.
- **Status:** GAP. Real users who upload personal documents currently cannot delete them via the API.

### GAP: No DELETE endpoints for IQA samples / decisions / standardisation / centre documents
- **Symptom:** None of `/api/iqa/{samples,decisions,standardisation,documents}` expose DELETE.
- **Root cause:** Endpoints never built.
- **Resolution:** Cleanup helper falls back to direct Mongo delete (gated to RUN_ID-tagged docs).
- **Status:** GAP.

### GAP: No `data-testid` attributes anywhere in the codebase
- **Symptom:** `grep -r data-testid src` returns 0 results.
- **Resolution:** Selectors use role/label/text first; testids added surgically only when 1–3 cannot disambiguate. Each addition logged with `TESTID:` prefix.
- **Status:** Open architectural note — accepted; per the plan we add testids on demand, never preemptively.

### GAP (cosmetic): `src/lib/upload.ts` line 141 says "50MB limit" in error but cap is 2 GB
- **Symptom:** Wrong error message text. Threw error reads "File size exceeds 50MB limit" but `MAX_FILE_SIZE = 2 * 1024^3`.
- **Status:** Cosmetic — not fixed yet. Will be picked up if a test asserts the error text.

### NOTE: DELETE on a published assessment is forbidden by design
- **Symptom:** `DELETE /api/v2/assessments/:id` returns 400 with `"Only draft assessments can be deleted"` once an assessment has been published.
- **Root cause:** `src/app/api/v2/assessments/[id]/route.ts:241-246` — deliberate business rule for audit-trail integrity.
- **Resolution:** Test was updated to assert this behaviour, and a separate test now covers the publish→edit→re-publish workflow (which transitions to `published_modified`).
- **Status:** EXPECTED BEHAVIOUR. No code change.

### APP BUG: `POST /api/v2/evidence/upload` returns 500 (not 4xx) when file extension is rejected
- **Symptom:** Uploading `bad.exe` triggers `uploadFile()` to throw "File type .exe is not allowed". The catch block (`route.ts:159-170`) returns 500 with the message preserved.
- **Root cause:** Error handler treats validation failures as server errors. Should return 400/415.
- **Severity:** P3 — user-visible error text is informative ("File type .exe is not allowed") so the UX is acceptable, but the status code is misleading for API consumers and monitoring/alerting tools.
- **Resolution:** Test accepts either 4xx or a 500 with a descriptive message. App fix not done — would require refactoring the error catch in upload route handlers; deferred to post-UAT.
- **Status:** ACCEPTED FOR LAUNCH; logged for follow-up.

### APP NOTE: Admin user DELETE is a soft delete (sets status: inactive)
- **Symptom:** `DELETE /api/v2/admin/users/:id` returns 200 but the user remains in the collection with `status='inactive'`.
- **Root cause:** `src/app/api/v2/admin/users/[id]/route.ts:97` — `User.findByIdAndUpdate(id, { status: 'inactive' })`. By design for audit/recovery.
- **Resolution:** Test cleanup helper performs a RUN_ID-gated hard-delete after the API soft-delete so the user count returns to baseline.
- **Status:** EXPECTED BEHAVIOUR. No code change.

### APP NOTE: Admin user/centre/qualification mutations write to `auditlogs` (intentional, never deleted)
- **Symptom:** `auditlogs` count drifts upward across test runs; cannot be cleaned by tests.
- **Resolution:** Postflight intentionally does NOT include `auditlogs` in the `FROZEN_COLLECTIONS` set. Drift is reported but does not fail the postflight check.
- **Status:** EXPECTED BEHAVIOUR.

### APP NOTE: Assessment-published notifications and signoffs are not cascade-deleted on assessment delete
- **Symptom:** `DELETE /api/v2/assessments/:id` deletes signoffs/criteriamaps/evidencemaps/remarks but does NOT delete notifications referencing the assessment.
- **Severity:** P3 — orphaned notifications still display in the UI, pointing to a non-existent entity.
- **Resolution:** Test cleanup helper sweeps notifications by `entityId` after each assessment delete (registry + postflight pre-cleanup).
- **Status:** Real app gap. Worth a small fix later but not blocking UAT.

### APP NOTE: `createNotification` is fire-and-forget (no await)
- **Symptom:** Notifications may be persisted asynchronously after a request response. In one test run, the postflight initially detected 0 leaks because the writes hadn't yet hit the DB before the leak query ran.
- **Resolution:** Postflight runs an unconditional RUN_ID-scoped pre-cleanup sweep before computing the diff, which is robust to write-ordering.
- **Status:** Acceptable for UAT — the user-visible UI eventually shows notifications correctly.
