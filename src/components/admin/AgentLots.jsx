import { useEffect, useState } from 'react'
import { fetchProperties } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../shared/ui'
import Icon from '../shared/Icon.jsx'
import ComputationModal from './ComputationModal.jsx'
import logoSrc from '../../assets/logo.png'

const PAGE_SIZE = 15

export default function AgentLots() {
  const [lots, setLots] = useState([])
  const [count, setCount] = useState(0)
  const [state, setState] = useState('loading')
  const [page, setPage] = useState(1)
  const [computeLot, setComputeLot] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchProperties({ status: 'available', sort: 'newest', page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!mounted) return
        setLots(result.data ?? [])
        setCount(result.count ?? 0)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [page])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <div>
      <PageHeader title="Available Lots" description="Lots you can sell. Coordinate with the admin to close a deal." />

      {state === 'loading' && <LoadingState label="Loading lots…" />}
      {state === 'error' && <ErrorState message="Could not load lots. Please refresh." />}
      {state === 'ready' && lots.length === 0 && <EmptyState message="No available lots right now." />}

      {state === 'ready' && lots.length > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((lot) => (
              <article key={lot.id} className="overflow-hidden rounded-lg border border-mist bg-white shadow-card">
                {lot.image_url ? (
                  <img src={lot.image_url} alt="" loading="lazy" className="h-40 w-full object-cover" />
                ) : (
                  <div className="grid h-40 place-items-center bg-mist">
                    <img src={logoSrc} alt="" loading="lazy" className="max-h-24 w-auto object-contain opacity-70" />
                  </div>
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
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label="Compute"
                      onClick={() => setComputeLot(lot)}
                    >
                      <Icon name="eye" className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={count}
            from={from}
            to={to}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      {computeLot && <ComputationModal lot={computeLot} onClose={() => setComputeLot(null)} />}
    </div>
  )
}
