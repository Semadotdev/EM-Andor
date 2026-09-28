import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentLots from './AgentLots.jsx'
import logoSrc from '../../assets/logo.png'

vi.mock('../../lib/api.js', () => ({ fetchProperties: vi.fn() }))
vi.mock('./ComputationModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Quick computation">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

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

  it('lists available lots with prices by page, using the website logo when no picture is set', async () => {
    const { container } = render(<AgentLots />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', logoSrc)
    expect(fetchProperties).toHaveBeenCalledWith({
      status: 'available',
      sort: 'newest',
      page: 1,
      pageSize: 15,
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

  it('opens the quick computation modal for a lot from its compute button', async () => {
    const user = userEvent.setup()

    render(<AgentLots />)

    await screen.findByText('Andor Ridge Lot A')
    await user.click(screen.getByRole('button', { name: 'Compute' }))

    expect(screen.getByRole('dialog', { name: 'Quick computation' })).toBeInTheDocument()
  })

  it('closes the quick computation modal', async () => {
    const user = userEvent.setup()

    render(<AgentLots />)

    await screen.findByText('Andor Ridge Lot A')
    await user.click(screen.getByRole('button', { name: 'Compute' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog', { name: 'Quick computation' })).not.toBeInTheDocument()
  })

  it('pages through the lots and refetches the selected page', async () => {
    const more = Array.from({ length: 9 }, (_, i) => LOT(`p${i + 1}`, `Lot ${i + 1}`))
    fetchProperties
      .mockResolvedValueOnce({ data: more, count: 20 })
      .mockResolvedValueOnce({ data: [LOT('a', 'Second Page Lot')], count: 20 })
    const user = userEvent.setup()

    render(<AgentLots />)

    await screen.findByText('Lot 1')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByText('Second Page Lot')).toBeInTheDocument()
    expect(fetchProperties).toHaveBeenLastCalledWith({
      status: 'available',
      sort: 'newest',
      page: 2,
      pageSize: 15,
    })
  })

  it('keeps the page size fixed and offers no rows-per-page selector', async () => {
    fetchProperties.mockResolvedValue({ data: [LOT('p1', 'First Page Lot')], count: 25 })

    render(<AgentLots />)

    expect(await screen.findByText('First Page Lot')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument()
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
