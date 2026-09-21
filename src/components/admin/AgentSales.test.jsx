import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentSales from './AgentSales.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchMySales: vi.fn() }))

import { fetchMySales } from '../../lib/sales.js'

describe('AgentSales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the agent sold lots', async () => {
    fetchMySales.mockResolvedValue([
      { id: 'p1', name: 'Andor Ridge Lot A', location: 'Batangas City', price: 1500000, sold_at: '2026-09-01T00:00:00Z' },
    ])

    render(<AgentSales agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(fetchMySales).toHaveBeenCalledWith('a1')
  })

  it('shows an empty state when the agent has no sales', async () => {
    fetchMySales.mockResolvedValue([])

    render(<AgentSales agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('You have no sold lots yet.')).toBeInTheDocument()
  })
})
