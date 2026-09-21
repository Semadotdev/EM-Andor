import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import Dashboard from './Dashboard.jsx'

vi.mock('./DashboardStats.jsx', () => ({
  default: ({ onJumpToInquiries }) => (
    <div>
      <span>StatsPanel</span>
      <button onClick={onJumpToInquiries}>View inquiries</button>
    </div>
  ),
}))

vi.mock('./AgentStats.jsx', () => ({
  default: ({ agent, downlineCount }) => (
    <span>
      AgentStatsPanel {agent.name} {downlineCount}
    </span>
  ),
}))

const admin = { id: 'admin1', name: 'Admin', role: 'admin' }
const agent = { id: 'a1', name: 'Ana', role: 'sub_agent' }

function renderDashboard({ currentAgent, downline = [] }) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<Outlet context={{ agent: currentAgent, downline }} />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/inquiries" element={<p>InquiriesPage</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows the admin stats and jumps to inquiries', async () => {
    const user = userEvent.setup()

    renderDashboard({ currentAgent: admin })

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('StatsPanel')).toBeInTheDocument()
    expect(screen.queryByText(/AgentStatsPanel/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View inquiries' }))

    expect(await screen.findByText('InquiriesPage')).toBeInTheDocument()
  })

  it('shows the agent stats and quick links', () => {
    renderDashboard({ currentAgent: agent, downline: [{ id: 'a2' }] })

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText(/AgentStatsPanel Ana 1/)).toBeInTheDocument()
    expect(screen.queryByText('StatsPanel')).not.toBeInTheDocument()

    const links = [
      ['Available Lots', '/admin/lots'],
      ['My Sales', '/admin/sales'],
      ['My Commissions', '/admin/my-commissions'],
      ['My Downline', '/admin/downline'],
    ]
    for (const [label, href] of links) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href)
    }
  })

  it('hides the downline quick link when the downline is empty', () => {
    renderDashboard({ currentAgent: agent, downline: [] })

    expect(screen.queryByRole('link', { name: /My Downline/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Available Lots/ })).toBeInTheDocument()
  })

  it('shows the downline quick link when the downline is not empty', () => {
    renderDashboard({ currentAgent: agent, downline: [{ id: 'a2' }] })

    expect(screen.getByRole('link', { name: /My Downline/ })).toBeInTheDocument()
  })
})
