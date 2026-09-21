import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminAgents from './AdminAgents.jsx'

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

  it('deactivates an agent after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    expect(setAgentActive).toHaveBeenCalledWith('a1', false)
  })
})
