# NCFE LMS — Add Auto-Generated Passwords to Admin User Creation

You are adding an auto-password-generator to the admin "Create User" and "Reset Password" flows so admins never have to invent passwords manually. Repo: `/Users/viditkbhatnagar/codes/NCFE_LMS/ncfe-lms`. The app is deployed at `https://ncfe-lms.onrender.com`; pushing to `main` triggers Render to redeploy automatically.

This is a small, surgical change. Do NOT broaden scope — no schema changes, no model changes, no migrations, no auth refactors. Three files touched, one new file added.

---

## What you're building

Today the admin types passwords by hand into a masked input. Replace that with:

1. **A "Generate" button** next to the password field. Clicks it → a cryptographically-random 14-character password is generated client-side and appears in a **visible** (not masked) input the admin can read and copy.
2. **A "Copy" button** next to the field.
3. **An "Eye" toggle** so the admin can switch between visible and masked if they want.
4. **A success modal after user creation** that shows: the user's name, email, role, and the password, with a "Copy credentials" button (copies all four as one block) and a clear warning that the password won't be shown again.
5. **The same generator + reveal in the Reset Password dialog**.

The admin can still type a password manually if they prefer — the generator is the default behaviour, manual entry is the fallback.

No backend API changes. The generated password flows through the existing `POST /api/v2/admin/users` and `POST /api/v2/admin/users/[id]/reset-password` endpoints unchanged. The validation already requires `min(8)` and the generated 14-char password satisfies that.

---

## Password specification

