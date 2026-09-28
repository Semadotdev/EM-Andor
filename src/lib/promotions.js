export const PROMOTION_THRESHOLDS = {
  sub_to_direct_sales: 5,
  sub_to_direct_recruits: 5,
}

export function computePromotion({ role, ownSales = 0, directRecruits = 0 }) {
  if (role === 'sub_agent') {
    const eligible =
      ownSales >= PROMOTION_THRESHOLDS.sub_to_direct_sales &&
      directRecruits >= PROMOTION_THRESHOLDS.sub_to_direct_recruits
    return { eligibleFor: eligible ? 'direct_agent' : null, counts: { ownSales, directRecruits } }
  }
  return { eligibleFor: null, counts: {} }
}

export function countDirectRecruits(agents, agentId) {
  return agents.filter((a) => a.upline_id === agentId && a.is_active !== false).length
}

export function eligibleAgents(agents, soldCounts = {}) {
  const result = new Map()
  for (const agent of agents) {
    if (agent.role === 'admin' || agent.is_active === false) continue
    const { eligibleFor, counts } = computePromotion({
      role: agent.role,
      ownSales: soldCounts[agent.id] ?? 0,
      directRecruits: countDirectRecruits(agents, agent.id),
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
