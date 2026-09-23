import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComputationModal from './ComputationModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

const lot = {
  id: 'l1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
  price: 500000,
}

describe('ComputationModal', () => {
  it('prefixes the TCP with the lot price and shows no results before a downpayment is entered', () => {
    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    expect(screen.getByLabelText('TCP')).toHaveValue(500000)
    expect(screen.getByLabelText('Downpayment')).toHaveValue(null)
    expect(screen.getByText('20% of TCP (minimum reservation fee + downpayment):')).toHaveTextContent('₱ 100,000')
    expect(screen.queryByText('Monthly Amortization')).not.toBeInTheDocument()
  })

  it('shows the monthly amortization for every payment term once a downpayment is entered', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Downpayment'), '100000')

    expect(await screen.findByText('Monthly Amortization')).toBeInTheDocument()
    expect(screen.getByText('₱ 400,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 33,333.33')).toBeInTheDocument()
    expect(screen.getByText('₱ 16,666.67')).toBeInTheDocument()
    expect(screen.getByText('₱ 11,111.11')).toBeInTheDocument()
    expect(screen.getByText('₱ 10,533.53')).toBeInTheDocument()
    expect(screen.getByText('₱ 8,897.78')).toBeInTheDocument()
    expect(screen.getByText('48 months (12% diminishing)')).toBeInTheDocument()
    expect(screen.getByText('60 months (12% diminishing)')).toBeInTheDocument()
  })

  it('recomputes every amortization as the downpayment changes', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    const downpayment = screen.getByLabelText('Downpayment')
    await user.type(downpayment, '100000')

    expect(await screen.findByText('₱ 400,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 10,533.53')).toBeInTheDocument()

    await user.clear(downpayment)
    await user.type(downpayment, '200000')

    expect(await screen.findByText('₱ 300,000')).toBeInTheDocument()
    expect(await screen.findByText('₱ 7,900.15')).toBeInTheDocument()
  })

  it('hides the results when the downpayment exceeds the TCP', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Downpayment'), '600000')

    expect(screen.queryByText('Monthly Amortization')).not.toBeInTheDocument()
  })

  it('only offers close — it never records anything', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={onClose} />)

    expect(screen.queryByRole('button', { name: /Save|Record/ })).not.toBeInTheDocument()
    const form = screen.getByRole('dialog').querySelector('form')
    await user.click(within(form).getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(<ComputationModal lot={lot} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})