# Phase 9: Activity Log Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Activity Log tab to the admin panel that displays all admin actions (create, update, delete) with filtering, search, sorting, pagination, and CSV export.

**Architecture:** A new `AdminActivityLog` component follows the existing table/filter pattern from `AdminProperties`. A new `fetchActivityLog` API function queries the `activity_log` table with filters and pagination. A new `formatRelativeTime` utility in `src/lib/format.js` converts timestamps to "2 hours ago" style. The dashboard gains a 6th tab.

**Tech Stack:** React 19, Tailwind CSS, Supabase JS client, Vitest + @testing-library/react, `exportToCSV` from `src/lib/csv.js`.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/format.js` | **Create** | Add `formatRelativeTime()` utility |
| `src/lib/api.js` | **Modify** | Add `fetchActivityLog()` function |
| `src/components/admin/AdminActivityLog.jsx` | **Create** | Activity log viewer component |
| `src/components/admin/AdminDashboard.jsx` | **Modify** | Add "Activity Log" tab |
| `src/components/admin/AdminActivityLog.test.jsx` | **Create** | Component tests |
| `src/components/admin/AdminDashboard.test.jsx` | **Modify** | Add Activity Log tab test |
| `docs/superpowers/specs/2026-08-18-phase9-activity-log.md` | **Create** | Feature spec |

---

### Task 1: Create the spec

**Files:**
- Create: `docs/superpowers/specs/2026-08-18-phase9-activity-log.md`

- [ ] **Step 1: Write the spec document**

```markdown
# Phase 9: Activity Log Viewer

## Feature Description
An Activity Log tab in the admin panel that displays all admin actions (create, update, delete) across properties and inquiries. Provides filtering, search, sorting, pagination, CSV export, and relative timestamps.

## Acceptance Criteria
- A new "Activity Log" tab appears after "Notifications" in the admin dashboard
- Log entries display in a table with columns: Action, Entity Type, Record ID, Timestamp, Details
- Action types (create, update, delete) are shown with colored badges
- Filter bar includes: action type dropdown, entity type dropdown, search input, sort dropdown
- Result count is displayed ("Showing X of Y entries")
- Pagination with Previous/Next buttons (20 entries per page)
- Export CSV button exports filtered results
- Loading state shows "Loading..."
- Empty state shows "No activity log entries found."
- Relative timestamps ("2 hours ago", "3 days ago")

## UI Components
- AdminActivityLog: main component
- Filter bar: action dropdown, entity dropdown, search input, sort dropdown, clear button
- Table: action badge, entity type, record ID, timestamp, details
- Pagination: Previous/Next buttons with page info
- Export CSV button

## Testing Requirements
- Renders log entries with correct action badges
- Filters by action type
- Filters by entity type
- Searches by record ID
- Sorts by newest/oldest
- Shows result count
- Shows loading state
- Shows empty state
- Export button calls exportToCSV
- Pagination Previous/Next
- AdminDashboard tab switch renders ActivityLog
```

- [ ] **Step 2: Verify spec is saved**

Run: `cat docs/superpowers/specs/2026-08-18-phase9-activity-log.md | head -5`
Expected: File exists with the spec content.

---

### Task 2: Write the implementation plan

**Files:**
- Create: `docs/superpowers/plans/2026-08-18-phase9-activity-log.md`

- [ ] **Step 1: Write the plan document**

(You are reading this plan now — it is the file being created.)

- [ ] **Step 2: Verify plan is saved**

Run: `cat docs/superpowers/plans/2026-08-18-phase9-activity-log.md | head -5`
Expected: File exists with plan content.

---

### Task 3: Add `formatRelativeTime` utility

**Files:**
- Modify: `src/lib/format.js`

- [ ] **Step 1: Write the failing test**

Create a quick inline test to verify the function doesn't exist yet:

Run: `node -e "const f = require('./src/lib/format.js'); console.log(typeof f.formatRelativeTime)" 2>&1 || echo "Expected: not a function"`
Expected: The function does not exist yet.

- [ ] **Step 2: Add `formatRelativeTime` to `src/lib/format.js`**

Append to the existing file:

```javascript
export function formatRelativeTime(dateString) {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}
```

- [ ] **Step 3: Verify the function is exported**

Run: `node -e "import('./src/lib/format.js').then(m => console.log(typeof m.formatRelativeTime))"`
Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add src/lib/format.js
git commit -m "feat: add formatRelativeTime utility"
```

---

### Task 4: Add `fetchActivityLog` API function

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add `fetchActivityLog` to the end of `src/lib/api.js`**

Append the following before the closing of the file:

