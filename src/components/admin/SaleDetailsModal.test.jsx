import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaleDetailsModal from './SaleDetailsModal.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchSale: vi.fn(), upsertSale: vi.fn() }))

import { fetchSale, upsertSale } from '../../lib/sales.js'

const lot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 100000,
  status: 'sold',
}

const sale = {
  id: 's1',
  property_id: 'l1',
  buyer_name: 'Juan Dela Cruz',
  buyer_address: 'Cebu City',
  tcp: 150000,
  downpayment: 20000,
  monthly_amortization: 5000,
  terms_of_payment: '12 months',
}

describe('SaleDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSale.mockResolvedValue(sale)
    upsertSale.mockResolvedValue(sale)
  })

  it('prefills the buyer and payment fields from the saved sale', async () => {
    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByDisplayValue('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cebu City')).toBeInTheDocument()
    expect(screen.getByDisplayValue('150000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12 months')).toBeInTheDocument()
    expect(fetchSale).toHaveBeenCalledWith('l1')
  })

  it('falls back to the lot price for TCP when no sale is on file', async () => {
    fetchSale.mockResolvedValue(null)

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByDisplayValue('100000')).toBeInTheDocument()
  })

  it('saves the edited buyer details and notifies the parent', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={onSaved} />)

    await user.clear(await screen.findByLabelText('Buyer Address'))
    await user.type(screen.getByLabelText('Buyer Address'), 'Davao City')
    await user.clear(screen.getByLabelText('M.A.'))
    await user.type(screen.getByLabelText('M.A.'), '6500')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(upsertSale).toHaveBeenCalledWith('l1', {
      buyer_name: 'Juan Dela Cruz',
      buyer_address: 'Davao City',
      tcp: 150000,
      downpayment: 20000,
      monthly_amortization: 6500,
      terms_of_payment: '12 months',
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('requires a buyer name before saving', async () => {
    const user = userEvent.setup()

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.clear(await screen.findByLabelText('Buyer Name'))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(upsertSale).not.toHaveBeenCalled()
    expect(screen.getByText('Buyer name is required.')).toBeInTheDocument()
  })

  it('requires a TCP greater than zero', async () => {
    const user = userEvent.setup()

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.clear(await screen.findByLabelText('TCP'))
    await user.type(screen.getByLabelText('TCP'), '-5')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(upsertSale).not.toHaveBeenCalled()
    expect(screen.getByText('TCP must be greater than 0.')).toBeInTheDocument()
  })

  it('shows an error banner when the sale cannot be loaded', async () => {
    fetchSale.mockRejectedValue(new Error('boom'))

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByText('Could not load the buyer details.')).toBeInTheDocument()
  })

  it('shows an error banner when saving fails', async () => {
    upsertSale.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<SaleDetailsModal lot={lot} onClose={vi.fn()} onSaved={vi.fn()} />)

    await screen.findByDisplayValue('Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Could not save the buyer details. Please try again.')).toBeInTheDocument()
    expect(upsertSale).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<SaleDetailsModal lot={lot} onClose={onClose} onSaved={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
