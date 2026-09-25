export const ROLE_LABELS = {
  admin: 'Admin',
  agent_head: 'Head',
  direct_agent: 'Direct',
  sub_agent: 'Sub',
}

export const ROLE_RANK = {
  agent_head: 3,
  direct_agent: 2,
  sub_agent: 1,
}

export function buildAgentTree(agents) {
  const byId = new Map(agents.map((a) => [a.id, { ...a, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    if (node.upline_id && byId.has(node.upline_id)) {
      byId.get(node.upline_id).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortByHasChildren = (node) => {
    node.children.sort((a, b) => Number(b.children.length > 0) - Number(a.children.length > 0))
    node.children.forEach(sortByHasChildren)
  }
  sortByHasChildren({ children: roots })
  return roots
}
