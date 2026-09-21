import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from './StatCard.jsx'

describe('StatCard', () => {
  it('renders the icon, value and uppercase label', () => {
    render(<StatCard icon={<span data-testid="icon">★</span>} label="Total Lots" value={42} />)

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Total Lots')).toHaveClass('uppercase')
  })

  it('applies the card styling', () => {
    const { container } = render(<StatCard icon={null} label="Total" value={1} />)

    expect(container.firstChild).toHaveClass('rounded-lg', 'border-mist', 'bg-white', 'p-5')
  })

  it('uses the brand tone by default and supports other tones', () => {
    const { unmount } = render(<StatCard icon={null} label="Brand" value={1} />)
    expect(screen.getByText('Brand').parentElement.previousElementSibling).toHaveClass('bg-brand/10')
    unmount()

    render(<StatCard icon={null} label="Alert" value={2} tone="red" />)
    expect(screen.getByText('Alert').parentElement.previousElementSibling).toHaveClass('bg-red-100')
  })
})
