import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentLots from './AgentLots.jsx'

vi.mock('../../lib/api.js', () => ({ fetchProperties: vi.fn() }))

import { fetchProperties } from '../../lib/api.js'

describe('AgentLots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists available lots with prices', async () => {
    fetchProperties.mockResolvedValue({
      data: [{ id: 'p1', name: 'Andor Ridge Lot A', location: 'Batangas City', price: 1500000, lot_area_sqm: 150, image_url: null }],
      count: 1,
    })

    render(<AgentLots />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(fetchProperties).toHaveBeenCalledWith({ status: 'available', sort: 'newest' })
  })

  it('shows an empty state when nothing is available', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AgentLots />)

    expect(await screen.findByText('No available lots right now.')).toBeInTheDocument()
  })
})
