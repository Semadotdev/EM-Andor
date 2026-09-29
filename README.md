# E.M. Andor — Website & Admin Portal

Web platform for **E.M. Andor Realty and Development**: a public marketing site plus a
role-gated back office for admins and sales agents, backed by Supabase (Postgres, Auth,
Storage, Edge Functions).

---

## Stack

| Layer | Choice |
| --- | --- |
| Build tool | Vite 6 |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions (Deno) |
| Client | `@supabase/supabase-js` |
| PWA | `vite-plugin-pwa` (Workbox service worker) |
| Tests | Vitest 4, Testing Library, jsdom |
| Spreadsheet import | `read-excel-file` |

---

## Application layout

- **Public site** — served at `/`. Single-page marketing site: hero, stats, about,
  services, projects, why-choose-us, CTA, contact. Copy and content live in
  [`src/data/site.js`](src/data/site.js); the contact form writes to the `inquiries` table.
- **Admin portal** — served at `/admin/*`. Two audiences behind one login:
  - `admin` — dashboard, properties, projects & lots, agents, commissions, inquiries,
    notifications, CMS, activity log.
  - `agent_head` / `direct_agent` / `sub_agent` — available lots, sales,
    commissions, and downline.

Both live in the same SPA; see [Architecture](#architecture).

---

## Getting started

### Prerequisites

- Node.js 20+ and npm (developed against v26)
- A Supabase project you have access to
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/cli) — only needed to deploy
  Edge Functions
