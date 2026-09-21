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
})
