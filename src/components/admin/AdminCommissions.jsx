import { useCallback, useEffect, useState } from 'react'
import { fetchAllAgents, fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { fetchCommissions, markCommissionPaid } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { COMMISSION_ROLES, formatRate } from '../../lib/commissions.js'
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  useToast,
} from '../shared/ui'

const commissionTone = (status) => (status === 'paid' ? 'green' : 'yellow')

export default function AdminCommissions() {
  const { showToast } = useToast()
  const [rateInputs, setRateInputs] = useState({})
  const [ratesState, setRatesState] = useState('loading')
  const [ratesMessage, setRatesMessage] = useState('')
  const [savingRates, setSavingRates] = useState(false)
  const [commissions, setCommissions] = useState([])
  const [agents, setAgents] = useState([])
  const [agentFilter, setAgentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [state, setState] = useState('loading')
  const [confirmPaid, setConfirmPaid] = useState(null)
  const [paidError, setPaidError] = useState(null)
  const [savingPaid, setSavingPaid] = useState(false)

  const loadRates = useCallback(() => {
    setRatesState('loading')
    fetchCommissionRates()
      .then((rows) => {
        setRateInputs(Object.fromEntries(rows.map((r) => [r.role, String(+(Number(r.rate) * 100).toFixed(2))])))
        setRatesState('ready')
      })
      .catch(() => setRatesState('error'))
  }, [])

  const loadCommissions = useCallback(() => {
    setState('loading')
    const filters = {}
    if (statusFilter) filters.status = statusFilter
    if (agentFilter) filters.agentId = agentFilter
    fetchCommissions(filters)
      .then((rows) => {
        setCommissions(rows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [statusFilter, agentFilter])

  useEffect(loadRates, [loadRates])
  useEffect(loadCommissions, [loadCommissions])

  useEffect(() => {
    let mounted = true
    fetchAllAgents()
      .then((rows) => { if (mounted) setAgents(rows.filter((a) => a.role !== 'admin')) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const saveRates = async (e) => {
    e.preventDefault()
    if (savingRates) return
    setSavingRates(true)
    setRatesMessage('')
    const invalid = Object.values(rateInputs).some((value) => {
      const num = Number(value)
      return value === '' || Number.isNaN(num) || num <= 0 || num > 100
    })
    if (invalid) {
      setRatesMessage('Rates must be greater than 0 and at most 100.')
      setSavingRates(false)
      return
    }
    try {
      const payload = Object.fromEntries(
        Object.entries(rateInputs).map(([role, value]) => [role, Number(value) / 100]),
      )
      await updateCommissionRates(payload)
      showToast('Rates saved.')
    } catch {
      setRatesMessage('Could not save the rates. Please try again.')
    } finally {
      setSavingRates(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!confirmPaid || savingPaid) return
    setSavingPaid(true)
    setPaidError(null)
    try {
      await markCommissionPaid(confirmPaid.id)
      setCommissions((list) => list.map((c) => (c.id === confirmPaid.id ? { ...c, status: 'paid' } : c)))
      setConfirmPaid(null)
      showToast('Commission marked as paid.')
    } catch (err) {
      setPaidError(err?.message === 'Commission is already paid.' ? err.message : 'Could not mark the commission paid. Please try again.')
    } finally {
      setSavingPaid(false)
    }
  }

  const visible = search
    ? commissions.filter((row) => (row.properties?.name ?? '').toLowerCase().includes(search.toLowerCase()))
    : commissions
  const earnedTotal = visible.reduce((sum, c) => sum + Number(c.amount), 0)
  const paidTotal = visible.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  const columns = [
    { key: 'agent', header: 'Agent', className: 'font-semibold text-brand-deep', render: (row) => row.agents?.name ?? '—' },
    { key: 'property', header: 'Property', className: 'text-ink/70', render: (row) => row.properties?.name ?? '—' },
    {
      key: 'rate',
      header: 'Rate',
      hideBelow: 'sm',
      className: 'text-ink/70',
      render: (row) => (
        <>
          {formatRate(row.rate)} <span className="text-xs text-ink/50">({ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale})</span>
        </>
      ),
    },
    { key: 'amount', header: 'Amount', className: 'font-semibold text-ink', render: (row) => formatPrice(row.amount) ?? '—' },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <Badge tone={commissionTone(row.status)}>{row.status === 'paid' ? 'Paid' : 'Earned'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      noWrap: true,
      className: 'min-w-[110px]',
      render: (row) =>
        row.status === 'earned' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPaidError(null)
              setConfirmPaid(row)
            }}
          >
            Mark Paid
          </Button>
        ) : null,
    },
  ]

  const commissionCard = (row) => (
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-semibold text-brand-deep">{row.agents?.name ?? '—'}</p>
        <Badge tone={commissionTone(row.status)}>{row.status === 'paid' ? 'Paid' : 'Earned'}</Badge>
      </div>
      <dl className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Property</dt>
          <dd className="text-ink/70">{row.properties?.name ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Rate</dt>
          <dd className="text-ink/70">
            {formatRate(row.rate)} ({ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale})
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/50">Amount</dt>
          <dd className="font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</dd>
        </div>
      </dl>
      {row.status === 'earned' && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPaidError(null)
              setConfirmPaid(row)
            }}
          >
            Mark Paid
          </Button>
        </div>
      )}
    </div>
  )

  const hasFilters = Boolean(search || statusFilter || agentFilter)

  return (
    <div>
      <PageHeader title="Commissions" description="Rates, earned amounts, and payouts across the agent network." />

      <form onSubmit={saveRates} className="mb-8 rounded-lg border border-mist bg-white p-5">
        <h2 className="mb-1 font-display text-sm font-bold text-brand-deep">Rates</h2>
        <p className="mb-4 text-xs text-ink/50">
          A Sub Agent seller keeps the Sub rate and their upline Direct earns the Direct rate. A Direct Agent seller who closes the
          sale themselves earns a flat 5%. The Agent Head always earns the Head rate on every sale they did not make, up to a 7%
          maximum payout. Existing commissions keep their original rate.
        </p>
        {ratesState === 'loading' && <LoadingState label="Loading rates…" />}
        {ratesState === 'error' && <p className="text-sm text-ink/60">Could not load rates.</p>}
        {ratesState === 'ready' && (
          <div className="flex flex-wrap items-end gap-4">
            {COMMISSION_ROLES.map((role) => (
              <Input
                key={role}
                id={`rate-${role}`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="w-32"
                label={`${ROLE_LABELS[role]} rate (%)`}
                value={rateInputs[role] ?? ''}
                onChange={(e) => setRateInputs((inputs) => ({ ...inputs, [role]: e.target.value }))}
              />
            ))}
            <Button type="submit" disabled={savingRates}>
              {savingRates ? 'Saving…' : 'Save Rates'}
            </Button>
          </div>
        )}
        {ratesMessage && <p className="mt-3 text-sm font-medium text-ink/70">{ratesMessage}</p>}
      </form>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-mist bg-white p-4">
        <Input
          type="text"
          placeholder="Search by property…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search by property"
          className="w-full sm:max-w-md"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-48">
            <Select aria-label="Filter by agent" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select id="cf-status" aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="earned">Earned</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
        </div>
      </div>

      {state === 'loading' && <LoadingState label="Loading commissions…" />}

      {state === 'error' && <ErrorState message="Could not load commissions." onRetry={loadCommissions} />}

      {state === 'ready' && (
        <>
          {commissions.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-lg border border-mist bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Earned</p>
                <p className="mt-1 font-display text-lg font-extrabold text-brand-deep">{formatPrice(earnedTotal)}</p>
              </div>
              <div className="rounded-lg border border-mist bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Paid</p>
                <p className="mt-1 font-display text-lg font-extrabold text-brand-deep">{formatPrice(paidTotal)}</p>
              </div>
            </div>
          )}
          <DataTable
            columns={columns}
            rows={visible}
            getRowKey={(row) => row.id}
            emptyMessage={hasFilters ? 'No commissions match your filters.' : 'No commissions yet.'}
            mobileCard={commissionCard}
          />
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmPaid)}
        onClose={() => setConfirmPaid(null)}
        onConfirm={handleMarkPaid}
        title="Mark Commission Paid"
        message={confirmPaid ? `Mark ${formatPrice(confirmPaid.amount)} for ${confirmPaid.agents?.name ?? 'this agent'} as paid?` : ''}
        confirmLabel="Mark Paid"
        loading={savingPaid}
      >
        {paidError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {paidError}
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
