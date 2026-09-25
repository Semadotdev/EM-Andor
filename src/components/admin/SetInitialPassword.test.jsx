import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SetInitialPassword from './SetInitialPassword.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

const pendingSession = { data: { session: { user: { id: 'a1', user_metadata: { password_setup_pending: true } } } } }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/set-password']}>
      <Routes>
        <Route path="/admin/set-password" element={<SetInitialPassword />} />
        <Route path="/admin/login" element={<p>LoginTarget</p>} />
        <Route path="/admin" element={<p>DashboardTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SetInitialPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue(pendingSession)
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'a1' } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('shows the form when the session has the pending flag', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Choose your password' })).toBeInTheDocument()
  })

  it('redirects to login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()

    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })

  it('redirects to the dashboard when the flag is already cleared', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'a1' } } } })

    renderPage()

    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('validates a short password', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), '123')
    await user.type(screen.getByLabelText('Confirm new password'), '123')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('validates that the passwords match', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm new password'), 'secret2')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('sets the password and stays signed in to the dashboard', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpass1',
      data: { password_setup_pending: false },
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('surfaces an update error and resets the button', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password should be more complex' } })
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'weakpass')
    await user.type(screen.getByLabelText('Confirm new password'), 'weakpass')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password should be more complex')
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument()
  })

  it('signs out from the set-password page', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.click(screen.getByRole('button', { name: 'Sign out instead' }))

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })

  it('toggles the new password field between text and password', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    const field = screen.getByLabelText('New password')
    expect(field).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show new password' })
    await user.click(toggle)

    expect(field).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hide new password' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide new password' }))

    expect(field).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles the confirm field independently of the new password field', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    const confirmField = screen.getByLabelText('Confirm new password')

    await user.click(screen.getByRole('button', { name: 'Show new password' }))
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text')
    expect(confirmField).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show confirm password' }))
    expect(confirmField).toHaveAttribute('type', 'text')
  })
})