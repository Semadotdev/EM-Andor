import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLogin from './AdminLogin.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderLogin(initialPath = '/admin/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<p>DashboardTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  })

  it('signs in and navigates to /admin on success', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'admin@emandor.com', password: 'secret' })
    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('shows an error message on failed sign-in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })
})
