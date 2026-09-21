import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchMySales, fetchCommissions } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { LoadingState, StatCard } from '../shared/ui'

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

  if (loading) return <LoadingState label="Loading stats…" />

  const cards = [
    { label: 'Sold Lots', value: String(soldCount), icon: 'residential', tone: 'brand' },
    { label: 'Downline Agents', value: String(downlineCount), icon: 'professional', tone: 'blue' },
    { label: 'Commission Earned', value: formatPrice(earned) ?? '₱ 0', icon: 'detail', tone: 'gold' },
    { label: 'Commission Paid', value: formatPrice(paid) ?? '₱ 0', icon: 'safety', tone: 'green' },
  ]

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} icon={<Icon name={card.icon} className="size-5" />} label={card.label} value={card.value} tone={card.tone} />
      ))}
    </div>
  )
}
