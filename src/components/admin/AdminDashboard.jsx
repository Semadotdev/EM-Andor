import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import Logo from '../shared/Logo.jsx'
import AdminProperties from './AdminProperties.jsx'
import AdminInquiries from './AdminInquiries.jsx'
import AdminImageGallery from './AdminImageGallery.jsx'
import AdminCMS from './AdminCMS.jsx'
import AdminNotifications from './AdminNotifications.jsx'
import AdminActivityLog from './AdminActivityLog.jsx'
import DashboardStats from './DashboardStats.jsx'

const tabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'cms', label: 'CMS' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'activity', label: 'Activity Log' },
]

export default function AdminDashboard() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState('properties')

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

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-deep">
        <p className="font-display text-lg text-white">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

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
        <DashboardStats onJumpToInquiries={() => setTab('inquiries')} />

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

        {tab === 'properties' && <AdminProperties />}
        {tab === 'gallery' && <AdminImageGallery />}
        {tab === 'cms' && <AdminCMS />}
        {tab === 'inquiries' && <AdminInquiries />}
        {tab === 'notifications' && <AdminNotifications />}
        {tab === 'activity' && <AdminActivityLog />}
      </div>
    </div>
  )
}
