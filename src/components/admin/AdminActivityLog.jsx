import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchActivityLog } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
import { formatRelativeTime } from '../../lib/format.js'
import { Badge, DataTable, ErrorState, LoadingState, PageHeader } from '../shared/ui'

const ACTION_TONES = {
  create: 'green',
  update: 'blue',
  delete: 'red',
}

const ENTITY_LABELS = {
  property: 'Properties',
  inquiry: 'Inquiries',
  cms: 'CMS',
  sale: 'Sales',
  project: 'Projects',
  commission: 'Commissions',
  agent: 'Agents',
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

  const load = useCallback(() => {
    setStatus('loading')
    const filters = { page }
    if (actionFilter) filters.action = actionFilter
    if (entityFilter) filters.entity_type = entityFilter
    if (search) filters.search = search
    if (sort) filters.sort = sort
    fetchActivityLog(filters)
      .then((result) => {
        setEntries(result.data ?? [])
        setTotalCount(result.count ?? 0)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [actionFilter, entityFilter, search, sort, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(totalCount / 20))

  const exportCSV = () => {
    const headers = ['Action', 'Table', 'Record ID', 'Timestamp', 'Details']
    const rows = entries.map((e) => [
      e.action,
      ENTITY_LABELS[e.entity_type] || e.entity_type,
      e.entity_id,
      new Date(e.created_at).toLocaleString('en-PH'),
      e.details ? JSON.stringify(e.details) : '',
    ])
    const date = new Date().toISOString().slice(0, 10)
    exportToCSV(headers, rows, `activity-log-${date}.csv`)
  }

  const columns = [
    {
      key: 'action',
      header: 'Action',
      render: (entry) => (
        <Badge tone={ACTION_TONES[entry.action] ?? 'gray'}>
          {entry.action ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1) : entry.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Table',
      className: 'text-ink/70',
      render: (entry) => ENTITY_LABELS[entry.entity_type] || entry.entity_type,
    },
    {
      key: 'record',
      header: 'Record ID',
      hideBelow: 'sm',
      className: 'font-mono text-xs text-ink/50',
      render: (entry) => entry.entity_id,
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      className: 'text-ink/60',
      render: (entry) => (
        <span title={new Date(entry.created_at).toLocaleString('en-PH')}>
          {formatRelativeTime(entry.created_at)}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      hideBelow: 'md',
      className: 'text-xs text-ink/50',
      render: (entry) => (entry.details && Object.keys(entry.details).length > 0 ? JSON.stringify(entry.details) : '—'),
    },
  ]

  const activityCard = (entry) => (
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Badge tone={ACTION_TONES[entry.action] ?? 'gray'}>
          {entry.action ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1) : entry.action}
        </Badge>
        <span className="text-xs text-ink/50">{formatRelativeTime(entry.created_at)}</span>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Table</dt>
          <dd className="text-ink/70">{ENTITY_LABELS[entry.entity_type] || entry.entity_type}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Record ID</dt>
          <dd className="font-mono text-xs text-ink/50">{entry.entity_id}</dd>
        </div>
        {entry.details && Object.keys(entry.details).length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Details</dt>
            <dd className="text-xs text-ink/50">{JSON.stringify(entry.details)}</dd>
          </div>
        )}
      </dl>
    </div>
  )

  const hasFilters = Boolean(search || actionFilter || entityFilter)

  return (
    <div>
      <PageHeader title="Activity Log" description="Every recorded create, update, and delete." />

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
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
          aria-label="Filter by table"
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All Tables</option>
          <option value="property">Properties</option>
          <option value="inquiry">Inquiries</option>
          <option value="cms">CMS</option>
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          aria-label="Sort activity log"
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        {hasFilters || sort !== 'newest' ? (
          <button
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setActionFilter('')
              setEntityFilter('')
              setSort('newest')
              setPage(1)
            }}
            className="rounded-md border border-mist px-3 py-2 text-xs font-semibold text-ink/60 transition-colors hover:border-brand/40 hover:text-brand"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {status === 'loading' && <LoadingState label="Loading activity log…" />}

      {status === 'error' && <ErrorState message="Could not load activity log." onRetry={load} />}

      {status === 'ready' && (
        <>
          {entries.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
                <button
                  onClick={exportCSV}
                  className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                >
                  Export CSV
                </button>
              </div>

              <p className="mb-3 text-xs font-semibold text-ink/50">
                Showing {entries.length} of {totalCount} entries
              </p>
            </>
          )}

          <DataTable
            columns={columns}
            rows={entries}
            getRowKey={(entry) => entry.id}
            emptyMessage={hasFilters ? 'No log entries match your filters.' : 'No activity recorded yet.'}
            mobileCard={activityCard}
          />

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-ink/60">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
