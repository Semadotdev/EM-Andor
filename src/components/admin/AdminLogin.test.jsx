import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
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
        <Route path="/admin/set-password" element={<p>SetupTarget</p>} />
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

  it('toggles password visibility', async () => {
    const user = userEvent.setup()

    renderLogin()

    const show = screen.getByRole('button', { name: 'Show password' })
    expect(show).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')

    await user.click(show)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('shows a caps lock hint while the password field reports caps lock', () => {
    renderLogin()

    const password = screen.getByLabelText('Password')

    fireEvent.keyDown(password, { key: 'A', modifierCapsLock: true })
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument()

    fireEvent.keyUp(password, { key: 'A', modifierCapsLock: false })
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument()
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

  it('shows an error and resets the button when sign-in rejects', async () => {
    supabase.auth.signInWithPassword.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText(/Something went wrong while signing in/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('links to the forgot-password page', () => {
    renderLogin()

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/admin/forgot-password',
    )
  })

  it('routes a first-time agent to set up their password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'a1', user_metadata: { password_setup_pending: true } } },
      error: null,
    })
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ana@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'temp1234')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('SetupTarget')).toBeInTheDocument()
  })
})
