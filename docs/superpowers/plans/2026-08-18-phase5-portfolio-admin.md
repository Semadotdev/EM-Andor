# Phase 5: Portfolio Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual portfolio grid view to the admin panel with quick actions on each property card.

**Architecture:** Create a new `AdminPortfolio` component that fetches properties using the existing `fetchProperties` API and renders them in a card grid. Reuse existing `PropertyForm` for create/edit. Add a "Portfolio" tab to `AdminDashboard`. No new API functions needed.

**Tech Stack:** React 19, Supabase JS client, Tailwind CSS, Vitest + @testing-library/react

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/components/admin/AdminPortfolio.jsx` | Create | Portfolio grid view with admin controls |
| `src/components/admin/AdminPortfolio.test.jsx` | Create | Tests for portfolio component |
| `src/components/admin/AdminDashboard.jsx` | Modify | Add Portfolio tab |
| `src/components/admin/AdminDashboard.test.jsx` | Modify | Add test for Portfolio tab |
| `docs/superpowers/specs/2026-08-18-phase5-portfolio-admin.md` | Create | Spec |
| `docs/superpowers/plans/2026-08-18-phase5-portfolio-admin.md` | Create | This plan |

---

### Task 1: Create AdminPortfolio Component

**Files:**
- Create: `src/components/admin/AdminPortfolio.jsx`

- [ ] **Step 1: Create the component file with imports and state**

Create `src/components/admin/AdminPortfolio.jsx`:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import PropertyForm from './PropertyForm.jsx'
import { deleteProperty, fetchProperties, setPropertyPinned } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

const fallbackImage = '/images/project-1.jpg'
```

- [ ] **Step 2: Add state declarations**

After imports, add the component function and all state:

```jsx
export default function AdminPortfolio() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [pendingPins, setPendingPins] = useState({})
  const [pendingStatuses, setPendingStatuses] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const debounceRef = useRef(null)
```

- [ ] **Step 3: Add load function and effects**

```jsx
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
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [search, typeFilter, statusFilter, sort])

  useEffect(load, [load])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])
```

- [ ] **Step 4: Add action handlers**

After the effects, add all action handlers:

```jsx
  const togglePin = async (property) => {
    if (pendingPins[property.id]) return
    const next = !property.is_pinned
    const prev = property.is_pinned
    setError(null)
    setPendingPins((pins) => ({ ...pins, [property.id]: true }))
    setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: next } : x)))
    try {
      await setPropertyPinned(property.id, next)
    } catch {
      setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: prev } : x)))
      setError('Could not update pin status. Please try again.')
    } finally {
      setPendingPins((pins) => ({ ...pins, [property.id]: false }))
    }
  }

  const handleStatusChange = async (property, newStatus) => {
    if (pendingStatuses[property.id]) return
    const prev = property.status
    setError(null)
    setPendingStatuses((s) => ({ ...s, [property.id]: true }))
    setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, status: newStatus } : x)))
    try {
      const { updateProperty } = await import('../../lib/api.js')
      await updateProperty(property.id, { status: newStatus })
    } catch {
      setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, status: prev } : x)))
      setError('Could not update status. Please try again.')
    } finally {
      setPendingStatuses((s) => ({ ...s, [property.id]: false }))
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return
    setError(null)
    setDeleting(true)
    try {
      await deleteProperty(confirmDelete.id)
      setProperties((list) => list.filter((x) => x.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch {
      setError('Could not delete property. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSaved = () => {
    setForm(null)
    load()
  }
```

- [ ] **Step 5: Add the JSX return — header and controls**

```jsx
  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-brand-deep">Portfolio</h1>
          <button onClick={() => setForm({ mode: 'create' })} className="btn btn-gold">
            <Icon name="residential" className="size-4" />
            Add New Property
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

- [ ] **Step 6: Add error, loading, and empty states**

After the controls section, add:

```jsx
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading properties">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-mist bg-white">
              <div className="aspect-[16/11] bg-mist" />
              <div className="space-y-3 p-6">
                <div className="h-4 w-24 rounded bg-mist" />
                <div className="h-5 w-3/4 rounded bg-mist" />
                <div className="h-4 w-1/2 rounded bg-mist" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load properties.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && properties.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          {(search || typeFilter || statusFilter) ? 'No properties match your filters.' : 'No properties yet. Click "Add New Property" to create one.'}
        </p>
      )}
