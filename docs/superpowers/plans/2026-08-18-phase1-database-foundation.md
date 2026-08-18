# Phase 1: Database Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-level infrastructure: audit timestamps, property lifecycle status, and an activity log.

**Architecture:** Extend the existing Supabase schema with new columns and a table. Add a `logActivity` API function that the existing CRUD functions call after successful operations. Add a status dropdown to the property form and a status badge column to the properties table.

**Tech Stack:** PostgreSQL (Supabase), React, Vitest, @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `supabase/schema.sql` | Add `updated_at` columns, trigger, `status` column, `activity_log` table, RLS |
| `src/lib/api.js` | Add `logActivity()`, update CRUD functions to call it |
| `src/components/admin/PropertyForm.jsx` | Add status dropdown, include in state/payload |
| `src/components/admin/PropertyForm.test.jsx` | Add status to payload, add status dropdown test |
| `src/components/admin/AdminProperties.jsx` | Add Status column with colored badge |
| `src/components/admin/AdminProperties.test.jsx` | Add status to sample data, test status badge |
| `src/components/admin/PropertyForm.confirm-summary.test.jsx` | Verify status shows in confirm summary |

---

### Task 1: Update database schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add `updated_at` columns and trigger to schema.sql**

Append after the existing storage policies (line 117):

```sql
-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add updated_at to properties
alter table public.properties add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_updated_at on public.properties;
create trigger set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Add updated_at to inquiries
alter table public.inquiries add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_updated_at on public.inquiries;
create trigger set_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();

-- Add status to properties
alter table public.properties add column if not exists status text not null default 'available';

-- Activity log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on activity_log" on public.activity_log;
  execute format(
    'create policy "admin all on activity_log" on public.activity_log
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

- [ ] **Step 2: Verify schema syntax**

Run: `cat supabase/schema.sql | head -200` to verify no syntax errors (this is a client-side schema file, not executed against a live DB).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): add updated_at, status column, and activity_log table"
```

---

### Task 2: Update API layer

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add `logActivity` function**

Add at the top of `api.js` after the imports:

```javascript
export async function logActivity(entityType, entityId, action, details = {}) {
  const { error } = await supabase.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    details,
  })
  if (error) throw error
}
```

- [ ] **Step 2: Update `createProperty` to log activity**

Change `createProperty` to:

```javascript
export async function createProperty(property) {
  const { data, error } = await supabase.from('properties').insert(property).select().single()
  if (error) throw error
  logActivity('property', data.id, 'create').catch(() => {})
  return data
}
```

- [ ] **Step 3: Update `updateProperty` to log activity**

Change `updateProperty` to:

```javascript
export async function updateProperty(id, updates) {
  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  logActivity('property', id, 'update', { fields: Object.keys(updates) }).catch(() => {})
  return data
}
```

- [ ] **Step 4: Update `deleteProperty` to log activity**

Change `deleteProperty` to:

```javascript
export async function deleteProperty(id) {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
  logActivity('property', id, 'delete').catch(() => {})
}
```

- [ ] **Step 5: Update `deleteInquiry` to log activity**

Change `deleteInquiry` to:

```javascript
export async function deleteInquiry(id) {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw error
  logActivity('inquiry', id, 'delete').catch(() => {})
}
```

- [ ] **Step 6: Run existing tests to verify no breakage**

Run: `npm run test`
Expected: All 73 tests pass (logActivity calls are fire-and-forget with `.catch(() => {})`)

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.js
git commit -m "feat(api): add logActivity and wire into CRUD functions"
```

---

### Task 3: Add status field to PropertyForm

**Files:**
- Modify: `src/components/admin/PropertyForm.jsx`
- Modify: `src/components/admin/PropertyForm.test.jsx`

- [ ] **Step 1: Add status to form state in PropertyForm.jsx**

In the `useState` for `form` (line 20-28), add `status`:

```javascript
const [form, setForm] = useState({
  name: property?.name ?? '',
  type: property?.type ?? '',
  location: property?.location ?? '',
  lot_area_sqm: property?.lot_area_sqm ?? '',
  price: property?.price ?? '',
  description: property?.description ?? '',
  status: property?.status ?? 'available',
  is_pinned: property?.is_pinned ?? false,
})
```

- [ ] **Step 2: Add status to the payload in `doSave`**

In the `payload` object inside `doSave` (around line 126-147), add:

```javascript
const payload = {
  name: form.name.trim(),
  type: form.type,
  location: form.location.trim(),
  lot_area_sqm: form.lot_area_sqm === '' ? null : Number(form.lot_area_sqm),
  price: form.price === '' ? null : Number(form.price),
  description: form.description.trim() || null,
  status: form.status,
  image_url: finalImageUrl || null,
  is_pinned: form.is_pinned,
  map_pins: pins.map((p) => {
    // ... existing map_pins logic
  }),
}
```

- [ ] **Step 3: Add status dropdown to the form JSX**

After the "Pin to website" checkbox block (around line 364-369), add:

```jsx
<div className="sm:col-span-2">
  <label htmlFor="pf-status" className="mb-1.5 block text-sm font-semibold text-brand-deep">
    Status
  </label>
  <select id="pf-status" className={inputCls} value={form.status} onChange={setField('status')}>
    <option value="available">Available</option>
    <option value="reserved">Reserved</option>
    <option value="sold">Sold</option>
  </select>
