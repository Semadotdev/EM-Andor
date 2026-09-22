import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from './Pagination.jsx'

const noop = () => {}

const renderPagination = (props = {}) =>
  render(<Pagination page={2} totalPages={5} onPageChange={noop} total={100} from={11} to={20} {...props} />)

describe('Pagination', () => {
  it('announces the visible range and the current page', () => {
    renderPagination()

    const range = screen.getByText('Showing 11–20 of 100')
    expect(range).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('calls onPageChange from the previous and next buttons', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()

    renderPagination({ onPageChange })

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables previous on the first page and next on the last page', () => {
    const { rerender } = renderPagination({ page: 1, from: 1, to: 10 })

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

    rerender(<Pagination page={5} totalPages={5} onPageChange={noop} total={100} from={91} to={100} />)

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('stacks the range summary below the prev/next controls on mobile', () => {
    renderPagination()

    const summary = screen.getByText('Showing 11–20 of 100').closest('div')
    const nav = screen.getByRole('button', { name: 'Previous page' }).parentElement
    const root = summary.parentElement

    expect(root).toHaveClass('flex-col', 'sm:flex-row')
    expect(nav).toHaveClass('order-1', 'sm:order-2')
    expect(summary).toHaveClass('order-2', 'sm:order-1')
    expect(summary.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('styles the buttons like the existing pagination control', () => {
    renderPagination()

    expect(screen.getByRole('button', { name: 'Next page' })).toHaveClass(
      'rounded-md',
      'border',
      'border-mist',
      'text-sm',
      'font-semibold',
      'disabled:opacity-40',
    )
  })

  it('hides the rows-per-page selector when no handler is provided', () => {
    renderPagination()

    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument()
  })

  it('changes the page size through the selector', async () => {
    const onPageSizeChange = vi.fn()
    const user = userEvent.setup()

    renderPagination({ pageSize: 10, onPageSizeChange })

    const select = screen.getByLabelText('Rows per page')
    expect(select).toHaveValue('10')

    await user.selectOptions(select, '25')
    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })
})
