import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader.jsx'

describe('PageHeader', () => {
  it('renders the title as a level-one heading', () => {
    render(<PageHeader title="Commissions" />)

    const heading = screen.getByRole('heading', { level: 1, name: 'Commissions' })
    expect(heading).toHaveClass('font-display', 'text-brand-deep')
  })

  it('renders the optional description', () => {
    render(<PageHeader title="Commissions" description="Track agent payouts." />)

    expect(screen.getByText('Track agent payouts.')).toBeInTheDocument()
  })

  it('omits the description when not provided', () => {
    const { container } = render(<PageHeader title="Commissions" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('renders the actions slot on the right', () => {
    render(<PageHeader title="Projects" actions={<button>New Project</button>} />)

    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
  })
})
