import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchCommissions } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'
import { Badge, DataTable, ErrorState, LoadingState, PageHeader } from '../shared/ui'

const commissionTone = (status) => (status === 'paid' ? 'green' : 'yellow')

export default function AgentCommissions({ agent: agentProp }) {
  const context = useOutletContext()
  const agent = agentProp ?? context?.agent
  const [rows, setRows] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchCommissions({ agentId: agent.id })
      .then((commissions) => {
        if (!mounted) return
        setRows(commissions)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const earned = rows.reduce((sum, c) => sum + Number(c.amount), 0)
  const paid = rows.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  const columns = [
    { key: 'property', header: 'Property', className: 'font-semibold text-brand-deep', render: (row) => row.properties?.name ?? '—' },
    {
      key: 'level',
      header: 'Level',
      hideBelow: 'sm',
      className: 'text-ink/70',
      render: (row) => ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale,
    },
    { key: 'rate', header: 'Rate', hideBelow: 'sm', className: 'text-ink/70', render: (row) => formatRate(row.rate) },
    { key: 'amount', header: 'Amount', className: 'font-semibold text-ink', render: (row) => formatPrice(row.amount) ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={commissionTone(row.status)}>{row.status === 'paid' ? 'Paid' : 'Earned'}</Badge>,
    },
  ]

  const commissionCard = (row) => (
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-semibold text-brand-deep">{row.properties?.name ?? '—'}</p>
        <Badge tone={commissionTone(row.status)}>{row.status === 'paid' ? 'Paid' : 'Earned'}</Badge>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Level</dt>
          <dd className="text-ink/70">{ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Rate</dt>
          <dd className="text-ink/70">{formatRate(row.rate)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Amount</dt>
          <dd className="font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )

  return (
    <div>
      <PageHeader title="My Commissions" description="Your commission earnings and their payout status." />

      {state === 'loading' && <LoadingState label="Loading commissions…" />}
      {state === 'error' && <ErrorState message="Could not load your commissions. Please refresh." />}

      {state === 'ready' && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(earned) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Earned</p>
            </div>
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(paid) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Paid</p>
            </div>
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(earned - paid) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Unpaid</p>
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            emptyMessage="No commissions yet."
            mobileCard={commissionCard}
          />
        </>
      )}
    </div>
  )
}
