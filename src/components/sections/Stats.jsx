import Reveal from '../shared/Reveal.jsx'
import { stats } from '../../data/site.js'

export default function Stats() {
  return (
    <section className="relative z-10 border-b border-mist bg-white" aria-label="Company statistics">
      <div className="container-x grid grid-cols-2 divide-mist sm:grid-cols-4 sm:divide-x">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 90} className="px-2 py-10 text-center sm:px-6 sm:py-14">
            <p className="font-display text-3xl font-extrabold tracking-tight text-brand sm:text-5xl">{stat.value}</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60 sm:text-sm">
              <span className="hidden h-1.5 w-1.5 rounded-full bg-gold sm:inline-block" aria-hidden="true" />
              {stat.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
