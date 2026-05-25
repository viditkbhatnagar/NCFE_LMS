# NCFE LMS — Send Welcome Emails via Brevo on Admin User Create + Password Reset

You are integrating Brevo (transactional email API) so that whenever an admin creates a user OR resets a user's password, the affected user automatically receives an email with their credentials. Repo: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. Production runs at `https://ncfe-lms.onrender.com`. Render auto-deploys on push to `main`.

This is additive — no schema change, no breaking change, soft-fail on email errors so user creation never blocks because Brevo is down.

---

## Prerequisites the user has already completed

The user has already:
- Signed up at brevo.com and verified a sender email (likely `noreply@learnerseducation.com` or similar).
- Generated a Brevo API key (`xkeysib-…`).
- Knows the four env-var values needed (API key, sender email, sender name, app base URL).

You do NOT need to set up Brevo. You just need to consume the API key.

---

## What you're building

1. **`src/lib/email.ts`** — a thin wrapper around `@getbrevo/brevo` exporting two functions:
   - `sendWelcomeEmail({ name, email, password, role, loginUrl })` — used after admin creates a new user.
   - `sendPasswordResetEmail({ name, email, password, loginUrl })` — used after admin resets a password.
   - Both return `{ ok: true, messageId } | { ok: false, error }`. Never throw.
   - Lazy-initialise the API client (cache it module-level after first call) so cold starts on Render aren't penalised on every send.

2. **Welcome email** — a clean HTML template (inline CSS, no external assets so it renders the same in every email client). Subject: `Welcome to NCFE LMS — Your Login Details`. Body includes greeting, role-aware "what you can do next", credentials block, login URL, security advice (change password after first login), and a polite signoff.

3. **Password reset email** — similar template. Subject: `Your NCFE LMS password has been reset`. Body explains the password was reset by an administrator, includes the new password + login URL, and warns to contact admin if the user didn't request this.

4. **API integration** — modify two routes:
   - `POST /api/v2/admin/users/route.ts` — after `User.create(...)` succeeds, call `sendWelcomeEmail(...)`. Include `emailSent: boolean` and (if failed) `emailError: string` in the JSON response. Do NOT roll back the user if email fails.
   - `POST /api/v2/admin/users/[id]/reset-password/route.ts` — after the password update, call `sendPasswordResetEmail(...)`. Same response shape.

5. **Audit logs** — log every email send attempt (success or failure) to `AuditLog` with `action: 'EMAIL_SENT'` or `'EMAIL_FAILED'`, `entityType: 'User'`, `entityId: <recipientUserId>`, and `newValue: { template: 'welcome' | 'password_reset', messageId?: string, error?: string }`. Use the existing `createAuditLog()` helper in `src/lib/audit.ts`.

6. **UI feedback** — in `src/app/(admin-dashboard)/admin/users/page.tsx`, after the success modal that already shows the generated password (from the password-generator change just deployed), add:
   - A green check + "Email sent to <email> ✓" line if `emailSent: true`.
   - A yellow warning + "Email failed — please share these credentials manually. Reason: <emailError>" line if `emailSent: false`.
   - The credentials are still shown either way so the admin always has a fallback.

7. **Resend button** — on the user list row, add a small "Resend welcome email" action (icon-only, in the row actions menu next to Edit / Reset password / Delete). Calls a new endpoint `POST /api/v2/admin/users/[id]/resend-welcome` which generates a fresh password (using the existing `generatePassword()` helper from `src/lib/password-generator.ts`), updates the user's password, sends the email, and returns the same shape. This covers the case where the original email got lost.

---

## Environment variables

The user will set these in `.env.local` (local) and in Render dashboard → service → Environment tab (production):

```
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@learnerseducation.com
BREVO_SENDER_NAME=Learners Education NCFE LMS
APP_BASE_URL=https://ncfe-lms.onrender.com
```

Your code must:

