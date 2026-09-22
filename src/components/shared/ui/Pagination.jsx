import { Select } from './Field.jsx'

const controlClass =
  'rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40'

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  from,
  to,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 flex flex-wrap items-center justify-center gap-3 sm:order-1">
        <p aria-live="polite" className="text-xs font-semibold text-ink/50">
          Showing {from}–{to} of {total}
        </p>
        {onPageSizeChange ? (
          <Select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="w-auto! px-2! py-1.5! text-xs!"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <div className="order-1 flex items-center gap-3 sm:order-2">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={controlClass}
        >
          Prev
        </button>
        <span className="text-sm text-ink/60">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={controlClass}
        >
          Next
        </button>
      </div>
    </div>
  )
}
