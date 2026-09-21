import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState, ErrorState, LoadingState } from './States.jsx'

describe('States', () => {
  it('renders an empty state message and children', () => {
    render(
      <EmptyState message="No commissions yet.">
        <button>Refresh</button>
      </EmptyState>,
    )

    expect(screen.getByText('No commissions yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('renders a loading state with a default label', () => {
    render(<LoadingState />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('renders a loading state with a custom label', () => {
    render(<LoadingState label="Loading lots…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading lots…')
  })

  it('renders an error state with the default message and no retry button', () => {
    render(<ErrorState />)

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('renders an error state with a custom message and retry handler', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()

    render(<ErrorState message="Could not load lots." onRetry={onRetry} />)

    expect(screen.getByText('Could not load lots.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
