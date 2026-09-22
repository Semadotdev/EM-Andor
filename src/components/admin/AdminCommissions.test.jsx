import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCommissions from './AdminCommissions.jsx'
import { renderWithToast as render } from '../../test/renderWithToast.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn().mockResolvedValue([]),
  fetchCommissionRates: vi.fn(),
  updateCommissionRates: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn(),
  markCommissionPaid: vi.fn(),
}))

import { fetchAllAgents, fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
import { fetchCommissions, markCommissionPaid } from '../../lib/sales.js'

const rates = [
  { role: 'sub_agent', rate: 0.03 },
  { role: 'direct_agent', rate: 0.015 },
  { role: 'agent_head', rate: 0.005 },
]

const rows = [
  { id: 'c1', agent_id: 'a1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned', properties: { name: 'Lot A' }, agents: { name: 'Ana Sub' } },
  { id: 'c2', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'paid', properties: { name: 'Lot A' }, agents: { name: 'Ben Direct' } },
]

describe('AdminCommissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCommissionRates.mockResolvedValue(rates)
    fetchCommissions.mockResolvedValue(rows)
    markCommissionPaid.mockResolvedValue({ ...rows[0], status: 'paid' })
    updateCommissionRates.mockResolvedValue([])
  })

  it('lists commissions with agent and property names', async () => {
    render(<AdminCommissions />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Ana Sub')).toBeInTheDocument()
    expect(within(table).getAllByText('Lot A').length).toBe(2)
    expect(within(table).getByText('₱ 30,000')).toBeInTheDocument()
  })

  it('marks an earned commission paid after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Ana Sub').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Mark Paid' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark Paid' }))

    expect(markCommissionPaid).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('Commission marked as paid.')).toBeInTheDocument()
  })

  it('saves edited rates as fractions and confirms with a toast', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const input = await screen.findByLabelText('Sub Agent rate (%)')
    await user.clear(input)
    await user.type(input, '4')
    await user.click(screen.getByRole('button', { name: 'Save Rates' }))

    expect(updateCommissionRates).toHaveBeenCalledWith(
      expect.objectContaining({ sub_agent: 0.04 }),
    )
    expect(await screen.findByText('Rates saved.')).toBeInTheDocument()
  })

  it('filters commissions by agent and searches by property', async () => {
    const user = userEvent.setup()
    fetchAllAgents.mockResolvedValue([{ id: 'a1', name: 'Ana Sub', role: 'sub_agent' }])

    render(<AdminCommissions />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Ana Sub')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filter by agent'), 'a1')

    expect(fetchCommissions).toHaveBeenLastCalledWith({ agentId: 'a1' })

    await user.type(screen.getByLabelText('Search by property'), 'Lot B')

    expect(screen.queryByText('Ana Sub')).not.toBeInTheDocument()
  })

  it('places the search input above the filter dropdowns', async () => {
    render(<AdminCommissions />)

    await screen.findByRole('table')

    const search = screen.getByLabelText('Search by property')
    const agent = screen.getByLabelText('Filter by agent')
    const status = screen.getByLabelText('Status')
    const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(follows(search, agent)).toBe(true)
    expect(follows(search, status)).toBe(true)
    expect(follows(agent, status)).toBe(true)
    expect(search).toHaveClass('sm:max-w-md')
  })

  it('rejects out-of-range rates before saving', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const input = await screen.findByLabelText('Sub Agent rate (%)')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save Rates' }))

    expect(await screen.findByText('Rates must be greater than 0 and at most 100.')).toBeInTheDocument()
    expect(updateCommissionRates).not.toHaveBeenCalled()
  })

  it('shows a mark-paid failure inside the confirmation modal', async () => {
    markCommissionPaid.mockRejectedValue(new Error('Commission is already paid.'))
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Ana Sub').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Mark Paid' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark Paid' }))

    expect(await within(dialog).findByText('Commission is already paid.')).toBeInTheDocument()
  })
})
