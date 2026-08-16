import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminInquiries from './AdminInquiries.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchInquiries: vi.fn(),
  setInquiryRead: vi.fn(),
  deleteInquiry: vi.fn(),
}))

import { fetchInquiries, setInquiryRead, deleteInquiry } from '../../lib/api.js'

const sample = [
  { id: 'q1', name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567', project_type: 'Residential Construction', message: 'Build a house', is_read: false, created_at: '2026-08-16T01:00:00Z' },
  { id: 'q2', name: 'Maria Santos', email: 'maria@example.com', phone: '09181234567', project_type: null, message: 'Lot inquiry', is_read: true, created_at: '2026-08-16T02:00:00Z' },
]

describe('AdminInquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchInquiries.mockResolvedValue(sample)
  })

  it('lists inquiries with names and types', async () => {
    render(<AdminInquiries />)

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('Residential Construction')).toBeInTheDocument()
  })

  it('marks an unread inquiry as read', async () => {
    setInquiryRead.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const readButtons = await screen.findAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(setInquiryRead).toHaveBeenCalledWith('q1', true)
    expect(screen.getAllByRole('button', { name: 'Mark unread' })).toHaveLength(2)
  })

  it('deletes an inquiry after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteInquiry.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(deleteInquiry).toHaveBeenCalledWith('q1')
    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('expands an inquiry to show full details', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await user.click(await screen.findByText('Maria Santos'))

    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.getByText('09181234567')).toBeInTheDocument()
    expect(screen.getByText('Lot inquiry')).toBeInTheDocument()
  })

  it('reverts the read toggle on failure and shows an error', async () => {
    setInquiryRead.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const readButtons = await screen.findAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(await screen.findByText(/Could not update status/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Mark read' })).toHaveLength(1)
  })

  it('ignores a read toggle while a status request is in flight', async () => {
    let resolve
    setInquiryRead.mockReturnValue(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const readButtons = await screen.findAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(setInquiryRead).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Mark unread' })).toHaveLength(2))
  })

  it('keeps an inquiry when delete fails and shows an error', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteInquiry.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(await screen.findByText(/Could not delete inquiry/)).toBeInTheDocument()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('shows a retry state when loading fails', async () => {
    fetchInquiries.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminInquiries />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument()
  })
})
