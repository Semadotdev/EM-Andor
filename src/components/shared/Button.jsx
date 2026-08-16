export default function Button({ href, variant = 'gold', children, className = '', ...rest }) {
  const variants = {
    gold: 'btn btn-gold',
    'outline-light': 'btn btn-outline-light',
    'outline-dark': 'btn btn-outline-dark',
  }

  const base = `${variants[variant] ?? variants.gold} ${className}`

  return (
    <a href={href} className={base} {...rest}>
      {children}
    </a>
  )
}
