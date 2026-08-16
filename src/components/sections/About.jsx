import Reveal from '../shared/Reveal.jsx'
import Button from '../shared/Button.jsx'
import Icon from '../shared/Icon.jsx'
import { about } from '../../data/site.js'

export default function About() {
  return (
    <section id="about" className="scroll-mt-24 overflow-hidden bg-surface py-20 sm:py-28">
      <div className="container-x grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative">
          <div className="absolute -left-5 -top-5 h-28 w-28 border-l-4 border-t-4 border-gold" aria-hidden="true" />
          <img
            src={about.image}
            alt={about.imageAlt}
            loading="lazy"
            className="relative aspect-[4/3] w-full rounded-lg object-cover shadow-lift"
          />
          <div className="absolute -bottom-6 right-4 rounded-lg bg-brand px-6 py-5 text-white shadow-lift sm:right-8">
            <p className="font-display text-3xl font-extrabold text-gold">15+</p>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Years of Experience</p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <span className="eyebrow flex items-center gap-3">
            <span className="gold-rule" aria-hidden="true" />
            {about.eyebrow}
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-deep sm:text-4xl lg:text-[2.75rem]">
            {about.heading}
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-ink/70 sm:text-lg">
            {about.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {about.highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 font-semibold text-brand-deep">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/90 text-brand-deep">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 13 4 4 10-11" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          <Button href="#services" variant="outline-dark" className="mt-10">
            Learn More
            <Icon name="arrow-right" className="size-4" />
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
