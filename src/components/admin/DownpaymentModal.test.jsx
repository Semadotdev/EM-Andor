import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DownpaymentModal from './DownpaymentModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/sales.js', () => ({
  completeDownpayment: vi.fn(),
  fetchPayments: vi.fn(),
  fetchSale: vi.fn(),
  lotFieldsForSale: (lot) => {
    const fields = { ...lot }
    delete fields.id
    delete fields.created_at
    delete fields.updated_at
    delete fields.sales
    return fields
  },
}))

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))

import { completeDownpayment, fetchPayments, fetchSale, lotFieldsForSale } from '../../lib/sales.js'

const lot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 500000,
  status: 'reserved',
  sold_by: 'a1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const project = { id: 'pr1', name: 'Andor Farm' }

const sale = {
  id: 's1',
  property_id: 'l1',
  buyer_name: 'Juan Dela Cruz',
  buyer_address: 'Cebu City',
  tcp: 500000,
  downpayment: 0,
  monthly_amortization: 0,
  terms_of_payment: '24',
}

async function openForm() {
  return screen.findByLabelText('Terms of Payment')
}

describe('DownpaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSale.mockResolvedValue(sale)
    fetchPayments.mockResolvedValue([])
    completeDownpayment.mockResolvedValue({})
  })

  it('loads the sale row and prefills TCP and terms', async () => {
    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument()
    const termsSelect = await screen.findByLabelText('Terms of Payment')
    expect(termsSelect).toHaveValue('24')
    expect(await screen.findByLabelText('Downpayment')).toHaveValue(null)
  })

  it('does not show a preview until a downpayment and terms are entered', async () => {
    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    expect(screen.queryByText('Monthly Amortization')).not.toBeInTheDocument()
  })

  it('shows a live monthly amortization preview that updates as the downpayment and terms change', async () => {
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '100000')

    expect(await screen.findByText('₱ 16,666.67')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '48')

    expect(await screen.findByText('₱ 10,533.53')).toBeInTheDocument()
    expect(screen.getByText('₱ 400,000')).toBeInTheDocument()
  })

  it('requires a positive downpayment', async () => {
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '0')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).not.toHaveBeenCalled()
    expect(screen.getByText('Downpayment must be greater than 0.')).toBeInTheDocument()
  })

  it('shows the reservation fee paid, the 20% minimum, and the remaining amount', async () => {
    fetchPayments.mockResolvedValue([
      { id: 'pay1', remarks: 'Reservation', amount: 50000 },
      { id: 'pay2', remarks: 'Installment', amount: 1000 },
    ])

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await openForm()).toBeInTheDocument()
    expect(screen.getByText('Reservation fee paid')).toBeInTheDocument()
    expect(screen.getAllByText('₱ 50,000')).toHaveLength(2)
    expect(screen.getByText('20% of TCP (minimum)')).toBeInTheDocument()
    expect(screen.getByText('₱ 100,000')).toBeInTheDocument()
    expect(screen.getByText('Still needed to reach 20%')).toBeInTheDocument()
    expect(screen.getAllByText('₱ 50,000')).toHaveLength(2)
  })

  it('blocks a downpayment that keeps the total below 20% of the TCP', async () => {
    fetchPayments.mockResolvedValue([{ remarks: 'Reservation', amount: 50000 }])
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '49999')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).not.toHaveBeenCalled()
    expect(
      screen.getByText('Downpayment must be at least ₱ 50,000 to reach 20% of the TCP with the reservation fee.'),
    ).toBeInTheDocument()
  })

  it('allows a downpayment that brings the total to 20% of the TCP', async () => {
    fetchPayments.mockResolvedValue([{ remarks: 'Reservation', amount: 50000 }])
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '50000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).toHaveBeenCalled()
    expect(screen.queryByText(/must be at least/)).not.toBeInTheDocument()
  })

  it('shows that the 20% minimum is already met when the reservation fee covers it', async () => {
    fetchPayments.mockResolvedValue([{ remarks: 'Reservation', amount: 100000 }])

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    expect(screen.getByText('Met by the reservation fee')).toBeInTheDocument()
    expect(screen.queryByText('Still needed to reach 20%')).not.toBeInTheDocument()
  })

  it('rejects a downpayment greater than the TCP', async () => {
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '600000')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).not.toHaveBeenCalled()
    expect(screen.getByText('Downpayment cannot exceed the TCP.')).toBeInTheDocument()
  })

  it('requires terms of payment before saving', async () => {
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '100000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).not.toHaveBeenCalled()
    expect(screen.getByText('Select the terms of payment.')).toBeInTheDocument()
  })

  it('records the downpayment with the recomputed monthly amortization and fires onSold', async () => {
    const onSold = vi.fn()
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={onSold} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '100000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(completeDownpayment).toHaveBeenCalledWith({
      propertyId: 'l1',
      payload: expect.objectContaining({ status: 'sold', sold_by: 'a1' }),
      downpayment: 100000,
      terms: '24',
      monthlyAmortization: 16666.67,
    })
    expect(onSold).toHaveBeenCalled()
    expect(await screen.findByText('Downpayment recorded.')).toBeInTheDocument()
  })

  it('closes on Escape without recording', async () => {
    const onClose = vi.fn()

    render(<DownpaymentModal lot={lot} project={project} onClose={onClose} onSold={vi.fn()} />)

    await openForm()
    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
    expect(completeDownpayment).not.toHaveBeenCalled()
  })

  it('shows a load error with a retry', async () => {
    fetchSale.mockRejectedValue(new Error('boom'))

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await screen.findByText('Could not load the reservation.')).toBeInTheDocument()
  })

  it('shows a fallback error banner when saving fails', async () => {
    completeDownpayment.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<DownpaymentModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await openForm()
    await user.type(screen.getByLabelText('Downpayment'), '100000')
    await user.click(screen.getByRole('button', { name: 'Record Downpayment' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(completeDownpayment).toHaveBeenCalled()
  })
})