- Read all four at runtime (not at module load — Brevo lib doesn't need pre-init).
- If any of the four are missing, `sendWelcomeEmail` returns `{ ok: false, error: 'Email service not configured' }` without crashing. The audit log records `EMAIL_FAILED`, the API returns 201/200 with `emailSent: false`, the UI shows the warning. User creation still succeeds.
- For local dev, if the user hasn't filled in `.env.local` yet, log a single `console.warn('[email] BREVO_* env vars not set; emails will be logged-only')` on first call and proceed in "logged-only" mode where the email body is printed to the server console instead of sent. This lets developers test the surrounding code without a Brevo account.

Add a brief comment to `.env.local.example` (or create the file if it doesn't exist) showing these four vars with placeholder values. Do NOT put real values anywhere except `.env.local` (gitignored).

---

## Implementation details

### `src/lib/email.ts`

```ts
import * as Brevo from '@getbrevo/brevo';

interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

let cachedApi: Brevo.TransactionalEmailsApi | null = null;

function getApi(): Brevo.TransactionalEmailsApi | null {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  if (cachedApi) return cachedApi;
  const api = new Brevo.TransactionalEmailsApi();
  api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, key);
  cachedApi = api;
  return api;
}

function buildSender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL || 'noreply@example.invalid',
    name: process.env.BREVO_SENDER_NAME || 'NCFE LMS',
  };
}

function loggedOnly(template: string, to: string, html: string): SendResult {
  console.warn(`[email:logged-only] template=${template} to=${to}\n${html}`);
  return { ok: true, messageId: 'logged-only' };
}

async function send(template: string, to: { email: string; name: string }, subject: string, html: string): Promise<SendResult> {
  const api = getApi();
  if (!api) return loggedOnly(template, to.email, html);
  try {
    const msg = new Brevo.SendSmtpEmail();
    msg.sender = buildSender();
    msg.to = [{ email: to.email, name: to.name }];
    msg.subject = subject;
    msg.htmlContent = html;
    const res = await api.sendTransacEmail(msg);
    return { ok: true, messageId: (res.body as { messageId?: string })?.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function sendWelcomeEmail(args: { name: string; email: string; password: string; role: string; loginUrl: string }): Promise<SendResult> {
  const html = welcomeHtml(args);
  return send('welcome', { email: args.email, name: args.name }, 'Welcome to NCFE LMS — Your Login Details', html);
}

export async function sendPasswordResetEmail(args: { name: string; email: string; password: string; loginUrl: string }): Promise<SendResult> {
  const html = resetHtml(args);
  return send('password_reset', { email: args.email, name: args.name }, 'Your NCFE LMS password has been reset', html);
}

// HTML templates below — see "Templates" section.
function welcomeHtml(...) { ... }
function resetHtml(...) { ... }
```

### Templates

Both templates must be inline-styled, mobile-responsive, and free of external image references. Use a simple white card on a soft-grey background, the project's primary green for CTAs, sans-serif system font stack. Copy each section in plain readable English.

**Welcome email skeleton:**

```
Hi {{name}},

Welcome to the NCFE Learning Management System. An account has been created for you as a {{role}}.

You can sign in at: {{loginUrl}}

  Email:    {{email}}
  Password: {{password}}

For your security, please sign in and change your password from the Profile page after your first login.

If you have questions, reach out to your assessor or the centre administrator.

— Learners Education NCFE LMS
```

Render the credentials block as a monospaced grey-background section so they're easy to copy. Make the login URL a button.

**Password reset email skeleton:**

```
Hi {{name}},

Your NCFE LMS password has just been reset by an administrator.

You can sign in at: {{loginUrl}}

  New password: {{password}}

If you did NOT request this change, please contact your administrator immediately.

— Learners Education NCFE LMS
```

### Wiring into the user create route

In `src/app/api/v2/admin/users/route.ts`, after the `User.create(...)` call:

```ts
const emailResult = await sendWelcomeEmail({
  name: user.name,
  email: user.email,
  password: validation.data.password,  // the plaintext from the request body, NOT user.passwordHash
  role: user.role,
  loginUrl: `${process.env.APP_BASE_URL || ''}/sign-in`,
});

await createAuditLog({
  userId: session!.user.id,
  action: emailResult.ok ? 'EMAIL_SENT' : 'EMAIL_FAILED',
  entityType: 'User',
  entityId: String(user._id),
  newValue: { template: 'welcome', ...(emailResult.ok ? { messageId: emailResult.messageId } : { error: emailResult.error }) },
});

return NextResponse.json({
  success: true,
  data: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
  emailSent: emailResult.ok,
  ...(emailResult.ok ? {} : { emailError: emailResult.error }),
}, { status: 201 });
```

Wire the password-reset route the same way.

### New endpoint — resend welcome

Create `src/app/api/v2/admin/users/[id]/resend-welcome/route.ts` modelled on the existing reset-password route. Generate a fresh password via the `generatePassword()` helper (which already exists from the previous deploy), update the user's `passwordHash`, send the welcome email, audit-log it, return `{ success, emailSent, emailError?, password }`. Admin-only.

In the user list UI, add a "Resend welcome email" action that hits this endpoint and shows the same success modal as create (so the admin gets the new password to copy).

---

## Tests

Add `tests/admin/email-integration.spec.ts`:

1. With `BREVO_API_KEY` unset (logged-only mode), create a `[E2E-${RUN_ID}]` user. Assert `emailSent: true`, `messageId: 'logged-only'`, audit log entry exists. Cleanup the user (soft-delete).
2. Set an obviously-invalid `BREVO_API_KEY` (e.g. `xkeysib-INVALID`). Create another user. Assert `emailSent: false`, `emailError` populated, user STILL created, audit log shows `EMAIL_FAILED`.
3. Reset that user's password. Same `emailSent` flag flow.
4. Resend welcome on the user. Assert new password returned, email send attempted, list refreshes.

A unit test for `src/lib/email.ts` in `tests/unit/email.spec.ts`:

- Without env vars → returns `ok: true, messageId: 'logged-only'`.
- With invalid env vars → returns `ok: false, error: …`.
- HTML output of `welcomeHtml` and `resetHtml` contains `name`, `email`, `password`, and `loginUrl` exactly once each (regression guard against template typos).

The Phase-2-style production E2E full workflow can stay as-is for now; if it later exercises admin-create on production, the email send becomes part of that test's network traffic — that's fine, but don't add a new prod test as part of this task.

---

## Run, commit, deploy

1. `npm install @getbrevo/brevo`.
2. Add the four env vars to `.env.local` with whatever values the user provides (or placeholder if they haven't set Brevo up yet — the logged-only mode will keep things working).
3. `npm run dev` and click through manually: open `/admin/users`, create a `[manual-test-${timestamp}]` user, watch the server console for the logged-only email body. Cleanup the user after.
4. `npx playwright test tests/admin/email-integration.spec.ts tests/unit/email.spec.ts` — green.
5. `npm run lint` and `npm run build` — pass.
6. **Tell the user (in chat)** to add the four env vars to the Render dashboard before this code reaches production: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `APP_BASE_URL`. Without those on Render, the deployed app falls back to logged-only mode (i.e. nothing actually emails) — that's safe but not what the user wants.
7. Commit two logical changes:
   - `feat(email): add Brevo transactional email helper with welcome + reset templates`
   - `feat(admin): send welcome email on create + reset, add resend-welcome action, surface emailSent in UI`
8. `git push origin main`. Wait for Render deploy. Smoke check: sign in as admin, create a `[smoke-${timestamp}]` user with a real (your own) email address — confirm you receive a welcome email in your inbox, including the credentials and the login URL. Then delete the test user.

Print a one-line summary in chat: `Done. Welcome + reset emails wiring is live. User must add BREVO_* env vars in Render before next user-create.`

---

## Hard constraints

- Do NOT block user creation on email failure. Soft-fail every time.
- Do NOT log full passwords in any persistent place except the email body itself. Audit logs record only `EMAIL_SENT`/`EMAIL_FAILED` plus `messageId` or `error`, never the password.
- Do NOT modify the `User` model.
- Do NOT modify `.env.local` if it already contains `BREVO_*` values — assume they're correct.
- Do NOT push the `BREVO_API_KEY` to git. `.env.local` is already in `.gitignore`; verify before committing.
- If the build fails on Render, read the logs, fix locally, push again. Two attempts max — if still failing, revert and report.
