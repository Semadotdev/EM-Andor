import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentDownline from './AgentDownline.jsx'

vi.mock('../../lib/sales.js', () => ({
  fetchTeamSales: vi.fn(),
  fetchCommissions: vi.fn(),
}))

import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'

const members = [
  { id: 'a2', name: 'Rico Recruit', role: 'sub_agent' },
  { id: 'a3', name: 'Dina Recruit', role: 'sub_agent' },
]

describe('AgentDownline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('summarizes each downline member', async () => {
    fetchTeamSales.mockResolvedValue([{ id: 'p1', sold_by: 'a2' }])
    fetchCommissions.mockResolvedValue([
      { id: 'c0', agent_id: 'a1', amount: 99999, status: 'earned' },
      { id: 'c1', agent_id: 'a2', amount: 30000, status: 'earned' },
      { id: 'c2', agent_id: 'a3', amount: 10000, status: 'paid' },
    ])

    render(<AgentDownline members={members} />)

    expect(await screen.findByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.getByText('Sold Lots: 1')).toBeInTheDocument()
    expect(screen.getByText('Earned: ₱ 30,000')).toBeInTheDocument()
    expect(screen.getByText('Earned: ₱ 10,000')).toBeInTheDocument()
    expect(screen.getByText('Paid: ₱ 10,000')).toBeInTheDocument()
    expect(screen.queryByText('Earned: ₱ 99,999')).not.toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    fetchTeamSales.mockRejectedValue(new Error('boom'))

    render(<AgentDownline members={members} />)

    expect(await screen.findByText('Could not load your downline. Please refresh.')).toBeInTheDocument()
  })
})