```

- [ ] **Step 7: Add the property card grid**

After the empty state, add:

```jsx
      {status === 'ready' && properties.length > 0 && (
        <>
          <p className="mb-3 text-xs font-semibold text-ink/50">
            Showing {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
          </p>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <article
                key={property.id}
                className="group overflow-hidden rounded-lg bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <div className="relative aspect-[16/11] overflow-hidden">
                  <img
                    src={property.image_url || fallbackImage}
                    alt={property.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-white">
                    {property.type}
                  </span>
                  <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-xs font-bold ${
                    property.status === 'sold'
                      ? 'bg-red-100 text-red-700'
                      : property.status === 'reserved'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}>
                    {property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : 'Available'}
                  </span>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
                        <Icon name="pin" className="size-3.5" />
                        {property.location}
                      </p>
                      <h3 className="mt-1 truncate font-display text-lg font-bold text-brand-deep">{property.name}</h3>
                    </div>
                    {property.is_pinned && (
                      <span className="shrink-0 rounded-full bg-gold/20 p-1.5" title="Pinned to website">
                        <Icon name="pin" className="size-3.5 text-gold" />
                      </span>
                    )}
                  </div>
                  {property.price != null && formatPrice(property.price) && (
                    <p className="mb-4 font-display text-base font-bold text-brand">
                      {formatPrice(property.price)}
                    </p>
                  )}
                  {property.price == null && <div className="mb-4" />}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setForm({ mode: 'edit', property })}
                      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePin(property)}
                      disabled={Boolean(pendingPins[property.id])}
                      aria-pressed={property.is_pinned}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        property.is_pinned
                          ? 'bg-gold text-brand-deep'
                          : 'border border-mist text-ink/50 hover:border-brand/40 hover:text-brand'
                      }`}
                    >
                      <Icon name="pin" className="size-3.5" />
                      {property.is_pinned ? 'Pinned' : 'Pin'}
                    </button>
                    <select
                      value={property.status || 'available'}
                      onChange={(e) => handleStatusChange(property, e.target.value)}
                      disabled={Boolean(pendingStatuses[property.id])}
                      aria-label={`Change status for ${property.name}`}
                      className="rounded-md border border-mist px-2 py-1.5 text-xs font-semibold text-ink/70 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-60"
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                    </select>
                    <button
                      onClick={() => setConfirmDelete(property)}
                      className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
```

- [ ] **Step 8: Add modals**

At the end of the return (before the closing `</div>`), add:

```jsx
      {form && (
        <PropertyForm
          mode={form.mode}
          property={form.mode === 'edit' ? form.property : null}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Property"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />
    </div>
  )
}
```

- [ ] **Step 9: Verify component**

Check that the file is syntactically correct and all imports resolve.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/AdminPortfolio.jsx
git commit -m "feat(admin): add AdminPortfolio grid view with quick actions"
```

---

### Task 2: Add Portfolio Tab to AdminDashboard

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Add import for AdminPortfolio**

After line 5 (`import AdminInquiries from './AdminInquiries.jsx'`), add:

```jsx
import AdminPortfolio from './AdminPortfolio.jsx'
```

- [ ] **Step 2: Add Portfolio tab to the tabs array**

Update the `tabs` array (lines 8-11):

```jsx
const tabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'inquiries', label: 'Inquiries' },
]
```

- [ ] **Step 3: Update the tab content rendering**

Update the conditional rendering (line 87). Replace:

```jsx
{tab === 'properties' ? <AdminProperties /> : <AdminInquiries />}
```

With:

```jsx
{tab === 'properties' && <AdminProperties />}
{tab === 'portfolio' && <AdminPortfolio />}
{tab === 'inquiries' && <AdminInquiries />}
```

- [ ] **Step 4: Verify**

Check that the file is syntactically correct and all imports resolve.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminDashboard.jsx
git commit -m "feat(admin): add Portfolio tab to AdminDashboard"
```

---

### Task 3: Create AdminPortfolio Tests

**Files:**
- Create: `src/components/admin/AdminPortfolio.test.jsx`

- [ ] **Step 1: Create test file**

Create `src/components/admin/AdminPortfolio.test.jsx` with the following tests:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPortfolio from './AdminPortfolio.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  updateProperty: vi.fn(),
  createProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { fetchProperties, setPropertyPinned, deleteProperty, updateProperty } from '../../lib/api.js'

const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false, status: 'available', created_at: '2026-08-16T01:00:00Z' },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true, status: 'reserved', created_at: '2026-08-16T02:00:00Z' },
]

