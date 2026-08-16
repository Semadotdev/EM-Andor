import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
