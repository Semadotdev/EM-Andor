import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchMySales, fetchCommissions } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

const statCardCls = 'rounded-lg border border-mist bg-white p-5 flex items-center gap-4'
const iconCls = 'size-10 shrink-0 grid place-items-center rounded-full'

export default function AgentStats({ agent, downlineCount = 0 }) {
  const [soldCount, setSoldCount] = useState(0)
  const [earned, setEarned] = useState(0)
  const [paid, setPaid] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchMySales(agent.id), fetchCommissions({ agentId: agent.id })])
      .then(([sales, commissions]) => {
        if (!mounted) return
        setSoldCount(sales.length)
        setEarned(commissions.reduce((sum, c) => sum + Number(c.amount), 0))
        setPaid(commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0))
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [agent.id])

  if (loading) return <p className="py-6 text-center text-ink/50 text-sm">Loading stats…</p>

  const cards = [
    { label: 'Sold Lots', value: String(soldCount), icon: 'residential', cls: 'bg-brand/10 text-brand' },
    { label: 'Downline Agents', value: String(downlineCount), icon: 'professional', cls: 'bg-blue-100 text-blue-600' },
    { label: 'Commission Earned', value: formatPrice(earned) ?? '₱ 0', icon: 'detail', cls: 'bg-gold/20 text-yellow-700' },
    { label: 'Commission Paid', value: formatPrice(paid) ?? '₱ 0', icon: 'safety', cls: 'bg-green-100 text-green-700' },
  ]

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={statCardCls}>
          <span className={`${iconCls} ${card.cls}`}>
            <Icon name={card.icon} className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{card.value}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
