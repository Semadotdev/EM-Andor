import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminApp from './AdminApp.jsx'

vi.mock('./AdminLogin.jsx', () => ({ default: () => <span>LoginPage</span> }))
vi.mock('./Dashboard.jsx', () => ({ default: () => <span>DashboardPage</span> }))
vi.mock('./AdminProjects.jsx', () => ({ default: () => <span>ProjectsPage</span> }))
vi.mock('./ProjectDetail.jsx', () => ({ default: () => <span>ProjectDetailPage</span> }))
vi.mock('./AdminAgents.jsx', () => ({ default: () => <span>AgentsPage</span> }))
vi.mock('./AdminCommissions.jsx', () => ({ default: () => <span>CommissionsPage</span> }))
vi.mock('./AdminInquiries.jsx', () => ({ default: () => <span>InquiriesPage</span> }))
vi.mock('./AdminNotifications.jsx', () => ({ default: () => <span>NotificationsPage</span> }))
vi.mock('./AdminCMS.jsx', () => ({ default: () => <span>CMSPage</span> }))
vi.mock('./AdminActivityLog.jsx', () => ({ default: () => <span>ActivityPage</span> }))
vi.mock('./AgentLots.jsx', () => ({ default: () => <span>LotsPage</span> }))
vi.mock('./AgentSales.jsx', () => ({ default: () => <span>SalesPage</span> }))
vi.mock('./AgentCommissions.jsx', () => ({ default: () => <span>MyCommissionsPage</span> }))
vi.mock('./AgentDownline.jsx', () => ({ default: () => <span>DownlinePage</span> }))
vi.mock('../shared/Logo.jsx', () => ({ default: () => <span>Logo</span> }))

vi.mock('../../lib/agents.js', () => ({
  fetchCurrentAgent: vi.fn(),
  fetchMyDownline: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent } from '../../lib/agents.js'

function renderApp(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'admin1', name: 'Admin', role: 'admin', is_active: true })
  })

  it('renders the dashboard at the index for admins', async () => {
    renderApp('/admin')

    expect(await screen.findByText('DashboardPage')).toBeInTheDocument()
  })

  it('renders the dashboard at the index for agents', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })

    renderApp('/admin')

    expect(await screen.findByText('DashboardPage')).toBeInTheDocument()
  })

  it('renders the login page without the admin layout', async () => {
    renderApp('/admin/login')

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders an admin-only route for admins', async () => {
    renderApp('/admin/inquiries')

    expect(await screen.findByText('InquiriesPage')).toBeInTheDocument()
  })

  it('renders the project detail route for admins', async () => {
    renderApp('/admin/projects/pr1')

    expect(await screen.findByText('ProjectDetailPage')).toBeInTheDocument()
  })

  it('redirects agents away from admin-only routes to /admin/lots', async () => {
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })

    renderApp('/admin/projects')

    expect(await screen.findByText('LotsPage')).toBeInTheDocument()
    expect(screen.queryByText('ProjectsPage')).not.toBeInTheDocument()
  })

  it('redirects admins away from agent routes to /admin/projects', async () => {
    renderApp('/admin/lots')

    expect(await screen.findByText('ProjectsPage')).toBeInTheDocument()
    expect(screen.queryByText('LotsPage')).not.toBeInTheDocument()
  })

  it('redirects unknown paths to the dashboard', async () => {
    renderApp('/admin/does-not-exist')

    expect(await screen.findByText('DashboardPage')).toBeInTheDocument()
  })
})
