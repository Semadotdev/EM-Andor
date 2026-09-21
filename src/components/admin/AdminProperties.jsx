import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import PropertyForm from './PropertyForm.jsx'
import { deleteProperty, fetchProperties, setPropertyPinned, bulkDeleteProperties, bulkSetPropertyPinned } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
import { fetchAllAgents } from '../../lib/agents.js'
import { formatPrice } from '../../lib/format.js'

export default function AdminProperties() {
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
  const [selected, setSelected] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [agentNames, setAgentNames] = useState({})

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

  useEffect(load, [load])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  useEffect(load, [load])

  useEffect(() => {
    let mounted = true
    fetchAllAgents()
      .then((rows) => {
        if (mounted) setAgentNames(Object.fromEntries(rows.map((a) => [a.id, a.name])))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    setSelected(new Set())
  }, [search, typeFilter, statusFilter])

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

  return (
    <div>
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

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading properties…</p>}

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
          {(search || typeFilter || statusFilter) ? 'No properties match your filters.' : 'No properties yet. Click "Add Property" to create one.'}
        </p>
      )}

      {status === 'ready' && properties.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-brand-deep">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
                <div className="flex flex-wrap gap-2">
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

          <p className="mb-3 text-xs font-semibold text-ink/50">
            Showing {properties.length} of {totalCount} properties
          </p>
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
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
            <tbody>
              {properties.map((property) => (
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {property.image_url ? (
                        <img src={property.image_url} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-mist text-ink/40">
                          <Icon name="residential" className="size-5" />
                        </span>
                      )}
                      <div>
                        <p className="font-semibold text-brand-deep">{property.name}</p>
                        {property.lot_area_sqm != null && (
                          <p className="text-xs text-ink/50">{Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{property.type}</td>
                  <td className="hidden px-4 py-3 text-ink/70 md:table-cell">{property.location}</td>
                  <td className="hidden px-4 py-3 font-semibold text-ink lg:table-cell">{formatPrice(property.price) ?? '—'}</td>
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
                    {property.status === 'sold' && property.sold_by && agentNames[property.sold_by] && (
                      <p className="mt-1 text-[11px] font-semibold text-ink/50">Sold by {agentNames[property.sold_by]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setForm({ mode: 'edit', property })}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(property)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

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
    </div>
  )
}
