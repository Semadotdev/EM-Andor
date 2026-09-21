import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable from './DataTable.jsx'

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status', render: (row) => <span>badge:{row.status}</span> },
  { key: 'rate', header: 'Rate', hideBelow: 'sm', className: 'text-right' },
]

const rows = [
  { id: '1', name: 'Ana', status: 'available', rate: '3%' },
  { id: '2', name: 'Ben', status: 'sold', rate: '1.5%' },
]

const getRowKey = (row) => row.id

describe('DataTable', () => {
  it('renders headers with scope="col" and the row cells', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} />)

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col')
    }

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('badge:available')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveClass('w-full')
  })

  it('renders all rows as table rows', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} />)

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1)
  })

  it('hides columns below the requested breakpoint', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} />)

    expect(screen.getByRole('columnheader', { name: 'Rate' })).toHaveClass(
      'hidden',
      'sm:table-cell',
      'text-right',
    )
    expect(screen.getByText('3%')).toHaveClass('hidden', 'sm:table-cell')
  })

  it('shows the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={getRowKey} />)

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('accepts a custom empty message', () => {
    render(
      <DataTable columns={columns} rows={[]} getRowKey={getRowKey} emptyMessage="No lots yet." />,
    )

    expect(screen.getByText('No lots yet.')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={getRowKey} state="loading" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.getByRole('table').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument()
  })

  it('shows an error state and retries', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()

    render(<DataTable columns={columns} rows={[]} getRowKey={getRowKey} state="error" onRetry={onRetry} />)

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders the footer slot', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={getRowKey} footer="2 records" />)

    expect(screen.getByText('2 records')).toBeInTheDocument()
  })

  it('renders mobile cards alongside the table when mobileCard is provided', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={getRowKey}
        mobileCard={(row) => <p>card {row.name}</p>}
      />,
    )

    expect(screen.getByText('card Ana')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('card Ana').closest('.md\\:hidden')).not.toBeNull()
    expect(screen.getByRole('table').closest('.hidden')).not.toBeNull()
  })
})
