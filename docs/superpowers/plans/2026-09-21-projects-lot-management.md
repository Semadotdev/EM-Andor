# Project-Based Lot Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Properties/Gallery admin with a project-first workflow: create a Farm Lot project (with per-role commission rates), import lots from Excel (Block/Lot/Area), and record sales that pay the agent chain at project rates.

**Architecture:** `projects` + `project_commission_rates` tables; `properties` becomes the lots table (adds `project_id`, `block_no`, `lot_no`). Client-side Excel parsing (`read-excel-file`) with a pure validation layer. Sales reuse the existing `savePropertyWithCommission` chain, with project rates overriding global per role. Properties/Gallery/PropertyForm/AdminPortfolio are deleted.

**Tech Stack:** React 19, Vite 6, Tailwind v4, Supabase (Postgres + RLS + PostgREST), Vitest 4 + Testing Library, `read-excel-file`.

**Spec:** `docs/superpowers/specs/2026-09-21-projects-lot-management-design.md`

---

## File Structure

**New:** `src/lib/excel.js`, `src/lib/projects.js`, `src/components/admin/AdminProjects.jsx`, `CreateProjectModal.jsx`, `ProjectDetail.jsx`, `UploadLotsModal.jsx`, `MarkSoldModal.jsx` (+ co-located tests).

**Modified:** `supabase/schema.sql`, `src/lib/sales.js`, `src/lib/api.js`, `src/components/admin/AdminDashboard.jsx`, `DashboardStats.jsx`, `src/components/sections/AvailableProperties.jsx`, `package.json`, `src/lib/database.types.ts`.

**Deleted:** `AdminProperties.jsx`, `AdminImageGallery.jsx`, `PropertyForm.jsx`, `AdminPortfolio.jsx` + their tests.

---

## Task 1: Schema — projects, rates, lot columns, RLS

**Files:** Modify `supabase/schema.sql`.

- [ ] **Step 1: Insert the projects block before `alter table public.properties enable row level security;`**

```sql
-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'farm_lot' check (type in ('farm_lot', 'housing', 'commercial', 'development')),
  address text not null,
  price_per_sqm numeric not null default 0 check (price_per_sqm >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_commission_rates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('sub_agent', 'direct_agent', 'agent_head')),
  rate numeric(6,4) not null default 0 check (rate >= 0 and rate <= 1),
  updated_at timestamptz not null default now(),
  unique (project_id, role)
);

create index if not exists project_commission_rates_project_id_idx
  on public.project_commission_rates(project_id);

alter table public.properties add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.properties add column if not exists block_no text;
alter table public.properties add column if not exists lot_no text;

create unique index if not exists properties_project_block_lot_idx
  on public.properties (project_id, block_no, lot_no)
  where project_id is not null;

alter table public.projects enable row level security;
alter table public.project_commission_rates enable row level security;

drop policy if exists "admin all on projects" on public.projects;
create policy "admin all on projects" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read projects" on public.projects;
create policy "public read projects" on public.projects
  for select to anon, authenticated using (true);

drop policy if exists "admin all on project_commission_rates" on public.project_commission_rates;
create policy "admin all on project_commission_rates" on public.project_commission_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read project_commission_rates" on public.project_commission_rates;
create policy "authenticated read project_commission_rates" on public.project_commission_rates
  for select to authenticated using (true);
```

- [ ] **Step 2: Add the triggers after the `set_updated_at()` function definition**