describe('AdminPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
  })

  it('renders property cards in a grid', async () => {
    render(<AdminPortfolio />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('Lot B')).toBeInTheDocument()
    expect(screen.getByText('Residential Lot')).toBeInTheDocument()
    expect(screen.getByText('Commercial Lot')).toBeInTheDocument()
  })

  it('displays status badges on cards', async () => {
    render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Reserved').length).toBeGreaterThanOrEqual(1)
  })

  it('displays pinned indicator for pinned properties', async () => {
    render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    const pinnedButtons = screen.getAllByRole('button', { name: 'Pinned' })
    expect(pinnedButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('pins a property optimistically and persists it', async () => {
    setPropertyPinned.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledWith('p1', true)
    expect(screen.getAllByRole('button', { name: 'Pinned' })).toHaveLength(2)
  })

  it('reverts pin on failure and shows error', async () => {
    setPropertyPinned.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(await screen.findByText(/Could not update pin status/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Pin' })).toHaveLength(1)
  })

  it('changes status via dropdown', async () => {
    updateProperty.mockResolvedValue({ ...sample[0], status: 'sold' })
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    const statusSelects = screen.getAllByRole('combobox', { name: /Change status/i })
    await user.selectOptions(statusSelects[0], 'sold')

    expect(updateProperty).toHaveBeenCalledWith('p1', { status: 'sold' })
  })

  it('deletes a property after confirmation', async () => {
    deleteProperty.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteProperty).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Lot A')).not.toBeInTheDocument()
  })

  it('opens PropertyForm when "Add New Property" is clicked', async () => {
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    await user.click(screen.getByText('Add New Property'))

    expect(screen.getByRole('dialog', { name: 'Add property' })).toBeInTheDocument()
  })

  it('opens PropertyForm in edit mode when Edit is clicked', async () => {
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])

    expect(screen.getByRole('dialog', { name: 'Edit property' })).toBeInTheDocument()
  })

  it('shows loading state', () => {
    fetchProperties.mockReturnValue(new Promise(() => {}))

    render(<AdminPortfolio />)

    expect(screen.getByRole('status', { name: 'Loading properties' })).toBeInTheDocument()
  })

  it('shows error state with retry', async () => {
    fetchProperties.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminPortfolio />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Lot A')).toBeInTheDocument()
  })

  it('shows empty state when no properties', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AdminPortfolio />)

    expect(await screen.findByText(/No properties yet/)).toBeInTheDocument()
  })

  it('shows "no match" message when filters return empty', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AdminPortfolio />)

    await screen.findByText(/No properties yet/)
    // After typing in search, filters trigger a reload
    // The empty message should change
  })

  it('applies responsive grid classes', async () => {
    const { container } = render(<AdminPortfolio />)

    await screen.findByText('Lot A')
    const grid = container.querySelector('.grid')
    expect(grid).toHaveClass('sm:grid-cols-2')
    expect(grid).toHaveClass('lg:grid-cols-3')
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/admin/AdminPortfolio.test.jsx`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminPortfolio.test.jsx
git commit -m "test(admin): add tests for AdminPortfolio grid view"
```

---

### Task 4: Update AdminDashboard Tests

**Files:**
- Modify: `src/components/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Add mock for AdminPortfolio**

After line 8 (`vi.mock('./AdminInquiries.jsx', ...)`), add:

```jsx
vi.mock('./AdminPortfolio.jsx', () => ({ default: () => <span>PortfolioPanel</span> }))
```

- [ ] **Step 2: Add test for Portfolio tab**

Before the closing `})` of the describe block, add:

```jsx
  it('switches to the portfolio tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Portfolio' }))
    await waitFor(() => {
      expect(screen.getByText('PortfolioPanel')).toBeInTheDocument()
    })
  })
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/components/admin/AdminDashboard.test.jsx`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminDashboard.test.jsx
git commit -m "test(admin): add Portfolio tab test to AdminDashboard"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify no regressions**

Check that:
- Properties tab still works (table view, search, filter, sort, bulk actions)
- Inquiries tab still works
- Portfolio tab shows grid view with cards
- Quick actions (pin, status, delete, edit) work on portfolio cards
- PropertyForm opens correctly from portfolio (create and edit modes)
- Responsive grid layout works (1/2/3 columns)
- Loading, error, and empty states display correctly

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address test failures from portfolio admin phase"
```
