# Admin Dashboard + Available Properties — Design Spec

**Date:** 2026-08-16
**Status:** Approved (design review)
**Related spec:** `2026-08-16-em-andor-website-design.md`

## Goal

Add a login-protected admin dashboard to the EM Andor static site and back it with Supabase so that:

1. The admin can manage (add / edit / delete / pin) an inventory of available lots & properties that appear in a new public **Available Properties** section.
2. Contact-form inquiries are stored in a database and surface in the admin dashboard instead of opening the visitor's mail app.

## Non-goals

- No multi-tenant / multi-role accounts. Single admin role.
- No email/SMS notifications for new inquiries (dashboard-only).
- Portfolio "Projects" section stays static (hardcoded in `src/data/site.js`).
- No online payment or reservations/booking flow.

## Architecture

- Keep the existing Vite + React + Tailwind SPA deployed on Vercel.
- Add `react-router-dom` for the `/admin` route. SPA fallback handled by a `vercel.json` rewrite: `/admin/*` → `/index.html`.
- Backend: **Supabase** (Postgres + Auth + Storage). The browser uses the Supabase JS SDK directly. No custom server code.
- Env vars (public-safe because of Row-Level Security):
  - `VITE_SUPABASE_URL` = `https://nfikkjuuzwphswutocao.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` (anon key from dashboard → Settings → API)

## Data model

### Table: `properties`

| column        | type           | notes                                   |
| ------------- | -------------- | --------------------------------------- |
| `id`          | uuid PK        | default `gen_random_uuid()`             |
| `name`        | text           | required                                |
| `type`        | text           | one of: residential lot, commercial lot, house & lot, development lot |
| `location`    | text           | required                                |
| `lot_area_sqm`| numeric        | nullable                                |
| `price`       | numeric        | PHP; nullable                           |
| `description` | text           | nullable, optional                     |
| `image_url`   | text           | nullable; public URL from Supabase Storage |
| `is_pinned`   | boolean        | default `false`; pinned ⇒ shown publicly |
| `created_at`  | timestamptz    | default `now()`                         |

### Table: `inquiries`

| column        | type           | notes                             |
| ------------- | -------------- | --------------------------------- |
| `id`          | uuid PK        | default `gen_random_uuid()`       |
| `name`        | text           | required                          |
| `email`       | text           | required                          |
| `phone`       | text           | required                          |
| `project_type`| text           | nullable                          |
| `message`     | text           | required                          |
| `is_read`     | boolean        | default `false`                   |
| `created_at`  | timestamptz    | default `now()`                   |

### Row-Level Security (RLS)

Applied in `supabase/schema.sql`:

- `properties`: authenticated admin can `SELECT` / `INSERT` / `UPDATE` / `DELETE` all rows. Anonymous (public site) can `SELECT` only rows where `is_pinned = true`.
- `inquiries`: anonymous can `INSERT`. Authenticated admin can `SELECT` / `UPDATE` / `DELETE`.
- Note: with RLS policies scoped to `auth.role() = 'authenticated'`, any signed-in user of the Supabase project is treated as admin. There is a single admin account in practice; acceptable for this scope.

### Storage

- Bucket `property-images` (private upload, public read via `storage.objects` policy so image URLs render on the public site).
- Uploaded images are referenced by public URL stored in `properties.image_url`.

## Public site changes

### New section: Available Properties

- Component `src/components/sections/AvailableProperties.jsx`, placed between `Projects` and `WhyChooseUs` in `App.jsx`.
- On mount, queries Supabase for `properties` where `is_pinned = true` (order by `created_at`).
- Card design mirrors the existing `Projects` card: image, type badge (gold), location with pin icon, lot area, price formatted as PHP (`₱ 1,234,567`), name, short description.
- States: loading skeleton → data grid / error message with retry / empty state ("No available properties yet").
- If the fetch fails, the section renders an unobtrusive error with a Retry button (does not break the rest of the page).

### Contact form rewiring

- `src/components/sections/Contact.jsx`: replace the `window.location.href = mailto:` submit with an async insert into the `inquiries` table.
- Keep existing client-side validation.
- Show an inline spinner on the submit button while in flight; success message on completion; inline error on failure with the form state preserved.

## Admin dashboard (`/admin`)

Routing under `react-router-dom`:

- `/admin/login` — email + password form using Supabase Auth.
- `/admin` — authenticated area. Redirects to `/admin/login` when unauthenticated; signs out with a button.
- Unknown `/admin/*` paths fall back to the dashboard.

### Layout

- Compact sidebar or top tabs: **Properties** | **Inquiries**, plus sign-out. Styled with existing brand tokens (green `brand`, gold `gold`, `surface`, `ink`).

### Properties tab

- Table/list of all properties: thumbnail, name, type, location, price.
- Row actions: **pin toggle** (pins/unpins live; optimistic update, reverts on failure), **Edit**, **Delete** (confirm before deleting).
- **Add Property** button opens a form (inline panel or modal) with fields:
  - name, type (select), location, lot area (number), price (number), description (textarea)
  - image upload → Supabase Storage `property-images` bucket
  - "Pin to website" checkbox
- Client-side validation; inline errors; submit spinner.

### Inquiries tab

- Newest-first list. Unread highlighted (e.g., dot/badge).
- Click to expand the full message.
- Actions: **Mark read / Mark unread**, **Delete** (with confirm).

## Error handling summary

- Public fetch: skeleton → error/retry → empty state.
- Contact form: inline errors, spinner, success banner, preserved form state on failure.
- Admin: inline validation/auth/upload errors; optimistic pin toggle with revert; delete confirms; session-expiry handling (401 → redirect to login).

## Security notes

- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are shipped to the client; RLS is the enforcement boundary.
- The Postgres password is never stored in the repo; schema is applied via the dashboard SQL editor or a local client, never committed with credentials.
- `supabase/schema.sql` contains only DDL + policies (no secrets).

## Setup checklist (user actions)

1. In Supabase dashboard: run `supabase/schema.sql` in the SQL editor.
2. Authentication → Users → create the admin email/password account.
3. Storage → create bucket `property-images` (public read) and add the storage policy from the script.
4. Vercel project settings → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → redeploy.

## Files

New:
- `src/lib/supabase.js`
- `src/components/sections/AvailableProperties.jsx`
- `src/components/admin/AdminApp.jsx` (routes + guard + layout)
- `src/components/admin/AdminLogin.jsx`
- `src/components/admin/AdminProperties.jsx` (+ property form)
- `src/components/admin/AdminInquiries.jsx`
- `supabase/schema.sql`
- `.env.example`
- `vercel.json`

Modified:
- `package.json` (add `@supabase/supabase-js`, `react-router-dom`)
- `src/App.jsx` (add router + admin routes)
- `src/main.jsx` (wrap in `BrowserRouter`)
- `src/components/sections/Contact.jsx` (DB submit)

## Verification

- `npm run build` succeeds.
- Local flow against live Supabase: login, add + pin a property → appears in public Available Properties; submit inquiry → appears in Inquiries with unread state; pin/unpin/edit/delete all work.
- After push: live site on Vercel shows pinned properties and stores inquiries.
