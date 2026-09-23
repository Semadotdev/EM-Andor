export const ROLE_LABELS = {
  admin: 'Admin',
  agent_head: 'Agent Head',
  direct_agent: 'Direct Agent',
  sub_agent: 'Sub Agent',
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
