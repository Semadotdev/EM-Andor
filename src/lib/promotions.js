export const PROMOTION_THRESHOLDS = {
  sub_to_direct_sales: 5,
  sub_to_direct_recruits: 5,
  direct_to_head_direct_agents: 5,
}

export function computePromotion({ role, ownSales = 0, directRecruits = 0, downlineDirectAgents = 0 }) {
  if (role === 'sub_agent') {
    const eligible =
      ownSales >= PROMOTION_THRESHOLDS.sub_to_direct_sales &&
      directRecruits >= PROMOTION_THRESHOLDS.sub_to_direct_recruits
    return { eligibleFor: eligible ? 'direct_agent' : null, counts: { ownSales, directRecruits } }
  }
  if (role === 'direct_agent') {
    const eligible = downlineDirectAgents >= PROMOTION_THRESHOLDS.direct_to_head_direct_agents
    return { eligibleFor: eligible ? 'agent_head' : null, counts: { downlineDirectAgents } }
  }
  return { eligibleFor: null, counts: {} }
}

export function countDirectRecruits(agents, agentId) {
  return agents.filter((a) => a.upline_id === agentId && a.is_active !== false).length
}

export function childrenOf(agents) {
  const map = new Map()
  for (const a of agents) {
    if (!a.upline_id) continue
    if (!map.has(a.upline_id)) map.set(a.upline_id, [])
    map.get(a.upline_id).push(a)
  }
  return map
}

export function countDownlineDirectAgents(agents, agentId) {
  const map = childrenOf(agents)
  const seen = new Set()
  const stack = [agentId]
  let count = 0

  while (stack.length > 0) {
    const id = stack.pop()
    for (const child of map.get(id) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      if (child.role === 'direct_agent' && child.is_active !== false) count++
      stack.push(child.id)
    }
  }
  return count
}

export function eligibleAgents(agents, soldCounts = {}) {
  const result = new Map()
  for (const agent of agents) {
    if (agent.role === 'admin' || agent.is_active === false) continue
    const { eligibleFor, counts } = computePromotion({
      role: agent.role,
      ownSales: soldCounts[agent.id] ?? 0,
      directRecruits: countDirectRecruits(agents, agent.id),
      downlineDirectAgents: countDownlineDirectAgents(agents, agent.id),
    })
    if (eligibleFor) result.set(agent.id, { agent, eligibleFor, counts })
  }
  return result
}

// When a sub agent is promoted to direct, their upline becomes the agent head
// above their nearest direct_agent ancestor. Returns the new upline id, or null
// when there is no direct_agent ancestor (leave the upline unchanged).
export function computeRewireUpline(agents, agentId) {
  const byId = new Map(agents.map((a) => [a.id, a]))
  const seen = new Set()

  let cursor = byId.get(agentId)?.upline_id ?? null
  let directAncestor = null
  while (cursor) {
    const member = byId.get(cursor)
    if (!member || seen.has(member.id)) break
    seen.add(member.id)
    if (member.role === 'direct_agent') {
      directAncestor = member
      break
    }
    cursor = member.upline_id
  }
  if (!directAncestor) return null

  cursor = directAncestor.upline_id
  while (cursor) {
    const member = byId.get(cursor)
    if (!member || seen.has(member.id)) return null
    seen.add(member.id)
    if (member.role === 'agent_head') return member.id
    cursor = member.upline_id
  }
  return null
}
