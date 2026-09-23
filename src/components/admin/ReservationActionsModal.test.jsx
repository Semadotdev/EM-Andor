import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReservationActionsModal from './ReservationActionsModal.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

const lot = {
  id: 'l1',
  name: 'Block 1 Lot 1',
  block_no: '1',
  lot_no: '1',
}

describe('ReservationActionsModal', () => {
  it('renders the chooser with the lot label and both actions', async () => {
    render(
      <ReservationActionsModal
        lot={lot}
        onClose={vi.fn()}
        onDownpayment={vi.fn()}
        onCancelReservation={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Reservation actions' })).toBeInTheDocument()
    expect(screen.getByText(/Block 1 Lot 1 is reserved/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make Downpayment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Reservation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('falls back to a generated label when the lot has no name', async () => {
    render(
      <ReservationActionsModal
        lot={{ block_no: '2', lot_no: '9' }}
        onClose={vi.fn()}
        onDownpayment={vi.fn()}
        onCancelReservation={vi.fn()}
      />,
    )

    expect(screen.getByText(/Block 2 Lot 9 is reserved/)).toBeInTheDocument()
  })

  it('fires onDownpayment and does not close the modal on its own', async () => {
    const onDownpayment = vi.fn()
    const user = userEvent.setup()

    render(
      <ReservationActionsModal
        lot={lot}
        onClose={vi.fn()}
        onDownpayment={onDownpayment}
        onCancelReservation={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Make Downpayment' }))

    expect(onDownpayment).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Reservation actions' })).toBeInTheDocument()
  })

  it('fires onCancelReservation and does not close the modal on its own', async () => {
    const onCancelReservation = vi.fn()
    const user = userEvent.setup()

    render(
      <ReservationActionsModal
        lot={lot}
        onClose={vi.fn()}
        onDownpayment={vi.fn()}
        onCancelReservation={onCancelReservation}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel Reservation' }))

    expect(onCancelReservation).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Reservation actions' })).toBeInTheDocument()
  })

  it('closes the modal when the cancel button is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <ReservationActionsModal
        lot={lot}
        onClose={onClose}
        onDownpayment={vi.fn()}
        onCancelReservation={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes the modal on Escape', async () => {
    const onClose = vi.fn()

    render(
      <ReservationActionsModal
        lot={lot}
        onClose={onClose}
        onDownpayment={vi.fn()}
        onCancelReservation={vi.fn()}
      />,
    )

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})