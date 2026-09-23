import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProjectDetail from './ProjectDetail.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/projects.js', () => ({
  fetchProject: vi.fn(),
  fetchProjectLots: vi.fn(),
  updateLot: vi.fn(),
  deleteLot: vi.fn(),
  lotPrice: (area, pricePerSqm) => Math.round(Number(area) * Number(pricePerSqm) * 100) / 100,
}))

vi.mock('../../lib/sales.js', () => ({ cancelReservation: vi.fn() }))

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))

vi.mock('./CreateProjectModal.jsx', () => ({
  default: ({ onClose, onCreated }) => (
    <div role="dialog" aria-label="Edit project">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onCreated()}>Save project</button>
    </div>
  ),
}))

vi.mock('./ReservationModal.jsx', () => ({
  default: ({ onClose, onReserved }) => (
    <div role="dialog" aria-label="Reserve lot">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onReserved()}>Reserve Lot</button>
    </div>
  ),
}))

vi.mock('./ReservationActionsModal.jsx', () => ({
  default: ({ onClose, onDownpayment, onCancelReservation }) => (
    <div role="dialog" aria-label="Reservation actions">
      <button onClick={onClose}>Close</button>
      <button onClick={onDownpayment}>Make Downpayment</button>
      <button onClick={onCancelReservation}>Cancel Reservation</button>
    </div>
  ),
}))

vi.mock('./DownpaymentModal.jsx', () => ({
  default: ({ onClose, onSold }) => (
    <div role="dialog" aria-label="Make downpayment">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onSold()}>Record Downpayment</button>
    </div>
  ),
}))

vi.mock('./UploadLotsModal.jsx', () => ({
  default: () => <div role="dialog" aria-label="Upload lots" />,
}))

vi.mock('./ComputationModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Quick computation">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('./BuyerLedgerModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Buyer ledger">
      <button onClick={onClose}>Close ledger</button>
    </div>
  ),
}))

import { deleteLot, fetchProject, fetchProjectLots, updateLot } from '../../lib/projects.js'
import { cancelReservation } from '../../lib/sales.js'
import { fetchAllAgents } from '../../lib/agents.js'

const project = {
  id: 'pr1',
  name: 'Andor Farm',
  type: 'farm_lot',
  address: 'Brgy. Andor',
  price_per_sqm: 1000,
}

const availableLot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 100000,
  status: 'available',
  sold_by: null,
}

const soldLot = {
  ...availableLot,
  id: 'l2',
  block_no: '1',
  lot_no: '2',
  status: 'sold',
  sold_by: 'a1',
  sales: { buyer_name: 'Juan Dela Cruz' },
}

