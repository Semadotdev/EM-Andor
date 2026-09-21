import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateAgentModal from './CreateAgentModal.jsx'

vi.mock('../../lib/agents.js', () => ({ createAgent: vi.fn() }))

import { createAgent } from '../../lib/agents.js'

const agents = [
  { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
  { id: 'a2', name: 'Ben Direct', role: 'direct_agent', is_active: true },
]

describe('CreateAgentModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an agent with the entered details', async () => {
    createAgent.mockResolvedValue({ id: 'a9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.type(screen.getByLabelText('Phone (optional)'), '0917')
    await user.selectOptions(screen.getByLabelText('Role'), 'direct_agent')
    await user.selectOptions(screen.getByLabelText('Upline (optional)'), 'a1')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(createAgent).toHaveBeenCalledWith({
      name: 'Cara New',
      email: 'cara@example.com',
      phone: '0917',
      role: 'direct_agent',
      uplineId: 'a1',
      password: 'secret123',
    })
    expect(onCreated).toHaveBeenCalled()
  })

  it('shows the error returned by the edge function', async () => {
    createAgent.mockRejectedValue(new Error('Email already registered'))
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<CreateAgentModal agents={agents} onClose={onClose} onCreated={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
