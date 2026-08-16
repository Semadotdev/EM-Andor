import { useEffect, useState } from 'react'
import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { fetchPinnedProperties } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

const fallbackImage = '/images/project-1.jpg'

export default function AvailableProperties() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setStatus('loading')
    fetchPinnedProperties()
      .then((data) => {
        if (!mounted) return
        setProperties(data ?? [])
        setStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('error')
      })
    return () => {
      mounted = false
    }
  }, [reloadKey])

  return (
    <section id="available-properties" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading
          eyebrow="Available Properties"
          title="Lots & Properties for Sale"
          description="Browse currently available lots and properties — updated live. Interested? Reach out through the contact form below."
        />

        {status === 'loading' && (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading available properties">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-mist bg-surface">
                <div className="aspect-[16/11] bg-mist" />
                <div className="space-y-3 p-6">
                  <div className="h-4 w-24 rounded bg-mist" />
                  <div className="h-5 w-3/4 rounded bg-mist" />
                  <div className="h-4 w-1/2 rounded bg-mist" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-lg border border-mist bg-surface p-10 text-center">
            <p className="text-ink/70">We couldn’t load the available properties right now.</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn btn-gold">
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && properties.length === 0 && (
          <p className="mt-12 rounded-lg border border-mist bg-surface p-10 text-center text-ink/70">
            No available properties at the moment. Check back soon!
          </p>
        )}

        {status === 'ready' && properties.length > 0 && (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, i) => (
              <Reveal key={property.id} delay={(i % 3) * 90}>
                <article className="group overflow-hidden rounded-lg bg-surface shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <img
                      src={property.image_url || fallbackImage}
                      alt={property.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-white">
                      {property.type}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
                        <Icon name="pin" className="size-3.5" />
                        {property.location}
                      </p>
                      {property.lot_area_sqm != null && (
                        <span className="text-xs font-semibold text-ink/60">
                          {Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-bold text-brand-deep">{property.name}</h3>
                    {property.description && <p className="mt-2 text-sm leading-relaxed text-ink/70">{property.description}</p>}
                    {formatPrice(property.price) && (
                      <p className="mt-3 font-display text-lg font-bold text-brand">{formatPrice(property.price)}</p>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
