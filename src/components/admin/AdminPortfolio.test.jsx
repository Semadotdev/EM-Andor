import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPortfolio from './AdminPortfolio.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

vi.mock('./PropertyForm.jsx', () => ({ default: ({ mode, onClose }) => (
  <div data-testid="property-form">
    <span>PropertyForm:{mode}</span>
    <button onClick={onClose}>CloseForm</button>
  </div>
) }))

vi.mock('../shared/ConfirmModal.jsx', () => ({ default: ({ open, onConfirm, onClose, title }) => (
  open ? (
    <div role="alertdialog" aria-label={title}>
      <span>{title}</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  ) : null
) }))

import { fetchProperties, setPropertyPinned, deleteProperty, updateProperty } from '../../lib/api.js'

const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false, status: 'available', created_at: '2026-08-16T01:00:00Z' },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true, status: 'reserved', created_at: '2026-08-16T02:00:00Z' },
]

describe('AdminPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders property cards with names and prices', async () => {
    render(<AdminPortfolio />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('Lot B')).toBeInTheDocument()
  })

  it('shows search input and filter dropdowns', async () => {
    render(<AdminPortfolio />)

    expect(await screen.findByLabelText('Search properties')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort properties')).toBeInTheDocument()
  })

  it('handles search input with debounce', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    const search = screen.getByLabelText('Search properties')
    await user.type(search, 'test')

    expect(fetchProperties).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(300)
    await waitFor(() => expect(fetchProperties).toHaveBeenCalledTimes(2))
  })

  it('handles type filter change', async () => {
    const user = userEvent.setup()
    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    await user.selectOptions(screen.getByLabelText('Filter by type'), 'commercial lot')

    await waitFor(() => expect(fetchProperties).toHaveBeenCalledWith(expect.objectContaining({ type: 'commercial lot' })))
  })

  it('handles status filter change', async () => {
    const user = userEvent.setup()
    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'sold')

    await waitFor(() => expect(fetchProperties).toHaveBeenCalledWith(expect.objectContaining({ status: 'sold' })))
  })

  it('handles sort change', async () => {
    const user = userEvent.setup()
    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    await user.selectOptions(screen.getByLabelText('Sort properties'), 'price_asc')

    await waitFor(() => expect(fetchProperties).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price_asc' })))
  })

  it('shows result count', async () => {
    render(<AdminPortfolio />)

    expect(await screen.findByText(/2 properties/)).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AdminPortfolio />)

    expect(await screen.findByText(/No properties yet/)).toBeInTheDocument()
  })

  it('edit button opens PropertyForm', async () => {
    const user = userEvent.setup()

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])

    expect(screen.getByTestId('property-form')).toBeInTheDocument()
    expect(screen.getByText('PropertyForm:edit')).toBeInTheDocument()
  })

  it('pin toggle calls setPropertyPinned', async () => {
    setPropertyPinned.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    const pinButtons = screen.getAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledWith('p1', true)
  })

  it('status dropdown calls updateProperty', async () => {
    updateProperty.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    const selects = screen.getAllByLabelText(/Change status/i)
    await user.selectOptions(selects[0], 'sold')

    expect(updateProperty).toHaveBeenCalledWith('p1', { status: 'sold' })
  })

  it('delete button opens ConfirmModal', async () => {
    const user = userEvent.setup()

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    const deleteButton = screen.getByRole('button', { name: 'Delete Lot A' })
    await user.click(deleteButton)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('Add New Property button opens PropertyForm in create mode', async () => {
    const user = userEvent.setup()

    render(<AdminPortfolio />)
    await screen.findByText('Lot A')

    await user.click(screen.getByText('Add New Property'))

    expect(screen.getByTestId('property-form')).toBeInTheDocument()
    expect(screen.getByText('PropertyForm:create')).toBeInTheDocument()
  })
})
