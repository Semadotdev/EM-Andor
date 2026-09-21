import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardStats from './DashboardStats.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchPropertyStats: vi.fn(),
  fetchInquiryStats: vi.fn(),
  fetchRecentInquiries: vi.fn(),
}))

import { fetchPropertyStats, fetchInquiryStats, fetchRecentInquiries } from '../../lib/api.js'

describe('DashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPropertyStats.mockResolvedValue({
      total: 5,
      projects: 3,
      pinned: 2,
      types: { 'residential lot': 3, 'commercial lot': 2 },
    })
    fetchInquiryStats.mockResolvedValue({ total: 12, unread: 4 })
    fetchRecentInquiries.mockResolvedValue([
      { id: 'q1', name: 'Juan', project_type: 'Residential', is_read: false, created_at: '2026-08-18T01:00:00Z' },
      { id: 'q2', name: 'Maria', project_type: null, is_read: true, created_at: '2026-08-17T02:00:00Z' },
    ])
  })

  it('renders stat cards with correct counts', async () => {
    render(<DashboardStats />)

    expect(await screen.findByText('5')).toBeInTheDocument()
    expect(screen.getByText('Total Lots')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Total Inquiries')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Unread')).toBeInTheDocument()
  })

  it('renders property type breakdown', async () => {
    render(<DashboardStats />)

    expect(await screen.findByText('Residential Lot: 3')).toBeInTheDocument()
    expect(screen.getByText('Commercial Lot: 2')).toBeInTheDocument()
  })

  it('renders recent inquiries list', async () => {
    render(<DashboardStats />)

    expect(await screen.findByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('Residential')).toBeInTheDocument()
  })

  it('calls onJumpToInquiries when View all is clicked', async () => {
    const onJump = vi.fn()
    const user = userEvent.setup()

    render(<DashboardStats onJumpToInquiries={onJump} />)

    await screen.findByText('Juan')
    await user.click(screen.getByText('View all'))
    expect(onJump).toHaveBeenCalled()
  })

  it('shows loading state initially', () => {
    fetchPropertyStats.mockReturnValue(new Promise(() => {}))
    fetchInquiryStats.mockReturnValue(new Promise(() => {}))
    fetchRecentInquiries.mockReturnValue(new Promise(() => {}))

    render(<DashboardStats />)

    expect(screen.getByText('Loading stats…')).toBeInTheDocument()
  })
})