```javascript
export async function fetchActivityLog(filters = {}) {
  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })

  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type)
  }
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`entity_id.ilike.${term},details->>'table'.ilike.${term}`)
  }

  const sort = filters.sort || 'newest'
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: true })
  }

  const page = filters.page || 1
  const limit = filters.limit || 20
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}
```

- [ ] **Step 2: Verify the function is exported**

Run: `node -e "import('./src/lib/api.js').then(m => console.log(typeof m.fetchActivityLog))"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: add fetchActivityLog API function"
```

---

### Task 5: Create `AdminActivityLog` component (test-first)

**Files:**
- Create: `src/components/admin/AdminActivityLog.test.jsx`
- Create: `src/components/admin/AdminActivityLog.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/AdminActivityLog.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminActivityLog from './AdminActivityLog.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchActivityLog: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))

import { fetchActivityLog } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'

const sample = [
  { id: 'a1', entity_type: 'property', entity_id: 'p1-uuid', action: 'create', details: {}, created_at: '2026-08-18T10:00:00Z' },
  { id: 'a2', entity_type: 'inquiry', entity_id: 'q1-uuid', action: 'delete', details: {}, created_at: '2026-08-18T09:00:00Z' },
  { id: 'a3', entity_type: 'property', entity_id: 'p2-uuid', action: 'update', details: { fields: ['price'] }, created_at: '2026-08-18T08:00:00Z' },
]

describe('AdminActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchActivityLog.mockResolvedValue({ data: sample, count: sample.length })
  })

  it('renders log entries with action types and entity types', async () => {
    render(<AdminActivityLog />)

    expect(await screen.findByText('property')).toBeInTheDocument()
    expect(screen.getByText('inquiry')).toBeInTheDocument()
    expect(screen.getByText('create')).toBeInTheDocument()
    expect(screen.getByText('delete')).toBeInTheDocument()
    expect(screen.getByText('update')).toBeInTheDocument()
  })

  it('shows filter dropdowns and search input', async () => {
    render(<AdminActivityLog />)

    await screen.findByText('property')
    expect(screen.getByLabelText('Filter by action')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by entity type')).toBeInTheDocument()
    expect(screen.getByLabelText('Search by record ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort order')).toBeInTheDocument()
  })

  it('handles action type filter change', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    await screen.findByText('property')
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'delete')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }))
    })
  })

  it('handles entity type filter change', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    await screen.findByText('property')
    await user.selectOptions(screen.getByLabelText('Filter by entity type'), 'inquiry')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(expect.objectContaining({ entity_type: 'inquiry' }))
    })
  })

  it('handles search input', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    await screen.findByText('property')
    await user.type(screen.getByLabelText('Search by record ID'), 'p1')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(expect.objectContaining({ search: 'p1' }))
    })
  })

  it('handles sort change', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    await screen.findByText('property')
    await user.selectOptions(screen.getByLabelText('Sort order'), 'oldest')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(expect.objectContaining({ sort: 'oldest' }))
    })
  })

  it('shows result count', async () => {
    render(<AdminActivityLog />)

    await screen.findByText('property')
    expect(screen.getByText('Showing 3 of 3 entries')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    fetchActivityLog.mockReturnValue(new Promise(() => {}))

    render(<AdminActivityLog />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    fetchActivityLog.mockResolvedValue({ data: [], count: 0 })

    render(<AdminActivityLog />)

    expect(await screen.findByText('No activity log entries found.')).toBeInTheDocument()
  })

  it('export button calls exportToCSV', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    await screen.findByText('property')
    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Action', 'Entity Type', 'Record ID', 'Timestamp', 'Details'],
      expect.arrayContaining([
        expect.arrayContaining(['create']),
        expect.arrayContaining(['delete']),
        expect.arrayContaining(['update']),
      ]),
      expect.stringMatching(/activity-log-export-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })

  it('pagination Previous/Next works', async () => {
    const user = userEvent.setup()
    fetchActivityLog.mockResolvedValueOnce({ data: sample, count: 25 })

    render(<AdminActivityLog />)

    await screen.findByText('property')
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).toBeInTheDocument()

    await user.click(nextBtn)

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/AdminActivityLog.test.jsx --reporter=verbose 2>&1 | tail -30`
Expected: FAIL — module not found or component not defined.

- [ ] **Step 3: Create `AdminActivityLog.jsx`**

Create `src/components/admin/AdminActivityLog.jsx`:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchActivityLog } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
import { formatRelativeTime } from '../../lib/format.js'

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
}

const ENTITY_LABELS = {
  property: 'Property',
  inquiry: 'Inquiry',
}

