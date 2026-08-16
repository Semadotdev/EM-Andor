import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { services } from '../../data/site.js'

const serviceIcons = ['residential', 'commercial', 'renovation', 'design']

export default function Services() {
  return (
    <section id="services" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading
          eyebrow="Our Services"
          title="What We Do"
          description="End-to-end construction and development services — from the first drawing to the final handover."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, i) => (
            <Reveal key={service.title} delay={i * 100}>
              <article className="group relative flex h-full flex-col rounded-lg border border-mist bg-surface p-7 transition-all duration-300 hover:-translate-y-2 hover:border-brand/20 hover:bg-white hover:shadow-lift">
                <span className="font-display text-5xl font-extrabold text-mist transition-colors duration-300 group-hover:text-brand/10" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="mt-3 grid size-14 place-items-center rounded-md bg-brand text-white transition-all duration-300 group-hover:bg-gold group-hover:text-brand-deep">
                  <Icon name={serviceIcons[i]} className="size-7" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-brand-deep">{service.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">{service.description}</p>
                <span className="mt-6 block h-1 w-10 rounded-full bg-gold transition-all duration-300 group-hover:w-full" aria-hidden="true" />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
