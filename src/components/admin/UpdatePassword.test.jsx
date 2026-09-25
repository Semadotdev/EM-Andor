import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UpdatePassword from './UpdatePassword.jsx'

let authListener

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((cb) => {
        authListener = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/update-password']}>
      <Routes>
        <Route path="/admin/update-password" element={<UpdatePassword />} />
        <Route path="/admin/login" element={<p>LoginTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('UpdatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authListener = undefined
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('shows the form when a recovery session exists', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
  })

  it('shows the invalid state when no recovery session exists', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Invalid or expired link' })).toBeInTheDocument()
  })

  it('shows the form when the PASSWORD_RECOVERY event fires', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()
    await screen.findByRole('heading', { name: 'Invalid or expired link' })
    act(() => {
      authListener('PASSWORD_RECOVERY', { user: { id: 'u1' } })
    })

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
  })

  it('validates a short password', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), '123')
    await user.type(screen.getByLabelText('Confirm new password'), '123')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('validates that the passwords match', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm new password'), 'secret2')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password, signs out, and returns to login', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass1' })
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })

  it('surfaces an update error and resets the button', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password should be more complex' } })
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'weakpass')
    await user.type(screen.getByLabelText('Confirm new password'), 'weakpass')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password should be more complex')
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument()
  })
})