import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button.jsx'

describe('Button', () => {
  it('renders an anchor when href is provided', () => {
    render(<Button href="#contact">Contact</Button>)

    const link = screen.getByRole('link', { name: 'Contact' })
    expect(link).toHaveAttribute('href', '#contact')
    expect(link).toHaveClass('btn', 'btn-gold')
  })

  it('renders a button when href is absent', () => {
    render(<Button>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('renders a button when type is provided even with an href', () => {
    render(
      <Button href="#contact" type="submit">
        Submit
      </Button>,
    )

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
  })

  it('maps the primary variant to the gold button styles', () => {
    render(<Button variant="primary">Primary</Button>)

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('btn-gold')
  })

  it('maps the secondary, danger, ghost and link variants', () => {
    const { unmount } = render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-mist', 'bg-white')
    unmount()

    const { unmount: unmountDanger } = render(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('border-red-200', 'text-red-700')
    unmountDanger()

    const { unmount: unmountGhost } = render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('text-ink/70')
    unmountGhost()

    render(<Button variant="link">Link</Button>)
    expect(screen.getByRole('button', { name: 'Link' })).not.toHaveClass('btn')
  })

  it('keeps the public page variants working on anchors', () => {
    const { unmount } = render(
      <Button href="#services" variant="outline-dark">
        Services
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Services' })).toHaveClass('btn-outline-dark')
    unmount()

    render(
      <Button href="#services" variant="outline-light">
        Light
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Light' })).toHaveClass('btn-outline-light')
  })

  it('supports the compact size', () => {
    render(<Button size="sm">Small</Button>)

    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('px-3', 'py-1.5', 'text-xs')
  })

  it('disables the button and blocks clicks', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()

    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-60')

    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
