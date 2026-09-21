import { useEffect, useState } from 'react'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'

export default function AgentDownline({ members }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    const ids = members.map((m) => m.id)
    Promise.all([fetchTeamSales(ids), fetchCommissions()])
      .then(([teamSales, teamCommissions]) => {
        if (!mounted) return
        setSales(teamSales)
        setCommissions(teamCommissions)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [members])

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Downline</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading downline…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your downline. Please refresh.
        </p>
      )}

      {state === 'ready' && (
        <div className="space-y-4">
          {members.map((member) => {
            const memberSales = sales.filter((s) => s.sold_by === member.id)
            const memberCommissions = commissions.filter((c) => c.agent_id === member.id)
            const earned = memberCommissions.reduce((sum, c) => sum + Number(c.amount), 0)
            const paid = memberCommissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

            return (
              <div key={member.id} className="rounded-lg border border-mist bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-deep">{member.name}</p>
                    <p className="text-xs text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-ink/70">
                    <span>Sold Lots: {memberSales.length}</span>
                    <span>Earned: {formatPrice(earned) ?? '₱ 0'}</span>
                    <span>Paid: {formatPrice(paid) ?? '₱ 0'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
