# Phase 1: Database Foundation

## Goal

Add database-level infrastructure that all subsequent admin features depend on: audit timestamps, property lifecycle status, and an activity log.

## Changes

### 1. `updated_at` columns

Add `updated_at timestamptz` to both `properties` and `inquiries` tables. Create a trigger function `set_updated_at()` that auto-sets `updated_at = now()` on every UPDATE. This gives audit timestamps without application-level bookkeeping.

- Default value: `now()` for existing rows (backfill on migration)
- Trigger fires on UPDATE only (not INSERT — `created_at` covers that)

### 2. Property `status` column

Add `status text not null default 'available'` to `properties`. Allowed values: `available`, `reserved`, `sold`.

- This replaces the binary pinned/unpinned concept for lifecycle tracking
- `is_pinned` stays — it controls public visibility independently of status
- Admin UI gets a status badge and a status dropdown in PropertyForm
- Public site is unaffected (it filters on `is_pinned`)

### 3. `activity_log` table

```sql
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,        -- 'property' | 'inquiry'
  entity_id uuid not null,
  action text not null,             -- 'create' | 'update' | 'delete'
  details jsonb default '{}',       -- optional: changed fields, old values
  created_at timestamptz not null default now()
);
```

- RLS: admin-only (same pattern as properties/inquiries)
- No public policies — anonymous users cannot read or write
- The `details` column is optional and stores lightweight context (e.g. `{"field": "status", "old": "available", "new": "sold"}`)
- Activity logging happens server-side via the API layer (not database triggers) so the frontend controls what gets logged

### 4. API layer changes

Add to `src/lib/api.js`:
- `logActivity(entityType, entityId, action, details?)` — inserts into `activity_log`
- Update `createProperty`, `updateProperty`, `deleteProperty` to call `logActivity` after success
- Update `deleteInquiry` to call `logActivity` after success

### 5. Admin UI changes

- **PropertyForm**: Add status dropdown (available/reserved/sold) after the "Pin to website" checkbox
- **AdminProperties table**: Add Status column with colored badge (green=available, yellow=reserved, red=sold)
- **ConfirmModal summary**: Show status in the property summary
- **AdminDashboard**: No changes yet (stats come in Phase 2)

## Files to modify

| File | Change |
|------|--------|
| `supabase/schema.sql` | Add columns, activity_log table, trigger, RLS |
| `src/lib/api.js` | Add `logActivity`, update CRUD functions |
| `src/components/admin/PropertyForm.jsx` | Add status field |
| `src/components/admin/AdminProperties.jsx` | Add status column |
| `src/components/admin/PropertyForm.test.jsx` | Update payload, add status tests |
| `src/components/admin/AdminProperties.test.jsx` | Add status column test |
| `src/components/shared/ConfirmModal.jsx` | No changes needed |
| `src/components/sections/AvailableProperties.test.jsx` | Verify no breakage |

## Testing

- All existing 73 tests must continue to pass
- New tests for: status field in PropertyForm, status badge in table, activity log API
- Build must succeed

## Out of scope

- Dashboard stats (Phase 2)
- Search/filter (Phase 3)
- Bulk actions (Phase 4)
- Content updates to activity_log (Phase 7)
