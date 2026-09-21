# Agent & Commission System — Design Spec

**Date:** 2026-09-21
**Status:** Approved (design review)
**Related specs:** `2026-08-16-admin-dashboard-properties-design.md`, `2026-08-18-phase*.md`

## Goal

Add a four-level agent organization with lot-sales commissions and rule-based promotions to the existing EM Andor admin dashboard:

1. Roles `admin`, `agent_head`, `direct_agent`, `sub_agent` organized in a single-upline (recruiter) tree.
2. Agents sign in to the existing `/admin` dashboard and see only agent-scoped tabs: available lots, own sales, own commissions, and — when they have a downline — their downline's sales and commissions.
3. The admin records a sale by marking a lot **sold** and picking the selling agent; the system creates commission rows for the seller and each upline at that level's configured rate.
4. Commissions are tracked as `earned` → `paid`.
5. Promotions follow rules: **Sub → Direct** = 5 own lots sold + 5 registered recruits; **Direct → Agent Head** = 5 agents in their downline have themselves promoted to Direct.
6. Buyer payment tracking (the Excel `Buyers Ledger` format) is explicitly a later phase. Commission rows snapshot per-sale amounts so payment-based logic can be added later without rewriting history.

## Non-goals

- No buyer/installment payment ledger in this phase; Excel remains the system of record for collections. See "Future: buyer ledger" for the extension point.
- Commissions are earned at **sale recording** time based on lot price — not on collections.
- No public agent signup; the admin creates all accounts.
- No email/SMS notifications for promotions or commissions (activity log only).
- Agents cannot edit properties, inquiries, CMS, notifications, or commissions.
- No multi-admin management UI; additional admin accounts are managed via Supabase.

## Roles & hierarchy

| role           | description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `admin`        | Full access. Creates agents, records sales, edits settings, marks paid.  |
| `agent_head`   | Top agent level. Earns override on every sale in their downline.         |
| `direct_agent` | Mid level. Earns override on their downline's sales.                     |
| `sub_agent`    | Entry level.                                                              |

- Every agent has at most one `upline_id` (their recruiter). The admin is not part of the commission chain.
- Recruits always start as `sub_agent`, regardless of the recruiter's role.

## Architecture

- Keep the Vite + React SPA, Tailwind v4, Supabase (Postgres + Auth + Storage), deployed on Vercel.
- Add one **Supabase Edge Function** (`create-agent`) because creating auth users requires the service-role key, which must never reach the browser. The function verifies the caller is an admin, then creates the auth user + `agents` row.
- All other reads/writes continue to go through `@supabase/supabase-js` with the anon key; RLS is the enforcement boundary.
- Pure business logic (commission math, promotion rules) lives in `src/lib/` as plain functions so it is unit-testable without Supabase, matching the existing `format.js` / `csv.js` style.

## Data model

### Table: `agents`

| column       | type          | notes                                                                 |
| ------------ | ------------- | --------------------------------------------------------------------- |
| `id`         | uuid PK       | default `gen_random_uuid()`                                           |
| `user_id`    | uuid          | references `auth.users(id)` on delete cascade; unique; the login link |
| `email`      | text          | unique, not null; display/search mirror of the auth email             |
| `name`       | text          | not null                                                              |
| `phone`      | text          | nullable                                                              |
| `role`       | text          | not null default `sub_agent`; check in (`admin`,`agent_head`,`direct_agent`,`sub_agent`) |
| `upline_id`  | uuid          | references `agents(id)` on delete set null; null for admin           |
| `is_active`  | boolean       | not null default true                                                 |
| `created_at` | timestamptz   | default `now()`                                                       |
| `updated_at` | timestamptz   | trigger-managed                                                       |

Indexes: `agents(user_id)`, `agents(email)`, `agents(upline_id)`.

### Table: `commission_settings`

| column       | type          | notes                                                              |
| ------------ | ------------- | ------------------------------------------------------------------ |
| `id`         | uuid PK       |                                                                    |
| `role`       | text          | unique, not null; check in (`sub_agent`,`direct_agent`,`agent_head`) |
| `rate`       | numeric(6,4)  | not null; fraction of lot price, e.g. `0.0300`                     |
| `updated_at` | timestamptz   | trigger-managed                                                    |

