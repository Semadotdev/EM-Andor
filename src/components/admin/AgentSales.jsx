import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchMySales } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { DataTable, ErrorState, LoadingState, PageHeader } from '../shared/ui'

export default function AgentSales({ agent: agentProp }) {
  const context = useOutletContext()
  const agent = agentProp ?? context?.agent
  const [sales, setSales] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchMySales(agent.id)
      .then((rows) => {
        if (!mounted) return
        setSales(rows)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const columns = [
    { key: 'lot', header: 'Lot', className: 'font-semibold text-brand-deep', render: (sale) => sale.name },
    { key: 'location', header: 'Location', hideBelow: 'sm', className: 'text-ink/70', render: (sale) => sale.location },
    { key: 'price', header: 'Price', className: 'font-semibold text-ink', render: (sale) => formatPrice(sale.price) ?? '—' },
    {
      key: 'sold',
      header: 'Sold',
      hideBelow: 'md',
      className: 'text-ink/60',
      render: (sale) => (sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('en-PH') : '—'),
    },
  ]

  return (
    <div>
      <PageHeader title="My Sales" description="The lots you have sold." />

      {state === 'loading' && <LoadingState label="Loading sales…" />}
      {state === 'error' && <ErrorState message="Could not load your sales. Please refresh." />}
      {state === 'ready' && (
        <DataTable
          columns={columns}
          rows={sales}
          getRowKey={(sale) => sale.id}
          emptyMessage="You have no sold lots yet."
        />
      )}
    </div>
  )
}
