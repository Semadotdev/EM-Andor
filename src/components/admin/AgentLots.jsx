import { useEffect, useState } from 'react'
import { fetchProperties } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '../shared/ui'

export default function AgentLots() {
  const [lots, setLots] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchProperties({ status: 'available', sort: 'newest' })
      .then((result) => {
        if (!mounted) return
        setLots(result.data ?? [])
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <PageHeader title="Available Lots" description="Lots you can sell. Coordinate with the admin to close a deal." />

      {state === 'loading' && <LoadingState label="Loading lots…" />}
      {state === 'error' && <ErrorState message="Could not load lots. Please refresh." />}
      {state === 'ready' && lots.length === 0 && <EmptyState message="No available lots right now." />}

      {state === 'ready' && lots.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <article key={lot.id} className="overflow-hidden rounded-lg border border-mist bg-white shadow-card">
              {lot.image_url ? (
                <img src={lot.image_url} alt="" loading="lazy" className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 place-items-center bg-mist text-sm text-ink/40">No image</div>
              )}
              <div className="space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-brand-deep">{lot.name}</h2>
                  <Badge tone="green">Available</Badge>
                </div>
                <p className="text-sm text-ink/60">{lot.location}</p>
                <p className="text-sm font-semibold text-ink">{formatPrice(lot.price) ?? 'Price on request'}</p>
                {lot.lot_area_sqm != null && (
                  <p className="text-xs text-ink/50">{Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
