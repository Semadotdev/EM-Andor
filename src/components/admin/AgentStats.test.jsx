import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentStats from './AgentStats.jsx'

vi.mock('../../lib/sales.js', () => ({
  fetchMySales: vi.fn(),
  fetchCommissions: vi.fn(),
}))

import { fetchCommissions, fetchMySales } from '../../lib/sales.js'

describe('AgentStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows sold lots and earned vs paid commission totals', async () => {
    fetchMySales.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    fetchCommissions.mockResolvedValue([
      { id: 'c1', status: 'earned', amount: 30000 },
      { id: 'c2', status: 'paid', amount: 15000 },
    ])

    render(<AgentStats agent={{ id: 'a1', name: 'Ana' }} downlineCount={3} />)

    expect(await screen.findByText('Sold Lots')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('₱ 45,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 15,000')).toBeInTheDocument()
  })
})
