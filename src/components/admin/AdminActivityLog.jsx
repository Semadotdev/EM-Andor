import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchActivityLog } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'
import { formatRelativeTime } from '../../lib/format.js'

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
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

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-brand-deep">Activity Log</h1>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
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
          {(search || actionFilter || entityFilter || sort !== 'newest') && (
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
          )}
        </div>
      </div>

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading activity log…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load activity log.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          {(search || actionFilter || entityFilter) ? 'No log entries match your filters.' : 'No activity recorded yet.'}
        </p>
      )}

      {status === 'ready' && entries.length > 0 && (
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

          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Record ID</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="hidden px-4 py-3 md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-mist/70 last:border-0">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {entry.action ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1) : entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
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
