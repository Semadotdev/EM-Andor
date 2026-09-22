import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminAgents from './AdminAgents.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn(),
  fetchSoldCounts: vi.fn(),
  setAgentActive: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn().mockResolvedValue([]),
  fetchTeamSales: vi.fn().mockResolvedValue([]),
}))
vi.mock('./CreateAgentModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Create agent">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { fetchAllAgents, fetchSoldCounts, setAgentActive } from '../../lib/agents.js'

const admin = { id: 'admin1', name: 'Admin', email: 'a@x.com', role: 'admin', upline_id: null, is_active: true }
const sub = { id: 'a1', name: 'Ana Sub', email: 'ana@x.com', role: 'sub_agent', upline_id: null, is_active: true }
const recruit = { id: 'a2', name: 'Rico Recruit', email: 'rico@x.com', role: 'sub_agent', upline_id: 'a1', is_active: true }

describe('AdminAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([admin, sub, recruit])
    fetchSoldCounts.mockResolvedValue({})
    setAgentActive.mockResolvedValue({})
  })

  it('lists agents with role labels and child indentation', async () => {
    render(<AdminAgents />)

    expect(await screen.findByText('Ana Sub')).toBeInTheDocument()
    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.getAllByText('Sub Agent').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an eligible badge when promotion thresholds are met', async () => {
    const recruits = Array.from({ length: 5 }, (_, i) => ({ ...recruit, id: `r${i}`, name: `Recruit ${i}` }))
    fetchAllAgents.mockResolvedValue([admin, sub, ...recruits])
    fetchSoldCounts.mockResolvedValue({ a1: 5 })

    render(<AdminAgents />)

    expect(await screen.findByText('Eligible: Direct Agent')).toBeInTheDocument()
  })

  it('opens the create agent modal', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Create Agent' }))
    expect(screen.getByRole('dialog', { name: 'Create agent' })).toBeInTheDocument()
  })

  it('deactivates an agent from the view modal after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }))

    expect(setAgentActive).toHaveBeenCalledWith('a1', false)
    expect(await screen.findByText('Agent deactivated.')).toBeInTheDocument()
  })

  it('keeps activation actions inside the view modal and hides them for admins', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await screen.findByText('Ana Sub')
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()

    const adminRow = screen.getAllByText('Admin')[0].closest('li')
    await user.click(within(adminRow).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Admin details' })
    expect(within(dialog).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
  })

  it('searches agents by name', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await screen.findByText('Ana Sub')
    await user.type(screen.getByLabelText('Search agents'), 'Rico')

    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.queryByText('Ana Sub')).not.toBeInTheDocument()
  })

  it('opens and closes the agent detail modal', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    expect(await screen.findByRole('dialog', { name: 'Ana Sub details' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Ana Sub details' })).not.toBeInTheDocument()
  })
})
