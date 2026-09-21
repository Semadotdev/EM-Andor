import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminProperties from './AdminProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
  bulkDeleteProperties: vi.fn(),
  bulkUpdatePropertyStatus: vi.fn(),
  bulkSetPropertyPinned: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Ana Sub', role: 'sub_agent' }]),
}))

import { fetchProperties, setPropertyPinned, deleteProperty, bulkDeleteProperties, bulkUpdatePropertyStatus, bulkSetPropertyPinned } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'

const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false, status: 'available', created_at: '2026-08-16T01:00:00Z' },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true, status: 'reserved', created_at: '2026-08-16T02:00:00Z' },
]

describe('AdminProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
  })

  it('lists properties with pinned state', async () => {
    render(<AdminProperties />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('Lot B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument()
  })

  it('displays status badges for each property', async () => {
    render(<AdminProperties />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Reserved').length).toBeGreaterThanOrEqual(1)
  })

  it('pins a property optimistically and persists it', async () => {
    setPropertyPinned.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledWith('p1', true)
    expect(screen.getAllByRole('button', { name: 'Pinned' })).toHaveLength(2)
  })

  it('reverts the pin toggle on failure and shows an error', async () => {
    setPropertyPinned.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminProperties />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(await screen.findByText(/Could not update pin status/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Pin' })).toHaveLength(1)
  })

  it('ignores a pin toggle while a pin request is in flight', async () => {
    let resolve
    setPropertyPinned.mockReturnValue(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()

    render(<AdminProperties />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Pinned' })).toHaveLength(2))
  })

  it('deletes a property after confirmation', async () => {
    deleteProperty.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(deleteProperty).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Lot A')).not.toBeInTheDocument()
  })

  it('shows a retry state when loading fails', async () => {
    fetchProperties.mockResolvedValue({ data: sample, count: sample.length })
    fetchProperties.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminProperties />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Lot A')).toBeInTheDocument()
  })

  it('shows bulk action toolbar when items are selected', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const checkboxes = screen.getAllByRole('checkbox', { name: /Select/i })
    await user.click(checkboxes[1])

    expect(screen.getByText('1 item selected')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('selects all properties with header checkbox', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all properties' })
    await user.click(selectAll)

    expect(screen.getByText('2 items selected')).toBeInTheDocument()
  })

  it('bulk deletes properties after confirmation', async () => {
    bulkDeleteProperties.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    const selectAll = screen.getByRole('checkbox', { name: 'Select all properties' })
    await user.click(selectAll)

    await user.click(screen.getByText('Delete Selected'))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All' }))

    expect(bulkDeleteProperties).toHaveBeenCalledWith(['p1', 'p2'])
  })

  it('exports CSV with all properties', async () => {
    const user = userEvent.setup()

    render(<AdminProperties />)

    await screen.findByText('Lot A')
    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Name', 'Type', 'Location', 'Price', 'Status', 'Pinned', 'Lot Area', 'Created Date'],
      expect.arrayContaining([
        expect.arrayContaining(['Lot A']),
        expect.arrayContaining(['Lot B']),
      ]),
      expect.stringMatching(/properties-export-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })

  it('shows the selling agent for sold properties', async () => {
    fetchProperties.mockResolvedValue({
      data: [{ ...sample[0], id: 'p9', name: 'Lot Sold', status: 'sold', sold_by: 'a1' }],
      count: 1,
    })

    render(<AdminProperties />)

    expect(await screen.findByText('Sold by Ana Sub')).toBeInTheDocument()
  })
})