- Optional: `psql`, if you prefer applying the schema over the CLI
- Optional: Python 3 with [Pillow](https://pypi.org/project/Pillow/), only for regenerating
  PWA icons

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

`.env` is gitignored. Set both values:

| Variable | Where it comes from |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon `public` key |

`src/lib/supabase.js` throws on import if either is missing, so the app fails fast rather
than rendering with a broken client.

### Run

```bash
npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |

There is no lint or formatter configured in this repo.

---

## Database setup

The schema lives in a single file, [`supabase/schema.sql`](supabase/schema.sql). It is
**not** wired into the Supabase CLI migration pipeline — there is no `supabase/config.toml`
and no `supabase/migrations/` directory — so apply it directly:

1. Open the Supabase dashboard → **SQL Editor** → **New query**
2. Paste the full contents of `supabase/schema.sql`
3. Run it

Or against a Postgres connection directly:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

The file is written to be re-runnable against an existing database. Every object uses
`create table if not exists`, `add column if not exists`, or `create or replace function`,
and each RLS policy is preceded by a matching `drop policy if exists`, so re-applying
produces no duplicate errors. There is a `do $$` block that migrates legacy `map_x` /
`map_y` columns into `map_pins` before dropping them.

Be aware that because there is no migration history, nothing here tracks drift — the file
is the source of truth, and changes to it are not versioned as migrations.

### What it creates

**Tables** — `properties`, `inquiries`, `agents`, `commission_settings`, `commissions`,
`projects`, `project_commission_rates`, `sales`, `payments`, `activity_log`,
`cms_content`, `notification_settings`, `notification_history`.

**Functions** — `current_agent_id()`, `is_admin()`, `get_downline(root)`, `set_updated_at()`,
`delete_project(p_id)`.

**Storage** — a public `property-images` bucket, plus read/write policies on it. Property
image uploads go here (see `uploadPropertyImage` in `src/lib/api.js`).

**Seed data** — three draft CMS pages (`home-hero`, `about`, `contact`).

The file also enables row-level security and defines policies across most tables. These
are the authorization boundary for the portal, and Edge Functions bypass them by using the
service-role key. Review them before using this in production.

### Creating the first admin

`schema.sql` cannot create Supabase Auth users, and nothing seeds an admin. On a fresh
project you end up with an empty `agents` table and no way into `/admin`. To bootstrap:

1. Supabase dashboard → **Authentication** → **Users** → **Add user**, and create the
   login you want to use (note the email).
2. In the SQL Editor, insert the matching profile row, copying the user id from step 1:

   ```sql
   insert into public.agents (user_id, email, name, role)
   values (
     '<auth-user-id>',
     'you@example.com',
     'Your Name',
     'admin'
   );
   ```

`agents.role` is constrained to `admin`, `agent_head`, `direct_agent`, or `sub_agent`, and
`user_id` must match an `auth.users` id or the login will not resolve. Every subsequent
agent is created from the admin UI via the `create-agent` Edge Function rather than by hand.

---

## Edge Functions

Three Deno functions in [`supabase/functions/`](supabase/functions/):

| Function | Purpose |
| --- | --- |
| `create-agent` | Creates an agent's auth user and profile record |
| `delete-project` | Deletes a project and its lots, gated on password re-entry |
| `update-agent-account` | Updates an agent's login email and resets their password |

Each one re-authorizes the caller from the incoming `Authorization` header (via an
anon-key client) before doing any privileged work, then uses the service-role key
server-side. The service-role key is never exposed to the browser.

**Secrets required.** These live on the Supabase project, *not* in the frontend `.env`:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

With the CLI, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set by `supabase link`; the
service-role key must be supplied yourself — either in the dashboard under
**Edge Functions → Secrets**, or with:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
```

**Deploy** (requires the Supabase CLI). Set the secrets first — a function that deploys
without them will fail at runtime:

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>
supabase functions deploy create-agent
supabase functions deploy delete-project
supabase functions deploy update-agent-account
```

A custom email template for password resets lives at
[`supabase/email-templates/reset-password.html`](supabase/email-templates/reset-password.html)
and must be pasted into Supabase Auth → **Email Templates** → **Reset Password** for reset
emails to render correctly.

---

## Project structure

```
.
├── index.html                  Entry HTML
├── vite.config.js              React + Tailwind + PWA plugin config
├── vitest.config.js            Test config (jsdom, setup file)
├── vercel.json                 SPA rewrites + cache headers
├── scripts/
│   └── generate-pwa-icons.py   Regenerates PWA icons from src/assets/logo.png (needs Pillow)
├── supabase/
│   ├── schema.sql              Full database schema
│   ├── functions/              Deno Edge Functions
│   └── email-templates/        Custom auth email HTML
├── public/                     Static assets (favicon, images, PWA icons)
├── demo/                       Sample lot-import workbooks
└── src/
    ├── App.jsx                 Top-level router
    ├── main.jsx                React root
    ├── index.css               Global styles + Tailwind entry
    ├── assets/logo.png         Brand logo (imported by JS; source for PWA icons)
    ├── data/site.js            All public site copy and content
    ├── hooks/                  Shared hooks (useInstallPrompt)
    ├── lib/                    Data + business logic layer (see below)
    ├── test/                   Test setup and helpers
    └── components/
        ├── layout/             Navbar, Footer
        ├── sections/           Public site sections
        ├── shared/             Buttons, modals, icons; shared/ui/ has the design-system kit
        └── admin/              Admin + agent portal pages
            ├── AdminApp.jsx        Portal router — add new routes here
            └── AdminLayout.jsx     Shell, nav config, and auth state provider
```

### `src/lib/` — the data and domain layer

All Supabase access lives here; components do not query the database directly.

| Module | Responsibility |
| --- | --- |
| `supabase.js` | Single typed client, backed by `database.types.ts` |
| `api.js` | Properties, inquiries, CMS, notifications, activity log, image upload |
| `auth.js` | Reset/update password, first-login password setup |
| `agents.js` | Agent CRUD, downline, promotions, commission rates |
| `projects.js` | Projects, lots, per-project pricing, lot CRUD |
| `sales.js` | Reservation and sale flow, payments, commission records |
| `commissions.js` | Commission rates, split calculation, chain building |
| `ledger.js` | Payment ledger, amortization, CSV rows |
| `promotions.js` | Rank promotion thresholds and upline rewiring |
| `excel.js` | Lot workbook import (parse, validate) |
| `csv.js` | CSV export |
| `format.js` | Currency and relative-time formatting |
| `agentMeta.js` | Role labels, rank ordering, agent tree building |

---

## Architecture

### Routing

[`src/App.jsx`](src/App.jsx) owns the top-level split: `/admin/*` renders
[`src/components/admin/AdminApp.jsx`](src/components/admin/AdminApp.jsx), everything else
falls through to the public site. `AdminApp.jsx` nests its own routes under
[`AdminLayout.jsx`](src/components/admin/AdminLayout.jsx), which provides auth state to its
children through the React Router outlet context.

| Route | Component | Access |
| --- | --- | --- |
| `/admin/login`, `forgot-password`, `update-password`, `set-password` | `AdminLogin` etc. | Public |
| `/admin` | `Dashboard` | Any signed-in user |
| `/admin/projects`, `/admin/projects/:id` | `AdminProjects`, `ProjectDetail` | `AdminOnly` |
| `/admin/agents` | `AdminAgents` | `AdminOnly` |
| `/admin/commissions` | `AdminCommissions` | `AdminOnly` |
| `/admin/inquiries` | `AdminInquiries` | `AdminOnly` |
| `/admin/notifications` | `AdminNotifications` | `AdminOnly` |
| `/admin/cms` | `AdminCMS` | `AdminOnly` |
| `/admin/activity` | `AdminActivityLog` | `AdminOnly` |
| `/admin/lots` | `AgentLots` | `AgentOnly` |
| `/admin/sales` | `AgentSales` | `AgentOnly` |
| `/admin/my-commissions` | `AgentCommissions` | `AgentOnly` |
| `/admin/downline` | `AgentDownline` | `AgentOnly` |

Access control is a binary admin-vs-agent split, not a permission matrix. Two guards
enforce it:

```jsx
function AdminOnly({ children }) {
  const { agent } = useOutletContext()
  if (agent.role !== 'admin') return <Navigate to="/admin/lots" replace />
  return children
}
```

`AgentOnly` is the inverse — admins are bounced to `/admin/projects`, agents fall through.
The two guards also set the landing page each audience sees on login.

**Adding an admin page:** create the component in `src/components/admin/`, add its route
to `AdminApp.jsx` wrapped in the appropriate guard, then add a link to the nav config at the
top of `AdminLayout.jsx` — that array is grouped by label and split into separate admin and
agent sections, so a new page also needs its entry added to whichever list applies.

### Data access

All Supabase access lives in `src/lib/`; components do not query the database directly.
Each module owns one domain, and functions follow the existing pattern of querying and
returning `{ data, error }`-shaped results to the caller.

`src/lib/supabase.js` exports the single client, typed against
`src/lib/database.types.ts`. That file is generated by
[`supabase gen types`](https://supabase.com/docs/reference/cli/supabase-gen-types) and
checked in — regenerate it after changing the schema, or the client types drift.

For anything that needs the service-role key, use an Edge Function. It is never available
to the browser.

### Authentication

Agents created by an admin are flagged for first-login password setup, and
`needsPasswordSetup()` in `src/lib/auth.js` routes them to `/admin/set-password` instead of
the dashboard. Admins creating an account supply the new agent's password; editing an
existing agent's password instead sends a reset email. Admins verify their own current
password server-side before privileged actions.

### PWA

`vite.config.js` registers a Workbox service worker with `skipWaiting` and
`clientsClaim`, precaching JS/CSS/HTML, webfonts, and icons, with `index.html` as the
navigation fallback. The manifest's `start_url` is `/admin` but its scope is `/`, so the
service worker covers the public site as well.

To regenerate icons after changing the logo, replace `src/assets/logo.png` and run:

```bash
python3 scripts/generate-pwa-icons.py
```

This needs Pillow (`pip install pillow`). It writes `pwa-192.png`, `pwa-512.png`,
`pwa-maskable-192.png`, `pwa-maskable-512.png`, and `apple-touch-icon.png` into
`public/icons/`. Commit the regenerated files — existing installs will otherwise keep
serving the old icons from the service worker cache.

---

## Deployment

Deployment spans two systems — Supabase and Vercel — and the order matters. The Vercel step
goes last.

### 1. Supabase

1. Apply `supabase/schema.sql` (see [Database setup](#database-setup)). This also creates
   the `property-images` storage bucket.
2. Create the first admin (see [Creating the first admin](#creating-the-first-admin)).
3. Set the Edge Function secrets, then deploy the three functions
   (see [Edge Functions](#edge-functions)).
4. Paste `supabase/email-templates/reset-password.html` into Supabase Auth → **Email
   Templates** → **Reset Password**.

### 2. Vercel

The frontend is a static SPA.

1. Push the repo and import it into Vercel. Framework preset: **Vite**. Build command
   `npm run build`, output directory `dist`.
2. Add both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as project environment
   variables. These are build-time values, so a change requires a redeploy.
3. `vercel.json` handles the rest:
   - a catch-all rewrite to `/index.html` so client-side routes like `/admin/agents`
     resolve on hard refresh
   - `Cache-Control: public, max-age=31536000, immutable` for hashed `/assets/*`
   - `Cache-Control: public, max-age=0, must-revalidate` for `sw.js`, `index.html`, and
     `manifest.webmanifest`, so a service-worker update is never served from cache

If the Edge Functions are not deployed, the portal still loads but agent creation, project
deletion, and account updates will fail at runtime.

Note that Vercel preview deployments will build against whatever Supabase project the
`VITE_*` variables point at, which defaults to production.

---

## Notes

- The public site's copy, stats, project list, and contact details are hardcoded in
  `src/data/site.js`. The admin CMS writes to the `cms_content` table, but the public site
  does not read from it yet — CMS edits currently have no effect on the rendered site.
- The four workbooks in `demo/` are sample data for the lot import flow, not application
  fixtures.
- **Known issue:** the five files in `public/icons/` are all 540×540, but `vite.config.js`
  declares them as 192×192 and 512×512, and `scripts/generate-pwa-icons.py` writes
  192/512/180. The generator appears never to have been run, so the committed icons do not
  match the manifest they are declared in. Re-running the script corrects the dimensions;
  it has deliberately been left alone for now.
- Design and planning history for the portal lives in
  [`docs/superpowers/`](docs/superpowers/) — `specs/` holds design documents and `plans/`
  holds the per-feature implementation plans.
