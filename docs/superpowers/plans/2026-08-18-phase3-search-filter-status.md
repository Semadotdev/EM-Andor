# Phase 3: Search, Filter, and Status Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side search, filtering, sorting, and status breakdown to the admin panel.

**Architecture:** Modify Supabase query builders in `api.js` to accept filter objects and return counts. Add filter UI controls (search inputs, dropdowns, sort selects) to AdminProperties and AdminInquiries. Add property status breakdown to DashboardStats.

**Tech Stack:** React 19, Supabase JS client, Tailwind CSS, Vitest + @testing-library/react

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/api.js` | Modify | Add filter params to `fetchProperties`, `fetchInquiries`; add `fetchPropertyStatusCounts` |
| `src/components/admin/AdminProperties.jsx` | Modify | Add search, type/status filters, sort, result count, clear button |
| `src/components/admin/AdminInquiries.jsx` | Modify | Add search, read filter, sort, result count, clear button |
| `src/components/admin/DashboardStats.jsx` | Modify | Add status breakdown row |
| `src/lib/api.test.js` | Modify | Add tests for filter chain construction |
| `src/components/admin/AdminProperties.test.jsx` | Modify | Add tests for filter UI |
| `src/components/admin/AdminInquiries.test.jsx` | Modify | Add tests for filter UI |
| `src/components/admin/DashboardStats.test.jsx` | Modify | Add test for status breakdown |

---

### Task 1: API Layer — Filter Support

**Files:**
- Modify: `src/lib/api.js:26-33` (fetchProperties)
- Modify: `src/lib/api.js:83-90` (fetchInquiries)
- Create: `src/lib/api.js` (new fetchPropertyStatusCounts function)

- [ ] **Step 1: Update fetchProperties to accept filters**

Replace the existing `fetchProperties` function (lines 26-33) with:

```js
export async function fetchProperties(filters = {}) {
  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`name.ilike.${term},location.ilike.${term}`)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const sortMap = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    price_asc: { column: 'price', ascending: true },
    price_desc: { column: 'price', ascending: false },
    name_asc: { column: 'name', ascending: true },
  }
  const sort = sortMap[filters.sort] || sortMap.newest
  query = query.order(sort.column, { ascending: sort.ascending })

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}
```

- [ ] **Step 2: Update fetchInquiries to accept filters**

Replace the existing `fetchInquiries` function (lines 83-90) with:

```js
export async function fetchInquiries(filters = {}) {
  let query = supabase
    .from('inquiries')
    .select('*', { count: 'exact' })

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`name.ilike.${term},email.ilike.${term},message.ilike.${term}`)
  }
  if (filters.is_read !== undefined && filters.is_read !== null) {
    query = query.eq('is_read', filters.is_read)
  }

  const sortMap = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    name_asc: { column: 'name', ascending: true },
  }
  const sort = sortMap[filters.sort] || sortMap.newest
  query = query.order(sort.column, { ascending: sort.ascending })

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}
```

- [ ] **Step 3: Add fetchPropertyStatusCounts function**

Add this new function after `fetchPropertyStats`:

```js
export async function fetchPropertyStatusCounts() {
  const { data, error } = await supabase
    .from('properties')
    .select('status')
  if (error) throw error
  const counts = { available: 0, reserved: 0, sold: 0 }
  for (const row of data) {
    if (counts[row.status] !== undefined) {
      counts[row.status]++
    }
  }
  return counts
}
```

- [ ] **Step 4: Run existing API tests to verify no regressions**

Run: `npm run test -- src/lib/api.test.js`
Expected: All existing tests still pass (existing callers pass no args, which defaults to empty filters)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.js
git commit -m "feat(api): add filter support to fetchProperties and fetchInquiries, add fetchPropertyStatusCounts"
```

---

### Task 2: API Tests — Filter Chain Construction

**Files:**
- Modify: `src/lib/api.test.js`

- [ ] **Step 1: Update makeChain to support or() method**

Replace the `makeChain` function (lines 25-31) with:

```js
function makeChain() {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single', 'insert', 'or']) {
    c[m] = vi.fn(() => c)
  }
  return c
}
```

- [ ] **Step 2: Add test for fetchProperties with search filter**

