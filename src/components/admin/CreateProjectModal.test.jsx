import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateProjectModal from './CreateProjectModal.jsx'

vi.mock('../../lib/agents.js', () => ({ fetchCommissionRates: vi.fn() }))
vi.mock('../../lib/projects.js', () => ({ createProject: vi.fn() }))

import { fetchCommissionRates } from '../../lib/agents.js'
import { createProject } from '../../lib/projects.js'

const rates = [
  { role: 'sub_agent', rate: 0.03 },
  { role: 'direct_agent', rate: 0.015 },
  { role: 'agent_head', rate: 0.05 },
]

describe('CreateProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCommissionRates.mockResolvedValue(rates)
  })

  it('prefills the commission rates as percents', async () => {
    render(<CreateProjectModal onClose={vi.fn()} onCreated={vi.fn()} />)

    expect(await screen.findByLabelText('Sub Agent rate (%)')).toHaveValue(3)
    expect(screen.getByLabelText('Direct Agent rate (%)')).toHaveValue(1.5)
    expect(screen.getByLabelText('Agent Head rate (%)')).toHaveValue(5)
  })

  it('disables the coming-soon project types', async () => {
    render(<CreateProjectModal onClose={vi.fn()} onCreated={vi.fn()} />)

    const type = screen.getByLabelText('Type')
    expect(within(type).getByRole('option', { name: 'Farm Lot' })).toBeEnabled()
    expect(within(type).getByRole('option', { name: 'Housing (Coming soon)' })).toBeDisabled()
    expect(within(type).getByRole('option', { name: 'Commercial (Coming soon)' })).toBeDisabled()
    expect(within(type).getByRole('option', { name: 'Development (Coming soon)' })).toBeDisabled()
  })

  it('submits the project with rates converted to fractions', async () => {
    createProject.mockResolvedValue({ id: 'pr9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateProjectModal onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Andor Farm')
    await user.type(screen.getByLabelText('Address'), 'Brgy. Andor')
    await user.type(screen.getByLabelText('Price per m² (PHP)'), '1000')
    await screen.findByLabelText('Sub Agent rate (%)')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    expect(createProject).toHaveBeenCalledWith({
      name: 'Andor Farm',
      type: 'farm_lot',
      address: 'Brgy. Andor',
      pricePerSqm: 1000,
      rates: { sub_agent: 0.03, direct_agent: 0.015, agent_head: 0.05 },
    })
    expect(onCreated).toHaveBeenCalled()
  })

  it('shows inline validation and skips the call when fields are missing', async () => {
    const user = userEvent.setup()

    render(<CreateProjectModal onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Address is required.')).toBeInTheDocument()
    expect(screen.getByText('Price per m² must be greater than 0.')).toBeInTheDocument()
    expect(createProject).not.toHaveBeenCalled()
  })

  it('surfaces the error returned when creating fails', async () => {
    createProject.mockRejectedValue(new Error('name already taken'))
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateProjectModal onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Andor Farm')
    await user.type(screen.getByLabelText('Address'), 'Brgy. Andor')
    await user.type(screen.getByLabelText('Price per m² (PHP)'), '1000')
    await screen.findByLabelText('Sub Agent rate (%)')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    expect(await screen.findByText('name already taken')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<CreateProjectModal onClose={onClose} onCreated={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
