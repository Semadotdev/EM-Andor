# Phase 4: Bulk Actions & CSV Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk selection, bulk actions, and CSV export to the admin panel's Properties and Inquiries tabs.

**Architecture:** Add new bulk API functions to `api.js` using Supabase `.in()` operator. Create a `csv.js` utility for browser-side CSV generation. Add selection state and bulk action UI to AdminProperties and AdminInquiries. A `BulkActionToolbar` component provides contextual actions.

**Tech Stack:** React 19, Supabase JS client, Tailwind CSS, Vitest + @testing-library/react

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/api.js` | Modify | Add 5 bulk API functions |
| `src/lib/csv.js` | Create | Browser-side CSV generation utility |
| `src/components/admin/AdminProperties.jsx` | Modify | Add checkboxes, selection state, bulk toolbar, CSV export |
| `src/components/admin/AdminInquiries.jsx` | Modify | Add checkboxes, selection state, bulk toolbar, CSV export |
| `src/lib/api.test.js` | Modify | Add tests for bulk API functions |
| `src/lib/csv.test.js` | Create | Tests for CSV generation |
| `src/components/admin/AdminProperties.test.jsx` | Modify | Add tests for selection, bulk actions, CSV |
| `src/components/admin/AdminInquiries.test.jsx` | Modify | Add tests for selection, bulk actions, CSV |
| `docs/superpowers/specs/2026-08-18-phase4-bulk-actions-csv.md` | Create | Spec |
| `docs/superpowers/plans/2026-08-18-phase4-bulk-actions-csv.md` | Create | This plan |

---

### Task 1: Bulk API Functions

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add bulkDeleteProperties**

At the end of `api.js` (after `deleteProperty`), add:

```js
export async function bulkDeleteProperties(ids) {
  const { error } = await supabase.from('properties').delete().in('id', ids)
  if (error) throw error
  for (const id of ids) {
    logActivity('property', id, 'delete').catch(() => {})
  }
}
```

- [ ] **Step 2: Add bulkUpdatePropertyStatus**

```js
export async function bulkUpdatePropertyStatus(ids, status) {
  const { error } = await supabase.from('properties').update({ status }).in('id', ids)
  if (error) throw error
}
```

- [ ] **Step 3: Add bulkSetPropertyPinned**

```js
export async function bulkSetPropertyPinned(ids, pinned) {
  const { error } = await supabase.from('properties').update({ is_pinned: pinned }).in('id', ids)
  if (error) throw error
}
```

- [ ] **Step 4: Add bulkDeleteInquiries**

```js
export async function bulkDeleteInquiries(ids) {
  const { error } = await supabase.from('inquiries').delete().in('id', ids)
  if (error) throw error
}
```

- [ ] **Step 5: Add bulkSetInquiryRead**

```js
export async function bulkSetInquiryRead(ids, isRead) {
  const { error } = await supabase.from('inquiries').update({ is_read: isRead }).in('id', ids)
  if (error) throw error
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.js
git commit -m "feat(api): add bulk delete and update functions for properties and inquiries"
```

---

### Task 2: Bulk API Tests

**Files:**
- Modify: `src/lib/api.test.js`

- [ ] **Step 1: Update makeChain to include in method**

In `api.test.js`, update `makeChain` to include `in` in the methods array:

```js
function makeChain() {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single', 'insert', 'or', 'in']) {
    c[m] = vi.fn(() => c)
  }
  return c
}
```

- [ ] **Step 2: Add import for bulk functions**

Update the import (line 2) to include:

```js
import {
  bulkDeleteProperties,
  bulkDeleteInquiries,
  bulkSetInquiryRead,
  bulkSetPropertyPinned,
  bulkUpdatePropertyStatus,
  createProperty,
  deleteInquiry,
  deleteProperty,
  fetchInquiries,
  fetchPinnedProperties,
  fetchProperties,
  fetchPropertyStatusCounts,
  setInquiryRead,
  setPropertyPinned,
  submitInquiry,
  updateProperty,
  uploadPropertyImage,
} from './api.js'
```

- [ ] **Step 3: Add bulk API tests**

At the end of the describe block, before the closing `})`, add:

```js
  it('bulkDeleteProperties deletes multiple properties by ids', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkDeleteProperties(['p1', 'p2'])

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.delete).toHaveBeenCalled()
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkUpdatePropertyStatus updates status for multiple properties', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkUpdatePropertyStatus(['p1', 'p2'], 'sold')

    expect(c.update).toHaveBeenCalledWith({ status: 'sold' })
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkSetPropertyPinned updates is_pinned for multiple properties', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkSetPropertyPinned(['p1', 'p2'], true)

    expect(c.update).toHaveBeenCalledWith({ is_pinned: true })
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkDeleteInquiries deletes multiple inquiries by ids', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkDeleteInquiries(['q1', 'q2'])

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(c.delete).toHaveBeenCalled()
    expect(c.in).toHaveBeenCalledWith('id', ['q1', 'q2'])
  })

  it('bulkSetInquiryRead updates is_read for multiple inquiries', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkSetInquiryRead(['q1', 'q2'], true)

    expect(c.update).toHaveBeenCalledWith({ is_read: true })
    expect(c.in).toHaveBeenCalledWith('id', ['q1', 'q2'])
  })
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/lib/api.test.js`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.test.js
git commit -m "test(api): add tests for bulk API functions"
```

