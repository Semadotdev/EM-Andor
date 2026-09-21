const TONES = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-700',
  gold: 'bg-gold/20 text-yellow-700',
  brand: 'bg-brand/10 text-brand',
}

export function statusTone(status) {
  if (status === 'available' || status === 'active') return 'green'
  if (status === 'reserved') return 'yellow'
  if (status === 'sold' || status === 'inactive') return 'red'
  return 'gray'
}

export default function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone] ?? TONES.gray}`}>
      {children}
    </span>
  )
}
