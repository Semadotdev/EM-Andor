import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentCommissions from './AgentCommissions.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchCommissions: vi.fn() }))

import { fetchCommissions } from '../../lib/sales.js'

describe('AgentCommissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows earned and paid totals with per-lot rows', async () => {
    fetchCommissions.mockResolvedValue([
      { id: 'c1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned', properties: { name: 'Lot A' } },
      { id: 'c2', role_at_sale: 'sub_agent', rate: 0.03, amount: 15000, status: 'paid', properties: { name: 'Lot B' } },
    ])

    render(<AgentCommissions agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 45,000')).toBeInTheDocument()
    expect(screen.getAllByText('₱ 15,000')).toHaveLength(2)
    expect(fetchCommissions).toHaveBeenCalledWith({ agentId: 'a1' })
  })

  it('shows an empty state with no commissions', async () => {
    fetchCommissions.mockResolvedValue([])

    render(<AgentCommissions agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('No commissions yet.')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    fetchCommissions.mockRejectedValue(new Error('boom'))

    render(<AgentCommissions agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('Could not load your commissions. Please refresh.')).toBeInTheDocument()
  })
})