---

### Task 3: CSV Export Utility

**Files:**
- Create: `src/lib/csv.js`
- Create: `src/lib/csv.test.js`

- [ ] **Step 1: Create csv.js**

```js
function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCSV(headers, rows, filename) {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','))
  const csv = [headerLine, ...dataLines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Create csv.test.js**

```js
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { exportToCSV } from './csv.js'

describe('exportToCSV', () => {
  let clickSpy

  beforeEach(() => {
    clickSpy = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:url'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { click: clickSpy, href: '', download: '' }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates CSV with headers and rows', () => {
    const headers = ['Name', 'Type']
    const rows = [['Lot A', 'residential'], ['Lot B', 'commercial']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('escapes values containing commas', () => {
    const headers = ['Name']
    const rows = [['Lot A, Batangas']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('escapes values containing quotes', () => {
    const headers = ['Name']
    const rows = [['He said "hello"']]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('handles null and undefined values', () => {
    const headers = ['Name', 'Type']
    const rows = [[null, undefined]]

    exportToCSV(headers, rows, 'test.csv')

    expect(clickSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/lib/csv.test.js`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/csv.js src/lib/csv.test.js
git commit -m "feat(csv): add browser-side CSV export utility with escaping"
```

---

### Task 4: AdminProperties — Bulk Selection & Actions

**Files:**
- Modify: `src/components/admin/AdminProperties.jsx`

- [ ] **Step 1: Add new imports and state**

Update imports (line 5):

```js
import { deleteProperty, fetchProperties, setPropertyPinned, bulkDeleteProperties, bulkUpdatePropertyStatus, bulkSetPropertyPinned } from '../../lib/api.js'
```

Add import for csv at top:

```js
import { exportToCSV } from '../../lib/csv.js'
import { formatPrice } from '../../lib/format.js'
```

After `sort` state (line 21), add selection and bulk action states:

```js
const [selected, setSelected] = useState(new Set())
const [bulkAction, setBulkAction] = useState(null)
const [bulkProcessing, setBulkProcessing] = useState(false)
const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
```

- [ ] **Step 2: Clear selection on filter change**

Update the `load` useCallback dependencies and add a useEffect to clear selection when filters change. Add after the existing `useEffect(load, [load])` (line 50):

```js
useEffect(() => {
  setSelected(new Set())
}, [search, typeFilter, statusFilter])
```

- [ ] **Step 3: Add selection handlers**

After the `handleSaved` function (line 87), add:

```js
const toggleSelect = (id) => {
  setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

const toggleSelectAll = () => {
  if (selected.size === properties.length) {
    setSelected(new Set())
  } else {
    setSelected(new Set(properties.map((p) => p.id)))
  }
}

const deselectAll = () => setSelected(new Set())
```

- [ ] **Step 4: Add bulk action handlers**

After `deselectAll`, add:

```js
const handleBulkDelete = async () => {
  if (bulkProcessing) return
  setBulkProcessing(true)
  try {
    await bulkDeleteProperties([...selected])
    setSelected(new Set())
    setConfirmBulkDelete(false)
    load()
  } catch {
    setError('Could not delete selected properties. Please try again.')
  } finally {
    setBulkProcessing(false)
  }
}

const handleBulkStatus = async (status) => {
  if (bulkProcessing) return
  setBulkProcessing(true)
  try {
    await bulkUpdatePropertyStatus([...selected], status)
    setProperties((list) =>
      list.map((p) => (selected.has(p.id) ? { ...p, status } : p))
    )
    setSelected(new Set())
  } catch {
    setError('Could not update status. Please try again.')
  } finally {
    setBulkProcessing(false)
  }
}

const handleBulkPin = async (pinned) => {
  if (bulkProcessing) return
  setBulkProcessing(true)
  try {
    await bulkSetPropertyPinned([...selected], pinned)
    setProperties((list) =>
      list.map((p) => (selected.has(p.id) ? { ...p, is_pinned: pinned } : p))
    )
    setSelected(new Set())
  } catch {
    setError('Could not update pin status. Please try again.')
  } finally {
    setBulkProcessing(false)
  }
}

const exportPropertiesCSV = () => {
  const toExport = selected.size > 0
    ? properties.filter((p) => selected.has(p.id))
    : properties
  const headers = ['Name', 'Type', 'Location', 'Price', 'Status', 'Pinned', 'Lot Area', 'Created Date']
  const rows = toExport.map((p) => [
    p.name,
    p.type,
    p.location,
    p.price ?? '',
    p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Available',
    p.is_pinned ? 'Yes' : 'No',
    p.lot_area_sqm ?? '',
    new Date(p.created_at).toLocaleDateString('en-PH'),
  ])
  const date = new Date().toISOString().slice(0, 10)
  exportToCSV(headers, rows, `properties-export-${date}.csv`)
}
```

- [ ] **Step 5: Add checkbox column header**

Replace the `<thead>` section (lines 191-200) with:

```jsx
<thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
  <tr>
    <th className="px-4 py-3 w-10">
      <input
        type="checkbox"
        checked={selected.size === properties.length && properties.length > 0}
        onChange={toggleSelectAll}
        aria-label="Select all properties"
        className="size-4 rounded border-mist text-brand focus:ring-brand/30"
      />
    </th>
    <th className="px-4 py-3">Property</th>
    <th className="hidden px-4 py-3 sm:table-cell">Type</th>
    <th className="hidden px-4 py-3 md:table-cell">Location</th>
    <th className="hidden px-4 py-3 lg:table-cell">Price</th>
    <th className="hidden px-4 py-3 lg:table-cell">Status</th>
    <th className="px-4 py-3 text-center">Pinned</th>
    <th className="px-4 py-3 text-right">Actions</th>
  </tr>
</thead>
```

- [ ] **Step 6: Add checkbox to each table row**

In the `<tr>` for each property (line 204), add a checkbox cell before the first `<td>`:

```jsx
<tr key={property.id} className="border-b border-mist/70 last:border-0">
  <td className="px-4 py-3 w-10">
    <input
      type="checkbox"
      checked={selected.has(property.id)}
      onChange={() => toggleSelect(property.id)}
      aria-label={`Select ${property.name}`}
      className="size-4 rounded border-mist text-brand focus:ring-brand/30"
    />
  </td>
  {/* existing td cells */}
```

- [ ] **Step 7: Add bulk action toolbar and CSV export button**

Before the `{error && ...}` block (line 161), insert:

```jsx
{status === 'ready' && properties.length > 0 && (
  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
    {selected.size > 0 ? (
      <>
        <span className="text-sm font-semibold text-brand-deep">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
        <div className="flex flex-wrap gap-2">
          <select
            onChange={(e) => {
              if (e.target.value) handleBulkStatus(e.target.value)
              e.target.value = ''
            }}
            defaultValue=""
            aria-label="Bulk status change"
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
          >
            <option value="" disabled>Set Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </select>
          <button
            onClick={() => handleBulkPin(true)}
            disabled={bulkProcessing}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
          >
            Pin All
          </button>
          <button
            onClick={() => handleBulkPin(false)}
            disabled={bulkProcessing}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
          >
            Unpin All
          </button>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkProcessing}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            Delete Selected
          </button>
        </div>
        <button
          onClick={deselectAll}
          className="ml-auto text-xs font-semibold text-ink/50 hover:text-brand"
        >
          Deselect All
        </button>
      </>
    ) : null}
    <button
      onClick={exportPropertiesCSV}
      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
    >
      Export CSV
    </button>
  </div>
)}
```

- [ ] **Step 8: Add bulk delete confirmation modal**

After the existing `<ConfirmModal>` (line 293), add:

```jsx
<ConfirmModal
  open={confirmBulkDelete}
  onClose={() => setConfirmBulkDelete(false)}
  onConfirm={handleBulkDelete}
  title="Bulk Delete Properties"
  message={`Delete ${selected.size} selected propert${selected.size !== 1 ? 'ies' : 'y'}? This cannot be undone.`}
  confirmLabel="Delete All"
  destructive
  loading={bulkProcessing}
/>
```

- [ ] **Step 9: Run tests**

Run: `npm run test -- src/components/admin/AdminProperties.test.jsx`
Expected: All tests pass (existing tests may need minor adjustments for the new checkbox column)

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/AdminProperties.jsx
git commit -m "feat(admin): add bulk selection, actions, and CSV export to AdminProperties"
```

---

### Task 5: AdminInquiries — Bulk Selection & Actions

**Files:**
- Modify: `src/components/admin/AdminInquiries.jsx`

- [ ] **Step 1: Add new imports and state**

Update imports (line 3):

```js
import { deleteInquiry, fetchInquiries, setInquiryRead, bulkDeleteInquiries, bulkSetInquiryRead } from '../../lib/api.js'
```

Add import for csv:

```js
import { exportToCSV } from '../../lib/csv.js'
```

After `sort` state (line 17), add selection and bulk action states:

```js
const [selected, setSelected] = useState(new Set())
const [bulkProcessing, setBulkProcessing] = useState(false)
const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
```

- [ ] **Step 2: Clear selection on filter change**

After the existing `useEffect(load, [load])` (line 46), add:

```js
useEffect(() => {
  setSelected(new Set())
}, [search, readFilter])
```

- [ ] **Step 3: Add selection handlers**

After the `handleDelete` function (line 78), add:

```js
const toggleSelect = (id) => {
  setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

const toggleSelectAll = () => {
  if (selected.size === inquiries.length) {
    setSelected(new Set())
  } else {
    setSelected(new Set(inquiries.map((q) => q.id)))
  }
}

const deselectAll = () => setSelected(new Set())
```

- [ ] **Step 4: Add bulk action handlers**

After `deselectAll`, add:

```js
const handleBulkDelete = async () => {
  if (bulkProcessing) return
  setBulkProcessing(true)
  try {
    await bulkDeleteInquiries([...selected])
    setSelected(new Set())
    setConfirmBulkDelete(false)
    load()
  } catch {
    setError('Could not delete selected inquiries. Please try again.')
  } finally {
    setBulkProcessing(false)
  }
}

const handleBulkRead = async (isRead) => {
  if (bulkProcessing) return
  setBulkProcessing(true)
  try {
    await bulkSetInquiryRead([...selected], isRead)
    setInquiries((list) =>
      list.map((q) => (selected.has(q.id) ? { ...q, is_read: isRead } : q))
    )
    setSelected(new Set())
  } catch {
    setError('Could not update read status. Please try again.')
  } finally {
    setBulkProcessing(false)
  }
}

const exportInquiriesCSV = () => {
  const toExport = selected.size > 0
    ? inquiries.filter((q) => selected.has(q.id))
    : inquiries
  const headers = ['Name', 'Email', 'Phone', 'Project Type', 'Property', 'Message', 'Read Status', 'Created Date']
  const rows = toExport.map((q) => [
    q.name,
    q.email,
    q.phone,
    q.project_type || 'General',
    q.property_name || '',
    q.message,
    q.is_read ? 'Read' : 'Unread',
    new Date(q.created_at).toLocaleDateString('en-PH'),
  ])
  const date = new Date().toISOString().slice(0, 10)
  exportToCSV(headers, rows, `inquiries-export-${date}.csv`)
}
```

- [ ] **Step 5: Add select-all checkbox to header**

Replace the existing heading div (lines 82-84):

```jsx
<div className="mb-6 flex items-center gap-4">
  <input
    type="checkbox"
    checked={selected.size === inquiries.length && inquiries.length > 0}
    onChange={toggleSelectAll}
    aria-label="Select all inquiries"
    className="size-4 rounded border-mist text-brand focus:ring-brand/30"
  />
  <h1 className="font-display text-2xl font-extrabold text-brand-deep">Inquiries</h1>
</div>
```

- [ ] **Step 6: Add checkbox to each inquiry card**

Inside the `<li>` (line 162), after the opening tag and before the `<div className="flex flex-wrap...">` (line 166), add:

```jsx
<div className="flex items-start gap-3">
  <input
    type="checkbox"
    checked={selected.has(inquiry.id)}
    onChange={() => toggleSelect(inquiry.id)}
    aria-label={`Select inquiry from ${inquiry.name}`}
    className="mt-1 size-4 shrink-0 rounded border-mist text-brand focus:ring-brand/30"
  />
  <div className="min-w-0 flex-1">
    {/* existing content from <div className="flex flex-wrap..."> to closing </div> */}
  </div>
</div>
```

This wraps the existing card content in a flex container with the checkbox on the left.

- [ ] **Step 7: Add bulk action toolbar and CSV export button**

Before the `{error && ...}` block (line 130), insert:

```jsx
{status === 'ready' && inquiries.length > 0 && (
  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
    {selected.size > 0 ? (
      <>
        <span className="text-sm font-semibold text-brand-deep">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBulkRead(true)}
            disabled={bulkProcessing}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
          >
            Mark All Read
          </button>
          <button
            onClick={() => handleBulkRead(false)}
            disabled={bulkProcessing}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
          >
            Mark All Unread
          </button>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkProcessing}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            Delete Selected
          </button>
        </div>
        <button
          onClick={deselectAll}
          className="ml-auto text-xs font-semibold text-ink/50 hover:text-brand"
        >
          Deselect All
        </button>
      </>
    ) : null}
    <button
      onClick={exportInquiriesCSV}
      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
    >
      Export CSV
    </button>
  </div>
)}
```

- [ ] **Step 8: Add bulk delete confirmation modal**

After the existing `<ConfirmModal>` (line 233), add:

```jsx
<ConfirmModal
  open={confirmBulkDelete}
  onClose={() => setConfirmBulkDelete(false)}
  onConfirm={handleBulkDelete}
  title="Bulk Delete Inquiries"
  message={`Delete ${selected.size} selected inquir${selected.size !== 1 ? 'ies' : 'y'}? This cannot be undone.`}
  confirmLabel="Delete All"
  destructive
  loading={bulkProcessing}
/>
```

- [ ] **Step 9: Run tests**

Run: `npm run test -- src/components/admin/AdminInquiries.test.jsx`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/AdminInquiries.jsx
git commit -m "feat(admin): add bulk selection, actions, and CSV export to AdminInquiries"
```

---

### Task 6: Update Component Tests

**Files:**
- Modify: `src/components/admin/AdminProperties.test.jsx`
- Modify: `src/components/admin/AdminInquiries.test.jsx`

- [ ] **Step 1: Update AdminProperties test mock**

Update the mock (lines 5-12):

```js
vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
  bulkDeleteProperties: vi.fn(),
  bulkUpdatePropertyStatus: vi.fn(),
  bulkSetPropertyPinned: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))
```

Update the import (line 14):

```js
import { fetchProperties, setPropertyPinned, deleteProperty, bulkDeleteProperties, bulkUpdatePropertyStatus, bulkSetPropertyPinned } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
```

- [ ] **Step 2: Add AdminProperties bulk action tests**

Before the closing `})` of the describe block, add:

```js
  it('shows bulk action toolbar when items are selected', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const checkboxes = screen.getAllByRole('checkbox', { name: /Select/i })
    await user.click(checkboxes[1])

    expect(screen.getByText('1 item selected')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('selects all properties with header checkbox', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all properties' })
    await user.click(selectAll)

    expect(screen.getByText('2 items selected')).toBeInTheDocument()
  })

  it('bulk deletes properties after confirmation', async () => {
    bulkDeleteProperties.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all properties' })
    await user.click(selectAll)

    await user.click(screen.getByText('Delete Selected'))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All' }))

    expect(bulkDeleteProperties).toHaveBeenCalledWith(['p1', 'p2'])
  })

  it('exports CSV with all properties', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Name', 'Type', 'Location', 'Price', 'Status', 'Pinned', 'Lot Area', 'Created Date'],
      expect.arrayContaining([
        expect.arrayContaining(['Lot A']),
        expect.arrayContaining(['Lot B']),
      ]),
      expect.stringMatching(/properties-export-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })
```

- [ ] **Step 3: Update AdminInquiries test mock**

Update the mock (lines 5-9):

```js
vi.mock('../../lib/api.js', () => ({
  fetchInquiries: vi.fn(),
  setInquiryRead: vi.fn(),
  deleteInquiry: vi.fn(),
  bulkDeleteInquiries: vi.fn(),
  bulkSetInquiryRead: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))
```

Update the import (line 11):

```js
import { fetchInquiries, setInquiryRead, deleteInquiry, bulkDeleteInquiries, bulkSetInquiryRead } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
```

- [ ] **Step 4: Add AdminInquiries bulk action tests**

Before the closing `})` of the describe block, add:

```js
  it('shows bulk action toolbar when items are selected', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await screen.findByText('Juan Dela Cruz')
    const checkboxes = screen.getAllByRole('checkbox', { name: /Select/i })
    await user.click(checkboxes[1])

    expect(screen.getByText('1 item selected')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('selects all inquiries with header checkbox', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await screen.findByText('Juan Dela Cruz')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all inquiries' })
    await user.click(selectAll)

    expect(screen.getByText('2 items selected')).toBeInTheDocument()
  })

  it('bulk deletes inquiries after confirmation', async () => {
    bulkDeleteInquiries.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await screen.findByText('Juan Dela Cruz')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all inquiries' })
    await user.click(selectAll)

    await user.click(screen.getByText('Delete Selected'))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All' }))

    expect(bulkDeleteInquiries).toHaveBeenCalledWith(['q1', 'q2'])
  })

  it('exports CSV with all inquiries', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await screen.findByText('Juan Dela Cruz')
    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Name', 'Email', 'Phone', 'Project Type', 'Property', 'Message', 'Read Status', 'Created Date'],
      expect.arrayContaining([
        expect.arrayContaining(['Juan Dela Cruz']),
        expect.arrayContaining(['Maria Santos']),
      ]),
      expect.stringMatching(/inquiries-export-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })
```

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminProperties.test.jsx src/components/admin/AdminInquiries.test.jsx
git commit -m "test(admin): add tests for bulk selection, actions, and CSV export"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify no regressions**

Check that:
- Existing property listing, pin, delete, search, filter, sort still work
- Existing inquiry listing, mark read, delete, search, filter, sort still work
- Selection state clears when filters change
- Bulk toolbar appears/disappears correctly
- CSV export triggers download

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address test failures from bulk actions phase"
```
