import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteInquiry, fetchInquiries, setInquiryRead, bulkDeleteInquiries, bulkSetInquiryRead } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmModal,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  useToast,
} from '../shared/ui'

const readTone = (isRead) => (isRead ? 'green' : 'yellow')

export default function AdminInquiries() {
  const { showToast } = useToast()
  const [inquiries, setInquiries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
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
      showToast(next ? 'Inquiry marked as read.' : 'Inquiry marked as unread.')
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
      showToast('Inquiry deleted.')
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
      showToast('Selected inquiries deleted.')
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
      showToast(isRead ? 'Inquiries marked as read.' : 'Inquiries marked as unread.')
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

  const rowActions = (inquiry) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => toggleRead(inquiry)}
        disabled={Boolean(pendingReads[inquiry.id])}
        aria-pressed={inquiry.is_read}
      >
        {inquiry.is_read ? 'Mark unread' : 'Mark read'}
      </Button>
      <Button size="sm" variant="danger" onClick={() => setConfirmDelete(inquiry)}>
        Delete
      </Button>
    </div>
  )

  const columns = [
    {
      key: 'select',
      header: '',
      render: (inquiry) => (
        <input
          type="checkbox"
          checked={selected.has(inquiry.id)}
          onChange={() => toggleSelect(inquiry.id)}
          aria-label={`Select inquiry from ${inquiry.name}`}
          className="size-4 rounded border-mist text-brand focus:ring-brand/30"
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      className: 'font-semibold text-brand-deep',
      render: (inquiry) => (
        <span className="flex items-center gap-2">
          {!inquiry.is_read && <span className="size-2 rounded-full bg-brand" aria-hidden="true" />}
          {inquiry.name}
        </span>
      ),
    },
    { key: 'type', header: 'Type', className: 'text-ink/70', render: (inquiry) => inquiry.project_type || 'General' },
    {
      key: 'property',
      header: 'Property',
      hideBelow: 'lg',
      className: 'text-ink/70',
      render: (inquiry) => inquiry.property_name || '—',
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      className: 'text-ink/70',
      render: (inquiry) => (
        <>
          <span className="block">{inquiry.email}</span>
          <span className="block text-xs text-ink/50">{inquiry.phone}</span>
        </>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      hideBelow: 'lg',
      className: 'text-ink/70',
      render: (inquiry) => <span className="block max-w-xs whitespace-pre-wrap">{inquiry.message}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (inquiry) => <Badge tone={readTone(inquiry.is_read)}>{inquiry.is_read ? 'Read' : 'Unread'}</Badge>,
    },
    { key: 'actions', header: 'Actions', align: 'right', noWrap: true, render: rowActions },
  ]

  const inquiryCard = (inquiry) => (
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-brand-deep">
          {!inquiry.is_read && <span className="size-2 rounded-full bg-brand" aria-hidden="true" />}
          {inquiry.name}
        </p>
        <Badge tone={readTone(inquiry.is_read)}>{inquiry.is_read ? 'Read' : 'Unread'}</Badge>
      </div>
      <dl className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Type</dt>
          <dd className="text-ink/70">{inquiry.project_type || 'General'}</dd>
        </div>
        {inquiry.property_name && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Property</dt>
            <dd className="text-ink/70">{inquiry.property_name}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Email</dt>
          <dd className="text-ink/70">{inquiry.email}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Phone</dt>
          <dd className="text-ink/70">{inquiry.phone}</dd>
        </div>
      </dl>
      <p className="mb-3 whitespace-pre-wrap text-sm text-ink/70">{inquiry.message}</p>
      {rowActions(inquiry)}
    </div>
  )

  return (
    <div>
      <PageHeader title="Inquiries" description="Submissions from the public contact form." />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input
            type="text"
            placeholder="Search name, email, or message…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search inquiries"
          />
        </div>
        <Select aria-label="Filter by read status" value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </Select>
        <Select aria-label="Sort inquiries" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name: A → Z</option>
        </Select>
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

      {status === 'loading' && <LoadingState label="Loading inquiries…" />}

      {status === 'error' && <ErrorState message="Could not load inquiries." onRetry={load} />}

      {status === 'ready' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
            <Checkbox
              id="inquiries-select-all"
              label="Select all inquiries"
              checked={selected.size === inquiries.length && inquiries.length > 0}
              onChange={toggleSelectAll}
            />
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-brand-deep">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleBulkRead(true)} disabled={bulkProcessing}>
                    Mark All Read
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleBulkRead(false)} disabled={bulkProcessing}>
                    Mark All Unread
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmBulkDelete(true)} disabled={bulkProcessing}>
                    Delete Selected
                  </Button>
                </div>
                <button
                  onClick={deselectAll}
                  className="ml-auto text-xs font-semibold text-ink/50 hover:text-brand"
                >
                  Deselect All
                </button>
              </>
            ) : null}
            <Button size="sm" variant="secondary" className={selected.size > 0 ? '' : 'ml-auto'} onClick={exportInquiriesCSV}>
              Export CSV
            </Button>
          </div>

          <p className="mb-3 text-xs font-semibold text-ink/50">
            Showing {inquiries.length} of {totalCount} inquiries
          </p>

          <DataTable
            columns={columns}
            rows={inquiries}
            getRowKey={(inquiry) => inquiry.id}
            emptyMessage={
              search || readFilter
                ? 'No inquiries match your filters.'
                : 'No inquiries yet. Submissions from the contact form will appear here.'
            }
            mobileCard={inquiryCard}
          />
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
