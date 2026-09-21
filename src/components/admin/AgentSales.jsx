import { useEffect, useState } from 'react'
import { fetchMySales } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

export default function AgentSales({ agent }) {
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

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Sales</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading sales…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your sales. Please refresh.
        </p>
      )}
      {state === 'ready' && sales.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          You have no sold lots yet.
        </p>
      )}

      {state === 'ready' && sales.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Lot</th>
                <th className="hidden px-4 py-3 sm:table-cell">Location</th>
                <th className="px-4 py-3">Price</th>
                <th className="hidden px-4 py-3 md:table-cell">Sold</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3 font-semibold text-brand-deep">{sale.name}</td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{sale.location}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(sale.price) ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-ink/60 md:table-cell">
                    {sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
