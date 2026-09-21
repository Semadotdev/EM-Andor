import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import AvailableProperties from './AvailableProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchPinnedProperties: vi.fn(),
  submitInquiry: vi.fn(),
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
  {
    id: 'p2',
    name: 'Farm Lot 12',
    type: 'farm lot',
    location: 'Tanauan',
    lot_area_sqm: 500,
    price: 900000,
    description: null,
    image_url: null,
    projects: { name: 'Andor Farm' },
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
    expect(screen.getByText('Residential Lot')).toBeInTheDocument()
    expect(screen.getByText('Andor Farm')).toBeInTheDocument()
    expect(screen.getByText('Farm Lot')).toBeInTheDocument()
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

  it('does not render a subdivision map at the section level', async () => {
    fetchPinnedProperties.mockResolvedValue([
      { ...sample[0], map_pins: [{ id: 'l1', name: 'Lot A', price: 1800000, lot_area_sqm: 150, x: 25, y: 40 }] },
    ])

    render(<AvailableProperties />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /subdivision map/i })).not.toBeInTheDocument()
  })

  it('opens a property modal when a card is clicked', async () => {
    fetchPinnedProperties.mockResolvedValue(sample)
    const user = userEvent.setup()

    render(<AvailableProperties />)

    const card = await screen.findByRole('button', { name: /View details for Andor Ridge Lot A/i })
    await user.click(card)

    const dialog = await screen.findByRole('dialog', { name: 'Andor Ridge Lot A' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByText('Corner lot').length).toBe(2)
    expect(screen.getAllByText('₱ 1,500,000').length).toBe(2)
    expect(screen.getAllByText('Batangas City').length).toBe(2)
  })

  it('does not show lot breakdown on the card itself', async () => {
    fetchPinnedProperties.mockResolvedValue([
      {
        ...sample[0],
        price: null,
        map_pins: [
          { id: 'l1', name: 'Lot A', price: 1800000, lot_area_sqm: 150, x: 25, y: 40 },
          { id: 'l2', name: 'Lot B', price: 2000000, lot_area_sqm: 200, x: 70, y: 15 },
        ],
      },
    ])

    render(<AvailableProperties />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('From ₱ 1,800,000')).toBeInTheDocument()
    expect(screen.queryByText('Lot A')).not.toBeInTheDocument()
    expect(screen.queryByText('Lot B')).not.toBeInTheDocument()
  })
})
