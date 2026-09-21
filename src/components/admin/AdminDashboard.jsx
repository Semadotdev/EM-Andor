import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'
import Logo from '../shared/Logo.jsx'
import AdminProperties from './AdminProperties.jsx'
import AdminInquiries from './AdminInquiries.jsx'
import AdminImageGallery from './AdminImageGallery.jsx'
import AdminCMS from './AdminCMS.jsx'
import AdminNotifications from './AdminNotifications.jsx'
import AdminActivityLog from './AdminActivityLog.jsx'
import AdminAgents from './AdminAgents.jsx'
import AdminCommissions from './AdminCommissions.jsx'
import DashboardStats from './DashboardStats.jsx'
import AgentStats from './AgentStats.jsx'
import AgentLots from './AgentLots.jsx'
import AgentSales from './AgentSales.jsx'
import AgentCommissions from './AgentCommissions.jsx'
import AgentDownline from './AgentDownline.jsx'

const adminTabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'cms', label: 'CMS' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'agents', label: 'Agents' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'activity', label: 'Activity Log' },
]

const agentTabs = [
  { id: 'lots', label: 'Available Lots' },
  { id: 'sales', label: 'My Sales' },
  { id: 'commissions', label: 'My Commissions' },
  { id: 'downline', label: 'My Downline' },
]

function FullScreen({ children }) {
  return <div className="grid min-h-screen place-items-center bg-brand-deep p-6 text-center text-white">{children}</div>
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [agent, setAgent] = useState(null)
  const [agentError, setAgentError] = useState(null)
  const [downline, setDownline] = useState([])
  const [tab, setTab] = useState(null)

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
    if (!session?.user) return
    let mounted = true
    fetchCurrentAgent()
      .then((row) => {
        if (!mounted) return
        setAgent(row)
        setTab(row.role === 'admin' ? 'properties' : 'lots')
      })
      .catch(() => {
        if (mounted) setAgentError('Your account is not linked to an agent profile. Contact the administrator.')
      })
    return () => { mounted = false }
  }, [session])

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

  if (!agent || !tab) return <FullScreen><p className="font-display text-lg">Loading…</p></FullScreen>

  const isAdmin = agent.role === 'admin'
  const tabs = isAdmin ? adminTabs : agentTabs.filter((t) => t.id !== 'downline' || downline.length > 0)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-mist bg-white">
        <div className="container-x flex items-center justify-between py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="dark" noLink className="max-w-[180px] sm:max-w-none" />
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="container-x py-8">
        {isAdmin ? (
          <DashboardStats onJumpToInquiries={() => setTab('inquiries')} />
        ) : (
          <AgentStats agent={agent} downlineCount={downline.length} />
        )}

        <nav className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" aria-label="Admin sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-brand text-white'
                  : 'border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {isAdmin ? (
          <>
            {tab === 'properties' && <AdminProperties />}
            {tab === 'gallery' && <AdminImageGallery />}
            {tab === 'cms' && <AdminCMS />}
            {tab === 'inquiries' && <AdminInquiries />}
            {tab === 'agents' && <AdminAgents />}
            {tab === 'commissions' && <AdminCommissions />}
            {tab === 'notifications' && <AdminNotifications />}
            {tab === 'activity' && <AdminActivityLog />}
          </>
        ) : (
          <>
            {tab === 'lots' && <AgentLots />}
            {tab === 'sales' && <AgentSales agent={agent} />}
            {tab === 'commissions' && <AgentCommissions agent={agent} />}
            {tab === 'downline' && <AgentDownline members={downline} />}
          </>
        )}
      </div>
    </div>
  )
}
