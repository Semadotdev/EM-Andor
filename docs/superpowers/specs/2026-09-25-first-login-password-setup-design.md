# First-Time Login Password Setup — Design

**Goal:** Force newly created agents to choose their own password at first login, and let admins re-flag an agent to require a new password without typing one themselves.

## Background

- `create-agent` (edge function, admin-only) creates each agent login with an admin-supplied temporary password (`email_confirm: true`).
- Agents sign in with that password and enter the dashboard directly — nothing forces a change.
- `AdminAccount` is admin-only, so non-admin agents have no self-service password change outside the reset-email flow.
- `AdminAgents` profile tab lets an admin set an agent's password directly; `AdminAccount` lets an admin edit their own credentials.

## Approach

A `user_metadata.password_setup_pending` boolean drives the flow end-to-end:

1. **Flag at creation** — `create-agent` sets `data: { password_setup_pending: true }` when creating the auth user. Existing agents (no flag) are unaffected.
2. **Detect on login** — `AdminLogin`, after a successful `signInWithPassword`, routes flagged users to `/admin/set-password` instead of `/admin`.
3. **Deep-link guard** — `AdminLayout` also redirects flagged users to `/admin/set-password` (covers saved sessions and direct navigation).
4. **Setup page** — new `/admin/set-password` route (public sibling of `login`), brand-deep shell matching `UpdatePassword`. New Password + Confirm, min-6 + match validation. Submit calls `supabase.auth.updateUser({ password, data: { password_setup_pending: false } })` — password and flag clear atomically — then stays signed in and navigates to `/admin`. No session → `/admin/login`; no flag → `/admin`.
5. **Admin reset-by-flag** — the admin no longer types passwords for other agents. `update-agent-account` drops password from the agent-management path (still accepted for admin self-service) and accepts `reset_password: true`, which sets `password_setup_pending: true` (metadata merge). `AdminAgents` profile tab replaces the "New password" input with a **Require new password** button.
6. **Admin self-service kept** — `AdminAccount` keeps its email/password form; `update-agent-account` continues to accept `password` for that path.

## Behavior decisions

- New agents only; legacy agents unaffected.
- Admin reset re-flags the agent; setup is forced at the agent's next sign-in.
- After first-time setup the agent stays signed in and lands on the dashboard.
- No schema, RLS, or SMTP changes. Two edge functions must be redeployed.

## Verification

`npm test` (Vitest), `npm run build` (Vite). Edge functions have no unit harness in this repo; verified by grep + manual deploy.

## Manual test checklist (post-deploy)

1. Admin creates an agent → new agent signs in with the temp password → lands on "Choose your password" → sets a new password → dashboard; next sign-in uses the new password without a setup prompt.
2. Admin opens that agent's Profile → no password field → **Require new password** → toast "Password reset required." → agent's next sign-in forces setup again.
3. Admin's own Account page still allows self-service email/password changes.
4. Existing agents sign in normally — no setup prompt.

## Out of scope

- Retroactive flagging of existing agents.
- Emailing agents (reset/forgot flows unchanged; delivery depends on the pending SMTP setup).
- Letting non-admin agents change their password outside the first-login / reset flows.