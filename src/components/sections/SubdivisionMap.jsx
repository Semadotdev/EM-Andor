import { subdivisionMap } from '../../data/site.js'
import Icon from '../shared/Icon.jsx'
import { formatPrice } from '../../lib/format.js'

export default function SubdivisionMap({ properties, onSelect }) {
  const positioned = properties.filter((p) => p.map_x != null && p.map_y != null)
  if (positioned.length === 0) return null

  return (
    <div className="mt-12">
      <div className="relative overflow-hidden rounded-lg border border-mist shadow-card">
        <img src={subdivisionMap.image} alt={subdivisionMap.alt} className="w-full" />
        {positioned.map((property) => (
          <button
            key={property.id}
            type="button"
            onClick={() => onSelect?.(property.id)}
            aria-label={`${property.name} — pin on map`}
            className="group absolute z-10 -translate-x-1/2 -translate-y-full transition-transform hover:scale-110"
            style={{ left: `${Number(property.map_x)}%`, top: `${Number(property.map_y)}%` }}
          >
            <Icon name="pin" className="size-8 text-brand drop-shadow" />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-mist bg-white px-3 py-2 text-sm shadow-lift group-hover:block">
              <span className="block font-semibold text-brand-deep">{property.name}</span>
              {formatPrice(property.price) && <span className="block text-brand">{formatPrice(property.price)}</span>}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-ink/50">Tap a pin on the map to jump to that lot’s details below.</p>
    </div>
  )
}
