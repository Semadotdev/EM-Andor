import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import Logo from '../shared/Logo.jsx'
import BrandLoader from '../shared/ui/BrandLoader.jsx'
import useInstallPrompt from '../../hooks/useInstallPrompt.js'
import { ToastProvider } from '../shared/ui'

const DASHBOARD_ITEM = { to: '/admin', label: 'Dashboard', end: true }

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
  { label: 'System', items: [{ to: '/admin/activity', label: 'Activity Log' }, { to: '/admin/account', label: 'Account' }] },
]

const AGENT_ITEMS = [
  { to: '/admin/lots', label: 'Available Lots' },
  { to: '/admin/sales', label: 'My Sales' },
  { to: '/admin/my-commissions', label: 'My Commissions' },
  { to: '/admin/downline', label: 'My Downline' },
]

const navLinkCls = ({ isActive }) =>
  `block rounded-md px-3 py-2 font-display text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-ink/70 hover:bg-surface'
  }`

function InstallAppButton({ onInstall }) {
  return (
    <button
      onClick={onInstall}
      className="w-full rounded-md border border-mist px-3 py-2 font-display text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand"
    >
      Install app
    </button>
  )
}

function SidebarNav({ isAdmin, showDownline, onNavigate }) {
  const link = (item) => (
    <li key={item.to}>
      <NavLink to={item.to} end={item.end} className={navLinkCls} onClick={onNavigate}>
        {item.label}
      </NavLink>
    </li>
  )

  return (
    <nav aria-label={isAdmin ? 'Admin sections' : 'Agent sections'} className="space-y-6">
      {isAdmin ? (
        <>
          <ul className="space-y-1">{link(DASHBOARD_ITEM)}</ul>
          {ADMIN_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-ink/40">{group.label}</p>
              <ul className="space-y-1">{group.items.map(link)}</ul>
            </div>
          ))}
        </>
      ) : (
        <ul className="space-y-1">
          {[DASHBOARD_ITEM, ...AGENT_ITEMS].filter((item) => item.label !== 'My Downline' || showDownline).map(link)}
        </ul>
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
  const { canInstall, promptInstall } = useInstallPrompt()

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

  if (checking) return <BrandLoader fullscreen />
  if (!session) return <Navigate to="/admin/login" replace />

  if (session.user?.user_metadata?.password_setup_pending) {
    return <Navigate to="/admin/set-password" replace />
  }

  if (agentError) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-deep p-6 text-center text-white">
        <div className="flex max-w-md flex-col items-center gap-6">
          <Logo variant="light" noLink />
          <p className="font-display text-lg">{agentError}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-deep"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (!agent) return <BrandLoader fullscreen />

  const isAdmin = agent.role === 'admin'

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <header className="sticky top-0 z-40 border-b border-mist bg-white">
          <div className="container-wide flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-mist text-ink/70 transition-colors hover:border-brand hover:text-brand lg:hidden"
              >
                <span aria-hidden="true">☰</span>
              </button>
              <div className="hidden lg:flex">
                <Logo variant="dark" noLink className="max-w-[180px] sm:max-w-none" />
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-brand-deep">{agent.name}</p>
                <p className="text-xs text-ink/50">{ROLE_LABELS[agent.role] ?? agent.role}</p>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="hidden rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand lg:block"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="container-wide flex items-start gap-8 py-8">
          <aside className="sticky top-[4.75rem] hidden max-h-[calc(100vh-5.75rem)] w-56 shrink-0 overflow-y-auto lg:block">
            <SidebarNav isAdmin={isAdmin} showDownline={downline.length > 0} />
            {canInstall && (
              <div className="mt-6">
                <InstallAppButton onInstall={promptInstall} />
              </div>
            )}
          </aside>

          <main className="min-w-0 flex-1">
            <Outlet context={{ agent, downline }} />
          </main>
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-brand-deep/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <div
              role="dialog"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col gap-6 overflow-y-auto bg-white p-4 shadow-lift"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white">
                <Logo variant="dark" noLink />
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="shrink-0 rounded-md px-2 py-1 text-ink/50 hover:text-ink"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <SidebarNav
                isAdmin={isAdmin}
                showDownline={downline.length > 0}
                onNavigate={() => setDrawerOpen(false)}
              />
              <div className="mt-auto border-t border-mist pt-4">
                <p className="truncate text-sm font-semibold text-brand-deep">{agent.name}</p>
                <p className="mb-3 text-xs text-ink/50">{ROLE_LABELS[agent.role] ?? agent.role}</p>
                {canInstall && (
                  <div className="mb-3">
                    <InstallAppButton onInstall={promptInstall} />
                  </div>
                )}
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
