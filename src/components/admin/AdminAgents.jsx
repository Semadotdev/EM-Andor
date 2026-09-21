import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROLE_LABELS, buildAgentTree } from '../../lib/agentMeta.js'
import { fetchAllAgents, fetchSoldCounts, setAgentActive } from '../../lib/agents.js'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { eligibleAgents } from '../../lib/promotions.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import CreateAgentModal from './CreateAgentModal.jsx'

const badgeCls = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold'

function roleBadgeCls(role) {
  if (role === 'admin') return 'bg-brand text-white'
  if (role === 'agent_head') return 'bg-gold text-brand-deep'
  if (role === 'direct_agent') return 'bg-blue-100 text-blue-700'
  return 'bg-brand/10 text-brand'
}

function AgentDetail({ agent, onClose }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let mounted = true
    Promise.all([fetchTeamSales([agent.id]), fetchCommissions({ agentId: agent.id })])
      .then(([s, c]) => {
        if (!mounted) return
        setSales(s)
        setCommissions(c)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const earned = commissions.reduce((sum, c) => sum + Number(c.amount), 0)
  const paid = commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${agent.name} details`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">
            {agent.name} · {ROLE_LABELS[agent.role] ?? agent.role}
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">✕</button>
        </div>

        {state === 'loading' && <p className="py-6 text-center text-ink/60">Loading details…</p>}
        {state === 'error' && <p className="py-6 text-center text-ink/60">Could not load agent details.</p>}

        {state === 'ready' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Sold Lots: {sales.length}</span>
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Earned: {formatPrice(earned) ?? '₱ 0'}</span>
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Paid: {formatPrice(paid) ?? '₱ 0'}</span>
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Sold Lots</h3>
              {sales.length === 0 ? (
                <p className="text-sm text-ink/60">No sold lots yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {sales.map((sale) => (
                    <li key={sale.id} className="flex justify-between gap-4">
                      <span className="text-ink/70">{sale.name}</span>
                      <span className="font-semibold text-ink">{formatPrice(sale.price) ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Commissions</h3>
              {commissions.length === 0 ? (
                <p className="text-sm text-ink/60">No commissions yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {commissions.map((row) => (
                    <li key={row.id} className="flex justify-between gap-4">
                      <span className="text-ink/70">
                        {row.properties?.name ?? 'Property'} · {formatRate(row.rate)}
                      </span>
                      <span className="font-semibold text-ink">
                        {formatPrice(row.amount) ?? '—'} <span className="text-xs uppercase text-ink/50">{row.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentNode({ node, depth, eligibility, onView, onToggle, pending }) {
  const eligible = eligibility?.get?.(node.id)
  return (
    <>
      <li>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-mist bg-white p-3" style={{ marginLeft: depth * 20 }}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-deep">{node.name}</p>
            <p className="text-xs text-ink/50">
              {node.email}
              {node.phone ? ` · ${node.phone}` : ''}
            </p>
          </div>
          <span className={`${badgeCls} ${roleBadgeCls(node.role)}`}>{ROLE_LABELS[node.role] ?? node.role}</span>
          {!node.is_active && <span className={`${badgeCls} bg-red-100 text-red-700`}>Inactive</span>}
          {eligible && <span className={`${badgeCls} bg-green-100 text-green-700`}>Eligible: {ROLE_LABELS[eligible.eligibleFor]}</span>}
          <button
            onClick={() => onView(node)}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
          >
            View
          </button>
          {node.role !== 'admin' && (
            <button
              onClick={() => onToggle(node)}
              disabled={Boolean(pending[node.id])}
              className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
            >
              {node.is_active ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      </li>
      {node.children.map((child) => (
        <AgentNode
          key={child.id}
          node={child}
          depth={depth + 1}
          eligibility={eligibility}
          onView={onView}
          onToggle={onToggle}
          pending={pending}
        />
      ))}
    </>
  )
}

export default function AdminAgents() {
  const [agents, setAgents] = useState([])
  const [soldCounts, setSoldCounts] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [pending, setPending] = useState({})

  const load = useCallback(() => {
    setState('loading')
    setError(null)
    Promise.all([fetchAllAgents(), fetchSoldCounts()])
      .then(([rows, counts]) => {
        setAgents(rows)
        setSoldCounts(counts)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  useEffect(load, [load])

  const eligibility = useMemo(() => eligibleAgents(agents, soldCounts), [agents, soldCounts])
  const tree = useMemo(() => buildAgentTree(agents), [agents])

  const handleToggle = async () => {
    if (!confirmToggle || toggling) return
    const next = !confirmToggle.is_active
    const id = confirmToggle.id
    setToggling(true)
    setError(null)
    setPending((p) => ({ ...p, [id]: true }))
    try {
      await setAgentActive(id, next)
      setAgents((list) => list.map((a) => (a.id === id ? { ...a, is_active: next } : a)))
      setConfirmToggle(null)
      load()
    } catch {
      setError('Could not update the agent. Please try again.')
    } finally {
      setToggling(false)
      setPending((p) => ({ ...p, [id]: false }))
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Agents</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold">Create Agent</button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading agents…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load agents.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && agents.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No agents yet. Click "Create Agent" to add the first one.
        </p>
      )}

      {state === 'ready' && agents.length > 0 && (
        <ul className="space-y-2">
          {tree.map((node) => (
            <AgentNode
              key={node.id}
              node={node}
              depth={0}
              eligibility={eligibility}
              onView={setDetail}
              onToggle={setConfirmToggle}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateAgentModal
          agents={agents.filter((a) => a.role !== 'admin' && a.is_active)}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {detail && <AgentDetail agent={detail} onClose={() => setDetail(null)} />}

      <ConfirmModal
        open={Boolean(confirmToggle)}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggle}
        title={confirmToggle?.is_active ? 'Deactivate Agent' : 'Activate Agent'}
        message={
          confirmToggle
            ? `${confirmToggle.is_active ? 'Deactivate' : 'Activate'} "${confirmToggle.name}"?`
            : ''
        }
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        destructive={Boolean(confirmToggle?.is_active)}
        loading={toggling}
      />
    </div>
  )
}