</div>
```

- [ ] **Step 4: Add status to the confirm modal summary**

In the ConfirmModal children section, after the "Pinned" row, add:

```jsx
<div className="flex justify-between gap-4">
  <dt className="font-semibold text-brand-deep shrink-0">Status</dt>
  <dd className="text-right text-ink/70 capitalize">{form.status}</dd>
</div>
```

- [ ] **Step 5: Update test payload in PropertyForm.test.jsx**

Update the `payload` object (line 14-24) to include status:

```javascript
const payload = {
  name: 'Andor Ridge Lot A',
  type: 'residential lot',
  location: 'Batangas City',
  lot_area_sqm: 150,
  price: 1500000,
  description: 'Corner lot',
  status: 'available',
  image_url: null,
  is_pinned: false,
  map_pins: [],
}
```

- [ ] **Step 6: Add test for status dropdown**

Add a new test after the "shows a property summary" test:

```javascript
it('defaults status to available and allows changing it', async () => {
  createProperty.mockResolvedValue({ id: 'p1' })
  const user = userEvent.setup()

  render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

  await fillRequiredFields(user)
  expect(screen.getByLabelText('Status')).toHaveValue('available')

  await user.selectOptions(screen.getByLabelText('Status'), 'reserved')
  expect(screen.getByLabelText('Status')).toHaveValue('reserved')

  await user.click(screen.getByRole('button', { name: 'Add Property' }))
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

  const dialog = screen.getByRole('alertdialog')
  expect(within(dialog).getByText('reserved')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Add Property' }))

  expect(createProperty).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'reserved' })
  )
})
```

- [ ] **Step 7: Run tests**

Run: `npm run test`
Expected: All tests pass (existing 73 + 1 new = 74)

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/PropertyForm.jsx src/components/admin/PropertyForm.test.jsx
git commit -m "feat(admin): add property status field to form and confirm summary"
```

---

### Task 4: Add status column to AdminProperties table

**Files:**
- Modify: `src/components/admin/AdminProperties.jsx`
- Modify: `src/components/admin/AdminProperties.test.jsx`

- [ ] **Step 1: Add status column header to the table**

In `AdminProperties.jsx`, add a Status column header after the Pinned column (around line 112):

```jsx
<th className="hidden px-4 py-3 lg:table-cell">Status</th>
```

- [ ] **Step 2: Add status badge cell to each row**

After the pinned button cell (around line 153), add:

```jsx
<td className="hidden px-4 py-3 lg:table-cell">
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
    property.status === 'sold'
      ? 'bg-red-100 text-red-700'
      : property.status === 'reserved'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-green-100 text-green-700'
  }`}>
    {property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : 'Available'}
  </span>
</td>
```

- [ ] **Step 3: Update sample data in AdminProperties.test.jsx**

Update the `sample` array (line 17-20) to include status:

```javascript
const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false, status: 'available' },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true, status: 'reserved' },
]
```

- [ ] **Step 4: Add test for status badge rendering**

Add a new test after "lists properties with pinned state":

```javascript
it('displays status badges for each property', async () => {
  render(<AdminProperties />)

  expect(await screen.findByText('Lot A')).toBeInTheDocument()
  expect(screen.getByText('Available')).toBeInTheDocument()
  expect(screen.getByText('Reserved')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: All tests pass (74 + 1 new = 75)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminProperties.jsx src/components/admin/AdminProperties.test.jsx
git commit -m "feat(admin): add status column with colored badges to properties table"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Review all changes**

Run: `git log --oneline -5` to see the commits
Run: `git diff HEAD~3 --stat` to see all changed files

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: phase 1 final adjustments"
```
