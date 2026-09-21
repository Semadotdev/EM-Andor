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

  it('applies per-column alignment to headers and cells', () => {
    const alignedColumns = [
      { key: 'name', header: 'Name', align: 'center' },
      { key: 'rate', header: 'Rate', align: 'right' },
      { key: 'note', header: 'Note', align: 'left' },
      { key: 'extra', header: 'Extra' },
    ]

    render(
      <DataTable
        columns={alignedColumns}
        rows={[{ id: '1', name: 'Ana', rate: '3%', note: 'steady', extra: 'plain' }]}
        getRowKey={getRowKey}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveClass('text-center')
    expect(screen.getByText('Ana')).toHaveClass('text-center')
    expect(screen.getByRole('columnheader', { name: 'Rate' })).toHaveClass('text-right')
    expect(screen.getByText('3%')).toHaveClass('text-right')
    expect(screen.getByRole('columnheader', { name: 'Note' })).toHaveClass('text-left')
    expect(screen.getByText('steady')).toHaveClass('text-left')
    expect(screen.getByRole('columnheader', { name: 'Extra' })).not.toHaveClass('text-center', 'text-right')
    expect(screen.getByText('plain')).not.toHaveClass('text-center', 'text-right')
  })

  it('adds whitespace-nowrap to columns with noWrap', () => {
    const wrappedColumns = [
      { key: 'actions', header: 'Actions', align: 'right', noWrap: true },
      { key: 'note', header: 'Note' },
    ]

    render(
      <DataTable
        columns={wrappedColumns}
        rows={[{ id: '1', actions: 'Mark Paid', note: 'steady' }]}
        getRowKey={getRowKey}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass('whitespace-nowrap', 'text-right')
    expect(screen.getByText('Mark Paid')).toHaveClass('whitespace-nowrap')
    expect(screen.getByText('steady')).not.toHaveClass('whitespace-nowrap')
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

  describe('pagination', () => {
    const manyRows = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      name: `Buyer ${index + 1}`,
      status: 'available',
      rate: '1%',
    }))

    it('slices the rows and pages through them', async () => {
      const user = userEvent.setup()

      render(<DataTable columns={columns} rows={manyRows} getRowKey={getRowKey} pageSize={10} />)

      expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument()
      expect(screen.getByText('Buyer 10')).toBeInTheDocument()
      expect(screen.queryByText('Buyer 11')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Next page' }))

      expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument()
      expect(screen.getByText('Buyer 11')).toBeInTheDocument()
      expect(screen.queryByText('Buyer 1')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('slices the mobile cards with the same page', async () => {
      const user = userEvent.setup()

      render(
        <DataTable
          columns={columns}
          rows={manyRows}
          getRowKey={getRowKey}
          pageSize={10}
          mobileCard={(row) => <p>card {row.name}</p>}
        />,
      )

      expect(screen.getByText('card Buyer 1')).toBeInTheDocument()
      expect(screen.queryByText('card Buyer 11')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Next page' }))

      expect(screen.getByText('card Buyer 11')).toBeInTheDocument()
      expect(screen.queryByText('card Buyer 1')).not.toBeInTheDocument()
    })

    it('resets to the first page when the rows array changes', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <DataTable columns={columns} rows={manyRows} getRowKey={getRowKey} pageSize={10} />,
      )

      await user.click(screen.getByRole('button', { name: 'Next page' }))
      expect(screen.getByText('Buyer 11')).toBeInTheDocument()

      rerender(<DataTable columns={columns} rows={[...manyRows]} getRowKey={getRowKey} pageSize={10} />)

      expect(screen.getByText('Buyer 1')).toBeInTheDocument()
      expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument()
    })

    it('clamps the page when rows shrink below the current page', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <DataTable columns={columns} rows={manyRows} getRowKey={getRowKey} pageSize={10} />,
      )

      await user.click(screen.getByRole('button', { name: 'Next page' }))
      expect(screen.getByText('Buyer 11')).toBeInTheDocument()

      rerender(<DataTable columns={columns} rows={manyRows.slice(0, 3)} getRowKey={getRowKey} pageSize={10} />)

      expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()
      expect(screen.getByText('Buyer 1')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('renders every row and no pagination when pageSize is zero', () => {
      render(<DataTable columns={columns} rows={manyRows} getRowKey={getRowKey} pageSize={0} />)

      expect(screen.getByText('Buyer 12')).toBeInTheDocument()
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
    })

    it('offers a rows-per-page selector when options are provided', async () => {
      const user = userEvent.setup()

      render(
        <DataTable
          columns={columns}
          rows={manyRows}
          getRowKey={getRowKey}
          pageSize={10}
          pageSizeOptions={[10, 25]}
        />,
      )

      await user.selectOptions(screen.getByLabelText('Rows per page'), '25')

      expect(screen.getByText('Showing 1–12 of 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('shows no pagination for the loading and empty paths', () => {
      const { rerender } = render(
        <DataTable columns={columns} rows={[]} getRowKey={getRowKey} state="loading" />,
      )

      expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()

      rerender(<DataTable columns={columns} rows={[]} getRowKey={getRowKey} />)

      expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    })
  })
})
