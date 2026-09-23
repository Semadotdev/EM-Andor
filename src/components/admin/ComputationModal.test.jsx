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
  it('prefixes the TCP with the lot price but leaves the other fields empty', () => {
    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    expect(screen.getByLabelText('TCP')).toHaveValue(500000)
    expect(screen.getByLabelText('Downpayment')).toHaveValue(null)
    expect(screen.getByLabelText('Terms of Payment')).toHaveValue('')
    expect(screen.queryByText('Monthly Amortization')).not.toBeInTheDocument()
  })

  it('shows no preview until a downpayment and terms are entered', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Downpayment'), '100000')

    expect(screen.queryByText('Monthly Amortization')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '48')

    expect(await screen.findByText('Monthly Amortization')).toBeInTheDocument()
    expect(screen.getByText('₱ 10,533.53')).toBeInTheDocument()
    expect(screen.getByText('₱ 400,000')).toBeInTheDocument()
  })

  it('recomputes the monthly amortization as the downpayment and terms change', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Downpayment'), '100000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '48')

    expect(await screen.findByText('₱ 10,533.53')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')

    expect(await screen.findByText('₱ 16,666.67')).toBeInTheDocument()
  })

  it('hides the preview when the downpayment exceeds the TCP', async () => {
    const user = userEvent.setup()

    render(<ComputationModal lot={lot} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Downpayment'), '600000')
    await user.selectOptions(screen.getByLabelText('Terms of Payment'), '24')

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