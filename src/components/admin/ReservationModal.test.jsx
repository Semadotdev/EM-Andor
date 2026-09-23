import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReservationModal from './ReservationModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))
vi.mock('../../lib/sales.js', () => ({ lotFieldsForSale: (lot) => {
  const fields = { ...lot }
  delete fields.id
  delete fields.created_at
  delete fields.updated_at
  delete fields.sales
  return fields
}, reserveLot: vi.fn() }))

import { fetchAllAgents } from '../../lib/agents.js'
import { reserveLot } from '../../lib/sales.js'

const lot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 100000,
  status: 'available',
  sold_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const project = { id: 'pr1', name: 'Andor Farm' }

describe('ReservationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([
      { id: 'admin1', name: 'Admin', role: 'admin', is_active: true },
      { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
      { id: 'a2', name: 'Inactive Agent', role: 'sub_agent', is_active: false },
    ])
    reserveLot.mockResolvedValue({ id: 'l1', status: 'reserved' })
  })

  it('offers only active non-admin agents as sellers', async () => {
    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    expect(await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Admin/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Inactive Agent/ })).not.toBeInTheDocument()
  })

  it('renders the buyer fields and terms without the downpayment and M.A. inputs', async () => {
    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    expect(await screen.findByLabelText('Buyer Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Buyer Address')).toBeInTheDocument()
    expect(screen.getByLabelText('TCP')).toHaveValue(100000)
    expect(screen.getByLabelText('Terms of Payment')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '48 months (12% diminishing)' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Downpayment')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('M.A.')).not.toBeInTheDocument()
  })

  it('reserves the lot with the seller, buyer details, and chosen terms', async () => {
    const onReserved = vi.fn()
    const user = userEvent.setup()

    render(<ReservationModal lot={{ ...lot, sales: { buyer_name: 'Existing Buyer' } }} project={project} onClose={vi.fn()} onReserved={onReserved} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Buyer Address'), 'Cebu City')
    await user.clear(screen.getByLabelText('TCP'))
    await user.type(screen.getByLabelText('TCP'), '150000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(reserveLot).toHaveBeenCalledWith({
      propertyId: 'l1',
      payload: {
        project_id: 'pr1',
        name: 'Block 1 Lot 1',
        block_no: '1',
        lot_no: '1',
        lot_area_sqm: 100,
        price: 100000,
        status: 'reserved',
        sold_by: 'a1',
      },
      details: {
        buyer_name: 'Juan Dela Cruz',
        buyer_address: 'Cebu City',
        tcp: 150000,
        downpayment: 0,
        monthly_amortization: 0,
        terms_of_payment: '24',
      },
    })
    expect(onReserved).toHaveBeenCalled()
    expect(await screen.findByText('Reservation recorded.')).toBeInTheDocument()
  })

  it('requires a seller before saving', async () => {
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(reserveLot).not.toHaveBeenCalled()
    expect(screen.getByText('Select the selling agent.')).toBeInTheDocument()
  })

  it('requires a buyer name before saving', async () => {
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(reserveLot).not.toHaveBeenCalled()
    expect(screen.getByText('Buyer name is required.')).toBeInTheDocument()
  })

  it('requires a TCP greater than zero', async () => {
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.clear(screen.getByLabelText('TCP'))
    await user.type(screen.getByLabelText('TCP'), '0')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(reserveLot).not.toHaveBeenCalled()
    expect(screen.getByText('TCP must be greater than 0.')).toBeInTheDocument()
  })

  it('requires the terms of payment before saving', async () => {
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(reserveLot).not.toHaveBeenCalled()
    expect(screen.getByText('Select the terms of payment.')).toBeInTheDocument()
  })

  it('surfaces field errors from the sales API', async () => {
    reserveLot.mockRejectedValue({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(await screen.findByText('Select an active selling agent.')).toBeInTheDocument()
    expect(screen.queryByText('Could not record the reservation. Please try again.')).not.toBeInTheDocument()
  })

  it('renders a generic message for non-seller field errors', async () => {
    reserveLot.mockRejectedValue({
      fieldErrors: { price: 'Set a price before marking this property sold.' },
    })
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(await screen.findByText('Set a price before marking this property sold.')).toBeInTheDocument()
    expect(screen.getByText('Could not record the reservation. Please try again.')).toBeInTheDocument()
  })

  it('surfaces a buyer-details failure after the reservation is recorded', async () => {
    reserveLot.mockRejectedValue(
      new Error('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.'),
    )
    const user = userEvent.setup()

    render(<ReservationModal lot={lot} project={project} onClose={vi.fn()} onReserved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '12')
    await user.click(screen.getByRole('button', { name: 'Reserve Lot' }))

    expect(
      await screen.findByText('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.'),
    ).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<ReservationModal lot={lot} project={project} onClose={onClose} onReserved={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
