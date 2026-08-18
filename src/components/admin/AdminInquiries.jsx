import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import { deleteInquiry, fetchInquiries, setInquiryRead, bulkDeleteInquiries, bulkSetInquiryRead } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'

export default function AdminInquiries() {
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
  const [selected, setSelected] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

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
    setSelected(new Set())
  }, [search, readFilter])

  const toggleRead = async (inquiry) => {
    if (pendingReads[inquiry.id]) return
    const next = !inquiry.is_read
    const prev = inquiry.is_read
    setError(null)
    setPendingReads((reads) => ({ ...reads, [inquiry.id]: true }))
    setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: next } : x)))
    try {
      await setInquiryRead(inquiry.id, next)
    } catch {
      setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: prev } : x)))
      setError('Could not update status. Please try again.')
    } finally {
      setPendingReads((reads) => ({ ...reads, [inquiry.id]: false }))
    }
  }

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

  return (
    <div>
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

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading inquiries…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load inquiries.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && inquiries.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          {search || readFilter ? 'No inquiries match your filters.' : 'No inquiries yet. Submissions from the contact form will appear here.'}
        </p>
      )}

      {status === 'ready' && inquiries.length > 0 && (
        <>
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

          <p className="mb-3 text-xs font-semibold text-ink/50">
            Showing {inquiries.length} of {totalCount} inquiries
          </p>
          <ul className="space-y-4">
          {inquiries.map((inquiry) => {
            const isExpanded = expanded === inquiry.id
            return (
              <li
                key={inquiry.id}
                className={`rounded-lg border bg-white p-5 ${inquiry.is_read ? 'border-mist' : 'border-brand/40 ring-1 ring-brand/20'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(inquiry.id)}
                    onChange={() => toggleSelect(inquiry.id)}
                    aria-label={`Select inquiry from ${inquiry.name}`}
                    className="mt-1 size-4 shrink-0 rounded border-mist text-brand focus:ring-brand/30"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button className="text-left" onClick={() => setExpanded(isExpanded ? null : inquiry.id)} aria-expanded={isExpanded}>
                        <span className="flex items-center gap-2">
                          {!inquiry.is_read && <span className="size-2 rounded-full bg-brand" aria-hidden="true" />}
                          <span className="font-semibold text-brand-deep">{inquiry.name}</span>
                          <span className="text-sm text-ink/50">
                            · <span>{inquiry.project_type || 'General'}</span>
                          </span>
                          {inquiry.property_name && (
                            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                              {inquiry.property_name}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink/50">
                          {new Date(inquiry.created_at).toLocaleString('en-PH')}
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleRead(inquiry)}
                          disabled={Boolean(pendingReads[inquiry.id])}
                          aria-pressed={inquiry.is_read}
                          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          {inquiry.is_read ? 'Mark unread' : 'Mark read'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(inquiry)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 rounded-md bg-surface p-4 text-sm leading-relaxed text-ink/80">
                        {inquiry.property_name && (
                          <p className="mb-2">
                            <span className="font-semibold text-brand-deep">Property:</span> {inquiry.property_name}
                          </p>
                        )}
                        <p>
                          <span className="font-semibold text-brand-deep">Email:</span> {inquiry.email}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-brand-deep">Phone:</span> {inquiry.phone}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap">{inquiry.message}</p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Inquiry"
        message={confirmDelete ? `Delete inquiry from ${confirmDelete.name}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />

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
    </div>
  )
}