export default function AdminActivityLog() {
  const [entries, setEntries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const debounceRef = useRef(null)

  const limit = 20

  const load = useCallback(() => {
    setStatus('loading')
    const filters = {}
    if (actionFilter) filters.action = actionFilter
    if (entityFilter) filters.entity_type = entityFilter
    if (search) filters.search = search
    filters.sort = sort
    filters.page = page
    filters.limit = limit
    fetchActivityLog(filters)
      .then((result) => {
        setEntries(result.data ?? [])
        setTotalCount(result.count ?? 0)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [actionFilter, entityFilter, search, sort, page])

  useEffect(load, [load])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const resetFilters = () => {
    setActionFilter('')
    setEntityFilter('')
    setSearchInput('')
    setSearch('')
    setSort('newest')
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / limit)

  const exportCSV = () => {
    const headers = ['Action', 'Entity Type', 'Record ID', 'Timestamp', 'Details']
    const rows = entries.map((e) => [
      e.action,
      ENTITY_LABELS[e.entity_type] ?? e.entity_type,
      e.entity_id,
      new Date(e.created_at).toLocaleString('en-PH'),
      e.details ? JSON.stringify(e.details) : '',
    ])
    const date = new Date().toISOString().slice(0, 10)
    exportToCSV(headers, rows, `activity-log-export-${date}.csv`)
  }

  if (status === 'loading') {
    return <p className="text-sm text-ink/60">Loading…</p>
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm text-red-600">Failed to load activity log.</p>
        <button onClick={load} className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 hover:border-brand/40 hover:text-brand">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Activity Log</h1>
        <p className="mt-1 text-sm text-ink/60">Track all admin actions across the system</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by record ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search by record ID"
          className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          aria-label="Filter by action"
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
          aria-label="Filter by entity type"
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All Types</option>
          <option value="property">Properties</option>
          <option value="inquiry">Inquiries</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort order"
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        {(actionFilter || entityFilter || search || sort !== 'newest') && (
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-ink/50 hover:text-brand"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink/50">
          Showing {entries.length} of {totalCount} entries
        </p>
        <button
          onClick={exportCSV}
          disabled={entries.length === 0}
          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No activity log entries found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="hidden px-4 py-3 sm:table-cell">Record ID</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="hidden px-4 py-3 md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-ink/50 sm:table-cell">
                    {entry.entity_id}
                  </td>
                  <td className="px-4 py-3 text-ink/60" title={new Date(entry.created_at).toLocaleString('en-PH')}>
                    {formatRelativeTime(entry.created_at)}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-ink/50 md:table-cell">
                    {entry.details && Object.keys(entry.details).length > 0
                      ? JSON.stringify(entry.details)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-ink/60">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/AdminActivityLog.test.jsx --reporter=verbose 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminActivityLog.jsx src/components/admin/AdminActivityLog.test.jsx
git commit -m "feat: add AdminActivityLog component with tests"
```

---

### Task 6: Add Activity Log tab to AdminDashboard

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`
- Modify: `src/components/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Add mock for AdminActivityLog in the test file**

Add this line after the existing `vi.mock('./AdminNotifications.jsx', ...)`:

```javascript
vi.mock('./AdminActivityLog.jsx', () => ({ default: () => <span>ActivityLogPanel</span> }))
```

- [ ] **Step 2: Add test for the new tab**

Append to the `describe('AdminDashboard', ...)` block:

```javascript
it('switches to the Activity Log tab', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  const user = userEvent.setup()

  renderDashboard()

  await waitFor(() => {
    expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: 'Activity Log' }))
  await waitFor(() => {
    expect(screen.getByText('ActivityLogPanel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the dashboard test to verify it fails**

Run: `npx vitest run src/components/admin/AdminDashboard.test.jsx --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — "Activity Log" button not found.

- [ ] **Step 4: Modify AdminDashboard.jsx**

Add import after the existing imports:

```javascript
import AdminActivityLog from './AdminActivityLog.jsx'
```

Add to the `tabs` array after `{ id: 'notifications', label: 'Notifications' }`:

```javascript
{ id: 'activity-log', label: 'Activity Log' },
```

Add conditional render after `{tab === 'notifications' && <AdminNotifications />}`:

```javascript
{tab === 'activity-log' && <AdminActivityLog />}
```

- [ ] **Step 5: Run dashboard test to verify it passes**

Run: `npx vitest run src/components/admin/AdminDashboard.test.jsx --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS including the new Activity Log tab test.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminDashboard.jsx src/components/admin/AdminDashboard.test.jsx
git commit -m "feat: add Activity Log tab to admin dashboard"
```

---

### Task 7: Verify everything

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm run test 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit if needed**

If any fixes were needed, commit them:

```bash
git add -A && git commit -m "fix: address test/build issues for phase 9"
```
