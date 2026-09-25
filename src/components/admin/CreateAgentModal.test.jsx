import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateAgentModal from './CreateAgentModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({ createAgent: vi.fn() }))

import { createAgent } from '../../lib/agents.js'

const agents = [
  { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
  { id: 'a2', name: 'Ben Direct', role: 'direct_agent', is_active: true },
  { id: 'a3', name: 'Cara Head', role: 'agent_head', is_active: true },
]

describe('CreateAgentModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a direct agent with an agent head upline', async () => {
    createAgent.mockResolvedValue({ id: 'a9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.type(screen.getByLabelText('Phone (optional)'), '0917')
    await user.selectOptions(screen.getByLabelText('Role'), 'direct_agent')
    await user.selectOptions(screen.getByLabelText('Upline'), 'a3')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(createAgent).toHaveBeenCalledWith({
      name: 'Cara New',
      email: 'cara@example.com',
      phone: '0917',
      role: 'direct_agent',
      uplineId: 'a3',
      password: 'secret123',
    })
    expect(onCreated).toHaveBeenCalled()
    expect(await screen.findByText('Agent created.')).toBeInTheDocument()
  })

  it('lists same-or-higher rank agents as uplines for a sub agent', async () => {
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    const upline = screen.getByLabelText('Upline')
    expect(upline.querySelectorAll('option')).toHaveLength(4)
    expect(screen.getByRole('option', { name: 'Ana Sub (Sub)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ben Direct (Direct)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cara Head (Head)' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Role'), 'direct_agent')
    expect(upline.querySelectorAll('option')).toHaveLength(3)
    expect(screen.queryByRole('option', { name: 'Ana Sub (Sub)' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ben Direct (Direct)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cara Head (Head)' })).toBeInTheDocument()
  })

  it('clears the upline when the role changes', async () => {
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Upline'), 'a2')
    expect(screen.getByLabelText('Upline').value).toBe('a2')

    await user.selectOptions(screen.getByLabelText('Role'), 'agent_head')
    expect(screen.getByLabelText('Upline').value).toBe('')
    expect(screen.getByRole('option', { name: 'Cara Head (Head)' })).toBeInTheDocument()
  })

  it('creates an agent head without requiring an upline', async () => {
    createAgent.mockResolvedValue({ id: 'a9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Cara Head')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.selectOptions(screen.getByLabelText('Role'), 'agent_head')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({ role: 'agent_head', uplineId: '' }))
    expect(onCreated).toHaveBeenCalled()
  })

  it('requires an upline for a sub agent', async () => {
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'Dana Sub')
    await user.type(screen.getByLabelText('Email'), 'dana@example.com')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(await screen.findByText('Select an upline for this role.')).toBeInTheDocument()
    expect(createAgent).not.toHaveBeenCalled()
  })

  it('disables the upline and requires the admin password to create an admin', async () => {
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Role'), 'admin')
    expect(screen.getByLabelText('Upline')).toBeDisabled()
    expect(screen.getByLabelText('Admin password')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'New Boss')
    await user.type(screen.getByLabelText('Email'), 'boss@example.com')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(await screen.findByText('Enter your admin password to continue.')).toBeInTheDocument()
    expect(createAgent).not.toHaveBeenCalled()
  })

  it('creates an admin after the admin password is provided', async () => {
    createAgent.mockResolvedValue({ id: 'a9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'New Boss')
    await user.type(screen.getByLabelText('Email'), 'boss@example.com')
    await user.selectOptions(screen.getByLabelText('Role'), 'admin')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.type(screen.getByLabelText('Admin password'), 'bosssecret')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(createAgent).toHaveBeenCalledWith({
      name: 'New Boss',
      email: 'boss@example.com',
      phone: '',
      role: 'admin',
      uplineId: '',
      password: 'secret123',
      adminPassword: 'bosssecret',
    })
    expect(onCreated).toHaveBeenCalled()
    expect(await screen.findByText('Agent created.')).toBeInTheDocument()
  })

  it('shows the error returned by the edge function', async () => {
    createAgent.mockRejectedValue(new Error('Email already registered'))
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.selectOptions(screen.getByLabelText('Upline'), 'a2')
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