Add this test in the describe block:

```js
it('fetchProperties applies search filter via or ilike', async () => {
  const data = [{ id: 'p1' }]
  const c = makeChain()
  c.order.mockResolvedValue({ data, error: null, count: 1 })
  supabase.from.mockReturnValue(c)

  await fetchProperties({ search: 'lot' })

  expect(c.or).toHaveBeenCalledWith('name.ilike.%lot%,location.ilike.%lot%')
  expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
})
```

- [ ] **Step 3: Add test for fetchProperties with type filter**

```js
it('fetchProperties applies type filter', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchProperties({ type: 'residential lot' })

  expect(c.eq).toHaveBeenCalledWith('type', 'residential lot')
})
```

- [ ] **Step 4: Add test for fetchProperties with status filter**

```js
it('fetchProperties applies status filter', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchProperties({ status: 'sold' })

  expect(c.eq).toHaveBeenCalledWith('status', 'sold')
})
```

- [ ] **Step 5: Add test for fetchProperties with sort**

```js
it('fetchProperties applies custom sort', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchProperties({ sort: 'price_asc' })

  expect(c.order).toHaveBeenCalledWith('price', { ascending: true })
})
```

- [ ] **Step 6: Add test for fetchProperties returns count**

```js
it('fetchProperties returns data and count', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [{ id: 'p1' }], error: null, count: 1 })
  supabase.from.mockReturnValue(c)

  const result = await fetchProperties()

  expect(result).toEqual({ data: [{ id: 'p1' }], count: 1 })
})
```

- [ ] **Step 7: Add test for fetchInquiries with search filter**

```js
it('fetchInquiries applies search filter via or ilike', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchInquiries({ search: 'juan' })

  expect(c.or).toHaveBeenCalledWith('name.ilike.%juan%,email.ilike.%juan%,message.ilike.%juan%')
})
```

- [ ] **Step 8: Add test for fetchInquiries with is_read filter**

```js
it('fetchInquiries applies is_read filter', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchInquiries({ is_read: false })

  expect(c.eq).toHaveBeenCalledWith('is_read', false)
})
```

- [ ] **Step 9: Add test for fetchInquiries with sort**

```js
it('fetchInquiries applies custom sort', async () => {
  const c = makeChain()
  c.order.mockResolvedValue({ data: [], error: null, count: 0 })
  supabase.from.mockReturnValue(c)

  await fetchInquiries({ sort: 'name_asc' })

  expect(c.order).toHaveBeenCalledWith('name', { ascending: true })
})
```

- [ ] **Step 10: Add test for fetchPropertyStatusCounts**

```js
it('fetchPropertyStatusCounts aggregates status counts', async () => {
  const c = makeChain()
  c.select.mockResolvedValue({
    data: [
      { status: 'available' },
      { status: 'available' },
      { status: 'sold' },
      { status: 'reserved' },
    ],
    error: null,
  })
  supabase.from.mockReturnValue(c)

  const result = await fetchPropertyStatusCounts()

  expect(supabase.from).toHaveBeenCalledWith('properties')
  expect(c.select).toHaveBeenCalledWith('status')
  expect(result).toEqual({ available: 2, reserved: 1, sold: 1 })
})
```

- [ ] **Step 11: Run tests**

