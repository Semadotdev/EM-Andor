import { useCallback, useEffect, useState } from 'react'
import { fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { fetchCommissions, markCommissionPaid } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { COMMISSION_ROLES, formatRate } from '../../lib/commissions.js'
import ConfirmModal from '../shared/ConfirmModal.jsx'

export default function AdminCommissions() {
  const [rateInputs, setRateInputs] = useState({})
  const [ratesState, setRatesState] = useState('loading')
  const [ratesMessage, setRatesMessage] = useState('')
  const [savingRates, setSavingRates] = useState(false)
  const [commissions, setCommissions] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [confirmPaid, setConfirmPaid] = useState(null)
  const [savingPaid, setSavingPaid] = useState(false)

  const loadRates = useCallback(() => {
    setRatesState('loading')
    fetchCommissionRates()
      .then((rows) => {
        setRateInputs(Object.fromEntries(rows.map((r) => [r.role, String(Number(r.rate) * 100)])))
        setRatesState('ready')
      })
      .catch(() => setRatesState('error'))
  }, [])

  const loadCommissions = useCallback(() => {
    setState('loading')
    setError(null)
    fetchCommissions(statusFilter ? { status: statusFilter } : {})
      .then((rows) => {
        setCommissions(rows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [statusFilter])

  useEffect(loadRates, [loadRates])
  useEffect(loadCommissions, [loadCommissions])

  const saveRates = async (e) => {
    e.preventDefault()
    if (savingRates) return
    setSavingRates(true)
    setRatesMessage('')
    try {
      const payload = Object.fromEntries(
        Object.entries(rateInputs).map(([role, value]) => [role, Number(value) / 100]),
      )
      await updateCommissionRates(payload)
      setRatesMessage('Rates saved.')
    } catch {
      setRatesMessage('Could not save the rates. Please try again.')
    } finally {
      setSavingRates(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!confirmPaid || savingPaid) return
    setSavingPaid(true)
    setError(null)
    try {
      await markCommissionPaid(confirmPaid.id)
      setCommissions((list) => list.map((c) => (c.id === confirmPaid.id ? { ...c, status: 'paid' } : c)))
      setConfirmPaid(null)
    } catch (err) {
      setError(err?.message === 'Commission is already paid.' ? err.message : 'Could not mark the commission paid. Please try again.')
    } finally {
      setSavingPaid(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">Commissions</h1>

      <form onSubmit={saveRates} className="mb-8 rounded-lg border border-mist bg-white p-5">
        <h2 className="mb-1 font-display text-sm font-bold text-brand-deep">Rates</h2>
        <p className="mb-4 text-xs text-ink/50">Percent of the lot price paid to each level. Existing commissions keep their original rate.</p>
        {ratesState === 'loading' && <p className="text-sm text-ink/60">Loading rates…</p>}
        {ratesState === 'error' && <p className="text-sm text-ink/60">Could not load rates.</p>}
        {ratesState === 'ready' && (
          <div className="flex flex-wrap items-end gap-4">
            {COMMISSION_ROLES.map((role) => (
              <div key={role}>
                <label htmlFor={`rate-${role}`} className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  {ROLE_LABELS[role]} rate (%)
                </label>
                <input
                  id={`rate-${role}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-32 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                  value={rateInputs[role] ?? ''}
                  onChange={(e) => setRateInputs((inputs) => ({ ...inputs, [role]: e.target.value }))}
                />
              </div>
            ))}
            <button type="submit" disabled={savingRates} className="btn btn-gold disabled:opacity-60">
              {savingRates ? 'Saving…' : 'Save Rates'}
            </button>
          </div>
        )}
        {ratesMessage && <p className="mt-3 text-sm font-medium text-ink/70">{ratesMessage}</p>}
      </form>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="cf-status" className="text-sm font-semibold text-brand-deep">Status</label>
        <select
          id="cf-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All</option>
          <option value="earned">Earned</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading commissions…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load commissions.</p>
          <button onClick={loadCommissions} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && commissions.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">No commissions yet.</p>
      )}

      {state === 'ready' && commissions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Property</th>
                <th className="hidden px-4 py-3 sm:table-cell">Rate</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((row) => (
                <tr key={row.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3 font-semibold text-brand-deep">{row.agents?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink/70">{row.properties?.name ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">
                    {formatRate(row.rate)} <span className="text-xs text-ink/50">({ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale})</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {row.status === 'paid' ? 'Paid' : 'Earned'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'earned' && (
                      <button
                        onClick={() => setConfirmPaid(row)}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmPaid)}
        onClose={() => setConfirmPaid(null)}
        onConfirm={handleMarkPaid}
        title="Mark Commission Paid"
        message={confirmPaid ? `Mark ${formatPrice(confirmPaid.amount)} for ${confirmPaid.agents?.name ?? 'this agent'} as paid?` : ''}
        confirmLabel="Mark Paid"
        loading={savingPaid}
      />
    </div>
  )
}
