import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminAccount from './AdminAccount.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchCurrentAgent: vi.fn(),
  updateAgentAccount: vi.fn(),
}))

import { fetchCurrentAgent, updateAgentAccount } from '../../lib/agents.js'

const admin = { id: 'admin1', email: 'admin@x.com', name: 'Admin', role: 'admin' }

describe('AdminAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAgent.mockResolvedValue(admin)
    updateAgentAccount.mockResolvedValue({ ...admin, email: 'boss@x.com' })
  })

  it('loads the admin profile and shows the email and role', async () => {
    render(<AdminAccount />)

    expect(await screen.findByDisplayValue('admin@x.com')).toBeInTheDocument()
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('updates the email and shows a confirmation toast', async () => {
    const user = userEvent.setup()

    render(<AdminAccount />)

    const emailInput = await screen.findByLabelText('Email')
    await user.clear(emailInput)
    await user.type(emailInput, 'boss@x.com')
    await user.click(screen.getByRole('button', { name: 'Save Account' }))

    expect(updateAgentAccount).toHaveBeenCalledWith('admin1', { email: 'boss@x.com', password: '' })
    expect(await screen.findByText('Account updated.')).toBeInTheDocument()
  })

  it('sets a new password while keeping the email', async () => {
    const user = userEvent.setup()

    render(<AdminAccount />)

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText('New password'), 'newsecret')
    await user.click(screen.getByRole('button', { name: 'Save Account' }))

    expect(updateAgentAccount).toHaveBeenCalledWith('admin1', { email: 'admin@x.com', password: 'newsecret' })
  })

  it('shows an error when the password is wrong', async () => {
    const user = userEvent.setup()
    updateAgentAccount.mockRejectedValue(new Error('Incorrect password.'))

    render(<AdminAccount />)

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText('New password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Save Account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password.')
  })

  it('blocks saving when the email is blank', async () => {
    const user = userEvent.setup()

    render(<AdminAccount />)

    const emailInput = await screen.findByLabelText('Email')
    await user.clear(emailInput)
    await user.click(screen.getByRole('button', { name: 'Save Account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required.')
    expect(updateAgentAccount).not.toHaveBeenCalled()
  })
})