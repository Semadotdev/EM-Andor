import { useState } from 'react'
import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { projectCategories, projects } from '../../data/site.js'

export default function Projects() {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? projects : projects.filter((p) => p.category === active)

  return (
    <section id="projects" className="scroll-mt-24 bg-surface py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading
          eyebrow="Our Portfolio"
          title="Featured Projects"
          description="A selection of the homes, businesses, and developments we are proud to have built."
        />

        <div className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3" role="tablist" aria-label="Filter projects by category">
          {projectCategories.map((category) => {
            const isActive = active === category
            return (
              <button
                key={category}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(category)}
                className={`rounded-full px-5 py-2.5 font-display text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-brand text-white shadow-card'
                    : 'border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>

        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, i) => (
            <Reveal key={project.name} delay={(i % 3) * 90}>
              <article className="group overflow-hidden rounded-lg bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <div className="relative aspect-[16/11] overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.imageAlt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
                  <span className="absolute left-4 top-4 rounded-full bg-gold px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-brand-deep">
                    {project.category}
                  </span>
                  <span className="absolute bottom-4 right-4 grid size-10 translate-y-3 place-items-center rounded-full bg-gold text-brand-deep opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true">
                    <Icon name="arrow-up-right" className="size-5" />
                  </span>
                </div>
                <div className="p-6">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
                    <Icon name="pin" className="size-3.5" />
                    {project.location}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-bold text-brand-deep">{project.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">{project.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
