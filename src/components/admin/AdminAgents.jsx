import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROLE_LABELS, buildAgentTree } from '../../lib/agentMeta.js'
import { fetchAllAgents, fetchSoldCounts, setAgentActive } from '../../lib/agents.js'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { eligibleAgents } from '../../lib/promotions.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'
import CreateAgentModal from './CreateAgentModal.jsx'
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  useToast,
} from '../shared/ui'

const roleTone = (role) => {
  if (role === 'admin') return 'brand'
  if (role === 'agent_head') return 'gold'
  if (role === 'direct_agent') return 'blue'
  return 'gray'
}

function AgentDetail({ agent, onClose, onToggle, pending }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [team, setTeam] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    Promise.all([fetchTeamSales([agent.id]), fetchCommissions({ agentId: agent.id }), fetchAllAgents()])
      .then(([s, c, all]) => {
        if (!mounted) return
        setSales(s)
        setCommissions(c)
        setTeam(all.filter((a) => a.upline_id === agent.id))
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
    <Modal open onClose={onClose} label={`${agent.name} details`} size="lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">
          {agent.name} · {ROLE_LABELS[agent.role] ?? agent.role}
          {!agent.is_active && <Badge tone="red">Inactive</Badge>}
        </h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">✕</button>
      </div>

      {state === 'loading' && <LoadingState label="Loading details…" />}
      {state === 'error' && <ErrorState message="Could not load agent details." />}

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

          <div>
            <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Downline</h3>
            {team.length === 0 ? (
              <p className="text-sm text-ink/60">No agents under this one.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {team.map((member) => (
                  <li key={member.id} className="flex justify-between gap-4">
                    <span className="text-ink/70">{member.name}</span>
                    <span className="text-xs font-semibold uppercase text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {agent.role !== 'admin' && (
        <div className="mt-6 flex justify-end">
          <Button
            variant={agent.is_active ? 'danger' : 'secondary'}
            onClick={() => onToggle(agent)}
            disabled={Boolean(pending?.[agent.id])}
          >
            {agent.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      )}
    </Modal>
  )
}

function AgentNode({ node, depth, openIds, onToggle, eligibility, onView }) {
  const eligible = eligibility?.get?.(node.id)
  const hasChildren = node.children.length > 0
  const open = openIds.has(node.id)
  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-mist bg-white p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-deep">{node.name}</p>
          <p className="text-xs text-ink/50">
            {node.email}
            {node.phone ? ` · ${node.phone}` : ''}
          </p>
        </div>
        <Badge tone={roleTone(node.role)}>{ROLE_LABELS[node.role] ?? node.role}</Badge>
        {!node.is_active && <Badge tone="red">Inactive</Badge>}
        {eligible && <Badge tone="green">Eligible: {ROLE_LABELS[eligible.eligibleFor]}</Badge>}
        <Button size="sm" variant="secondary" onClick={() => onView(node)}>
          View
        </Button>
        {hasChildren && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Toggle ${node.name} downline`}
            onClick={() => onToggle(node.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-mist text-ink/60 transition-transform hover:bg-surface"
          >
            <span aria-hidden="true" className={open ? '-rotate-180' : ''}>▼</span>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="mt-2 space-y-2" style={{ marginLeft: Math.min(depth + 1, 2) * 20 }}>
          {node.children.map((child) => (
            <AgentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openIds={openIds}
              onToggle={onToggle}
              eligibility={eligibility}
              onView={onView}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function AdminAgents() {
  const { showToast } = useToast()
  const [agents, setAgents] = useState([])
  const [search, setSearch] = useState('')
  const [soldCounts, setSoldCounts] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [pending, setPending] = useState({})
  const [openIds, setOpenIds] = useState(() => new Set())

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

  const toggleOpen = useCallback((id) => {
    setOpenIds((ids) => {
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const eligibility = useMemo(() => eligibleAgents(agents, soldCounts), [agents, soldCounts])
  const filtered = search
    ? agents.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(search.toLowerCase()))
    : agents
  const tree = useMemo(() => buildAgentTree(filtered), [filtered])

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
      setDetail((d) => (d && d.id === id ? { ...d, is_active: next } : d))
      setConfirmToggle(null)
      showToast(next ? 'Agent activated.' : 'Agent deactivated.')
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
      <PageHeader
        title="Agents"
        description="The agent network and its hierarchy."
        actions={<Button onClick={() => setShowCreate(true)}>Create Agent</Button>}
      />

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <LoadingState label="Loading agents…" />}

      {state === 'error' && <ErrorState message="Could not load agents." onRetry={load} />}

      {state === 'ready' && agents.length === 0 && (
        <EmptyState message='No agents yet. Click "Create Agent" to add the first one.' />
      )}

      {state === 'ready' && agents.length > 0 && (
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search agents"
            className="sm:max-w-sm"
          />
        </div>
      )}

      {state === 'ready' && agents.length > 0 && (
        <ul className="space-y-2">
          {tree.map((node) => (
            <AgentNode
              key={node.id}
              node={node}
              depth={0}
              openIds={openIds}
              onToggle={toggleOpen}
              eligibility={eligibility}
              onView={setDetail}
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

      {detail && (
        <AgentDetail
          agent={detail}
          onClose={() => setDetail(null)}
          onToggle={setConfirmToggle}
          pending={pending}
        />
      )}

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
