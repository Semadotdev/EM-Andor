import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BuyerLedgerModal from './BuyerLedgerModal.jsx'
import { buildLedger, ledgerCsvRows } from '../../lib/ledger.js'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/sales.js', () => ({
  fetchSale: vi.fn(),
  fetchPayments: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({ exportToCSV: vi.fn() }))

vi.mock('./SaleDetailsModal.jsx', () => ({
  default: ({ onSaved }) => (
    <div role="dialog" aria-label="Edit sale">
      <button onClick={() => onSaved()}>Save sale</button>
    </div>
  ),
}))

import { fetchSale, fetchPayments, createPayment, updatePayment, deletePayment } from '../../lib/sales.js'
import { exportToCSV } from '../../lib/csv.js'

const lot = {
  id: 'l1',
  project_id: 'pr1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  lot_area_sqm: 100,
  price: 100000,
  status: 'sold',
  sold_by: 'a1',
}

const project = { id: 'pr1', name: 'Andor Farm', price_per_sqm: 1000 }

const sale = {
  id: 's1',
  property_id: 'l1',
  buyer_name: 'Juan Dela Cruz',
  buyer_address: 'Cebu City',
  tcp: 20000,
  downpayment: 4000,
  monthly_amortization: 1500,
  terms_of_payment: '12 months',
}

const payments = [
  {
    id: 'pay1',
    property_id: 'l1',
    entry_date: '2026-01-05',
    or_number: 'OR-1',
    amount: 5000,
    surcharge: 200,
    interest: 100,
    remarks: 'first payment',
  },
  {
    id: 'pay2',
    property_id: 'l1',
    entry_date: '2026-02-05',
    or_number: 'OR-2',
    amount: 3000,
    surcharge: 100,
    interest: 50,
    remarks: '',
  },
]

const DETAIL_VALUES = ['Andor Farm', '100 sqm', '₱ 1,000 / m²', '₱ 20,000', '₱ 4,000', '₱ 1,500', '12 months', 'Cebu City']

const CSV_HEADERS = ['DATE', 'OR#', 'AMOUNT', 'SURCHARGE', 'INTEREST', 'PRINCIPAL', 'BALANCE OF PRINCIPAL', 'REMARKS']

