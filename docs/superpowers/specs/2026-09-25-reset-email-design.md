# Reset-Password Email Design (Supabase template)

Date: 2026-09-25

## Feature Description

A branded, paste-ready HTML email template for Supabase Auth **Email Templates → Reset password** (the recovery email sent by `supabase.auth.resetPasswordForEmail`). The design reuses the EM Andor website design system so the email is visually continuous with the site and the `/admin` auth pages it serves.

Note: this spec supersedes the "No custom password-reset email" non-goal from `2026-09-25-forgot-password-design.md` — the recovery *flow* is unchanged (still Supabase's built-in recovery), only the email's HTML is now customized.

## Deliverable

- `supabase/email-templates/reset-password.html` — self-contained template, paste-ready into the Supabase dashboard.
- Destination: Supabase Dashboard → Authentication → Email Templates → **Reset password** → Body (`<html>` content) and Subject.

## Subject

`Reset your password — E.M. Andor`

## Design System (from `src/index.css` `@theme`)

| Token | Hex | Usage in email |
| --- | --- | --- |
| brand-deep | `#00452a` | Header band, footer band, headline, CTA text |
| brand | `#006b3c` | Plain-text link color |
| brand-2 | `#009b4d` | "Password Reset" eyebrow |
| gold | `#f6d21a` | "ANDOR" in header, gold rule, CTA button bg |
| surface | `#f5f7f5` | Body background |
| ink | `#12352a` | Body copy |
| mist | `#e6ece7` | Card border, divider rule |
| ink/50 | `#66817a` | Helper/fine print |

Typography: display = **Archivo** (fallback Arial/Helvetica), body = **Inter** (fallback Arial/Helvetica). Webfonts degrade gracefully in clients that block them.

## Layout (top to bottom)

1. **Hidden preheader** — "Set a new password for your E.M. Andor dashboard account." (invisible; sets the snippet preview text).
2. **Header band** (`brand-deep`, full-width) — text wordmark **E.M. ANDOR** (white, "ANDOR" gold), sub-line *BUILDERS & ASSOCIATES* (spaced caps, white 72%), then a 56×4px gold pill rule. Mirrors the `/admin` auth page shells. The wordmark is **text, not `<img>`**, because the site logo is a bundled asset with no public URL — text renders in every client.
3. **Body** (`surface` bg) — white card (1px `mist` border, 16px radius):
   - Eyebrow "PASSWORD RESET" (brand-2, letter-spaced caps) — site `.eyebrow` pattern.
   - Headline "Reset your password" (brand-deep, Archivo bold).
   - Copy: request explanation + "This link expires shortly and can only be used once."
   - **Gold CTA button** "Reset Password" → `{{ .ConfirmationURL }}` — bulletproof (VML `v:roundrect` guarded by `[if mso]` for Outlook, standard `<a>` for everything else), 8px radius, brand-deep text.
   - Plain-text fallback link (`{{ .ConfirmationURL }}`, break-all) for text-only clients, labeled "If the button doesn't work…".
   - `mist` divider, then the no-action notice: "If you didn't request this, you can safely ignore this email and your password will not be changed."
4. **Footer band** (`brand-deep`, full-width):
   - Wordmark line "E.M. ANDOR BUILDERS & ASSOCIATES" (gold last two words).
   - Contact: `(043) 980 7189` · `emandorbuilders27@gmail.com` (tel:/mailto: links) and address from `src/data/site.js` (`250-G, P Burgos St., Poblacion, Brgy 12, Batangas City`).
   - Gold hairline rule, then © 2026 E.M. Andor Builders and Associates Dev't. Corp.

## Templating

- CTA + fallback link both use **`{{ .ConfirmationURL }}`** — the only variable needed. Supabase populates it from the dashboard **Site URL** + the `redirectTo` passed to `resetPasswordForEmail` (i.e. `<origin>/admin/update-password#access_token=…&type=recovery`).
- Subject and HTML body are pasted in the dashboard template editor; the file is otherwise plain static HTML (no Supabase `config.toml` exists for this project).

## Accessibility & email best practices

- 600px wide, table-based layout; inline styles + a small `<style>` block for `[if mso]` and `max-width:620px` MQ (card padding narrows, CTA centers).
- Contrast-compliant pairs: gold `#f6d21a` / `#00452a` (button), `#00452a` on `#f5f7f5`+white, brand-deep / white+.
- No external images, no JS, no `<style>` beyond email-safe CSS; `mso-hide:all` on preheader; `-ms-text-size-adjust`/`-webkit-text-size-adjust` enabled.
- All links `target="_blank"`, `word-break:break-all` on the long fallback URL.

## Deployment (manual — user action)

1. Supabase Dashboard → Authentication → **Email Templates**.
2. Select **Reset password**.
3. Subject: `Reset your password — E.M. Andor`.
4. Body: paste the full contents of `supabase/email-templates/reset-password.html`.
5. Confirm **Site URL** is set and that `<origin>/admin/update-password` is in the **Redirect URLs** allowlist (needed for the recovery link to land correctly).

## Test / Verify

- Open `supabase/email-templates/reset-password.html` in a browser (link is a harmless relative URL when not sent by Supabase) to sanity-check the layout at ≥600px and ≤420px widths.