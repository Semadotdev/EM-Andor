import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import PropertyForm from './PropertyForm.jsx'
import { deleteProperty, fetchProperties, setPropertyPinned, updateProperty } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

const fallbackImage = '/images/project-1.jpg'

export default function AdminPortfolio() {
  const [properties, setProperties] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [pendingPins, setPendingPins] = useState({})
  const [pendingStatus, setPendingStatus] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const debounceRef = useRef(null)

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
    if (pendingStatus[property.id]) return
    const prev = property.status
    setError(null)
    setPendingStatus((s) => ({ ...s, [property.id]: true }))
    setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, status: newStatus } : x)))
    try {
      await updateProperty(property.id, { status: newStatus })
    } catch {
      setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, status: prev } : x)))
      setError('Could not update status. Please try again.')
    } finally {
      setPendingStatus((s) => ({ ...s, [property.id]: false }))
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return
    setError(null)
    setDeleting(true)
    try {
      await deleteProperty(confirmDelete.id)
      setProperties((list) => list.filter((x) => x.id !== confirmDelete.id))
      setTotalCount((c) => c - 1)
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

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading portfolio">
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
          <p className="text-ink/70">Could not load portfolio.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && properties.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <Icon name="residential" className="size-10 text-ink/30" />
          <p className="text-ink/60">
            {(search || typeFilter || statusFilter) ? 'No properties match your filters.' : 'No properties yet. Click "Add New Property" to create one.'}
          </p>
        </div>
      )}

      {status === 'ready' && properties.length > 0 && (
        <>
          <p className="mb-4 text-xs font-semibold text-ink/50">
            Showing {properties.length} of {totalCount} {totalCount === 1 ? 'property' : 'properties'}
          </p>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <article
                key={property.id}
                className="group overflow-hidden rounded-lg border border-mist bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative aspect-[16/11] overflow-hidden">
                  <img
                    src={property.image_url || fallbackImage}
                    alt={property.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-white">
                    {property.type}
                  </span>
                  {property.is_pinned && (
                    <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-gold text-brand-deep shadow-sm">
                      <Icon name="pin" className="size-3.5" />
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
                        <Icon name="pin" className="size-3" />
                        {property.location}
                      </p>
                      <h3 className="mt-1 truncate font-display text-lg font-bold text-brand-deep">{property.name}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      property.status === 'sold'
                        ? 'bg-red-100 text-red-700'
                        : property.status === 'reserved'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : 'Available'}
                    </span>
                  </div>

                  {property.price != null && (
                    <p className="mb-4 font-display text-base font-bold text-brand">
                      {formatPrice(property.price) ?? '—'}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setForm({ mode: 'edit', property })}
                      className="flex-1 rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePin(property)}
                      disabled={Boolean(pendingPins[property.id])}
                      aria-label={property.is_pinned ? 'Unpin' : 'Pin'}
                      className={`grid size-8 place-items-center rounded-md border transition-colors disabled:opacity-60 ${
                        property.is_pinned
                          ? 'border-gold bg-gold text-brand-deep'
                          : 'border-mist text-ink/50 hover:border-brand/40 hover:text-brand'
                      }`}
                    >
                      <Icon name="pin" className="size-3.5" />
                    </button>
                    <select
                      value={property.status}
                      onChange={(e) => handleStatusChange(property, e.target.value)}
                      disabled={Boolean(pendingStatus[property.id])}
                      aria-label={`Change status for ${property.name}`}
                      className="rounded-md border border-mist px-2 py-1.5 text-xs font-semibold text-ink/70 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-60"
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                    </select>
                    <button
                      onClick={() => setConfirmDelete(property)}
                      className="grid size-8 place-items-center rounded-md border border-red-200 text-red-600 transition-colors hover:bg-red-50"
                      aria-label={`Delete ${property.name}`}
                    >
                      <Icon name="safety" className="size-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
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
    </div>
  )
}