```sql
drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.project_commission_rates;
create trigger set_updated_at before update on public.project_commission_rates
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Verify** — `grep -n "projects\|project_commission_rates" supabase/schema.sql` shows tables before the FK alter and triggers after the function.

- [ ] **Step 4: Apply to the live project** via the Management API (token at `~/.supabase/access-token`), then verify the tables and policies exist. (Pattern used previously: POST the file contents to `/v1/projects/nfikkjuuzwphswutocao/database/query`.)

- [ ] **Step 5: Regenerate types** — `npx supabase gen types typescript --project-id nfikkjuuzwphswutocao --schema public > src/lib/database.types.ts`; confirm `projects` and `project_commission_rates` appear.

- [ ] **Step 6: Commit** — `feat(schema): add projects and per-project commission rates`.

---

## Task 2: Excel parsing library

**Files:** Create `src/lib/excel.js`, `src/lib/excel.test.js`; modify `package.json`.

- [ ] **Step 1: Add the dependency** — `npm install read-excel-file`.

- [ ] **Step 2: Write failing tests** covering: header aliases (`Block No`/`blk`/`block`, `Lot No`/`lot`, `Area`/`area (sqm)`), missing columns, blank rows skipped, non-numeric/zero area errors, in-file duplicates, duplicates against existing keys.

- [ ] **Step 3: Implement `src/lib/excel.js`**

```js
import readXlsxFile from 'read-excel-file'

const HEADER_ALIASES = {
  block_no: ['block no', 'block', 'blk no', 'blk', 'block number'],
  lot_no: ['lot no', 'lot', 'lot number'],
  area: ['area', 'area (sqm)', 'area sqm', 'sqm'],
}

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export function mapLotRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return { rows: [], errors: ['The file is empty.'] }

  const header = (rawRows[0] ?? []).map(normalize)
  const index = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    index[field] = header.findIndex((h) => aliases.includes(h))
  }
  const missing = Object.entries(index).filter(([, i]) => i === -1).map(([field]) => field)
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`Missing column(s): ${missing.map((f) => HEADER_ALIASES[f][0]).join(', ')}. Expected headers: Block No, Lot No, Area.`],
    }
  }

  const rows = []
  for (let i = 1; i < rawRows.length; i++) {
    const raw = rawRows[i] ?? []
    const blockRaw = raw[index.block_no]
    const lotRaw = raw[index.lot_no]
    const areaRaw = raw[index.area]
    if (String(blockRaw ?? '').trim() === '' && String(lotRaw ?? '').trim() === '' && String(areaRaw ?? '').trim() === '') continue
    const area = typeof areaRaw === 'number' ? areaRaw : Number(String(areaRaw ?? '').trim())
    rows.push({
      rowNumber: i + 1,
      block_no: String(blockRaw ?? '').trim(),
      lot_no: String(lotRaw ?? '').trim(),
      area,
    })
  }
  return { rows, errors: [] }
}

export function validateLotRows(rows, existingKeys = []) {
  const errors = []
  const seen = new Set(existingKeys.map((k) => `${normalize(k.block_no)}|${normalize(k.lot_no)}`))
  for (const row of rows) {
    if (!row.block_no) errors.push(`Row ${row.rowNumber}: Block No is required.`)
    if (!row.lot_no) errors.push(`Row ${row.rowNumber}: Lot No is required.`)
    if (!Number.isFinite(row.area) || row.area <= 0) errors.push(`Row ${row.rowNumber}: Area must be a number greater than 0.`)
    const key = `${normalize(row.block_no)}|${normalize(row.lot_no)}`
    if (row.block_no && row.lot_no && seen.has(key)) {
      errors.push(`Row ${row.rowNumber}: Block ${row.block_no} Lot ${row.lot_no} is duplicated.`)
    }
    seen.add(key)
  }
  return errors
}

