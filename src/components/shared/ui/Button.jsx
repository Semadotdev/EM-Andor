const VARIANTS = {
  gold: 'btn btn-gold',
  primary: 'btn btn-gold',
  secondary: 'btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand',
  danger: 'btn border border-red-200 text-red-700 hover:bg-red-50',
  ghost: 'btn text-ink/70 hover:bg-surface hover:text-brand',
  link: 'font-semibold text-brand underline-offset-2 hover:underline',
  'outline-light': 'btn btn-outline-light',
  'outline-dark': 'btn btn-outline-dark',
}

const SIZES = {
  md: '',
  sm: 'px-3 py-1.5 text-xs',
}

export default function Button({
  href,
  type,
  variant = 'gold',
  size = 'md',
  disabled = false,
  children,
  className = '',
  ...rest
}) {
  const classes = [
    VARIANTS[variant] ?? VARIANTS.gold,
    SIZES[size] ?? '',
    disabled ? 'disabled:opacity-60' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (href !== undefined && !type) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button type={type ?? 'button'} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  )
}