- **Length:** 14 characters by default (constant, exported so it's easy to change later).
- **Character set:** lowercase a–z, uppercase A–Z, digits 0–9, plus the symbols `!@#$%^&*-_=+`.
- **Excluded characters:** `0`, `O`, `o`, `I`, `l`, `1` (ambiguous in handwriting / common fonts) and any character that breaks copy-paste in email or terminal: space, tab, quotes, backslash, backtick.
- **Composition guarantee:** every generated password must contain at least one lowercase, one uppercase, one digit, and one symbol. Reject and regenerate otherwise (loop with a max-attempts safety cap).
- **Entropy source:** `crypto.getRandomValues(new Uint32Array(...))`. Do NOT use `Math.random()`.

The helper must work in both the browser and Node — `globalThis.crypto` is available in both modern Node (≥19) and all current browsers.

---

## Files to change

### 1. New file — `src/lib/password-generator.ts`

```ts
const LOWERS = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
const UPPERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const DIGITS = '23456789';                 // no 0, 1
const SYMBOLS = '!@#$%^&*-_=+';
const ALL = LOWERS + UPPERS + DIGITS + SYMBOLS;

export const DEFAULT_PASSWORD_LENGTH = 14;

function pick(charset: string): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return charset[buf[0] % charset.length];
}

/** Generates a cryptographically-random password meeting composition rules. */
export function generatePassword(length: number = DEFAULT_PASSWORD_LENGTH): string {
  if (length < 8) throw new Error('Password length must be at least 8');

  // Always include at least one of each class
  const required = [pick(LOWERS), pick(UPPERS), pick(DIGITS), pick(SYMBOLS)];
  const remaining = Array.from({ length: length - required.length }, () => pick(ALL));
  const chars = [...required, ...remaining];

  // Fisher–Yates shuffle using crypto entropy
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
```

### 2. Update — `src/app/(admin-dashboard)/admin/users/page.tsx`

Locate the create-user form (around line 220–235 — the existing password input). Replace the single `<input type="password" />` with a control that includes:

- A text input that defaults to `type="text"` (visible) once the admin has either generated or typed a password.
- Three icon buttons inline with the input:
  - **Generate** (refresh / shuffle icon) — calls `generatePassword()` from `@/lib/password-generator` and sets the value.
  - **Copy** (clipboard icon) — `navigator.clipboard.writeText(form.password)`. On success, briefly show "Copied" tooltip text for 1.5 s.
  - **Toggle visibility** (eye icon) — flips between `type="text"` and `type="password"`.
- A small caption under the input: `"Click 'Generate' for a secure random password, or type your own."`
- The form's initial state should call `generatePassword()` once when the dialog opens, so a fresh password is pre-filled.
- The same `errors.password[0]` validation message rendering should remain.

After the existing successful-create logic (where `setShowDialog(false)` is called or the list is reloaded), open a new **success modal** instead of just closing the dialog. The success modal shows:

```
✓ User created

Name:     <name>
Email:    <email>
Role:     <role>
Password: <password>   [Copy]

⚠ This password won't be shown again. Copy it now and send it to the user.

[ Copy all credentials ]   [ Done ]
```

`Copy all credentials` puts the following text on the clipboard:

```
Name: <name>
Email: <email>
Password: <password>
Login: https://ncfe-lms.onrender.com/sign-in
```

`Done` closes the modal and reloads the user list. Use the existing modal styling pattern from the password-reset dialog around line 379–410 for consistency.

### 3. Update — same file, password-reset dialog (around line 379–410)

Apply the same treatment to the reset dialog: a generated password is pre-filled, with Generate / Copy / Eye buttons. After successful reset, show a smaller success modal with just `Email`, `New password`, and `Copy credentials` button.

### 4. No API change

`POST /api/v2/admin/users` and `POST /api/v2/admin/users/[id]/reset-password` are unchanged. Confirm by reading the routes — do not edit them.

---

## Tests

Add `tests/admin/password-generator.spec.ts`:

1. Open `/admin/users` create dialog — assert password field is non-empty on open (auto-generated).
2. Click Generate — assert the value changes to a new 14-char string.
3. Assert the generated value contains at least one lowercase, one uppercase, one digit, and one symbol.
4. Click Copy — assert clipboard contains the password (use Playwright's `clipboard-read` permission).
5. Submit the form with a `[E2E-${RUN_ID}]` user → assert the success modal renders with the same password the form had → assert `Copy all credentials` puts a multi-line block on the clipboard → click Done → assert new user appears in the list. Cleanup: delete the user via the admin UI (soft-delete is fine).
6. Reset password for the same user → assert the reset dialog auto-generates → submit → success modal renders.

Add a Node-side unit-style test by importing `generatePassword` directly in a `tests/unit/password-generator.spec.ts` and asserting: 100 generated passwords all have length 14, all contain ≥1 of each class, and uniqueness across 100 generations is 100% (collision probability is astronomically small; if it ever fails, the entropy source is broken).

Use the same RUN_ID + non-destructive rules from prior runs. Production database is `ncfe_lms` on Atlas; do not reset anything.

---

## Run, commit, deploy

1. `npm run dev` and click through the new flows manually first as a sanity check.
2. `npx playwright test tests/admin/password-generator.spec.ts tests/unit/password-generator.spec.ts` — both green.
3. `npm run lint` — passes.
4. `npm run build` — passes (catches TS errors).
5. `git add` only the modified files: `src/lib/password-generator.ts`, `src/app/(admin-dashboard)/admin/users/page.tsx`, the two new spec files.
6. Commit: `feat(admin): auto-generate passwords on user create + reset, with reveal/copy UX`.
7. `git push origin main` — Render auto-deploys.
8. Wait for the deploy to go live, then a 30-second smoke check on production: sign in as admin → open create-user dialog → confirm a password is auto-filled → close without submitting.

Print a one-line summary in chat: `Done. Auto-password generator live on production. Manual entry still works as fallback.`

---

## Hard constraints

- Do NOT change `User` model, `adminUserCreateSchema`, or any API route.
- Do NOT add a "must change password on first login" feature — that's a bigger change for next week.
- Do NOT attempt to send invitation emails — out of scope.
- Do NOT modify `.env*`, the database, or any pre-existing user.
- If the build fails on Render after push, read the error, fix locally, push again. If you can't fix it within two attempts, revert the commit and report.
