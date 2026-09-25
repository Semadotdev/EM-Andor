export default function BrandLoader({ fullscreen = true, label }) {
  if (!fullscreen) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-ink/60">
        <span
          aria-hidden="true"
          className="size-5 animate-brand-spin rounded-full border-2 border-mist border-t-brand"
        />
        {label && <span>{label}</span>}
      </div>
    )
  }

  return (
    <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-brand-deep text-white">
      <div className="hero-lines absolute inset-0" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <span className="relative grid size-20 place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-brand-spin rounded-full border-2 border-gold/25 border-t-gold"
          />
          <svg viewBox="0 0 32 32" className="size-10 animate-brand-pulse" aria-hidden="true">
            <path d="M16 4 30 28H2L16 4Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M16 13 24 28H8L16 13Z" fill="#F6D21A" />
          </svg>
        </span>

        <p className="leading-tight">
          <span className="block font-display text-xl font-extrabold uppercase tracking-tight">
            E.M. <span className="text-gold">Andor</span>
          </span>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-white/70">
            Realty &amp; Development
          </span>
        </p>

        <span aria-hidden="true" className="h-1.5 w-52 max-w-[70vw] overflow-hidden rounded-full bg-white/15">
          <span className="block h-full w-1/3 animate-brand-progress rounded-full bg-gold" />
        </span>

        <span className="sr-only">{label || 'Loading…'}</span>
      </div>
    </div>
  )
}
