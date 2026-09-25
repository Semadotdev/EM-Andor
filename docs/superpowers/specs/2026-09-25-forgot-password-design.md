# Forgot Password (`/admin` recovery via Supabase Auth)

Date: 2026-09-25

## Feature Description

Self-service password recovery for admin dashboard users. A user who is locked out can request a password-reset email, click the emailed link, set a new password, and return to the sign-in screen. Backed entirely by Supabase Auth's built-in recovery flow — no new tables, no SMTP credentials, no custom token logic.

## Acceptance Criteria

1. `/admin/login` shows a "Forgot password?" link that navigates to `/admin/forgot-password`.
2. `/admin/forgot-password` accepts an email, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, and always shows a generic success message ("If an account exists for that email, we've sent a reset link.") — it never reveals whether the email is registered.
3. The emailed link lands the user on `/admin/update-password`; supabase-js picks up the recovery token from the URL hash automatically.
4. `/admin/update-password` shows New Password + Confirm fields, validates (min 6 chars, match), and calls `supabase.auth.updateUser({ password })`.
5. After a successful update, the user is signed out and redirected to `/admin/login`.
6. An invalid or expired recovery session shows a clear "invalid or expired link" state with a link back to `/admin/forgot-password`.
7. Both new routes are public (registered outside the `AdminLayout` session guard).
8. Loading, error, and submitting states are handled gracefully in both pages.
9. Both pages have unit tests; all existing tests continue to pass.

## Non-Goals

- No custom password-reset email, token table, or SMTP setup (Supabase sends the built-in "Reset password" email).
- No change to password policy — stays at min 6 chars to match `create-agent` / `update-agent-account`.

## Architecture

- `src/lib/auth.js` — thin wrappers around the Supabase auth calls used by the two pages:
  - `resetPassword(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/admin/update-password' })`
  - `updatePassword(password)` → `supabase.auth.updateUser({ password })`
- `src/components/admin/ForgotPassword.jsx` — public route `/admin/forgot-password`. Email form, generic anti-enumeration success message, "Back to sign in" link. Mirrors the `AdminLogin` page shell (brand-deep background, white card, logo, gold-rule, `Input`).
- `src/components/admin/UpdatePassword.jsx` — public route `/admin/update-password`. Detects the recovery session on mount (`getSession()` + `onAuthStateChange` `PASSWORD_RECOVERY` listener, subscribed before a fresh `getSession()` to avoid missing the event). Renders the new-password form, and on success calls `supabase.auth.signOut()` then navigates to `/admin/login`.
- `src/components/admin/AdminLogin.jsx` — adds a "Forgot password?" link below the password field (with the caps-lock hint).
- `src/components/admin/AdminApp.jsx` — registers the two routes beside `login`, outside the `AdminLayout` guard:
  `<Route path="forgot-password" element={<ForgotPassword />} />`
  `<Route path="update-password" element={<UpdatePassword />} />`

## Data Flow

1. User clicks "Forgot password?" on login → `/admin/forgot-password`.
2. User submits email → `resetPassword(email)` → Supabase emails a recovery link pointing at `<origin>/admin/update-password#access_token=…&type=recovery`.
3. supabase-js (initialized at module load in `src/lib/supabase.js`) detects the hash tokens and establishes a recovery session; `UpdatePassword` subscribes on mount and sees the `PASSWORD_RECOVERY` event (with `getSession()` as fallback).
4. User submits new password → `updatePassword(password)` → on success `signOut()` → navigate to `/admin/login`.
5. User signs in normally with the new password.

## Error Handling

- `ForgotPassword`:
  - Client validation: valid email format required.
  - Network/exception: generic error message, button resets to "Send Reset Link".
  - Success regardless of whether the account exists (anti-enumeration).
- `UpdatePassword`:
  - No recovery session on load → "invalid or expired link" state with link back to forgot-password.
  - New password < 6 chars → inline error ("Password must be at least 6 characters.").
  - Mismatched confirmation → inline error.
  - `updateUser` error → surface the message in the alert box; keep password fields; button resets.
  - Weak-password error from Supabase surfaces in the same alert box.

## Testing

- `src/components/admin/ForgotPassword.test.jsx` — mock `../../lib/supabase.js`; assert:
  - submit calls `resetPasswordForEmail` with the email and a `redirectTo` ending in `/admin/update-password`;
  - generic success message shows; no reference to whether the account exists;
  - client-side validation blocks invalid email;
  - rejection shows an error and resets the button.
- `src/components/admin/UpdatePassword.test.jsx` — mock `../../lib/supabase.js`; assert:
  - with no recovery session, shows the invalid/expired state;
  - with a recovery session, typing a short password shows the min-length error; mismatched confirm blocks submit;
  - valid submit calls `updateUser`, then `signOut`, then navigates to `/admin/login`;
  - `updateUser` failure shows an alert and resets the button.
- `src/components/admin/AdminApp.test.jsx` — extend (existing file) with a routing test verifying `/admin/forgot-password` and `/admin/update-password` render their pages. Mock `../../lib/supabase.js` for the session-dependent layout routes so the existing suite keeps passing.

## Manual Configuration (Supabase Dashboard — not code)

1. Auth → URL Configuration → set **Site URL** to the deployed origin.
2. Add the deployed origin and `…/admin/update-password` to the **Redirect URLs** allowlist.
3. Auth → Email Templates → "Reset password" uses the default template (link is built from Site URL + `redirectTo`); no change required unless custom branding is desired.