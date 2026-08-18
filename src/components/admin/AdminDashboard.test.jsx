import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'

vi.mock('./AdminProperties.jsx', () => ({ default: () => <span>PropertiesPanel</span> }))
vi.mock('./AdminInquiries.jsx', () => ({ default: () => <span>InquiriesPanel</span> }))
vi.mock('./AdminCMS.jsx', () => ({ default: () => <span>CMSPanel</span> }))
vi.mock('./AdminNotifications.jsx', () => ({ default: () => <span>NotificationsPanel</span> }))
vi.mock('./AdminActivityLog.jsx', () => ({ default: () => <span>ActivityLogPanel</span> }))
vi.mock('./DashboardStats.jsx', () => ({ default: () => <span>StatsPanel</span> }))
vi.mock('../shared/Logo.jsx', () => ({ default: () => <span>Logo</span> }))

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
  })

  it('redirects to /admin/login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderDashboard()

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('renders the properties tab when authenticated', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
    })
    expect(screen.getByText('StatsPanel')).toBeInTheDocument()
  })

  it('switches to the inquiries tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
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
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
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
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
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
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
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
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
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
      expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Activity Log' }))
    await waitFor(() => {
      expect(screen.getByText('ActivityLogPanel')).toBeInTheDocument()
    })
  })
})
