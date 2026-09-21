# Project-Based Lot Management (Farm Lot) — Design Spec

**Date:** 2026-09-21
**Status:** Approved (design review)
**Related specs:** `2026-09-21-agent-commissions-design.md`

## Goal

Replace the flat Properties admin with a project-first workflow:

1. **Admin creates a Project** — name, type, address, price per m², and the project's commission setup (per-role rates). Only **Farm Lot** is implemented; Housing, Commercial, and Development are visible but disabled as "Coming soon".
2. **Admin uploads an Excel file** of the project's lots — columns for **Block No, Lot No, Area** — with a validation preview before import.
3. **Sales generate the commission chain** — when a lot is marked sold with a selling agent, the seller and each upline earn commission at the project's rates (falling back to global rates), using the existing chain/snapshot logic.

The existing admin **Properties** and **Gallery** tabs are deleted; the **Projects** tab replaces them. Existing property rows and commissions are kept as legacy data.

## Non-goals

- Housing / Commercial / Development project processes (selectable but disabled).
- Per-individual-agent commission overrides (the rates table is shaped so this can be added later without migration).
- Public project pages; the public Available Properties section stays as-is, fed by pinned lots.
- Property image management (the Gallery tab is removed; `AdminCMS` keeps its own image upload).
- Map-pin authoring for new lots (legacy columns remain, not surfaced).

## Data model

### Table: `projects`

| column          | type          | notes                                                        |
| --------------- | ------------- | ------------------------------------------------------------ |
| `id`            | uuid PK       | default `gen_random_uuid()`                                  |
| `name`          | text          | not null                                                     |
| `type`          | text          | not null default `farm_lot`; check in (`farm_lot`,`housing`,`commercial`,`development`) |
| `address`       | text          | not null                                                     |
| `price_per_sqm` | numeric       | not null, check >= 0                                         |
| `created_at`    | timestamptz   | default `now()`                                              |
| `updated_at`    | timestamptz   | trigger-managed                                              |

### Table: `project_commission_rates`

| column       | type         | notes                                                            |
| ------------ | ------------ | ---------------------------------------------------------------- |
| `id`         | uuid PK      |                                                                  |
| `project_id` | uuid         | references `projects(id)` on delete cascade; not null            |
| `role`       | text         | not null; check in (`sub_agent`,`direct_agent`,`agent_head`)     |
| `rate`       | numeric(6,4) | not null; check 0..1                                             |
| unique       |              | (`project_id`,`role`)                                            |

### `properties` (the lots table) additions

| column       | type   | notes                                                     |
| ------------ | ------ | --------------------------------------------------------- |
| `project_id` | uuid   | references `projects(id)` on delete set null; nullable (legacy rows) |
| `block_no`   | text   | nullable                                                  |
| `lot_no`     | text   | nullable                                                  |

Partial unique index: `(project_id, block_no, lot_no)` where `project_id is not null`.

Imported lots set: `name = 'Block {block_no} Lot {lot_no}'`, `type = 'farm lot'`, `location = project.address`, `lot_area_sqm = area`, `price = round(area × project.price_per_sqm, 2)`, `status = 'available'`, `is_pinned = false`, `map_pins = []`.

### RLS

| table                     | policy                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| `projects`                | admin all; anon + authenticated select (public marketing info)          |
| `project_commission_rates`| admin all; authenticated select                                        |
| `properties`              | unchanged (admin all; agent available/own/downline; anon pinned)        |

## Commission resolution

`sales.js` `createCommissionRows` resolves rates per role from `project_commission_rates` for the lot's `project_id`, falling back to the global `commission_settings` for any missing role. Everything else is unchanged: chain walk (max 3, admin stop), snapshots (`rate`, `sale_price`, `amount`, `role_at_sale`), `unique(property_id, agent_id)`, paid-block, self-healing regeneration, and promotion evaluation.

## Excel import

- Dependency: `read-excel-file` (browser build, small).
- `src/lib/excel.js`:
  - `mapLotRows(rawRows)` — case/space tolerant header mapping (`block no` / `blk` / `block`, `lot no` / `lot`, `area` / `area (sqm)`), returns `{ rows: [{ block_no, lot_no, area }], errors }`.
  - `validateLotRows(rows, existingKeys)` — required columns, non-empty block/lot, `area > 0` finite, duplicates within the file, duplicates against the project's existing `(block_no, lot_no)`.
  - `readLotsFile(file)` — thin wrapper over `read-excel-file` that returns raw rows for `mapLotRows`.
