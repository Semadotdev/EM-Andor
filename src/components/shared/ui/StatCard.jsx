const TONES = {
  brand: 'bg-brand/10 text-brand',
  gold: 'bg-gold/20 text-yellow-700',
  blue: 'bg-blue-100 text-blue-600',
  red: 'bg-red-100 text-red-600',
  green: 'bg-green-100 text-green-700',
  gray: 'bg-mist text-ink/60',
}

export default function StatCard({ icon, label, value, tone = 'brand' }) {
  return (
    <div className="rounded-lg border border-mist bg-white p-5 flex items-center gap-4">
      <span className={`size-10 shrink-0 grid place-items-center rounded-full ${TONES[tone] ?? TONES.brand}`}>
        {icon}
      </span>
      <div>
        <p className="text-2xl font-extrabold text-brand-deep">{value}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      </div>
    </div>
  )
}
