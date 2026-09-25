import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/forgot-password']}>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('requests a reset link with the email and a redirect to update-password', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('agent@emandor.com', {
      redirectTo: expect.stringMatching(/\/admin\/update-password$/),
    })
    expect(await screen.findByText(/If an account exists for that email, we've sent a reset link/i)).toBeInTheDocument()
  })

  it('shows the sent message even when the account does not exist', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    })
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'ghost@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByText(/If an account exists for that email, we've sent a reset link/i)).toBeInTheDocument()
  })

  it('rejects an invalid email before calling the API', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('shows a generic error and resets the button when the request fails', async () => {
    supabase.auth.resetPasswordForEmail.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/i)
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument()
  })

  it('surfaces the rate-limit message without revealing account existence', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'For security purposes, you can only request this after 60 seconds.' },
    })
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Please wait a moment/i)
  })
})