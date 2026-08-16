import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'

vi.mock('./AdminProperties.jsx', () => ({ default: () => 'PropertiesPanel' }))
vi.mock('./AdminInquiries.jsx', () => ({ default: () => 'InquiriesPanel' }))

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

    expect(await screen.findByText('PropertiesPanel')).toBeInTheDocument()
  })

  it('switches to the inquiries tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await screen.findByText('PropertiesPanel')
    await user.click(screen.getByRole('button', { name: 'Inquiries' }))
    expect(await screen.findByText('InquiriesPanel')).toBeInTheDocument()
  })
})
