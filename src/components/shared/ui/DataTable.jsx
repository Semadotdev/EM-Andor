import { EmptyState, ErrorState } from './States.jsx'

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

const cellClass = (column, extra = '') =>
  ['px-4 py-3', HIDE_BELOW[column.hideBelow], column.className, extra].filter(Boolean).join(' ')

function TableHead({ columns }) {
  return (
    <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
      <tr>
        {columns.map((column) => (
          <th key={column.key} scope="col" className={cellClass(column)}>
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function Table({ columns, rows, getRowKey, footer }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-mist bg-white">
      <table className="w-full text-left text-sm">
        <TableHead columns={columns} />
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="border-b border-mist/70 last:border-0">
              {columns.map((column) => (
                <td key={column.key} className={cellClass(column)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="border-t border-mist px-4 py-3">{footer}</div>}
    </div>
  )
}

export default function DataTable({
  columns,
  rows = [],
  getRowKey,
  state = 'ready',
  onRetry,
  emptyMessage = 'Nothing here yet.',
  loadingMessage = 'Loading…',
  footer,
  mobileCard,
}) {
  const rowKey = getRowKey ?? ((row, index) => row?.id ?? index)

  if (state === 'error') {
    return <ErrorState onRetry={onRetry} />
  }

  const table = (
    <div className={mobileCard ? 'hidden md:block' : undefined}>
      <Table columns={columns} rows={rows} getRowKey={rowKey} footer={footer} />
    </div>
  )

  if (state === 'loading') {
    return (
      <div className="overflow-x-auto rounded-lg border border-mist bg-white" aria-busy="true">
        <span role="status" className="sr-only">
          {loadingMessage}
        </span>
        <table className="w-full text-left text-sm">
          <TableHead columns={columns} />
          <tbody>
            {[0, 1, 2].map((rowIndex) => (
              <tr key={rowIndex} className="border-b border-mist/70 last:border-0">
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    <span className="block h-4 w-24 animate-pulse rounded bg-mist" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  if (!mobileCard) return table

  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={rowKey(row, index)}>{mobileCard(row)}</div>
        ))}
      </div>
      {table}
    </div>
  )
}
