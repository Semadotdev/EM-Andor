import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCommissions from './AdminCommissions.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchCommissionRates: vi.fn(),
  updateCommissionRates: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn(),
  markCommissionPaid: vi.fn(),
}))

import { fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
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

    expect(await screen.findByText('Ana Sub')).toBeInTheDocument()
    expect(screen.getAllByText('Lot A').length).toBe(2)
    expect(screen.getByText('₱ 30,000')).toBeInTheDocument()
  })

  it('marks an earned commission paid after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    await screen.findByText('Ana Sub')
    const row = screen.getByText('Ana Sub').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Mark Paid' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark Paid' }))

    expect(markCommissionPaid).toHaveBeenCalledWith('c1')
  })

  it('saves edited rates as fractions', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const input = await screen.findByLabelText('Sub Agent rate (%)')
    await user.clear(input)
    await user.type(input, '4')
    await user.click(screen.getByRole('button', { name: 'Save Rates' }))

    expect(updateCommissionRates).toHaveBeenCalledWith(
      expect.objectContaining({ sub_agent: 0.04 }),
    )
  })
})