describe('BuyerLedgerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSale.mockResolvedValue(sale)
    fetchPayments.mockResolvedValue(payments)
    createPayment.mockResolvedValue({ id: 'pay3' })
    updatePayment.mockResolvedValue({ id: 'pay1' })
    deletePayment.mockResolvedValue(undefined)
  })

  it('summarises the sale and reveals the hidden details on demand', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Buyer')).toBeInTheDocument()
    expect(screen.getByText('Block 1 Lot 1')).toBeInTheDocument()
    expect(screen.queryByText('Project')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveClass('max-w-6xl')

    for (const value of DETAIL_VALUES) {
      expect(screen.queryByText(value)).not.toBeInTheDocument()
    }

    const toggle = screen.getByRole('button', { name: /Show more details/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)

    expect(screen.getByRole('button', { name: /Show less/ })).toHaveAttribute('aria-expanded', 'true')

    for (const value of DETAIL_VALUES) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }

    await user.click(screen.getByRole('button', { name: /Show less/ }))

    expect(screen.getByRole('button', { name: /Show more details/ })).toHaveAttribute('aria-expanded', 'false')

    for (const value of DETAIL_VALUES) {
      expect(screen.queryByText(value)).not.toBeInTheDocument()
    }

    expect(fetchSale).toHaveBeenCalledWith('l1')
    expect(fetchPayments).toHaveBeenCalledWith('l1')
  })

  it('shows derived principal and running balance for each payment', async () => {
    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(await screen.findByText('OR-1')).toBeInTheDocument()
    expect(screen.getByText('₱ 4,700')).toBeInTheDocument()
    expect(screen.getByText('₱ 15,300')).toBeInTheDocument()
    expect(screen.getByText('₱ 2,850')).toBeInTheDocument()
    expect(screen.getAllByText('₱ 12,450')).toHaveLength(2)
    expect(screen.getByText('Total paid')).toBeInTheDocument()
    expect(screen.getByText('₱ 8,000')).toBeInTheDocument()
    expect(screen.getByText('Total principal')).toBeInTheDocument()
    expect(screen.getByText('₱ 7,550')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText(/Remaining balance/)).toBeInTheDocument()
  })

  it('adds a payment from the modal and reloads the ledger', async () => {
    const onChanged = vi.fn()
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={onChanged} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Add Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Add payment' })
    await user.type(within(dialog).getByLabelText('DATE'), '2026-03-05')
    await user.type(within(dialog).getByLabelText('OR#'), 'OR-3')
    await user.type(within(dialog).getByLabelText('AMOUNT'), '2500')
    await user.type(within(dialog).getByLabelText('REMARKS'), 'March')
    await user.click(within(dialog).getByRole('button', { name: 'Add Payment' }))

    expect(createPayment).toHaveBeenCalledWith('l1', {
      entry_date: '2026-03-05',
      or_number: 'OR-3',
      amount: 2500,
      surcharge: 0,
      interest: 0,
      remarks: 'March',
    })
    expect(fetchPayments).toHaveBeenCalledTimes(2)
    expect(onChanged).toHaveBeenCalled()
    expect(await screen.findByText('Payment added.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Add payment' })).not.toBeInTheDocument()
  })

  it('shows a payment modal error when adding fails', async () => {
    createPayment.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Add Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Add payment' })
    await user.type(within(dialog).getByLabelText('DATE'), '2026-03-05')
    await user.type(within(dialog).getByLabelText('AMOUNT'), '2500')
    await user.click(within(dialog).getByRole('button', { name: 'Add Payment' }))

    expect(await within(dialog).findByText('Could not add the payment. Please try again.')).toBeInTheDocument()
  })

  it('blocks adding a payment without a date or a positive amount', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Add Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Add payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Payment' }))

    expect(createPayment).not.toHaveBeenCalled()
    expect(within(dialog).getByText('DATE is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('AMOUNT must be greater than 0.')).toBeInTheDocument()
  })

  it('edits a payment in the modal and reloads the ledger', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    const row = screen.getAllByRole('row')[1]
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit payment' })
    expect(within(dialog).getByLabelText('DATE')).toHaveValue('2026-01-05')
    expect(within(dialog).getByLabelText('OR#')).toHaveValue('OR-1')
    expect(within(dialog).getByLabelText('AMOUNT')).toHaveValue(5000)
    expect(within(dialog).getByLabelText('REMARKS')).toHaveValue('first payment')

    await user.clear(within(dialog).getByLabelText('AMOUNT'))
    await user.type(within(dialog).getByLabelText('AMOUNT'), '5500')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(updatePayment).toHaveBeenCalledWith('pay1', {
      entry_date: '2026-01-05',
      or_number: 'OR-1',
      amount: 5500,
      surcharge: 200,
      interest: 100,
      remarks: 'first payment',
    })
    expect(fetchPayments).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Payment updated.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Edit payment' })).not.toBeInTheDocument()
  })

  it('closes the payment modal on cancel without saving', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Add Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Add payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Add payment' })).not.toBeInTheDocument()
    expect(createPayment).not.toHaveBeenCalled()
    expect(updatePayment).not.toHaveBeenCalled()
  })

  it('deletes a payment after confirmation and reloads the ledger', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    const row = screen.getAllByRole('row')[1]
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deletePayment).toHaveBeenCalledWith('pay1')
    expect(fetchPayments).toHaveBeenCalledTimes(2)
  })

  it('paginates the payments table and slices the displayed rows', async () => {
    const manyPayments = Array.from({ length: 12 }, (_, index) => ({
      id: `pay${index + 1}`,
      property_id: 'l1',
      entry_date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      or_number: `OR-${index + 1}`,
      amount: 1000,
      surcharge: 0,
      interest: 0,
      remarks: '',
    }))
    fetchPayments.mockResolvedValue(manyPayments)
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(await screen.findByText('OR-1')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument()
    expect(screen.getByText('OR-10')).toBeInTheDocument()
    expect(screen.queryByText('OR-11')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rows per page')).toHaveValue('10')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument()
    expect(screen.getByText('OR-11')).toBeInTheDocument()
    expect(screen.getByText('OR-12')).toBeInTheDocument()
    expect(screen.queryByText('OR-1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('exports the ledger rows as CSV', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(exportToCSV).toHaveBeenCalledWith(
      CSV_HEADERS,
      ledgerCsvRows(buildLedger(payments, 20000)),
      'ledger-Juan-Dela-Cruz-Block-1-Lot-1.csv',
    )
  })

  it('opens the sale details modal and reloads the sale after saving', async () => {
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    await screen.findByText('Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: 'Edit Sale' }))

    expect(screen.getByRole('dialog', { name: 'Edit sale' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save sale' }))

    expect(fetchSale).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Edit sale' })).not.toBeInTheDocument()
  })

  it('shows a load error with a retry', async () => {
    fetchPayments.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(await screen.findByText('Could not load the ledger.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('OR-1')).toBeInTheDocument()
  })

  it('does not close when the delete confirmation backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={onClose} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    const row = screen.getAllByRole('row')[1]
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(dialog.parentElement)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close the ledger when Escape dismisses a nested dialog', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={onClose} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    const row = screen.getAllByRole('row')[1]
    await user.click(within(row).getByRole('button', { name: 'Delete' }))
    await screen.findByRole('alertdialog')

    await userEvent.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /ledger/i })).toBeInTheDocument()
  })

  it('closes only the payment modal when Escape dismisses it', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={onClose} onChanged={vi.fn()} />)

    await screen.findByText('OR-1')
    await user.click(screen.getByRole('button', { name: 'Add Payment' }))
    await screen.findByRole('dialog', { name: 'Add payment' })

    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Add payment' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Buyer ledger' })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={onClose} onChanged={vi.fn()} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on a backdrop click but not when clicking the dialog', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<BuyerLedgerModal lot={lot} project={project} onClose={onClose} onChanged={vi.fn()} />)

    const dialog = await screen.findByRole('dialog', { name: 'Buyer ledger' })
    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    await user.click(dialog.parentElement)
    expect(onClose).toHaveBeenCalled()
  })
})