Seed placeholder rates — **the admin must confirm these in the UI before the first sale**: `sub_agent 0.0300`, `direct_agent 0.0150`, `agent_head 0.0050`.

### Table: `commissions`

One row **per agent per sale**. Values are snapshots so later rate or role changes never rewrite history.

| column         | type          | notes                                              |
| -------------- | ------------- | -------------------------------------------------- |
| `id`           | uuid PK       |                                                    |
| `property_id`  | uuid          | references `properties(id)` on delete cascade; not null |
| `agent_id`     | uuid          | references `agents(id)` on delete restrict; not null |
| `role_at_sale` | text          | level used to pick `rate` at sale time             |
| `sale_price`   | numeric       | snapshot of `properties.price` at sale time        |
| `rate`         | numeric(6,4)  | snapshot of the configured rate                    |
| `amount`       | numeric       | `sale_price * rate`                                |
| `status`       | text          | not null default `earned`; check in (`earned`,`paid`) |
| `paid_at`      | timestamptz   | null until marked paid                             |
| `created_at`   | timestamptz   | default `now()`                                    |
| unique         |               | (`property_id`,`agent_id`)                         |

Indexes: `commissions(agent_id)`, `commissions(status)`.

### `properties` additions

| column    | type        | notes                                                        |
| --------- | ----------- | ------------------------------------------------------------ |
| `sold_by` | uuid        | references `agents(id)` on delete set null; null unless sold |
| `sold_at` | timestamptz | set when `status` becomes `sold`                             |

## Commission computation

Triggered when the admin saves a property with `status = 'sold'` and a selling agent:

1. **Validate:** `price` must be non-null and > 0, and `sold_by` must be an active agent. Otherwise block the save with an inline error.
2. **Resolve the chain:** selling agent → `upline_id` → `upline_id`, stopping at null or an admin row. Maximum 3 levels.
3. **Look up rates:** for each chain agent, read `commission_settings.rate` for their **current** role. If a role has no rate row, skip that level and record the skip in `activity_log` details.
4. **Insert commission rows:** one per chain agent, snapshotting `role_at_sale`, `rate`, `sale_price`, `amount`. `unique(property_id, agent_id)` prevents duplicates.
5. **Update the property:** `sold_by`, `sold_at = now()`, `status = 'sold'`.
6. **Re-evaluate promotions** for the seller (own-sales count changed) and for their upline chain.
7. **Activity log:** sale + commission entries.

### Re-sale and un-sale rules

- **Changing the selling agent on an already-sold property:** allowed only if none of that property's commission rows are `paid`. Existing rows are deleted and regenerated as `earned`. If any row is `paid`, block with "Commission already paid — reverse payment first."
- **Un-selling** (`status` changes away from `sold`): delete the property's `earned` commission rows; if any row is `paid`, block the status change.

## Promotion engine

Pure functions in `src/lib/promotions.js`:

```
computePromotion({ role, ownSales, directRecruits, downlineDirectAgents })
  → { eligibleFor: 'direct_agent' | 'agent_head' | null, counts }
```

Rules:

