import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from './ConfirmModal.jsx'

const base = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Delete Lot',
  message: 'This cannot be undone.',
}

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmModal {...base} open={false} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an alertdialog with the title and message', () => {
    render(<ConfirmModal {...base} />)

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Lot' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('uses the default labels and calls the callbacks', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(<ConfirmModal {...base} onClose={onClose} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('supports a custom confirm label', () => {
    render(<ConfirmModal {...base} confirmLabel="Delete" />)

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows Processing… and disables the buttons while loading', () => {
    render(<ConfirmModal {...base} loading />)

    expect(screen.getByRole('button', { name: 'Processing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('styles the confirm button red when destructive', () => {
    render(<ConfirmModal {...base} destructive confirmLabel="Delete" />)

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600')
  })

  it('auto-focuses the confirm button', async () => {
    render(<ConfirmModal {...base} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus())
  })

  it('closes on a backdrop click unless loading', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(<ConfirmModal {...base} onClose={onClose} />)
    await user.click(screen.getByRole('alertdialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<ConfirmModal {...base} onClose={onClose} loading />)
    await user.click(screen.getByRole('alertdialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders children below the message', () => {
    render(
      <ConfirmModal {...base}>
        <p role="alert">Commission is already paid.</p>
      </ConfirmModal>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Commission is already paid.')
  })
})
