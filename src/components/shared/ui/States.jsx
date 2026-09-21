import BrandLoader from './BrandLoader.jsx'

export function EmptyState({ message, children }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
      {message && <p className="text-ink/60">{message}</p>}
      {children}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }) {
  return <BrandLoader fullscreen={false} label={label} />
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
      <p className="text-ink/70">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-gold">
          Retry
        </button>
      )}
    </div>
  )
}
