import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminActivityLog from './AdminActivityLog.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchActivityLog: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))

import { fetchActivityLog } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'

const sample = [
  {
    id: 'a1',
    entity_type: 'property',
    entity_id: '550e8400-e29b-41d4-a716-446655440000',
    action: 'create',
    details: {},
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a2',
    entity_type: 'inquiry',
    entity_id: '550e8400-e29b-41d4-a716-446655440001',
    action: 'update',
    details: { fields: ['is_read'] },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a3',
    entity_type: 'cms',
    entity_id: '550e8400-e29b-41d4-a716-446655440002',
    action: 'delete',
    details: {},
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
]

describe('AdminActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchActivityLog.mockResolvedValue({ data: sample, count: sample.length })
  })

  it('renders log entries', async () => {
    render(<AdminActivityLog />)

    expect(await screen.findByText('Showing 3 of 3 entries')).toBeInTheDocument()
    expect(screen.getAllByText('Create').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Update').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Delete').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Properties').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Inquiries').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('CMS').length).toBeGreaterThanOrEqual(1)
  })

  it('shows filter dropdowns and search', async () => {
    render(<AdminActivityLog />)

    await screen.findByRole('table')
    expect(screen.getByLabelText('Search by record ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by action')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by table')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort activity log')).toBeInTheDocument()
  })

  it('handles action type filter', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'create')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', page: 1 })
      )
    })
  })

  it('handles table filter', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Filter by table'), 'property')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ entity_type: 'property', page: 1 })
      )
    })
  })

  it('handles search input', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Search by record ID'), 'abc')
    vi.advanceTimersByTime(300)

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'abc', page: 1 })
      )
    })
    vi.useRealTimers()
  })

  it('handles sort change', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Sort activity log'), 'oldest')

    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'oldest', page: 1 })
      )
    })
  })

  it('shows result count', async () => {
    render(<AdminActivityLog />)

    expect(await screen.findByText('Showing 3 of 3 entries')).toBeInTheDocument()
  })

  it('shows loading state', async () => {
    fetchActivityLog.mockReturnValue(new Promise(() => {}))

    render(<AdminActivityLog />)

    expect(screen.getByText('Loading activity log…')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    fetchActivityLog.mockResolvedValue({ data: [], count: 0 })

    render(<AdminActivityLog />)

    expect(await screen.findByText('No activity recorded yet.')).toBeInTheDocument()
  })

  it('shows filtered empty state', async () => {
    fetchActivityLog.mockResolvedValue({ data: [], count: 0 })
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByText('No activity recorded yet.')

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'create')

    expect(await screen.findByText('No log entries match your filters.')).toBeInTheDocument()
  })

  it('export button works', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Action', 'Table', 'Record ID', 'Timestamp', 'Details'],
      expect.arrayContaining([
        expect.arrayContaining(['create']),
        expect.arrayContaining(['update']),
        expect.arrayContaining(['delete']),
      ]),
      expect.stringMatching(/activity-log-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })

  it('shows retry state when loading fails', async () => {
    fetchActivityLog.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminActivityLog />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Showing 3 of 3 entries')).toBeInTheDocument()
  })

  it('clears filters when Clear filters is clicked', async () => {
    const user = userEvent.setup()

    render(<AdminActivityLog />)
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'delete')
    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete' })
      )
    })

    await user.click(screen.getByText('Clear filters'))
    await waitFor(() => {
      expect(fetchActivityLog).toHaveBeenCalledWith(
        expect.not.objectContaining({ action: 'delete' })
      )
    })
  })
})
