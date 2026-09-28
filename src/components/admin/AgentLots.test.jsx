import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentLots from './AgentLots.jsx'

vi.mock('../../lib/api.js', () => ({ fetchProperties: vi.fn() }))

import { fetchProperties } from '../../lib/api.js'

const LOT = (id, name) => ({
  id,
  name,
  location: 'Batangas City',
  price: 1500000,
  lot_area_sqm: 150,
  image_url: null,
})

describe('AgentLots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue({ data: [LOT('p1', 'Andor Ridge Lot A')], count: 1 })
  })

  it('lists available lots with prices by page, using the placeholder image when none is set', async () => {
    const { container } = render(<AgentLots />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/lot-placeholder.svg')
    expect(fetchProperties).toHaveBeenCalledWith({
      status: 'available',
      sort: 'newest',
      page: 1,
      pageSize: 9,
    })
  })

  it('uses the lot photo when one is set', async () => {
    fetchProperties.mockResolvedValue({
      data: [{ ...LOT('p1', 'Andor Ridge Lot A'), image_url: 'https://cdn.example.com/lot.jpg' }],
      count: 1,
    })

    const { container } = render(<AgentLots />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/lot.jpg')
  })

  it('pages through the lots and refetches the selected page', async () => {
    const more = Array.from({ length: 9 }, (_, i) => LOT(`p${i + 1}`, `Lot ${i + 1}`))
    fetchProperties
      .mockResolvedValueOnce({ data: more, count: 20 })
      .mockResolvedValueOnce({ data: [LOT('a', 'Second Page Lot')], count: 20 })
    const user = userEvent.setup()

    render(<AgentLots />)

    await screen.findByText('Lot 1')
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByText('Second Page Lot')).toBeInTheDocument()
    expect(fetchProperties).toHaveBeenLastCalledWith({
      status: 'available',
      sort: 'newest',
      page: 2,
      pageSize: 9,
    })
  })

  it('resets to the first page when the page size changes', async () => {
    fetchProperties
      .mockResolvedValueOnce({ data: [LOT('p1', 'First Page Lot')], count: 25 })
      .mockResolvedValueOnce({ data: [LOT('p2', 'Resized Page Lot')], count: 25 })
    const user = userEvent.setup()

    render(<AgentLots />)

    await screen.findByText('First Page Lot')
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Rows per page'), '12')

    expect(await screen.findByText('Resized Page Lot')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(fetchProperties).toHaveBeenLastCalledWith({
      status: 'available',
      sort: 'newest',
      page: 1,
      pageSize: 12,
    })
  })

  it('shows an empty state when nothing is available', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AgentLots />)

    expect(await screen.findByText('No available lots right now.')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    fetchProperties.mockRejectedValue(new Error('boom'))

    render(<AgentLots />)

    expect(await screen.findByText('Could not load lots. Please refresh.')).toBeInTheDocument()
  })
})
