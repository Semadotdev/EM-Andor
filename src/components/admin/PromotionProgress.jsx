import { useEffect, useMemo, useState } from 'react'
import { PROMOTION_THRESHOLDS } from '../../lib/promotions.js'
import { fetchMySales } from '../../lib/sales.js'
import { Badge, LoadingState } from '../shared/ui'

function ProgressBar({ value, max, tone = 'brand' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = tone === 'green' ? 'bg-brand-3' : 'bg-brand'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function PromotionProgress({ agent, downline = [] }) {
  const [sold, setSold] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchMySales(agent.id)
      .then((sales) => {
        if (!mounted) return
        setSold(sales.length)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [agent.id])

  const directRecruits = useMemo(
    () => downline.filter((m) => m.upline_id === agent.id && m.is_active !== false).length,
    [downline, agent.id],
  )

  const salesTarget = PROMOTION_THRESHOLDS.sub_to_direct_sales
  const recruitsTarget = PROMOTION_THRESHOLDS.sub_to_direct_recruits
  const eligible = sold >= salesTarget && directRecruits >= recruitsTarget

  if (agent.role !== 'sub_agent') return null

  return (
    <section className="mb-8 rounded-lg border border-mist bg-white p-5" aria-label="Become a Direct Agent">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-brand-deep">Become a Direct Agent</h2>
        {eligible ? (
          <Badge tone="green">Ready for promotion</Badge>
        ) : (
          <Badge tone="gray">Requirement: {salesTarget} sales + {recruitsTarget} recruits</Badge>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading promotion progress…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">Own Sales</span>
              <span className="font-semibold text-ink/60">{sold} / {salesTarget}</span>
            </div>
            <ProgressBar value={sold} max={salesTarget} tone={sold >= salesTarget ? 'green' : 'brand'} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">Direct Recruits</span>
              <span className="font-semibold text-ink/60">{directRecruits} / {recruitsTarget}</span>
            </div>
            <ProgressBar value={directRecruits} max={recruitsTarget} tone={directRecruits >= recruitsTarget ? 'green' : 'brand'} />
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink/50">
        Your promotion to Direct Agent is applied automatically once you meet both targets.
      </p>
    </section>
  )
}