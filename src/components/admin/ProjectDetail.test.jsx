import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectDetail from './ProjectDetail.jsx'

vi.mock('../../lib/projects.js', () => ({
  fetchProject: vi.fn(),
  fetchProjectLots: vi.fn(),
  updateLot: vi.fn(),
  deleteLot: vi.fn(),
}))

vi.mock('../../lib/api.js', () => ({ setPropertyPinned: vi.fn() }))

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))

vi.mock('./CreateProjectModal.jsx', () => ({
  default: ({ onClose, onCreated }) => (
    <div role="dialog" aria-label="Edit project">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onCreated()}>Save project</button>
    </div>
  ),
}))

vi.mock('./MarkSoldModal.jsx', () => ({
  default: ({ onSold }) => (
    <div role="dialog" aria-label="Mark lot sold">
      <button onClick={() => onSold()}>Confirm sale</button>
    </div>
  ),
}))

vi.mock('./UploadLotsModal.jsx', () => ({
  default: () => <div role="dialog" aria-label="Upload lots" />,
}))

vi.mock('./BuyerLedgerModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Buyer ledger">
      <button onClick={onClose}>Close ledger</button>
    </div>
  ),
}))

import { deleteLot, fetchProject, fetchProjectLots, updateLot } from '../../lib/projects.js'
import { setPropertyPinned } from '../../lib/api.js'
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
  is_pinned: false,
  sold_by: null,
}

const soldLot = {
  ...availableLot,
  id: 'l2',
  block_no: '1',
  lot_no: '2',
  status: 'sold',
  is_pinned: true,
  sold_by: 'a1',
  sales: { buyer_name: 'Juan Dela Cruz' },
}

describe('ProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProjectLots.mockResolvedValue([availableLot, soldLot])
    fetchProject.mockResolvedValue(project)
    fetchAllAgents.mockResolvedValue([{ id: 'a1', name: 'Ana Agent', role: 'sub_agent', is_active: true }])
    setPropertyPinned.mockResolvedValue(undefined)
    deleteLot.mockResolvedValue(undefined)
  })

  it('lists the lots with status, price, and selling agent', async () => {
    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    expect(await screen.findByText('Ana Agent')).toBeInTheDocument()
    expect(screen.getByText('2 lots')).toBeInTheDocument()
    expect(screen.getByText('1 available')).toBeInTheDocument()
    expect(screen.getByText('1 sold')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Sold')).toBeInTheDocument()
    expect(screen.getAllByText('₱ 100,000')).toHaveLength(2)
    expect(screen.getAllByText('100 sqm')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Mark Sold' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
    expect(screen.getByText('Buyer')).toBeInTheDocument()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ledger' })).toHaveLength(1)
  })

  it('reads the buyer name from an array-shaped sales relation', async () => {
    fetchProjectLots.mockResolvedValue([{ ...soldLot, sales: [{ buyer_name: 'Maria Santos' }] }])

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument()
  })

  it('shows a dash when a sold lot has no buyer on file', async () => {
    fetchProjectLots.mockResolvedValue([{ ...soldLot, sales: null }])

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await screen.findByText('Sold')
    const row = screen.getAllByRole('row')[1]
    const cells = within(row).getAllByRole('cell')

    expect(cells[5]).toHaveTextContent('—')
  })

  it('opens the buyer ledger for a sold lot', async () => {
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Ledger' }))

    expect(screen.getByRole('dialog', { name: 'Buyer ledger' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close ledger' }))

    expect(screen.queryByRole('dialog', { name: 'Buyer ledger' })).not.toBeInTheDocument()
  })

  it('pins a lot optimistically and persists it', async () => {
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    expect(pinButtons).toHaveLength(1)

    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledWith('l1', true)
    expect(screen.getAllByRole('button', { name: 'Pinned' })).toHaveLength(2)
  })

  it('reverts the pin toggle on failure and shows an error', async () => {
    setPropertyPinned.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(await screen.findByText(/Could not update pin status/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Pin' })).toHaveLength(1)
  })

  it('opens the mark sold modal and reloads the lots after a sale', async () => {
    fetchProjectLots
      .mockResolvedValueOnce([availableLot, soldLot])
      .mockResolvedValueOnce([soldLot])
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Mark Sold' }))
    expect(screen.getByRole('dialog', { name: 'Mark lot sold' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm sale' }))

    expect(fetchProjectLots).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Mark lot sold' })).not.toBeInTheDocument()
  })

  it('edits a lot through updateLot and reloads', async () => {
    const updated = { ...availableLot, block_no: '2', lot_no: '5', lot_area_sqm: 120 }
    updateLot.mockResolvedValue(updated)
    fetchProjectLots
      .mockResolvedValueOnce([availableLot])
      .mockResolvedValueOnce([updated])
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })

    await user.clear(within(dialog).getByLabelText('Block'))
    await user.type(within(dialog).getByLabelText('Block'), '2')
    await user.clear(within(dialog).getByLabelText('Lot'))
    await user.type(within(dialog).getByLabelText('Lot'), '5')
    await user.clear(within(dialog).getByLabelText('Area (sqm)'))
    await user.type(within(dialog).getByLabelText('Area (sqm)'), '120')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(updateLot).toHaveBeenCalledWith(availableLot, project, { block_no: '2', lot_no: '5', area: 120 })
    expect(await screen.findByText('120 sqm')).toBeInTheDocument()
  })

  it('translates a unique violation on edit into a friendly message', async () => {
    updateLot.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint "properties_project_block_lot_idx"'), {
        code: '23505',
      }),
    )
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Edit lot' })
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Block/Lot already exists in this project.')).toBeInTheDocument()
  })

  it('deletes an available lot after confirmation', async () => {
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteLot).toHaveBeenCalledWith('l1')
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(0)
  })

  it('shows the delete block message verbatim when the lot cannot be deleted', async () => {
    deleteLot.mockRejectedValue(new Error('Only available lots can be deleted. Un-sell the lot first.'))
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Only available lots can be deleted. Un-sell the lot first.')).toBeInTheDocument()
  })

  it('opens the upload lots modal', async () => {
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await screen.findByText('Ana Agent')
    await user.click(screen.getByRole('button', { name: 'Upload Lots' }))

    expect(screen.getByRole('dialog', { name: 'Upload lots' })).toBeInTheDocument()
  })

  it('edits the project and refreshes the project and its lots', async () => {
    fetchProject.mockResolvedValue({ ...project, name: 'Andor Farm Updated' })
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Edit Project' }))
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(fetchProject).toHaveBeenCalledWith('pr1')
    expect(await screen.findByText('Andor Farm Updated')).toBeInTheDocument()
    expect(fetchProjectLots).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Edit project' })).not.toBeInTheDocument()
  })

  it('calls onBack when going back', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()

    render(<ProjectDetail project={project} onBack={onBack} />)

    await screen.findByText('Ana Agent')
    await user.click(screen.getByRole('button', { name: '← Back to Projects' }))

    expect(onBack).toHaveBeenCalled()
  })
})
