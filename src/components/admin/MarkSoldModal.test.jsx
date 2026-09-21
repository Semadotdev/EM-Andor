import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkSoldModal from './MarkSoldModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({ fetchAllAgents: vi.fn() }))
vi.mock('../../lib/sales.js', () => ({ recordSale: vi.fn() }))

import { fetchAllAgents } from '../../lib/agents.js'
import { recordSale } from '../../lib/sales.js'

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

describe('MarkSoldModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([
      { id: 'admin1', name: 'Admin', role: 'admin', is_active: true },
      { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
      { id: 'a2', name: 'Inactive Agent', role: 'sub_agent', is_active: false },
    ])
    recordSale.mockResolvedValue({ id: 'l1', status: 'sold' })
  })

  it('offers only active non-admin agents as sellers', async () => {
    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Admin/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Inactive Agent/ })).not.toBeInTheDocument()
  })

  it('renders the buyer and payment fields with the TCP prefilled from the lot price', async () => {
    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    expect(await screen.findByLabelText('Buyer Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Buyer Address')).toBeInTheDocument()
    expect(screen.getByLabelText('TCP')).toHaveValue(100000)
    expect(screen.getByLabelText('Downpayment')).toBeInTheDocument()
    expect(screen.getByLabelText('M.A.')).toBeInTheDocument()
    expect(screen.getByLabelText('Terms of Payment')).toBeInTheDocument()
  })

  it('records the sale with the full lot payload, seller, and buyer details', async () => {
    const onSold = vi.fn()
    const user = userEvent.setup()

    render(<MarkSoldModal lot={{ ...lot, sales: { buyer_name: 'Existing Buyer' } }} project={project} onClose={vi.fn()} onSold={onSold} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Buyer Address'), 'Cebu City')
    await user.clear(screen.getByLabelText('TCP'))
    await user.type(screen.getByLabelText('TCP'), '150000')
    await user.type(screen.getByLabelText('Downpayment'), '20000')
    await user.type(screen.getByLabelText('M.A.'), '5000')
    await user.type(screen.getByLabelText('Terms of Payment'), '12 months')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(recordSale).toHaveBeenCalledWith({
      propertyId: 'l1',
      payload: {
        project_id: 'pr1',
        name: 'Block 1 Lot 1',
        block_no: '1',
        lot_no: '1',
        lot_area_sqm: 100,
        price: 100000,
        status: 'sold',
        sold_by: 'a1',
      },
      details: {
        buyer_name: 'Juan Dela Cruz',
        buyer_address: 'Cebu City',
        tcp: 150000,
        downpayment: 20000,
        monthly_amortization: 5000,
        terms_of_payment: '12 months',
      },
    })
    expect(onSold).toHaveBeenCalled()
    expect(await screen.findByText('Sale recorded.')).toBeInTheDocument()
  })

  it('requires a seller before saving', async () => {
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana Sub (Sub Agent)' })
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(recordSale).not.toHaveBeenCalled()
    expect(screen.getByText('Select the selling agent.')).toBeInTheDocument()
  })

  it('requires a buyer name before saving', async () => {
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(recordSale).not.toHaveBeenCalled()
    expect(screen.getByText('Buyer name is required.')).toBeInTheDocument()
  })

  it('requires a TCP greater than zero', async () => {
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.clear(screen.getByLabelText('TCP'))
    await user.type(screen.getByLabelText('TCP'), '0')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(recordSale).not.toHaveBeenCalled()
    expect(screen.getByText('TCP must be greater than 0.')).toBeInTheDocument()
  })

  it('surfaces field errors from the sales API', async () => {
    recordSale.mockRejectedValue({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(await screen.findByText('Select an active selling agent.')).toBeInTheDocument()
    expect(screen.queryByText('Could not record the sale. Please try again.')).not.toBeInTheDocument()
  })

  it('renders a generic message for non-seller field errors', async () => {
    recordSale.mockRejectedValue({
      fieldErrors: { price: 'Set a price before marking this property sold.' },
    })
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(await screen.findByText('Set a price before marking this property sold.')).toBeInTheDocument()
    expect(screen.getByText('Could not record the sale. Please try again.')).toBeInTheDocument()
  })

  it('surfaces the paid-commission block', async () => {
    recordSale.mockRejectedValue(new Error('Commission already paid — reverse payment first.'))
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(await screen.findByText('Commission already paid — reverse payment first.')).toBeInTheDocument()
  })

  it('surfaces a buyer-details failure after the sale is recorded', async () => {
    recordSale.mockRejectedValue(
      new Error('Sale recorded, but the buyer details failed to save. Reopen the lot and use Edit Sale to retry.'),
    )
    const user = userEvent.setup()

    render(<MarkSoldModal lot={lot} project={project} onClose={vi.fn()} onSold={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Selling Agent'), 'a1')
    await user.type(screen.getByLabelText('Buyer Name'), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Mark Sold' }))

    expect(
      await screen.findByText('Sale recorded, but the buyer details failed to save. Reopen the lot and use Edit Sale to retry.'),
    ).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<MarkSoldModal lot={lot} project={project} onClose={onClose} onSold={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
