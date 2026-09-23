import { describe, expect, it } from 'vitest'
import { ROLE_LABELS, buildAgentTree } from './agentMeta.js'

const admin = { id: 'admin1', name: 'Admin', role: 'admin', upline_id: null, is_active: true }
const sub = { id: 'a1', name: 'Sub', role: 'sub_agent', upline_id: null, is_active: true }

describe('agentMeta', () => {
  it('labels every role', () => {
    expect(ROLE_LABELS).toEqual({
      admin: 'Admin',
      agent_head: 'Agent Head',
      direct_agent: 'Direct Agent',
      sub_agent: 'Sub Agent',
    })
  })

  it('nests children under their upline', () => {
    const tree = buildAgentTree([admin, { ...sub, id: 'a2', upline_id: 'a1' }, sub])

    expect(tree).toHaveLength(2)
    const subNode = tree.find((n) => n.id === 'a1')
    expect(subNode.children.map((c) => c.id)).toEqual(['a2'])
  })

  it('sorts agents with their own downline ahead of leaf agents at every level', () => {
    const head = { id: 'h1', name: 'Head', role: 'agent_head', upline_id: null, is_active: true }
    const leafDirect = { id: 'd1', name: 'Leaf Direct', role: 'direct_agent', upline_id: 'h1', is_active: true }
    const managingDirect = { id: 'd2', name: 'Managing Direct', role: 'direct_agent', upline_id: 'h1', is_active: true }
    const leafSub = { id: 's1', name: 'Leaf Sub', role: 'sub_agent', upline_id: 'd2', is_active: true }
    const managingSub = { id: 's2', name: 'Managing Sub', role: 'sub_agent', upline_id: 'd2', is_active: true }
    const grandSub = { id: 's3', name: 'Grand Sub', role: 'sub_agent', upline_id: 's2', is_active: true }

    const tree = buildAgentTree([head, leafDirect, managingDirect, leafSub, managingSub, grandSub])

    expect(tree.map((n) => n.id)).toEqual(['h1'])
    const headNode = tree[0]
    expect(headNode.children.map((c) => c.id)).toEqual(['d2', 'd1'])
    const managingNode = headNode.children.find((c) => c.id === 'd2')
    expect(managingNode.children.map((c) => c.id)).toEqual(['s2', 's1'])
  })

  it('keeps relative order among agents that have equal downline status', () => {
    const parent = { id: 'p1', name: 'Parent', role: 'sub_agent', upline_id: null, is_active: true }
    const a = { id: 'a1', name: 'A', role: 'sub_agent', upline_id: 'p1', is_active: true }
    const b = { id: 'a2', name: 'B', role: 'sub_agent', upline_id: 'p1', is_active: true }
    const c = { id: 'a3', name: 'C', role: 'sub_agent', upline_id: 'p1', is_active: true }

    const tree = buildAgentTree([parent, a, b, c])

    expect(tree[0].children.map((n) => n.id)).toEqual(['a1', 'a2', 'a3'])
  })
})
