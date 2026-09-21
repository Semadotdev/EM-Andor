import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchCommissions } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'

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

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Commissions</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading commissions…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your commissions. Please refresh.
        </p>
      )}

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

          {rows.length === 0 ? (
            <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-mist bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Level</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Rate</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-mist/70 last:border-0">
                      <td className="px-4 py-3 font-semibold text-brand-deep">{row.properties?.name ?? '—'}</td>
                      <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale}</td>
                      <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{formatRate(row.rate)}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {row.status === 'paid' ? 'Paid' : 'Earned'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