Run: `npm run test -- src/lib/api.test.js`
Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
git add src/lib/api.test.js
git commit -m "test(api): add filter chain construction tests for fetchProperties, fetchInquiries, fetchPropertyStatusCounts"
```

---

### Task 3: AdminProperties — Filter UI

**Files:**
- Modify: `src/components/admin/AdminProperties.jsx`

- [ ] **Step 1: Add filter state and debounced search**

Replace the component's state declarations and load function. Add these imports at the top:

```js
import { useCallback, useEffect, useRef, useState } from 'react'
```

Replace the state declarations (lines 9-14) with:

```js
const [properties, setProperties] = useState([])
const [totalCount, setTotalCount] = useState(0)
const [status, setStatus] = useState('loading')
const [error, setError] = useState(null)
const [form, setForm] = useState(null)
const [pendingPins, setPendingPins] = useState({})
const [confirmDelete, setConfirmDelete] = useState(null)
const [deleting, setDeleting] = useState(false)
const [searchInput, setSearchInput] = useState('')
const [search, setSearch] = useState('')
const [typeFilter, setTypeFilter] = useState('')
const [statusFilter, setStatusFilter] = useState('')
const [sort, setSort] = useState('newest')
const debounceRef = useRef(null)
```

Replace the `load` useCallback (lines 17-25) with:

```js
const load = useCallback(() => {
  setStatus('loading')
  const filters = {}
  if (search) filters.search = search
  if (typeFilter) filters.type = typeFilter
  if (statusFilter) filters.status = statusFilter
  if (sort) filters.sort = sort
  fetchProperties(filters)
    .then((result) => {
      setProperties(result.data ?? [])
      setTotalCount(result.count ?? 0)
      setStatus('ready')
    })
    .catch(() => setStatus('error'))
}, [search, typeFilter, statusFilter, sort])
```

Update the useEffect (line 27):

```js
useEffect(load, [load])
```

Add a debounced search effect after the load effect:

```js
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    setSearch(searchInput)
  }, 300)
  return () => clearTimeout(debounceRef.current)
}, [searchInput])
```

- [ ] **Step 2: Add filter bar UI**

Replace the header div (lines 72-78) with:

```jsx
<div className="mb-6">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <h1 className="font-display text-2xl font-extrabold text-brand-deep">Properties</h1>
    <button onClick={() => setForm({ mode: 'create' })} className="btn btn-gold">
      <Icon name="residential" className="size-4" />
      Add Property
    </button>
  </div>

  <div className="flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
    <input
      type="text"
      placeholder="Search name or location…"
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      aria-label="Search properties"
      className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
    />
    <select
      value={typeFilter}
      onChange={(e) => setTypeFilter(e.target.value)}
      aria-label="Filter by type"
      className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
    >
      <option value="">All Types</option>
      <option value="residential lot">Residential Lot</option>
      <option value="commercial lot">Commercial Lot</option>
      <option value="house & lot">House & Lot</option>
      <option value="development lot">Development Lot</option>
    </select>
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      aria-label="Filter by status"
      className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
    >
      <option value="">All Statuses</option>
      <option value="available">Available</option>
      <option value="reserved">Reserved</option>
      <option value="sold">Sold</option>
    </select>
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value)}
      aria-label="Sort properties"
      className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
    >
      <option value="newest">Newest</option>
      <option value="oldest">Oldest</option>
      <option value="price_asc">Price: Low → High</option>
      <option value="price_desc">Price: High → Low</option>
      <option value="name_asc">Name: A → Z</option>
    </select>
    {(search || typeFilter || statusFilter || sort !== 'newest') && (
      <button
        onClick={() => {
          setSearchInput('')
          setSearch('')
          setTypeFilter('')
          setStatusFilter('')
          setSort('newest')
        }}
        className="rounded-md border border-mist px-3 py-2 text-xs font-semibold text-ink/60 transition-colors hover:border-brand/40 hover:text-brand"
      >
        Clear filters
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: Add result count display**

After the filter bar, before the error/loading states, add:

```jsx
{status === 'ready' && (
  <p className="mb-3 text-xs font-semibold text-ink/50">
    Showing {properties.length} of {totalCount} properties
  </p>
)}
```

- [ ] **Step 4: Update the empty state message**

Change line 99 from:
```jsx
No properties yet. Click "Add Property" to create one.
```
To:

```jsx
{(search || typeFilter || statusFilter) ? 'No properties match your filters.' : 'No properties yet. Click "Add Property" to create one.'}
```

- [ ] **Step 5: Update handleSaved to reload with filters**

Update `handleSaved` (lines 61-68) to reload instead of optimistic update:

```js
const handleSaved = () => {
  setForm(null)
  load()
}
```

- [ ] **Step 6: Run existing tests to check what breaks**

Run: `npm run test -- src/components/admin/AdminProperties.test.jsx`
Expected: Some tests may fail due to changed API return shape (now `{ data, count }` instead of just array)

- [ ] **Step 7: Update existing tests for new API shape**

In `AdminProperties.test.jsx`, update the mock (line 6):

```js
fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
```

And update the retry test (line 103-104):

```js
fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
fetchProperties.mockRejectedValueOnce(new Error('boom'))
```

- [ ] **Step 8: Run tests**

Run: `npm run test -- src/components/admin/AdminProperties.test.jsx`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/AdminProperties.jsx src/components/admin/AdminProperties.test.jsx
git commit -m "feat(admin): add search, filter, sort, and result count to AdminProperties"
```

---

### Task 4: AdminInquiries — Filter UI

**Files:**
- Modify: `src/components/admin/AdminInquiries.jsx`

- [ ] **Step 1: Add filter state and debounced search**

Replace the component's state declarations. Add `useRef` to imports:

```js
import { useCallback, useEffect, useRef, useState } from 'react'
```

Replace the state declarations (lines 7-13) with:

```js
const [inquiries, setInquiries] = useState([])
const [totalCount, setTotalCount] = useState(0)
const [status, setStatus] = useState('loading')
const [error, setError] = useState(null)
const [expanded, setExpanded] = useState(null)
const [pendingReads, setPendingReads] = useState({})
const [confirmDelete, setConfirmDelete] = useState(null)
const [deleting, setDeleting] = useState(false)
const [searchInput, setSearchInput] = useState('')
const [search, setSearch] = useState('')
const [readFilter, setReadFilter] = useState('')
const [sort, setSort] = useState('newest')
const debounceRef = useRef(null)
```

Replace the `load` useCallback (lines 14-22) with:

```js
const load = useCallback(() => {
  setStatus('loading')
  const filters = {}
  if (search) filters.search = search
  if (readFilter === 'read') filters.is_read = true
  else if (readFilter === 'unread') filters.is_read = false
  if (sort) filters.sort = sort
  fetchInquiries(filters)
    .then((result) => {
      setInquiries(result.data ?? [])
      setTotalCount(result.count ?? 0)
      setStatus('ready')
    })
    .catch(() => setStatus('error'))
}, [search, readFilter, sort])
```

Update the useEffect (line 24):

```js
useEffect(load, [load])
```

Add debounced search effect after load:

```js
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    setSearch(searchInput)
  }, 300)
  return () => clearTimeout(debounceRef.current)
}, [searchInput])
```

- [ ] **Step 2: Add filter bar UI**

Replace the header (line 60) with:

```jsx
<div className="mb-6">
  <h1 className="font-display text-2xl font-extrabold text-brand-deep">Inquiries</h1>
