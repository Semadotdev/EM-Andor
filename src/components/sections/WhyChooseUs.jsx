import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { whyChooseUs } from '../../data/site.js'

export default function WhyChooseUs() {
  return (
    <section className="relative overflow-hidden bg-brand-deep py-20 sm:py-28">
      <div className="hero-lines absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" aria-hidden="true" />

      <div className="container-x relative">
        <SectionHeading
          light
          eyebrow="Why Choose Us"
          title="The Andor Standard"
          description="More than builders — a partner committed to the craft, the client, and the community."
        />

        <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {whyChooseUs.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 90}>
              <div className="group flex gap-5">
                <div className="grid size-14 shrink-0 place-items-center rounded-md bg-gold text-brand-deep shadow-card transition-transform duration-300 group-hover:-translate-y-1">
                  <Icon name={item.icon} className="size-7" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{item.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
