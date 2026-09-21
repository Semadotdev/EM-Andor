import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import Logo from '../shared/Logo.jsx'
import { ToastProvider } from '../shared/ui'
import DashboardStats from './DashboardStats.jsx'
import AgentStats from './AgentStats.jsx'

const ADMIN_GROUPS = [
  {
    label: 'Sales',
    items: [
      { to: '/admin/projects', label: 'Projects' },
      { to: '/admin/agents', label: 'Agents' },
      { to: '/admin/commissions', label: 'Commissions' },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { to: '/admin/inquiries', label: 'Inquiries' },
      { to: '/admin/notifications', label: 'Notifications' },
    ],
  },
  { label: 'Content', items: [{ to: '/admin/cms', label: 'CMS' }] },
  { label: 'System', items: [{ to: '/admin/activity', label: 'Activity Log' }] },
]

const AGENT_ITEMS = [
  { to: '/admin/lots', label: 'Available Lots' },
  { to: '/admin/sales', label: 'My Sales' },
  { to: '/admin/my-commissions', label: 'My Commissions' },
  { to: '/admin/downline', label: 'My Downline' },
]

function FullScreen({ children }) {
  return <div className="grid min-h-screen place-items-center bg-brand-deep p-6 text-center text-white">{children}</div>
}

const navLinkCls = ({ isActive }) =>
  `block rounded-md px-3 py-2 font-display text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-ink/70 hover:bg-surface'
  }`

function SidebarNav({ isAdmin, showDownline, onNavigate }) {
  const link = (item) => (
    <li key={item.to}>
      <NavLink to={item.to} className={navLinkCls} onClick={onNavigate}>
        {item.label}
      </NavLink>
    </li>
  )

  return (
    <nav aria-label={isAdmin ? 'Admin sections' : 'Agent sections'} className="space-y-6">
      {isAdmin
        ? ADMIN_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-ink/40">{group.label}</p>
              <ul className="space-y-1">{group.items.map(link)}</ul>
            </div>
          ))
        : (
            <ul className="space-y-1">{AGENT_ITEMS.filter((item) => item.label !== 'My Downline' || showDownline).map(link)}</ul>
          )}
    </nav>
  )
}

export default function AdminLayout() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [agent, setAgent] = useState(null)
  const [agentError, setAgentError] = useState(null)
  const [downline, setDownline] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
        setChecking(false)
      })
      .catch(() => {
        if (!mounted) return
        setChecking(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    let mounted = true
    fetchCurrentAgent()
      .then((row) => {
        if (!mounted) return
        setAgent(row)
        setAgentError(null)
      })
      .catch(() => {
        if (mounted) setAgentError('Your account is not linked to an agent profile. Contact the administrator.')
      })
    return () => { mounted = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!agent || agent.role === 'admin') return
    let mounted = true
    fetchMyDownline()
      .then((rows) => { if (mounted) setDownline(rows) })
      .catch(() => {})
    return () => { mounted = false }
  }, [agent])

  if (checking) return <FullScreen><p className="font-display text-lg">Loading…</p></FullScreen>
  if (!session) return <Navigate to="/admin/login" replace />

  if (agentError) {
    return (
      <FullScreen>
        <div className="max-w-md space-y-4">
          <p className="font-display text-lg">{agentError}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-deep"
          >
            Sign out
          </button>
        </div>
      </FullScreen>
    )
  }

  if (!agent) return <FullScreen><p className="font-display text-lg">Loading…</p></FullScreen>

  const isAdmin = agent.role === 'admin'

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <header className="border-b border-mist bg-white">
          <div className="container-x flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-mist text-ink/70 transition-colors hover:border-brand hover:text-brand lg:hidden"
              >
                <span aria-hidden="true">☰</span>
              </button>
              <Logo variant="dark" noLink className="max-w-[180px] sm:max-w-none" />
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-brand-deep">{agent.name}</p>
                <p className="text-xs text-ink/50">{ROLE_LABELS[agent.role] ?? agent.role}</p>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="container-x flex gap-8 py-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            <SidebarNav isAdmin={isAdmin} showDownline={downline.length > 0} />
          </aside>

          <main className="min-w-0 flex-1">
            {isAdmin ? (
              <DashboardStats onJumpToInquiries={() => navigate('/admin/inquiries')} />
            ) : (
              <AgentStats agent={agent} downlineCount={downline.length} />
            )}

            <Outlet context={{ agent, downline }} />
          </main>
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-brand-deep/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] overflow-y-auto bg-white p-4 shadow-lift">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-ink/50">Menu</p>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-md px-2 py-1 text-ink/50 hover:text-ink"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <SidebarNav
                isAdmin={isAdmin}
                showDownline={downline.length > 0}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
