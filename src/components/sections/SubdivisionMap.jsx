import { subdivisionMap } from '../../data/site.js'
import Icon from '../shared/Icon.jsx'
import { formatPrice } from '../../lib/format.js'

export default function SubdivisionMap({ properties, onSelect }) {
  const pins = properties.flatMap((property) =>
    (property.map_pins ?? []).map((lot) => ({ property, lot })),
  )
  if (pins.length === 0) return null

  return (
    <div className="mt-12">
      <div className="relative overflow-hidden rounded-lg border border-mist shadow-card">
        <img src={subdivisionMap.image} alt={subdivisionMap.alt} className="w-full" />
        {pins.map(({ property, lot }) => {
          const price = formatPrice(lot.price) || formatPrice(property.price)
          return (
            <button
              key={`${property.id}-${lot.id}`}
              type="button"
              onClick={() => onSelect?.(property.id)}
              aria-label={`${lot.name} — pin on map`}
              className="group absolute z-10 -translate-x-1/2 -translate-y-full transition-transform hover:scale-110"
              style={{ left: `${Number(lot.x)}%`, top: `${Number(lot.y)}%` }}
            >
              <Icon name="pin" className="size-8 text-brand drop-shadow" />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-mist bg-white px-3 py-2 text-sm shadow-lift group-hover:block group-focus-within:block">
                <span className="block font-semibold text-brand-deep">{lot.name}</span>
                {price && <span className="block text-brand">{price}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-center text-xs text-ink/50">Tap a pin on the map to jump to that lot’s details below.</p>
    </div>
  )
}
