import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminAgents from './AdminAgents.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn(),
  fetchSoldCounts: vi.fn(),
  setAgentActive: vi.fn(),
  updateAgent: vi.fn(),
  updateAgentAccount: vi.fn(),
  resetAgentAccountPassword: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn().mockResolvedValue([]),
  fetchTeamSales: vi.fn().mockResolvedValue([]),
}))
vi.mock('./CreateAgentModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Create agent">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { fetchAllAgents, fetchSoldCounts, resetAgentAccountPassword, setAgentActive, updateAgent, updateAgentAccount } from '../../lib/agents.js'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'

const admin = { id: 'admin1', name: 'Admin', email: 'a@x.com', role: 'admin', upline_id: null, is_active: true }
const sub = { id: 'a1', name: 'Ana Sub', email: 'ana@x.com', role: 'sub_agent', upline_id: null, is_active: true }
const recruit = { id: 'a2', name: 'Rico Recruit', email: 'rico@x.com', role: 'sub_agent', upline_id: 'a1', is_active: true }

describe('AdminAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([admin, sub, recruit])
    fetchSoldCounts.mockResolvedValue({})
    setAgentActive.mockResolvedValue({})
  })

  it('lists agents and expands nested levels through dropdown toggles', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    expect(await screen.findByText('Ana Sub')).toBeInTheDocument()
    expect(screen.queryByText('Rico Recruit')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Toggle Ana Sub downline' }))

    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.getAllByText('Sub Agent').length).toBeGreaterThanOrEqual(2)
  })

  it('collapses and expands the dropdown and shows sub agents of sub agents via a nested toggle', async () => {
    const user = userEvent.setup()
    const deep = { id: 'a3', name: 'Danny Deep', email: 'danny@x.com', role: 'sub_agent', upline_id: 'a2', is_active: true }
    fetchAllAgents.mockResolvedValue([admin, sub, recruit, deep])

    render(<AdminAgents />)

    const anaToggle = await screen.findByRole('button', { name: 'Toggle Ana Sub downline' })
    expect(anaToggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(anaToggle)
    expect(screen.getByRole('button', { name: 'Toggle Ana Sub downline' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.queryByText('Danny Deep')).not.toBeInTheDocument()
    expect(screen.getByText('Rico Recruit').closest('li').parentElement).toHaveStyle({ marginLeft: '20px' })

    await user.click(screen.getByRole('button', { name: 'Toggle Rico Recruit downline' }))
    expect(screen.getByText('Danny Deep')).toBeInTheDocument()
    expect(screen.getByText('Danny Deep').closest('li').parentElement).toHaveStyle({ marginLeft: '40px' })

    await user.click(screen.getByRole('button', { name: 'Toggle Ana Sub downline' }))
    expect(screen.queryByText('Rico Recruit')).not.toBeInTheDocument()
  })

  it('shows an eligible badge when promotion thresholds are met', async () => {
    const recruits = Array.from({ length: 5 }, (_, i) => ({ ...recruit, id: `r${i}`, name: `Recruit ${i}` }))
    fetchAllAgents.mockResolvedValue([admin, sub, ...recruits])
    fetchSoldCounts.mockResolvedValue({ a1: 5 })

    render(<AdminAgents />)

    expect(await screen.findByText('Eligible: Direct Agent')).toBeInTheDocument()
  })

  it('opens the create agent modal', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Create Agent' }))
    expect(screen.getByRole('dialog', { name: 'Create agent' })).toBeInTheDocument()
  })

  it('deactivates an agent from the profile tab after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate Account' }))

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }))

    expect(setAgentActive).toHaveBeenCalledWith('a1', false)
    expect(await screen.findByText('Agent deactivated.')).toBeInTheDocument()
  })

  it('keeps activation actions inside the profile tab and hides them for admins', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await screen.findByText('Ana Sub')
    expect(screen.queryByRole('button', { name: 'Deactivate Account' })).not.toBeInTheDocument()

    const adminRow = screen.getAllByText('Admin')[0].closest('li')
    await user.click(within(adminRow).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Admin details' })
    expect(within(dialog).getByRole('tab', { name: 'Commissions' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))
    expect(within(dialog).queryByRole('button', { name: 'Deactivate Account' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Activate Account' })).not.toBeInTheDocument()
  })

  it('shows sold lots and commissions on the commissions tab', async () => {
    const user = userEvent.setup()
    fetchTeamSales.mockResolvedValue([{ id: 's1', name: 'Lot A', price: 120000 }])
    fetchCommissions.mockResolvedValue([
      { id: 'c1', properties: { name: 'Lot A' }, rate: 0.03, amount: 3600, status: 'paid' },
    ])

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    expect(within(dialog).getByText('Sold Lots: 1')).toBeInTheDocument()
    expect(within(dialog).getByText('Lot A')).toBeInTheDocument()
    expect(within(dialog).getByText('Lot A · 3.00%')).toBeInTheDocument()
    expect(within(dialog).getAllByText(/₱ 3,600/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the upline chain and full downline on the agents tab', async () => {
    const user = userEvent.setup()
    const head = { id: 'h1', name: 'Cara Head', email: 'cara@x.com', role: 'agent_head', upline_id: null, is_active: true }
    const direct = { id: 'd1', name: 'Ben Direct', email: 'ben@x.com', role: 'direct_agent', upline_id: 'h1', is_active: true }
    const sub2 = { id: 'a4', name: 'Dee Sub', email: 'dee@x.com', role: 'sub_agent', upline_id: 'd1', is_active: true }
    fetchAllAgents.mockResolvedValue([admin, sub, recruit, head, direct, sub2])

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Toggle Cara Head downline' }))
    await user.click(await screen.findByRole('button', { name: 'Toggle Ben Direct downline' }))

    const deeRow = (await screen.findByText('Dee Sub')).closest('li')
    await user.click(within(deeRow).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Dee Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Agents' }))

    const upline = within(dialog).getByText('Upline').closest('div')
    expect(within(upline).getByText('Ben Direct')).toBeInTheDocument()
    expect(within(upline).getByText('Cara Head')).toBeInTheDocument()
    expect(within(upline).getByText('Direct Agent')).toBeInTheDocument()
    expect(within(upline).getByText('Agent Head')).toBeInTheDocument()

    const downlineSection = within(dialog).getByText('Downline').closest('div')
    expect(within(downlineSection).getByText('No downline yet.')).toBeInTheDocument()
  })

  it('toggles the agents tab into an org chart view', async () => {
    const user = userEvent.setup()
    const head = { id: 'h1', name: 'Cara Head', email: 'cara@x.com', role: 'agent_head', upline_id: null, is_active: true }
    const direct = { id: 'd1', name: 'Ben Direct', email: 'ben@x.com', role: 'direct_agent', upline_id: 'h1', is_active: true }
    const sub2 = { id: 'a4', name: 'Dee Sub', email: 'dee@x.com', role: 'sub_agent', upline_id: 'd1', is_active: true }
    const grandSub = { id: 'a5', name: 'Ella Grand', email: 'ella@x.com', role: 'sub_agent', upline_id: 'a4', is_active: true }
    fetchAllAgents.mockResolvedValue([admin, sub, recruit, head, direct, sub2, grandSub])
    fetchSoldCounts.mockResolvedValue({})

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Toggle Cara Head downline' }))
    await user.click(await screen.findByRole('button', { name: 'Toggle Ben Direct downline' }))

    const deeRow = (await screen.findByText('Dee Sub')).closest('li')
    await user.click(within(deeRow).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Dee Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Agents' }))
    await user.click(within(dialog).getByRole('button', { name: 'View org chart' }))

    expect(within(dialog).getByText('Cara Head')).toBeInTheDocument()
    expect(within(dialog).getByText('Ben Direct')).toBeInTheDocument()
    expect(within(dialog).getByText('Agent Head')).toBeInTheDocument()
    expect(within(dialog).getByText('Direct Agent')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Sub Agent').length).toBeGreaterThanOrEqual(2)
    expect(within(dialog).getByText('Selected')).toBeInTheDocument()
    expect(within(dialog).getByText('Ella Grand')).toBeInTheDocument()

    const headText = within(dialog).getByText('Cara Head')
    const ben = within(dialog).getByText('Ben Direct')
    const dee = within(dialog).getByText('Dee Sub')
    expect(headText.compareDocumentPosition(ben) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(ben.compareDocumentPosition(dee) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

    expect(within(dialog).getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Fit chart to width' })).toBeInTheDocument()
    expect(within(dialog).getByText('100%')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }))
    expect(within(dialog).getByText('110%')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }))
    expect(within(dialog).getByText('120%')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Zoom out' }))
    expect(within(dialog).getByText('110%')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'View list' }))
    expect(within(dialog).getByText('Upline')).toBeInTheDocument()
    expect(within(dialog).getByText('Downline')).toBeInTheDocument()
  })

  it('keeps a manual zoom level after fitting a wide org chart', async () => {
    const user = userEvent.setup()
    const head = { id: 'h1', name: 'Cara Head', email: 'cara@x.com', role: 'agent_head', upline_id: null, is_active: true }
    const direct = { id: 'd1', name: 'Ben Direct', email: 'ben@x.com', role: 'direct_agent', upline_id: 'h1', is_active: true }
    const sub2 = { id: 'a4', name: 'Dee Sub', email: 'dee@x.com', role: 'sub_agent', upline_id: 'd1', is_active: true }
    fetchAllAgents.mockResolvedValue([admin, sub, recruit, head, direct, sub2])
    fetchSoldCounts.mockResolvedValue({})

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Toggle Cara Head downline' }))
    await user.click(await screen.findByRole('button', { name: 'Toggle Ben Direct downline' }))

    const deeRow = (await screen.findByText('Dee Sub')).closest('li')
    await user.click(within(deeRow).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Dee Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Agents' }))
    await user.click(within(dialog).getByRole('button', { name: 'View org chart' }))

    const chart = dialog.querySelector('.min-w-max')
    const wrap = chart.parentElement
    expect(wrap.className).toMatch(/h-\[/)
    expect(wrap.className).not.toMatch(/max-h-\[/)
    Object.defineProperty(wrap, 'clientWidth', { value: 624, configurable: true })
    chart.getBoundingClientRect = () => ({
      width: 5000 * (parseFloat(chart.style.zoom) || 1),
      height: 100,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await user.click(within(dialog).getByRole('button', { name: 'Fit chart to width' }))
    expect(within(dialog).getByText('12%')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }))
    expect(within(dialog).getByText('22%')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }))
    expect(within(dialog).getByText('32%')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Zoom out' }))
    expect(within(dialog).getByText('22%')).toBeInTheDocument()
  })

  it('edits the name and phone from the profile tab', async () => {
    const user = userEvent.setup()
    updateAgent.mockResolvedValue({ ...sub, name: 'Ana Updated', phone: '0917' })

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))

    const nameInput = within(dialog).getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Updated')
    const phoneInput = within(dialog).getByLabelText('Phone')
    await user.type(phoneInput, '0917')
    await user.click(within(dialog).getByRole('button', { name: 'Save Profile' }))

    expect(updateAgent).toHaveBeenCalledWith('a1', { name: 'Ana Updated', phone: '0917' })
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it('edits the agent email from the profile tab', async () => {
    const user = userEvent.setup()
    updateAgent.mockResolvedValue({ ...sub, email: 'new@x.com' })
    updateAgentAccount.mockResolvedValue({ ...sub, email: 'new@x.com' })

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))

    expect(within(dialog).queryByLabelText('New password')).not.toBeInTheDocument()

    const emailInput = within(dialog).getByLabelText('Email')
    expect(emailInput).toHaveValue('ana@x.com')
    await user.clear(emailInput)
    await user.type(emailInput, 'new@x.com')
    await user.click(within(dialog).getByRole('button', { name: 'Save Profile' }))

    expect(updateAgentAccount).toHaveBeenCalledWith('a1', { email: 'new@x.com' })
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it('marks an agent to require a new password at their next sign-in', async () => {
    const user = userEvent.setup()
    resetAgentAccountPassword.mockResolvedValue({ ...sub })

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))

    await user.click(within(dialog).getByRole('button', { name: 'Require new password' }))

    expect(resetAgentAccountPassword).toHaveBeenCalledWith('a1')
    expect(await screen.findByText('Password reset required.')).toBeInTheDocument()
  })

  it('searches agents by name', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await screen.findByText('Ana Sub')
    await user.type(screen.getByLabelText('Search agents'), 'Rico')

    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.queryByText('Ana Sub')).not.toBeInTheDocument()
  })

  it('opens and closes the agent detail modal', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    expect(await screen.findByRole('dialog', { name: 'Ana Sub details' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Ana Sub details' })).not.toBeInTheDocument()
  })
})