const reservedLot = {
  ...availableLot,
  id: 'l3',
  block_no: '1',
  lot_no: '3',
  status: 'reserved',
  sold_by: 'a1',
  sales: { buyer_name: 'Reserved Buyer' },
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/admin/projects/pr1']}>
      <Routes>
        <Route path="/admin/projects/:id" element={<ProjectDetail />} />
        <Route path="/admin/projects" element={<p>ProjectsListPage</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProjectLots.mockResolvedValue([availableLot, soldLot])
    fetchProject.mockResolvedValue(project)
    fetchAllAgents.mockResolvedValue([{ id: 'a1', name: 'Ana Agent', role: 'sub_agent', is_active: true }])
    deleteLot.mockResolvedValue(undefined)
  })

  it('lists the lots with status, price, and selling agent', async () => {
    renderDetail()

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Ana Agent')).toBeInTheDocument()
    expect(screen.getByText('2 lots')).toBeInTheDocument()
    expect(screen.getByText('1 available')).toBeInTheDocument()
    expect(screen.getByText('0 reserved')).toBeInTheDocument()
    expect(screen.getByText('1 sold')).toBeInTheDocument()
    expect(within(table).getByText('Available')).toBeInTheDocument()
    expect(within(table).getByText('Sold')).toBeInTheDocument()
    expect(within(table).getAllByText('₱ 100,000')).toHaveLength(2)
    expect(within(table).getAllByText('100 sqm')).toHaveLength(2)
    expect(within(table).getAllByRole('button', { name: 'Reserve' })).toHaveLength(1)
    expect(within(table).getAllByRole('button', { name: 'Compute' })).toHaveLength(2)
    expect(within(table).getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
    expect(within(table).getByText('Buyer')).toBeInTheDocument()
    expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(within(table).getAllByRole('button', { name: 'Ledger' })).toHaveLength(1)
  })

  it('reads the buyer name from an array-shaped sales relation', async () => {
    fetchProjectLots.mockResolvedValue([{ ...soldLot, sales: [{ buyer_name: 'Maria Santos' }] }])

    renderDetail()

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Maria Santos')).toBeInTheDocument()
  })

  it('shows a dash when a sold lot has no buyer on file', async () => {
    fetchProjectLots.mockResolvedValue([{ ...soldLot, sales: null }])

    renderDetail()

    await screen.findByRole('table')
    const row = screen.getAllByRole('row')[1]
    const cells = within(row).getAllByRole('cell')

    expect(cells[5]).toHaveTextContent('—')
  })

  it('opens the buyer ledger for a sold lot', async () => {
    const user = userEvent.setup()

    renderDetail()

    const ledgerButtons = await screen.findAllByRole('button', { name: 'Ledger' })
    await user.click(ledgerButtons[0])

    expect(screen.getByRole('dialog', { name: 'Buyer ledger' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close ledger' }))

    expect(screen.queryByRole('dialog', { name: 'Buyer ledger' })).not.toBeInTheDocument()
  })

  it('opens the reservation modal and reloads the lots after a reservation', async () => {
    fetchProjectLots
      .mockResolvedValueOnce([availableLot, soldLot])
      .mockResolvedValueOnce([{ ...availableLot, status: 'reserved' }])
    const user = userEvent.setup()

    renderDetail()

    const reserveButtons = await screen.findAllByRole('button', { name: 'Reserve' })
    await user.click(reserveButtons[0])
    expect(screen.getByRole('dialog', { name: 'Reserve lot' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(fetchProjectLots).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Reserve lot' })).not.toBeInTheDocument()
  })

  it('opens the reservation chooser for a reserved lot', async () => {
    fetchProjectLots.mockResolvedValue([reservedLot])
    const user = userEvent.setup()

    renderDetail()

    const reservationButtons = await screen.findAllByRole('button', { name: 'Reservation' })
    await user.click(reservationButtons[0])

    expect(screen.getByRole('dialog', { name: 'Reservation actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make Downpayment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Reservation' })).toBeInTheDocument()
  })

  it('flows from the chooser into the downpayment modal', async () => {
    fetchProjectLots.mockResolvedValue([reservedLot])
    const user = userEvent.setup()

    renderDetail()

    await user.click((await screen.findAllByRole('button', { name: 'Reservation' }))[0])
    await user.click(screen.getByRole('button', { name: 'Make Downpayment' }))

    expect(screen.queryByRole('dialog', { name: 'Reservation actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Make downpayment' })).toBeInTheDocument()
  })

  it('cancels a reservation through the shared confirm modal and reloads', async () => {
    cancelReservation.mockResolvedValue(undefined)
    fetchProjectLots
      .mockResolvedValueOnce([reservedLot])
      .mockResolvedValueOnce([availableLot])
    const user = userEvent.setup()

    renderDetail()

    await user.click((await screen.findAllByRole('button', { name: 'Reservation' }))[0])
    await user.click(screen.getByRole('button', { name: 'Cancel Reservation' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel Reservation' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel Reservation' }))

    expect(cancelReservation).toHaveBeenCalledWith('l3')
    expect(await screen.findByText('Reservation cancelled.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('edits a lot through updateLot and reloads', async () => {
    const updated = { ...availableLot, block_no: '2', lot_no: '5', lot_area_sqm: 120 }
    updateLot.mockResolvedValue(updated)
    fetchProjectLots
      .mockResolvedValueOnce([availableLot])
      .mockResolvedValueOnce([updated])
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })

    await user.clear(within(dialog).getByLabelText('Block'))
    await user.type(within(dialog).getByLabelText('Block'), '2')
    await user.clear(within(dialog).getByLabelText('Lot'))
    await user.type(within(dialog).getByLabelText('Lot'), '5')
    await user.clear(within(dialog).getByLabelText('Area (sqm)'))
    await user.type(within(dialog).getByLabelText('Area (sqm)'), '120')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(updateLot).toHaveBeenCalledWith(availableLot, project, {
      block_no: '2',
      lot_no: '5',
      area: 120,
      price_per_sqm: 1000,
    })
    expect(await screen.findAllByText('120 sqm')).toHaveLength(2)
    expect(await screen.findByText('Lot updated.')).toBeInTheDocument()
  })

  it('edits the per-m² price and shows the recomputed total before saving', async () => {
    updateLot.mockResolvedValue({ ...availableLot, price: 750000, price_per_sqm: 7500 })
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })

    expect(within(dialog).getByLabelText('Price per m² (PHP)')).toHaveValue(1000)

    await user.clear(within(dialog).getByLabelText('Price per m² (PHP)'))
    await user.type(within(dialog).getByLabelText('Price per m² (PHP)'), '7500')

    expect(within(dialog).getByText('Total price: ₱ 750,000')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(updateLot).toHaveBeenCalledWith(availableLot, project, {
      block_no: '1',
      lot_no: '1',
      area: 100,
      price_per_sqm: 7500,
    })
  })

  it('rejects a non-positive per-m² price in the edit modal', async () => {
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })

    await user.clear(within(dialog).getByLabelText('Price per m² (PHP)'))
    await user.type(within(dialog).getByLabelText('Price per m² (PHP)'), '0')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Price per m² must be a number greater than 0.')
    expect(updateLot).not.toHaveBeenCalled()
  })

  it('translates a unique violation on edit into a friendly message', async () => {
    updateLot.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint "properties_project_block_lot_idx"'), {
        code: '23505',
      }),
    )
    const user = userEvent.setup()

    renderDetail()

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Block/Lot already exists in this project.')).toBeInTheDocument()
  })

  it('deletes an available lot from inside the edit modal after confirmation', async () => {
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const editDialog = await screen.findByRole('dialog', { name: 'Edit lot' })
    await user.click(within(editDialog).getByRole('button', { name: 'Delete Lot' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteLot).toHaveBeenCalledWith('l1')
    expect(screen.queryByRole('dialog', { name: 'Edit lot' })).not.toBeInTheDocument()
    expect(await screen.findByText('Lot deleted.')).toBeInTheDocument()
  })

  it('shows the delete block message verbatim when the lot cannot be deleted', async () => {
    deleteLot.mockRejectedValue(new Error('Only available lots can be deleted. Un-sell the lot first.'))
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const editDialog = await screen.findByRole('dialog', { name: 'Edit lot' })
    await user.click(within(editDialog).getByRole('button', { name: 'Delete Lot' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Only available lots can be deleted. Un-sell the lot first.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit lot' })).toBeInTheDocument()
  })

  it('shows the empty state and no compute buttons when there are no lots', async () => {
    fetchProjectLots.mockResolvedValue([])

    renderDetail()

    expect(await screen.findByText(/No lots yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Compute' })).not.toBeInTheDocument()
  })

  it('opens the quick computation modal for every lot status', async () => {
    fetchProjectLots.mockResolvedValue([availableLot, reservedLot, soldLot])
    const user = userEvent.setup()

    renderDetail()

    const computeButtons = await screen.findAllByRole('button', { name: 'Compute' })
    await user.click(computeButtons[0])

    expect(screen.getByRole('dialog', { name: 'Quick computation' })).toBeInTheDocument()
  })

  it('does not offer delete when editing a reserved lot', async () => {
    fetchProjectLots.mockResolvedValue([reservedLot])
    const user = userEvent.setup()

    renderDetail()

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    const editDialog = await screen.findByRole('dialog', { name: 'Edit lot' })

    expect(within(editDialog).queryByRole('button', { name: 'Delete Lot' })).not.toBeInTheDocument()
  })

  it('opens the upload lots modal', async () => {
    const user = userEvent.setup()

    renderDetail()

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Upload Lots' }))

    expect(screen.getByRole('dialog', { name: 'Upload lots' })).toBeInTheDocument()
  })

  it('edits the project and refreshes the project and its lots', async () => {
    fetchProject.mockResolvedValue({ ...project, name: 'Andor Farm Updated' })
    const user = userEvent.setup()

    renderDetail()

    await user.click(await screen.findByRole('button', { name: 'Edit Project' }))
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(fetchProject).toHaveBeenCalledWith('pr1')
    expect(await screen.findByText('Andor Farm Updated')).toBeInTheDocument()
    expect(fetchProjectLots).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Edit project' })).not.toBeInTheDocument()
  })

  it('navigates back to the projects list from the breadcrumb', async () => {
    const user = userEvent.setup()

    renderDetail()

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: '← Projects' }))

    expect(await screen.findByText('ProjectsListPage')).toBeInTheDocument()
  })

  it('shows a retry state when the project cannot be loaded', async () => {
    fetchProject.mockRejectedValue(new Error('boom'))

    renderDetail()

    expect(await screen.findByText('Could not load this project.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