- Import UI: preview table with per-row errors, Import disabled while errors exist, single batch insert, success toast with the count.
- Validation is pure and unit-tested; the file-reader wrapper is covered by component tests via a mock.

## Admin UX

### Projects tab (first admin tab, new default)

- **List:** name, type badge (Farm Lot), address, price/m², available/sold lot counts, lot total. Row action: open detail.
- **Create Project modal:** name, type select (only `farm_lot` enabled; others disabled with "Coming soon"), address, price/m², and the three commission rate inputs (%, prefilled from global `commission_settings`). Creating a project upserts its three rate rows.
- **Project detail:**
  - Header: name, type, address, price/m², counts.
  - **Upload Lots** → Excel import modal (preview + import).
  - Lots table: Block, Lot, Area, Price, Status, Sold by, and row actions **Pin toggle**, **Mark Sold** (available lots only), **Edit** (block/lot/area), **Delete** (available lots only, with confirm — sold lots must be un-sold first, which enforces the paid-commission block).
  - **Mark Sold modal:** active-agent seller select + confirmation; routes through `savePropertyWithCommission` with `{ status: 'sold', sold_by }` so commissions and promotions run.
  - Editing the project's price/m² reprices **available** lots only; sold lots keep their snapshot.

### Removal

- Delete `AdminProperties.jsx`, `AdminImageGallery.jsx`, `PropertyForm.jsx`, `AdminPortfolio.jsx` (dead code) and their test files.
- `AdminDashboard`: remove the Properties/Gallery tabs and imports; add Projects; default admin tab becomes `projects`.
- `DashboardStats`: keep lot stats, add a Projects count (via `fetchPropertyStats` extension).
- `api.js`: remove functions that become unused — `bulkDeleteProperties`, `bulkSetPropertyPinned`, and `fetchPropertyStatusCounts` (verify unreferenced) — with their tests. **Keep** `fetchProperties`, `fetchPinnedProperties`, `createProperty`, `updateProperty`, `setPropertyPinned`, `deleteProperty`, `uploadPropertyImage`, `fetchPropertyStats` (still used by the project detail actions, `sales.js`, `AdminCMS`, and the public section).
- Pinning is preserved via the lot-row toggle so the public section stays fed.

## Public site

Available Properties stays; cards show the project name when present and use a `farm lot` type label. No new public routes.

## Error handling

- Excel: file-read failure, missing columns, and per-row errors all render in the import modal; import never partially applies (validate everything first, single insert).
- Project create: inline validation (name/address/price/m² > 0, rates 0–100%).
- Mark sold: same error surfacing as the previous sale flow (`fieldErrors`, paid-commission block).
- Lot edit/delete: confirmation for delete; unique-index violations surfaced as "Block/Lot already exists in this project."

## Testing

- Pure unit tests: `excel.js` mapping/validation (including duplicate and bad-area cases), project-rate fallback in `sales.js`, `projects.js` CRUD queries.
- Component tests: Projects list, Create Project modal (disabled types, rates prefilled), import preview (errors block import), project detail (pin/mark-sold/edit/delete), updated AdminDashboard tabs/default, DashboardStats projects count.
- Deleted components' tests are deleted; `AdminDashboard.test.jsx` updated for the new tab set.
- Verification: full suite + build + live smoke (create project → import Excel → mark sold → three commission rows at project rates).

## Setup / verification

1. Apply the updated `supabase/schema.sql` to the live project (idempotent).
2. Regenerate `src/lib/database.types.ts`.
3. `npm test`, `npm run build`.
4. Manual: create a Farm Lot project, upload a small Excel, mark a lot sold, confirm the commission chain.

## Files

**New:** `src/lib/excel.js`, `src/lib/projects.js`, `src/components/admin/AdminProjects.jsx`, `CreateProjectModal.jsx`, `ProjectDetail.jsx`, `UploadLotsModal.jsx`, `MarkSoldModal.jsx` (+ co-located tests).

**Modified:** `supabase/schema.sql`, `src/lib/sales.js`, `src/lib/api.js`, `src/components/admin/AdminDashboard.jsx`, `DashboardStats.jsx`, `src/components/sections/AvailableProperties.jsx`, `package.json`.

**Deleted:** `AdminProperties.jsx`, `AdminImageGallery.jsx`, `PropertyForm.jsx`, `AdminPortfolio.jsx` and their tests.

## Confirmed assumptions

1. Lot naming `Block {block} Lot {lot}`.
2. Project price/m² edits reprice available lots only.
3. Small per-lot edit/delete actions live inside a project (no general Properties admin).
4. "Coming soon" types are visible but disabled.
5. Agents' Available Lots cards gain the project name; no agent-facing project pages.
