import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminInquiries from './AdminInquiries.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchInquiries: vi.fn(),
  setInquiryRead: vi.fn(),
  deleteInquiry: vi.fn(),
  bulkDeleteInquiries: vi.fn(),
  bulkSetInquiryRead: vi.fn(),
}))

vi.mock('../../lib/csv.js', () => ({
  exportToCSV: vi.fn(),
}))

import { fetchInquiries, setInquiryRead, deleteInquiry, bulkDeleteInquiries, bulkSetInquiryRead } from '../../lib/api.js'
import { exportToCSV } from '../../lib/csv.js'

const sample = [
  { id: 'q1', name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567', project_type: 'Residential Construction', message: 'Build a house', is_read: false, created_at: '2026-08-16T01:00:00Z' },
  { id: 'q2', name: 'Maria Santos', email: 'maria@example.com', phone: '09181234567', project_type: null, message: 'Lot inquiry', is_read: true, created_at: '2026-08-16T02:00:00Z' },
]

const findTable = () => screen.findByRole('table')

describe('AdminInquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchInquiries.mockResolvedValue({ data: sample, count: sample.length })
  })

  it('lists inquiries with names and types', async () => {
    render(<AdminInquiries />)

    const table = await findTable()
    expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(within(table).getByText('Maria Santos')).toBeInTheDocument()
    expect(within(table).getByText('Residential Construction')).toBeInTheDocument()
  })

  it('shows contact details and the full message', async () => {
    render(<AdminInquiries />)

    const table = await findTable()
    expect(within(table).getByText('maria@example.com')).toBeInTheDocument()
    expect(within(table).getByText('09181234567')).toBeInTheDocument()
    expect(within(table).getByText('Lot inquiry')).toBeInTheDocument()
  })

  it('marks an unread inquiry as read', async () => {
    setInquiryRead.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const table = await findTable()
    const readButtons = within(table).getAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(setInquiryRead).toHaveBeenCalledWith('q1', true)
    expect(within(table).getAllByRole('button', { name: 'Mark unread' })).toHaveLength(2)
    expect(await screen.findByText('Inquiry marked as read.')).toBeInTheDocument()
  })

  it('deletes an inquiry after confirmation', async () => {
    deleteInquiry.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const table = await findTable()
    const mariaRow = within(table).getByText('Maria Santos').closest('tr')
    const deleteButton = within(mariaRow).getByRole('button', { name: 'Delete' })
    await user.click(deleteButton)

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(deleteInquiry).toHaveBeenCalledWith('q2')
    expect(await screen.findByText('Inquiry deleted.')).toBeInTheDocument()
  })

  it('reverts the read toggle on failure and shows an error', async () => {
    setInquiryRead.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const table = await findTable()
    const readButtons = within(table).getAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(await screen.findByText(/Could not update status/)).toBeInTheDocument()
    expect(within(table).getAllByRole('button', { name: 'Mark read' })).toHaveLength(1)
  })

  it('ignores a read toggle while a status request is in flight', async () => {
    let resolve
    setInquiryRead.mockReturnValue(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const table = await findTable()
    const readButtons = within(table).getAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(setInquiryRead).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect(within(table).getAllByRole('button', { name: 'Mark unread' })).toHaveLength(2))
  })

  it('keeps an inquiry when delete fails and shows an error', async () => {
    deleteInquiry.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const table = await findTable()
    const deleteButtons = within(table).getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/Could not delete inquiry/)).toBeInTheDocument()
    expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument()
  })

  it('shows a retry state when loading fails', async () => {
    fetchInquiries.mockResolvedValue({ data: sample, count: sample.length })
    fetchInquiries.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    const table = await findTable()
    expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument()
  })

  it('shows bulk action toolbar when items are selected', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await findTable()
    const checkboxes = screen.getAllByRole('checkbox', { name: /Select/i })
    await user.click(checkboxes[1])

    expect(screen.getByText('1 item selected')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('selects all inquiries with header checkbox', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await findTable()
    const selectAll = screen.getByRole('checkbox', { name: 'Select all inquiries' })
    await user.click(selectAll)

    expect(screen.getByText('2 items selected')).toBeInTheDocument()
  })

  it('bulk deletes inquiries after confirmation', async () => {
    bulkDeleteInquiries.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await findTable()
    const selectAll = screen.getByRole('checkbox', { name: 'Select all inquiries' })
    await user.click(selectAll)

    await user.click(screen.getByText('Delete Selected'))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All' }))

    expect(bulkDeleteInquiries).toHaveBeenCalledWith(['q1', 'q2'])
    expect(await screen.findByText('Selected inquiries deleted.')).toBeInTheDocument()
  })

  it('bulk marks selected inquiries as read', async () => {
    bulkSetInquiryRead.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await findTable()
    await user.click(screen.getByRole('checkbox', { name: 'Select all inquiries' }))
    await user.click(screen.getByRole('button', { name: 'Mark All Read' }))

    expect(bulkSetInquiryRead).toHaveBeenCalledWith(['q1', 'q2'], true)
    expect(await screen.findByText('Inquiries marked as read.')).toBeInTheDocument()
  })

  it('exports CSV with all inquiries', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await findTable()
    await user.click(screen.getByText('Export CSV'))

    expect(exportToCSV).toHaveBeenCalledWith(
      ['Name', 'Email', 'Phone', 'Project Type', 'Property', 'Message', 'Read Status', 'Created Date'],
      expect.arrayContaining([
        expect.arrayContaining(['Juan Dela Cruz']),
        expect.arrayContaining(['Maria Santos']),
      ]),
      expect.stringMatching(/inquiries-export-\d{4}-\d{2}-\d{2}\.csv/)
    )
  })
})
