import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrandLoader from './BrandLoader.jsx'

describe('BrandLoader', () => {
  it('renders the fullscreen branded loader by default', () => {
    render(<BrandLoader />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('fixed', 'inset-0', 'bg-brand-deep')
    expect(status).toHaveTextContent('Loading…')
    expect(screen.getByText('Andor')).toBeInTheDocument()
    expect(screen.getByText('Builders & Associates')).toBeInTheDocument()
    expect(status.querySelector('.animate-brand-spin')).not.toBeNull()
    expect(status.querySelector('.animate-brand-progress')).not.toBeNull()
  })

  it('accepts a custom label for the fullscreen loader', () => {
    render(<BrandLoader label="Preparing dashboard…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Preparing dashboard…')
  })

  it('renders compact mode with an inline spinner and label', () => {
    render(<BrandLoader fullscreen={false} label="Loading lots…" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading lots…')
    expect(status).not.toHaveClass('fixed')
    expect(status.querySelector('.animate-brand-spin')).not.toBeNull()
  })

  it('renders compact mode without a label', () => {
    render(<BrandLoader fullscreen={false} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })
})
