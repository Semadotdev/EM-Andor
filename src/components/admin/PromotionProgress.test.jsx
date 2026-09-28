import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PromotionProgress from './PromotionProgress.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchMySales: vi.fn() }))

import { fetchMySales } from '../../lib/sales.js'

const agent = { id: 'a1', name: 'Ana' }
const recruit = (id, active = true) => ({ id, role: 'sub_agent', upline_id: 'a1', is_active: active })

describe('PromotionProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMySales.mockResolvedValue([])
  })

  it('renders nothing for non-sub agents', () => {
    fetchMySales.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ id: String(i) })))
    const { container } = render(<PromotionProgress agent={{ ...agent, role: 'direct_agent' }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows progress toward the sub to direct requirement', async () => {
    fetchMySales.mockResolvedValue([{ id: 's1' }, { id: 's2' }])

    render(<PromotionProgress agent={{ ...agent, role: 'sub_agent' }} downline={[recruit('r1'), recruit('r2', false), recruit('r3')]} />)

    expect(await screen.findByText('Become a Direct Agent')).toBeInTheDocument()
    expect(screen.getAllByText('2 / 5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Requirement: 5 sales \+ 5 recruits/)).toBeInTheDocument()
  })

  it('marks the agent ready for promotion when both targets are met', async () => {
    fetchMySales.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` })))
    const downline = Array.from({ length: 5 }, (_, i) => recruit(`r${i}`))

    render(<PromotionProgress agent={{ ...agent, role: 'sub_agent' }} downline={downline} />)

    expect(await screen.findByText('Ready for promotion')).toBeInTheDocument()
    expect(screen.queryByText(/Requirement:/)).not.toBeInTheDocument()
  })
})