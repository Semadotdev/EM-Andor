import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast.jsx'

function Trigger() {
  const { showToast } = useToast()
  const sequence = useRef(0)
  return (
    <button
      onClick={() => {
        sequence.current += 1
        showToast(`Saved ${sequence.current}`)
      }}
    >
      Save
    </button>
  )
}

function renderProvider() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast inside the polite live region', () => {
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const toast = screen.getByText('Saved 1')
    expect(toast).toBeInTheDocument()
    expect(toast.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('auto-dismisses after four seconds', () => {
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Saved 1')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(screen.getByText('Saved 1')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument()
  })

  it('dismisses manually', () => {
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument()
  })

  it('keeps independent timers for stacked toasts', () => {
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument()
    expect(screen.getByText('Saved 2')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('Saved 2')).not.toBeInTheDocument()
  })

  it('returns both showToast and dismissToast from useToast', () => {
    let api
    function Capture() {
      api = useToast()
      return null
    }

    render(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
    )

    expect(typeof api.showToast).toBe('function')
    expect(typeof api.dismissToast).toBe('function')
  })

  it('throws when useToast is used outside a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Trigger />)).toThrow('useToast must be used within a ToastProvider')

    error.mockRestore()
  })
})
