import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import AvailableProperties from './AvailableProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchPinnedProperties: vi.fn(),
}))

import { fetchPinnedProperties } from '../../lib/api.js'

const sample = [
  {
    id: 'p1',
    name: 'Andor Ridge Lot A',
    type: 'residential lot',
    location: 'Batangas City',
    lot_area_sqm: 150,
    price: 1500000,
    description: 'Corner lot',
    image_url: '/images/hero.jpg',
  },
]

describe('AvailableProperties', () => {
  beforeEach(() => {
    fetchPinnedProperties.mockReset()
  })

  it('shows a loading state, then renders pinned properties', async () => {
    let resolveFetch
    fetchPinnedProperties.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    render(<AvailableProperties />)

    expect(screen.getByLabelText('Loading available properties')).toBeInTheDocument()

    await act(async () => {
      resolveFetch(sample)
    })

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(screen.getByText('150 sqm')).toBeInTheDocument()
    expect(screen.getByText('residential lot')).toBeInTheDocument()
  })

  it('shows an empty state when nothing is pinned', async () => {
    fetchPinnedProperties.mockResolvedValue([])

    render(<AvailableProperties />)

    expect(await screen.findByText(/No available properties/i)).toBeInTheDocument()
  })

  it('shows an error state with a retry button that reloads', async () => {
    fetchPinnedProperties
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([
        { id: 'p2', name: 'Andor Ridge Lot B', type: 'house & lot', location: 'Lipa', lot_area_sqm: null, price: null, description: null, image_url: null },
      ])

    render(<AvailableProperties />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Andor Ridge Lot B')).toBeInTheDocument()
  })

  it('shows the subdivision map above the grid only when a property has a position', async () => {
    fetchPinnedProperties.mockResolvedValue(sample)

    render(<AvailableProperties />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /subdivision map/i })).not.toBeInTheDocument()
  })

  it('renders pins on the map and highlights the matching card when a pin is clicked', async () => {
    fetchPinnedProperties.mockResolvedValue([{ ...sample[0], map_x: 25, map_y: 40 }])
    const user = userEvent.setup()

    render(<AvailableProperties />)

    expect(await screen.findByRole('img', { name: /subdivision map/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Andor Ridge Lot A.*pin on map/i }))

    const card = screen.getByRole('heading', { name: 'Andor Ridge Lot A' }).closest('article')
    expect(card).toHaveAttribute('data-highlighted', 'true')
  })
})