</div>

<div className="mb-4 flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
  <input
    type="text"
    placeholder="Search name, email, or message…"
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
    aria-label="Search inquiries"
    className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
  />
  <select
    value={readFilter}
    onChange={(e) => setReadFilter(e.target.value)}
    aria-label="Filter by read status"
    className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
  >
    <option value="">All</option>
    <option value="unread">Unread</option>
    <option value="read">Read</option>
  </select>
  <select
    value={sort}
    onChange={(e) => setSort(e.target.value)}
    aria-label="Sort inquiries"
    className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
  >
    <option value="newest">Newest</option>
    <option value="oldest">Oldest</option>
    <option value="name_asc">Name: A → Z</option>
  </select>
  {(search || readFilter || sort !== 'newest') && (
    <button
      onClick={() => {
        setSearchInput('')
        setSearch('')
        setReadFilter('')
        setSort('newest')
      }}
      className="rounded-md border border-mist px-3 py-2 text-xs font-semibold text-ink/60 transition-colors hover:border-brand/40 hover:text-brand"
    >
      Clear filters
    </button>
  )}
</div>
```

- [ ] **Step 3: Add result count display**

After the filter bar, before the error/loading states:

```jsx
{status === 'ready' && (
  <p className="mb-3 text-xs font-semibold text-ink/50">
    Showing {inquiries.length} of {totalCount} inquiries
  </p>
)}
```

- [ ] **Step 4: Update the empty state message**

Change line 81 from:
```jsx
No inquiries yet. Submissions from the contact form will appear here.
```
To:

```jsx
{search || readFilter ? 'No inquiries match your filters.' : 'No inquiries yet. Submissions from the contact form will appear here.'}
```

- [ ] **Step 5: Update handleDelete to reload**

Update `handleDelete` to reload with filters:

```js
const handleDelete = async () => {
  if (!confirmDelete || deleting) return
  setError(null)
  setDeleting(true)
  try {
    await deleteInquiry(confirmDelete.id)
    setConfirmDelete(null)
    load()
  } catch {
    setError('Could not delete inquiry. Please try again.')
  } finally {
    setDeleting(false)
  }
}
```

- [ ] **Step 6: Run existing tests to check what breaks**

Run: `npm run test -- src/components/admin/AdminInquiries.test.jsx`
Expected: Some tests may fail due to changed API return shape

- [ ] **Step 7: Update existing tests for new API shape**

In `AdminInquiries.test.jsx`, update the mock (line 17):

```js
fetchInquiries.mockResolvedValue({ data: sample, count: sample.length })
```

And update the retry test (line 119):

```js
fetchInquiries.mockResolvedValue({ data: sample, count: sample.length })
fetchInquiries.mockRejectedValueOnce(new Error('boom'))
```

- [ ] **Step 8: Run tests**

Run: `npm run test -- src/components/admin/AdminInquiries.test.jsx`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/AdminInquiries.jsx src/components/admin/AdminInquiries.test.jsx
git commit -m "feat(admin): add search, filter, sort, and result count to AdminInquiries"
```

