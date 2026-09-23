import { describe, expect, it } from 'vitest'
import {
  computePromotion,
  computeRewireUpline,
  countDirectRecruits,
  countDownlineDirectAgents,
  eligibleAgents,
} from './promotions.js'

const agent = (id, role, upline_id = null, is_active = true) => ({ id, name: id, role, upline_id, is_active })

describe('promotions', () => {
  it('promotes a sub agent with 5 own sales and 5 recruits', () => {
    expect(computePromotion({ role: 'sub_agent', ownSales: 5, directRecruits: 5 })).toEqual({
      eligibleFor: 'direct_agent',
      counts: { ownSales: 5, directRecruits: 5 },
    })
    expect(computePromotion({ role: 'sub_agent', ownSales: 5, directRecruits: 4 }).eligibleFor).toBeNull()
    expect(computePromotion({ role: 'sub_agent', ownSales: 4, directRecruits: 5 }).eligibleFor).toBeNull()
  })

  it('promotes a direct agent when 5 direct agents are in the downline', () => {
    expect(computePromotion({ role: 'direct_agent', downlineDirectAgents: 5 }).eligibleFor).toBe('agent_head')
    expect(computePromotion({ role: 'direct_agent', downlineDirectAgents: 4 }).eligibleFor).toBeNull()
  })

  it('never promotes an agent head or admin', () => {
    expect(computePromotion({ role: 'agent_head', ownSales: 99, directRecruits: 99 }).eligibleFor).toBeNull()
    expect(computePromotion({ role: 'admin' }).eligibleFor).toBeNull()
  })

  it('counts only active direct recruits', () => {
    const agents = [
      agent('a1', 'sub_agent'),
      agent('r1', 'sub_agent', 'a1'),
      agent('r2', 'sub_agent', 'a1', false),
      agent('r3', 'direct_agent', 'other'),
    ]
    expect(countDirectRecruits(agents, 'a1')).toBe(1)
  })

  it('counts direct agents anywhere below, not just one level down', () => {
    const agents = [
      agent('head1', 'agent_head'),
      agent('d1', 'direct_agent', 'head1'),
      agent('d2', 'direct_agent', 'd1'),
      agent('s1', 'sub_agent', 'd2'),
      agent('d3', 'direct_agent', 's1'),
      agent('d4', 'direct_agent', 's1', false),
    ]
    expect(countDownlineDirectAgents(agents, 'head1')).toBe(3)
  })

  it('returns every agent that is currently eligible', () => {
    const agents = [agent('s1', 'sub_agent')]
    for (let i = 0; i < 5; i++) agents.push(agent(`r${i}`, 'sub_agent', 's1'))
    const eligible = eligibleAgents(agents, { s1: 5 })

    expect(eligible.get('s1').eligibleFor).toBe('direct_agent')
    expect(eligible.get('s1').counts).toEqual({ ownSales: 5, directRecruits: 5 })
  })
})

describe('computeRewireUpline', () => {
  it('rewires a promoted sub to the agent head above its direct', () => {
    const agents = [
      agent('head1', 'agent_head'),
      agent('d1', 'direct_agent', 'head1'),
      agent('s1', 'sub_agent', 'd1'),
    ]

    expect(computeRewireUpline(agents, 's1')).toBe('head1')
  })

  it('climbs over stacked directs to the agent head', () => {
    const agents = [
      agent('head1', 'agent_head'),
      agent('d2', 'direct_agent', 'head1'),
      agent('d1', 'direct_agent', 'd2'),
      agent('s1', 'sub_agent', 'd1'),
    ]

    expect(computeRewireUpline(agents, 's1')).toBe('head1')
  })

  it('leaves the upline unchanged when the chain has no direct agent', () => {
    const agents = [
      agent('head1', 'agent_head'),
      agent('s2', 'sub_agent', 'head1'),
      agent('s1', 'sub_agent', 's2'),
    ]

    expect(computeRewireUpline(agents, 's1')).toBeNull()
  })

  it('leaves the upline unchanged for a sub already under the head', () => {
    const agents = [agent('head1', 'agent_head'), agent('s1', 'sub_agent', 'head1')]

    expect(computeRewireUpline(agents, 's1')).toBeNull()
  })

  it('returns null when no agent head exists above the direct', () => {
    const agents = [
      agent('d1', 'direct_agent'),
      agent('s1', 'sub_agent', 'd1'),
    ]

    expect(computeRewireUpline(agents, 's1')).toBeNull()
  })

  it('returns null when the chain above the direct only reaches an admin', () => {
    const agents = [
      agent('admin1', 'admin'),
      agent('d1', 'direct_agent', 'admin1'),
      agent('s1', 'sub_agent', 'd1'),
    ]

    expect(computeRewireUpline(agents, 's1')).toBeNull()
  })

  it('returns null for an unknown agent', () => {
    expect(computeRewireUpline([agent('head1', 'agent_head')], 'missing')).toBeNull()
  })
})
