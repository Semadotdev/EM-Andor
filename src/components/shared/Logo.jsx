const logos = import.meta.glob('/src/assets/logo.*', { eager: true })
const logoSrc = Object.values(logos)[0]?.default

function Wordmark({ isLight }) {
  return (
    <span className="leading-tight">
      <span
        className={`block font-display text-lg font-extrabold uppercase tracking-tight ${
          isLight ? 'text-white' : 'text-brand-deep'
        }`}
      >
        E.M. <span className="text-brand-2">Andor</span>
      </span>
      <span
        className={`block text-[0.58rem] font-semibold uppercase tracking-[0.22em] ${
          isLight ? 'text-white/70' : 'text-ink/70'
        }`}
      >
        Realty &amp; Development
      </span>
    </span>
  )
}

export default function Logo({ variant = 'dark', className = '', noLink = false }) {
  const isLight = variant === 'light'
  const Tag = noLink ? 'div' : 'a'
  const tagProps = noLink ? {} : { href: '#home' }

  return (
    <Tag className={`group flex items-center gap-3 ${className}`} {...tagProps} aria-label="E.M. Andor — home">
      {logoSrc ? (
        <>
          <img
            src={logoSrc}
            alt="E.M. Andor Realty and Development logo"
            className="max-h-12 w-auto transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <Wordmark isLight={isLight} />
        </>
      ) : (
        <span className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand text-white shadow-card">
            <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
              <path d="M16 4 30 28H2L16 4Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M16 13 24 28H8L16 13Z" fill="#F6D21A" />
            </svg>
          </span>
          <Wordmark isLight={isLight} />
        </span>
      )}
    </Tag>
  )
}
