import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'
import { Badge, ErrorState, LoadingState, PageHeader } from '../shared/ui'

export default function AgentDownline({ members: membersProp }) {
  const context = useOutletContext()
  const members = membersProp ?? context?.downline ?? []
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
      <PageHeader title="My Downline" description="Sales and commission activity of the agents under you." />

      {state === 'loading' && <LoadingState label="Loading downline…" />}
      {state === 'error' && <ErrorState message="Could not load your downline. Please refresh." />}

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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-brand-deep">{member.name}</p>
                    <Badge tone="gray">{ROLE_LABELS[member.role] ?? member.role}</Badge>
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
