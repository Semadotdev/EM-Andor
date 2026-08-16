export default function SectionHeading({ eyebrow, title, description, align = 'center', light = false, className = '' }) {
  const alignCls = align === 'left' ? 'items-start text-left' : 'items-center text-center'
  return (
    <div className={`flex flex-col gap-4 ${alignCls} ${className}`}>
      {eyebrow && (
        <span className={`eyebrow flex items-center gap-3 ${align === 'center' ? 'justify-center' : ''} ${light ? 'text-gold' : ''}`}>
          <span className="gold-rule" aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      <h2
        className={`max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem] ${
          light ? 'text-white' : 'text-brand-deep'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p className={`max-w-2xl text-base leading-relaxed sm:text-lg ${light ? 'text-white/75' : 'text-ink/70'}`}>
          {description}
        </p>
      )}
    </div>
  )
}
