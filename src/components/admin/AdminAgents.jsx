import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ROLE_LABELS, buildAgentTree } from '../../lib/agentMeta.js'
import { fetchAllAgents, fetchSoldCounts, setAgentActive, updateAgent } from '../../lib/agents.js'
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

const TABS = [
  { id: 'commissions', label: 'Commissions' },
  { id: 'agents', label: 'Agents' },
  { id: 'profile', label: 'Profile' },
]

function OrgChart({ data }) {
  return (
    <div className="org-chart">
      <div
        className={`rounded-lg border bg-white px-3 py-2 text-center ${
          data.node.id === data.focusId ? 'border-brand ring-2 ring-brand/30' : 'border-mist'
        }`}
      >
        <p className="font-semibold text-brand-deep">{data.node.name}</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          <Badge tone={roleTone(data.node.role)}>{ROLE_LABELS[data.node.role] ?? data.node.role}</Badge>
          {!data.node.is_active && <Badge tone="red">Inactive</Badge>}
          {data.node.id === data.focusId && <Badge tone="green">Selected</Badge>}
        </div>
      </div>
      {data.children.length > 0 && (
        <>
          <div className="org-chart__stem" aria-hidden="true" />
          <div className={`org-chart__children ${data.children.length === 1 ? 'org-chart__no-rail' : ''}`}>
            {data.children.map((child) => (
              <div key={child.node.id} className="org-chart__child">
                <OrgChart data={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AgentDetail({ agent, onClose, onToggle, onSaved, pending }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [allAgents, setAllAgents] = useState([])
  const [state, setState] = useState('loading')
  const [tab, setTab] = useState('commissions')
  const [chartMode, setChartMode] = useState(false)
  const [form, setForm] = useState({ name: agent.name, phone: agent.phone ?? '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const wrapRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchTeamSales([agent.id]), fetchCommissions({ agentId: agent.id }), fetchAllAgents()])
      .then(([s, c, all]) => {
        if (!mounted) return
        setSales(s)
        setCommissions(c)
        setAllAgents(all)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const earned = commissions.reduce((sum, c) => sum + Number(c.amount), 0)
  const paid = commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  const uplineChain = useMemo(() => {
    const chain = []
    const byId = new Map(allAgents.map((a) => [a.id, a]))
    let cursor = agent.upline_id ? byId.get(agent.upline_id) : null
    let guard = 0
    while (cursor && guard < 25) {
      chain.push(cursor)
      cursor = cursor.upline_id ? byId.get(cursor.upline_id) : null
      guard += 1
    }
    return chain
  }, [allAgents, agent.upline_id])

  const downline = useMemo(() => {
    const childrenMap = new Map()
    for (const a of allAgents) {
      if (!a.upline_id) continue
      if (!childrenMap.has(a.upline_id)) childrenMap.set(a.upline_id, [])
      childrenMap.get(a.upline_id).push(a)
    }
    const result = []
    const queue = [...(childrenMap.get(agent.id) ?? [])]
    while (queue.length > 0) {
      const current = queue.shift()
      result.push(current)
      queue.push(...(childrenMap.get(current.id) ?? []))
    }
    return result
  }, [allAgents, agent.id])

  const orgData = useMemo(() => {
    const childrenMap = new Map()
    for (const a of allAgents) {
      if (!a.upline_id) continue
      if (!childrenMap.has(a.upline_id)) childrenMap.set(a.upline_id, [])
      childrenMap.get(a.upline_id).push(a)
    }
    const build = (row) => ({
      focusId: agent.id,
      node: row,
      children: (childrenMap.get(row.id) ?? []).map(build),
    })
    let current = build(agent)
    for (const upline of [...uplineChain].reverse()) {
      current = { focusId: agent.id, node: upline, children: [current] }
    }
    return current
  }, [allAgents, agent.id, uplineChain])

  const fitChart = useCallback(() => {
    const wrap = wrapRef.current
    const chart = chartRef.current
    if (!wrap || !chart) return
    const prev = chart.style.zoom
    chart.style.zoom = 1
    const natural = chart.getBoundingClientRect().width
    chart.style.zoom = prev
    if (!natural || natural <= 0) return
    const avail = wrap.clientWidth
    const next = Math.round(((avail - 24) / natural) * 100) / 100
    setZoom(Math.max(0.1, Math.min(1, next)))
  }, [])

  useLayoutEffect(() => {
    if (!chartMode) {
      setZoom(1)
      return
    }
    fitChart()
  }, [chartMode, orgData, fitChart])

  const zoomStep = (delta) => () => {
    setZoom((z) => Math.round(Math.max(0.1, Math.min(2, z + delta)) * 100) / 100)
  }

  const toggleChart = () => {
    setChartMode((m) => !m)
  }

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setSaveError(null)
  }

  const saveProfile = async () => {
    if (saving) return
    if (!form.name.trim()) {
      setSaveError('Name is required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateAgent(agent.id, { name: form.name, phone: form.phone })
      onSaved(updated)
    } catch {
      setSaveError('Could not save the profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} label={`${agent.name} details`} size="lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">
          {agent.name} · {ROLE_LABELS[agent.role] ?? agent.role}
          {!agent.is_active && <Badge tone="red">Inactive</Badge>}
        </h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">✕</button>
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-mist bg-surface p-1" role="tablist" aria-label="Agent details">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-1.5 font-display text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-brand shadow-card' : 'text-ink/60 hover:text-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state === 'loading' && <LoadingState label="Loading details…" />}
      {state === 'error' && <ErrorState message="Could not load agent details." />}

      {state === 'ready' && tab === 'commissions' && (
        <div role="tabpanel" className="space-y-5">
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

      {state === 'ready' && tab === 'agents' && (
        <div role="tabpanel" className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-brand-deep">Network</h3>
            <Button size="sm" variant="secondary" onClick={toggleChart}>
              {chartMode ? 'View list' : 'View org chart'}
            </Button>
          </div>

          {chartMode && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={zoomStep(-0.1)} aria-label="Zoom out">
                −
              </Button>
              <span className="w-12 text-center text-sm font-semibold text-ink/70" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <Button size="sm" variant="secondary" onClick={zoomStep(0.1)} aria-label="Zoom in">
                +
              </Button>
              <Button size="sm" variant="secondary" onClick={fitChart}>
                Fit chart to width
              </Button>
            </div>
          )}

          {chartMode ? (
            <div ref={wrapRef} className="h-[min(28rem,60vh)] overflow-auto rounded-lg border border-mist bg-surface/50 py-4">
              <div ref={chartRef} style={{ zoom }} className="min-w-max px-4 py-2">
                <OrgChart data={orgData} />
              </div>
            </div>
          ) : (
            <>
              <div>
                <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Upline</h3>
                {uplineChain.length === 0 ? (
                  <p className="text-sm text-ink/60">No upline.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {uplineChain.map((upline) => (
                      <li key={upline.id} className="text-ink/80">
                        {upline.name} <span className="text-xs font-semibold uppercase text-ink/50">{ROLE_LABELS[upline.role] ?? upline.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Downline</h3>
                {downline.length === 0 ? (
                  <p className="text-sm text-ink/60">No downline yet.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {downline.map((member) => (
                      <li key={member.id} className="text-ink/80">
                        {member.name} <span className="text-xs font-semibold uppercase text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {state === 'ready' && tab === 'profile' && (
        <div role="tabpanel" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ap-name" label="Name" value={form.name} onChange={setField('name')} required />
            <Input id="ap-phone" label="Phone" value={form.phone} onChange={setField('phone')} />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-brand-deep">Email</span>
            <p className="text-sm text-ink/80">{agent.email}</p>
            <p className="mt-1 text-xs text-ink/50">Email is the agent's login and cannot be changed.</p>
          </div>

          {saveError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {saveError}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>

          {agent.role !== 'admin' && (
            <div className="flex justify-end border-t border-mist pt-4">
              <Button
                variant={agent.is_active ? 'danger' : 'secondary'}
                onClick={() => onToggle(agent)}
                disabled={Boolean(pending?.[agent.id])}
              >
                {agent.is_active ? 'Deactivate Account' : 'Activate Account'}
              </Button>
            </div>
          )}
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

  const handleSaved = useCallback((updated) => {
    setAgents((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))
    setDetail((d) => (d && d.id === updated.id ? { ...d, ...updated } : d))
    showToast('Profile saved.')
  }, [showToast])

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
          onSaved={handleSaved}
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
