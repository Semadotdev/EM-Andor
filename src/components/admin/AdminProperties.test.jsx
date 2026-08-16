import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminProperties from './AdminProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { fetchProperties, setPropertyPinned, deleteProperty } from '../../lib/api.js'

const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true },
]

describe('AdminProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue(sample)
  })

  it('lists properties with pinned state', async () => {
    render(<AdminProperties />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('Lot B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument()
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
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteProperty.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(deleteProperty).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Lot A')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('shows a retry state when loading fails', async () => {
    fetchProperties.mockResolvedValue(sample)
    fetchProperties.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminProperties />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Lot A')).toBeInTheDocument()
  })
})