- **`sub_agent` → `direct_agent`:** `ownSales >= 5` **and** `directRecruits >= 5`.
  - `ownSales` = properties where `sold_by = agent`.
  - `directRecruits` = active agents with `upline_id = agent` (all-time, regardless of the recruit's current role).
- **`direct_agent` → `agent_head`:** `downlineDirectAgents >= 5`.
  - `downlineDirectAgents` = agents anywhere in the recursive downline whose current role is `direct_agent` and who are active.
  - No own-sales requirement for this rung (per approved design).
- Own-sales counts are **lifetime**, not reset per promotion.

**Triggers** (I/O lives in the API layer, rules stay pure):

- A sale is recorded (seller's `ownSales` changes).
- An agent is created or activated (`directRecruits` of the upline changes).
- A role changes (promotion can cascade: promoting X to Direct may qualify X's upline for Head). The API iterates until no further promotions, with a safety bound.

Promotions are applied automatically and logged to `activity_log` as `agent` / `promote` with `{ from, to, counts }`. No email notification (non-goal).

## Auth & RLS

### Agent accounts — Edge Function `create-agent`

`supabase/functions/create-agent/index.ts`:

1. Read the caller's JWT (supabase-js `functions.invoke` attaches it automatically).
2. Look up the caller in `agents`; require `role = 'admin'` and `is_active = true`. Reject otherwise (403).
3. `auth.admin.createUser({ email, password, email_confirm: true })` with the service-role client.
4. Insert the `agents` row with `user_id` = new auth user id, plus name/phone/role/upline.
5. On insert failure, best-effort `auth.admin.deleteUser(newUserId)` so no orphan logins remain.

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions by default; no manual secrets needed. Deploy requires the Supabase CLI and a linked project (`supabase functions deploy create-agent`).

### RLS redesign

Today's `schema.sql` hardcodes a single admin email in every policy. Replace with role-based helpers (all `security definer`, `stable`, `set search_path = public`):

- `current_agent()` — the `agents` row for `auth.uid()`.
- `is_admin()` — true when that row is `role = 'admin'` and active.
- `get_downline(root uuid)` — recursive CTE returning all descendant agent ids.

These are `security definer` so policies that call them cannot recurse into the `agents` policies.

| table                 | policy                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `properties`          | admin: all. Authenticated agent: select where `status = 'available'` **or** `sold_by` is self **or** `sold_by in get_downline(self)`. Anon: select pinned only (unchanged). |
| `inquiries`           | admin: all. Anon: insert only (unchanged). Agents: no access.                               |
| `agents`              | admin: all. Agent: select self + recursive downline. No update.                             |
| `commissions`         | admin: all (incl. mark paid). Agent: select where `agent_id` is self **or** in `get_downline(self)`. |
| `commission_settings` | admin: all. Authenticated agents: select (so an agent can see their rate).                  |
| `activity_log`        | admin: all (unchanged pattern, via `is_admin()`).                                           |
| `cms_content`, `notification_*` | unchanged.                                                                        |

**Bootstrap:** `schema.sql` cannot create auth users. Setup order is documented below: create the admin login in Supabase Auth first, then insert their `agents` row with `role = 'admin'` (SQL editor snippet provided in the setup checklist).

## Admin experience

`AdminDashboard.jsx` resolves the current agent via `fetchCurrentAgent()` and renders tabs by role.

Admin tabs: **Properties, Gallery, CMS, Inquiries, Notifications, Activity Log** (existing) + **Agents, Commissions** (new).

### Agents tab

- Org tree / flat list of all agents with role badges, active state, and search.
- **Create Agent modal:** name, email, phone, role, upline (agent select), temporary password → calls the Edge Function, then refreshes the tree.
- Row actions: activate/deactivate, view detail (own sales, commissions, downline), promotion-eligibility badge.
- An inactive agent's upline reference is shown but cannot receive new recruits.

### Commissions tab

- **Rates panel** (top of the tab): edits the three `commission_settings` rates (Sub Agent / Direct Agent / Agent Head) with save + inline validation. This is the only place rates change; existing commission rows are unaffected because they snapshot `rate`.
- All commission rows across agents; filters by agent and status; search by property.
- **Mark Paid** action (`earned` → `paid`, stamps `paid_at`), with a confirmation modal consistent with the app's existing `ConfirmModal` pattern.
- Earned vs paid totals per agent.

### Properties / sale recording

- `PropertyForm.jsx`: when `status = 'sold'`, a required **Selling Agent** select appears (active agents, any role). The save routes through the sale-aware API (property update + commissions + promotions + activity log).
- `AdminProperties.jsx` shows a "Sold by" column/badge.

## Agent experience

Agents sign in at the same `/admin/login` and see four tabs (admin ones are hidden):

- **Available Lots** — every lot with `status = 'available'`: name, location, area, price, image. These are "the lots they're able to sell"; closing is still coordinated with the admin.
- **My Sales** — lots where `sold_by` is the agent.
- **My Commissions** — own commission rows, earned vs paid totals, per-lot breakdown (their own rate and any override rows).
- **My Downline** — only when the agent has at least one downline agent: each member's sold lots and commission totals (scope-limited by `get_downline`).

`DashboardStats` is hidden for agents; a small own-stats row (own sales, own commissions, downline count) replaces it.

## Error handling

- Create-agent: 403 for non-admins; inline error for duplicate email; spinner; modal stays open on failure.
- Sale recording: inline validation for missing price / no seller; server errors bubble to the form's existing error banner; optimistic UI is not used for sales.
- Commission regeneration: blocked when paid rows exist, with a clear message.
- Mark paid: confirmation modal; optimistic update with revert on failure (matching the pin-toggle pattern).
- Agent tabs: standard loading / error+retry / empty states, matching existing admin components.
- Session expiry: existing redirect-to-login behavior applies unchanged.

## Testing

- **Pure unit tests:** `promotions.js` rules (including boundary counts of exactly 5 and the Direct→Head rule), `commissions.js` chain math (3 levels, chain shorter than 3, missing rate, price validation).
- **API tests:** new `agents.test.js` follows the existing `api.test.js` chain-mock pattern for `recordSale`, `fetchCurrentAgent`, agent/commission queries, and promotion application/cascade.
- **Component tests:** role gating (admin vs agent tab sets), Create Agent modal, Mark Paid confirmation, sale flow in `PropertyForm`.
- **Edge Function:** not covered by vitest (Deno runtime outside the Vite build); manual verification steps are listed in the implementation plan.

## Future: buyer ledger (out of scope)

- `commissions` is already keyed per property + agent with snapshotted amounts, so a later phase can add `buyers` and `payments` tables mirroring the Excel ledger columns (`DATE`, `OR#`, `AMOUNT`, `SURCHARGE`, `INTEREST`, `PRINCIPAL`, `BALANCE OF PRINCIPAL`, `REMARKS`) and a commission-on-collection model that references the sale.
- No schema changes in this phase are needed to keep that door open.

## Setup checklist (user actions)

1. Run the updated `supabase/schema.sql` in the Supabase SQL editor (idempotent; safe to re-run).
2. Create the admin login in Supabase → Authentication → Users, then insert the matching row:
   ```sql
   insert into public.agents (user_id, email, name, role)
   select id, email, 'Admin', 'admin' from auth.users where email = 'YOUR_ADMIN_EMAIL'
   on conflict (email) do update set role = 'admin';
   ```
3. Deploy the Edge Function (requires Supabase CLI, project already linked or `supabase link --project-ref nfikkjuuzwphswutocao`):
   ```bash
   supabase functions deploy create-agent
   ```
4. Sign in as admin → Commissions tab → Rates panel → confirm the placeholder rates before recording any sale.
5. Run `npm test` and `npm run build`.

## Files

**New:**

- `supabase/functions/create-agent/index.ts`
- `src/lib/agents.js` — agent / commission / sale API functions
- `src/lib/commissions.js` — pure commission math
- `src/lib/promotions.js` — pure promotion rules
- `src/components/admin/AdminAgents.jsx` (+ CreateAgentModal)
- `src/components/admin/AdminCommissions.jsx`
- `src/components/admin/AgentLots.jsx`
- `src/components/admin/AgentSales.jsx`
- `src/components/admin/AgentCommissions.jsx`
- `src/components/admin/AgentDownline.jsx`
- co-located `*.test.js(x)` for the above

**Modified:**

- `supabase/schema.sql` — new tables, property columns, role-based RLS helpers
- `src/lib/api.js` — sale-aware property save; existing exports preserved
- `src/components/admin/AdminDashboard.jsx` — role gating
- `src/components/admin/PropertyForm.jsx` — selling agent on sold
- `src/components/admin/AdminProperties.jsx` — sold-by display
- `src/components/admin/DashboardStats.jsx` — agent variant

## Verification

- `npm test` passes; `npm run build` succeeds.
- Manual: create one agent per level through the Agents tab; record a sale; verify commission rows for the whole chain; verify promotions at the 5-sale / 5-recruit / 5-Direct-downline boundaries; mark commissions paid; sign in as an agent at each level and confirm they see only their own + downline data; confirm cross-agent reads are rejected at the API/RLS boundary.
