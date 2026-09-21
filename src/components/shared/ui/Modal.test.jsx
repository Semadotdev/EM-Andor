import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal.jsx'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        Body
      </Modal>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title and points aria-labelledby at it', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit lot">
        Body
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    const heading = screen.getByRole('heading', { name: 'Edit lot' })

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id)
  })

  it('falls back to aria-label when there is no title', () => {
    render(
      <Modal open onClose={vi.fn()} label="Buyer ledger">
        Body
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Buyer ledger' })).toBeInTheDocument()
  })

  it('applies the requested size', () => {
    render(
      <Modal open onClose={vi.fn()} title="Large" size="lg">
        Body
      </Modal>,
    )

    expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl')
  })

  it('renders the footer slot', () => {
    render(
      <Modal open onClose={vi.fn()} title="Footer" footer={<button>Save</button>}>
        Body
      </Modal>,
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(
      <Modal open onClose={onClose} title="Escape">
        Body
      </Modal>,
    )

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop click but not when clicking the dialog', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal open onClose={onClose} title="Backdrop">
        Body
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    await user.click(dialog.parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes from the header close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal open onClose={onClose} title="Close button">
        Body
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('blocks the backdrop and close button while busy', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal open onClose={onClose} title="Busy" busy>
        Body
      </Modal>,
    )

    await user.click(screen.getByRole('dialog').parentElement)

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
  })

  it('focuses the dialog on open and restores focus on close', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Focus">
            Body
          </Modal>
        </>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('traps Tab and Shift+Tab within the dialog', async () => {
    const user = userEvent.setup()

    render(
      <Modal open onClose={vi.fn()} title="Trap">
        <button>First</button>
        <button>Last</button>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'Last' })

    dialog.focus()
    await user.tab()
    expect(close).toHaveFocus()

    last.focus()
    await user.tab()
    expect(close).toHaveFocus()

    close.focus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('only closes the topmost modal on Escape', async () => {
    const onCloseOuter = vi.fn()
    const onCloseInner = vi.fn()

    render(
      <>
        <Modal open onClose={onCloseOuter} title="Outer">
          outer
        </Modal>
        <Modal open onClose={onCloseInner} title="Inner">
          inner
        </Modal>
      </>,
    )

    await userEvent.keyboard('{Escape}')

    expect(onCloseInner).toHaveBeenCalledTimes(1)
    expect(onCloseOuter).not.toHaveBeenCalled()
  })

  it('unwinds the modal stack when the topmost modal closes', async () => {
    const onOuterClose = vi.fn()

    function Harness() {
      const [outerOpen, setOuterOpen] = useState(true)
      const [innerOpen, setInnerOpen] = useState(true)
      return (
        <>
          <Modal
            open={outerOpen}
            onClose={() => {
              setOuterOpen(false)
              onOuterClose()
            }}
            title="Outer"
          >
            outer
          </Modal>
          <Modal open={innerOpen} onClose={() => setInnerOpen(false)} title="Inner">
            inner
          </Modal>
        </>
      )
    }

    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('inner')).not.toBeInTheDocument()
    expect(onOuterClose).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    expect(onOuterClose).toHaveBeenCalledTimes(1)
  })
})
