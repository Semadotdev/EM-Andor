import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'

vi.mock('./AdminProjects.jsx', () => ({ default: () => <span>ProjectsPanel</span> }))
vi.mock('./AdminInquiries.jsx', () => ({ default: () => <span>InquiriesPanel</span> }))
vi.mock('./AdminCMS.jsx', () => ({ default: () => <span>CMSPanel</span> }))
vi.mock('./AdminNotifications.jsx', () => ({ default: () => <span>NotificationsPanel</span> }))
vi.mock('./AdminActivityLog.jsx', () => ({ default: () => <span>ActivityLogPanel</span> }))
vi.mock('./DashboardStats.jsx', () => ({ default: () => <span>StatsPanel</span> }))
vi.mock('../shared/Logo.jsx', () => ({ default: () => <span>Logo</span> }))
vi.mock('./AdminAgents.jsx', () => ({ default: () => <span>AgentsPanel</span> }))
vi.mock('./AdminCommissions.jsx', () => ({ default: () => <span>AdminCommissionsPanel</span> }))
vi.mock('./AgentStats.jsx', () => ({ default: () => <span>AgentStatsPanel</span> }))
vi.mock('./AgentLots.jsx', () => ({ default: () => <span>AgentLotsPanel</span> }))
vi.mock('./AgentSales.jsx', () => ({ default: () => <span>AgentSalesPanel</span> }))
vi.mock('./AgentCommissions.jsx', () => ({ default: () => <span>AgentCommissionsPanel</span> }))
vi.mock('./AgentDownline.jsx', () => ({ default: () => <span>AgentDownlinePanel</span> }))
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
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/login" element={<p>LoginPage</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAgent.mockResolvedValue({ id: 'admin1', name: 'Admin', role: 'admin', is_active: true })
  })

  it('redirects to /admin/login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderDashboard()

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('renders the projects tab by default when authenticated', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    expect(screen.getByText('StatsPanel')).toBeInTheDocument()
    const tabNames = screen.getAllByRole('button').map((button) => button.textContent)
    expect(tabNames).toEqual(
      expect.arrayContaining(['Projects', 'CMS', 'Inquiries', 'Agents', 'Commissions', 'Notifications', 'Activity Log']),
    )
    expect(screen.queryByRole('button', { name: 'Properties' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gallery' })).not.toBeInTheDocument()
  })

  it('switches to the inquiries tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Inquiries' }))
    await waitFor(() => {
      expect(screen.getByText('InquiriesPanel')).toBeInTheDocument()
    })
  })

  it('redirects to login when sign-out fires the auth listener', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    const listener = supabase.auth.onAuthStateChange.mock.calls[0][0]
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(supabase.auth.signOut).toHaveBeenCalled()
    listener('SIGNED_OUT', null)
    await waitFor(() => {
      expect(screen.getByText('LoginPage')).toBeInTheDocument()
    })
  })

  it('redirects to login when the auth listener reports no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    const listener = supabase.auth.onAuthStateChange.mock.calls[0][0]
    listener('SIGNED_OUT', null)
    await waitFor(() => {
      expect(screen.getByText('LoginPage')).toBeInTheDocument()
    })
  })

  it('switches to the CMS tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'CMS' }))
    await waitFor(() => {
      expect(screen.getByText('CMSPanel')).toBeInTheDocument()
    })
  })

  it('switches to the Notifications tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    await waitFor(() => {
      expect(screen.getByText('NotificationsPanel')).toBeInTheDocument()
    })
  })

  it('switches to the Activity Log tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Activity Log' }))
    await waitFor(() => {
      expect(screen.getByText('ActivityLogPanel')).toBeInTheDocument()
    })
  })

  it('shows agent tabs for a sub agent and hides admin-only panels', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([{ id: 'a2', name: 'Downline', role: 'sub_agent' }])

    renderDashboard()

    expect(await screen.findByText('AgentLotsPanel')).toBeInTheDocument()
    expect(screen.getByText('AgentStatsPanel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Projects' })).not.toBeInTheDocument()
  })

  it('shows the downline tab only when the agent has a downline', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([])

    renderDashboard()

    await screen.findByText('AgentLotsPanel')
    expect(screen.queryByRole('button', { name: 'My Downline' })).not.toBeInTheDocument()
  })

  it('keeps the selected tab across auth state events', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('ProjectsPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    await waitFor(() => {
      expect(screen.getByText('NotificationsPanel')).toBeInTheDocument()
    })

    const listener = supabase.auth.onAuthStateChange.mock.calls[0][0]
    await act(async () => {
      listener('TOKEN_REFRESHED', { user: { id: 'u1' } })
    })

    expect(fetchCurrentAgent).toHaveBeenCalledTimes(1)
    expect(screen.getByText('NotificationsPanel')).toBeInTheDocument()
  })
})