export async function readLotsFile(file) {
  return readXlsxFile(file)
}
```

- [ ] **Step 4: Run the tests** — `npx vitest run src/lib/excel.test.js`.

- [ ] **Step 5: Commit** — `feat: add excel lot parsing and validation`.

---

## Task 3: Projects API layer

**Files:** Create `src/lib/projects.js`, `src/lib/projects.test.js`.

- [ ] **Step 1: Write failing tests** for: `fetchProjects`, `fetchProject`, `fetchProjectRatesMap`, `createProject` (insert + rates upsert), `updateProject` (update + reprice available lots), `fetchProjectLots`, `createLots` (derived name/price), `updateLot` (derived name/price), `deleteLot` (blocks non-available). Use the repo's chain-mock pattern.

- [ ] **Step 2: Implement** the functions exactly as drafted in the spec's data model: `fetchProjects`, `fetchProject`, `fetchProjectRates`, `fetchProjectRatesMap`, `createProject`, `upsertProjectRates`, `updateProject` (+ `repriceAvailableLots`), `fetchProjectLots`, `createLots`, `updateLot`, `deleteLot`.

Key rules:
- `createLots` payload per row: `{ project_id, name: 'Block {block} Lot {lot}', type: 'farm lot', location: project.address, block_no, lot_no, lot_area_sqm: area, price: round(area * project.price_per_sqm, 2), status: 'available', is_pinned: false, map_pins: [] }`.
- `repriceAvailableLots` updates `price` for `status = 'available'` lots only.
- `deleteLot` throws `'Only available lots can be deleted. Un-sell the lot first.'` when status !== 'available'.
- Activity log entries via `logActivity` (fire-and-forget): `project/create`, `project/update`, `project/import_lots`.

- [ ] **Step 3: Run tests** and **commit** — `feat: add projects data layer`.

---

## Task 4: Project-rate commission resolution

**Files:** Modify `src/lib/sales.js`, `src/lib/sales.test.js`.

- [ ] **Step 1: Add a failing test** — when a lot's project has rates, they override global rates per role; missing project roles fall back to global.

- [ ] **Step 2: Implement** — in `createCommissionRows`, load both maps and merge:

```js
const [projectRates, globalRates, chain] = await Promise.all([
  fetchProjectRatesMap(property.project_id),
  fetchCommissionRatesMap(),
  resolveChainForAgent(property.sold_by),
])
const rates = { ...globalRates, ...projectRates }
```

Import `fetchProjectRatesMap` from `./projects.js`. Add `vi.mock('./projects.js', () => ({ fetchProjectRatesMap: vi.fn().mockResolvedValue({}) }))` to `sales.test.js` and update existing expectations if needed.

- [ ] **Step 3: Run tests** and **commit** — `feat: resolve commissions from project rates with global fallback`.

---

## Task 5: Projects list + Create Project modal

**Files:** Create `AdminProjects.jsx`, `CreateProjectModal.jsx` (+ tests).

- [ ] **Step 1: `AdminProjects`** — loads `fetchProjects()` plus per-project lot counts (`fetchProjectLots` or a count query); renders a table/cards: name, type badge, address, price/m², available/sold counts, and a "Create Project" button; opening a project selects it (renders `ProjectDetail`). Loading/error/empty states match `AdminAgents`.
- [ ] **Step 2: `CreateProjectModal`** — props `{ onClose, onCreated }`. Fields: name, type select (`farm_lot` enabled; `housing`/`commercial`/`development` disabled with a "Coming soon" suffix), address, price/m², and three rate inputs prefilled from `fetchCommissionRates()` (percent → fraction on save). Validation inline. Submits `createProject({ name, type, address, pricePerSqm, rates })`, then `onCreated()`.
- [ ] **Step 3: Tests** — renders projects; create modal disables non-farm types, prefills rates, submits the right payload; error surfaced.
- [ ] **Step 4: Commit** — `feat(admin): add projects list and create project modal`.

---

## Task 6: Project detail — lots table, pin, edit, delete, mark sold

**Files:** Create `ProjectDetail.jsx`, `MarkSoldModal.jsx` (+ tests).

- [ ] **Step 1: `ProjectDetail`** — props `{ project, onBack }`. Header with project info + counts. Loads `fetchProjectLots(project.id)`. Table columns: Block, Lot, Area, Price, Status, Sold by, Actions.
  - **Pin toggle** per lot via `setPropertyPinned` (optimistic with revert, matching `AdminProperties`' old pattern).
  - **Mark Sold** (available only) opens `MarkSoldModal`.
  - **Edit** inline/modal: block/lot/area → `updateLot` (recomputes name/price); surface unique-violation as "Block/Lot already exists in this project."
  - **Delete** (available only) with `ConfirmModal` → `deleteLot`; show its error verbatim when blocked.
- [ ] **Step 2: `MarkSoldModal`** — props `{ lot, project, onClose, onSold }`. Loads active non-admin agents (`fetchAllAgents`), seller select, confirm; calls `savePropertyWithCommission({ mode: 'edit', propertyId: lot.id, payload: { ...lot, status: 'sold', sold_by: sellerId } })`; surfaces `fieldErrors` and the paid-commission message like `PropertyForm` did; then `onSold()`.
- [ ] **Step 3: Tests** — lists lots; mark-sold payload; pin toggle; delete blocked message; edit recomputes.
- [ ] **Step 4: Commit** — `feat(admin): add project detail with lot actions and sale recording`.

---

## Task 7: Upload Lots (Excel) modal

**Files:** Create `UploadLotsModal.jsx` (+ test).

- [ ] **Step 1:** Props `{ project, onClose, onImported }`. File input → `readLotsFile` → `mapLotRows` → `validateLotRows(rows, existingKeys)` where existing keys come from `fetchProjectLots(project.id)`. Preview table (row number, block, lot, area, error highlight). Import disabled while `errors.length > 0` or `rows.length === 0`. Import calls `createLots(project.id, project, rows)`, then `onImported()`.
- [ ] **Step 2: Tests** — mock `../../lib/excel.js`; valid file enables import and calls `createLots`; invalid rows disable import and show errors; header error shown.
- [ ] **Step 3: Commit** — `feat(admin): add excel lot upload with preview`.

---

## Task 8: Rewire dashboard, remove old tabs, clean API, update stats

**Files:** Modify `AdminDashboard.jsx`, `DashboardStats.jsx`, `api.js`, `api.test.js`, `AdminDashboard.test.jsx`, `DashboardStats.test.jsx`. Delete `AdminProperties.jsx`, `AdminImageGallery.jsx`, `PropertyForm.jsx`, `AdminPortfolio.jsx` + tests.

- [ ] **Step 1: Delete** the four components and their test files (`AdminProperties.test.jsx`, `AdminImageGallery.test.jsx`, `PropertyForm.test.jsx`, `AdminPortfolio.test.jsx`).
- [ ] **Step 2: `AdminDashboard`** — admin tabs become `projects, cms, inquiries, agents, commissions, notifications, activity`; default tab `'projects'`; import/render `AdminProjects`; remove Properties/Gallery imports and renders.
- [ ] **Step 3: `DashboardStats`** — 4 cards: **Total Lots** (`propertyStats.total`), **Projects** (`propertyStats.projects`), **Total Inquiries**, **Unread**. Extend `fetchPropertyStats` in `api.js` with a `projects` count (`supabase.from('projects').select('id')` length).
- [ ] **Step 4: `api.js` cleanup** — remove `bulkDeleteProperties`, `bulkSetPropertyPinned`, and `fetchPropertyStatusCounts` (confirm no references remain via `rg`), and their tests. Keep the rest.
- [ ] **Step 5: Update tests** — `AdminDashboard.test.jsx` mocks `AdminProjects` and asserts the new tab set/default; `DashboardStats.test.jsx` asserts the Projects card.
- [ ] **Step 6: Run the full suite + build**, then **commit** — `refactor(admin): replace properties/gallery with projects`.

---

## Task 9: Public Available Properties shows project info

**Files:** Modify `src/lib/api.js`, `src/components/sections/AvailableProperties.jsx` (+ test).

- [ ] **Step 1:** `fetchPinnedProperties` selects `'*, projects(name)'`; the card shows the project name when present.
- [ ] **Step 2:** Add `'farm lot': 'Farm Lot'` to the type labels used by the section.
- [ ] **Step 3: Update the test** fixture/assertions; run tests; **commit** — `feat(public): show project name on available lots`.

---

## Task 10: Verification and live smoke

- [ ] **Step 1:** `npm test` (all green) and `npm run build` (succeeds).
- [ ] **Step 2:** Confirm the live DB has `projects`/`project_commission_rates` and the lot columns (Management API query), and that `src/lib/database.types.ts` includes them.
- [ ] **Step 3:** Manual smoke (user): create a Farm Lot project → upload an Excel with a few Block/Lot/Area rows → confirm lots appear with derived prices → Mark Sold with a Sub Agent → confirm three commission rows at the project's rates.
- [ ] **Step 4:** Commit any fix-ups only if needed.