---

### Task 5: DashboardStats — Status Breakdown

**Files:**
- Modify: `src/components/admin/DashboardStats.jsx`
- Modify: `src/components/admin/DashboardStats.test.jsx`

- [ ] **Step 1: Add fetchPropertyStatusCounts to DashboardStats**

Update the import (line 3):

```js
import { fetchPropertyStats, fetchInquiryStats, fetchRecentInquiries, fetchPropertyStatusCounts } from '../../lib/api.js'
```

Add state for statusCounts (after line 11):

```js
const [statusCounts, setStatusCounts] = useState(null)
```

Add `fetchPropertyStatusCounts()` to the Promise.all (line 16):

```js
Promise.all([fetchPropertyStats(), fetchInquiryStats(), fetchRecentInquiries(), fetchPropertyStatusCounts()])
  .then(([ps, is, rec, sc]) => {
    if (!mounted) return
    setPropertyStats(ps)
    setInquiryStats(is)
    setRecent(rec)
    setStatusCounts(sc)
    setLoading(false)
  })
```

- [ ] **Step 2: Add status breakdown UI**

After the type breakdown (line 90), add:

```jsx
{statusCounts && (
  <div className="flex flex-wrap gap-3">
    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
      Available: {statusCounts.available ?? 0}
    </span>
    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
      Reserved: {statusCounts.reserved ?? 0}
    </span>
    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
      Sold: {statusCounts.sold ?? 0}
    </span>
  </div>
)}
```

- [ ] **Step 3: Update DashboardStats test mock**

Update the mock (lines 6-10):

```js
vi.mock('../../lib/api.js', () => ({
  fetchPropertyStats: vi.fn(),
  fetchInquiryStats: vi.fn(),
  fetchRecentInquiries: vi.fn(),
  fetchPropertyStatusCounts: vi.fn(),
}))
```

Update the import (line 12):

```js
import { fetchPropertyStats, fetchInquiryStats, fetchRecentInquiries, fetchPropertyStatusCounts } from '../../lib/api.js'
```

Add mock return value in beforeEach (after line 22):

```js
fetchPropertyStatusCounts.mockResolvedValue({ available: 3, reserved: 1, sold: 1 })
```

- [ ] **Step 4: Add test for status breakdown**

```js
it('renders property status breakdown', async () => {
  render(<DashboardStats />)

  expect(await screen.findByText('Available: 3')).toBeInTheDocument()
  expect(screen.getByText('Reserved: 1')).toBeInTheDocument()
  expect(screen.getByText('Sold: 1')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/components/admin/DashboardStats.test.jsx`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/DashboardStats.jsx src/components/admin/DashboardStats.test.jsx
git commit -m "feat(admin): add property status breakdown to DashboardStats"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Fix any issues found**

If tests or build fail, fix and re-run.

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: resolve test/build issues from Phase 3"
```
