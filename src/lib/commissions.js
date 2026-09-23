export const COMMISSION_ROLES = ['sub_agent', 'direct_agent', 'agent_head']
export const LEVEL_CUT = 0.01
export const COMMISSION_CAP = 0.07
export const DIRECT_SELLS_BASE = 0.05
export const HEAD_SELLS_TOTAL = 0.06
export const MAX_CHAIN_LENGTH = 25

export function formatRate(rate) {
  const num = Number(rate)
  if (rate === null || rate === undefined || Number.isNaN(num)) return '—'
  return `${(num * 100).toFixed(2)}%`
}

export function validateSale({ price, sold_by }) {
  const errors = {}
  const numPrice = Number(price)
  if (price === '' || price === null || price === undefined || Number.isNaN(numPrice) || numPrice <= 0) {
    errors.price = 'Set a price before marking this property sold.'
  }
  if (!sold_by) {
    errors.sold_by = 'Select the selling agent.'
  }
  return errors
}

function cents(value) {
  return Math.round(value * 100) / 100
}

function shareRows(price, chain, shares) {
  const rows = []
  for (let i = 0; i < chain.length; i++) {
    const share = shares[i]
    if (share === undefined || share <= 0) continue
    const agent = chain[i]
    rows.push({
      agent_id: agent.id,
      role_at_sale: agent.role,
      sale_price: price,
      rate: share,
      amount: cents(price * share),
    })
  }
  return rows
}

export function buildCommissionRows(price, chain, rates) {
  const warnings = []
  const seen = new Set()
  const salePrice = Number(price)

  const clean = []
  for (const agent of chain.slice(0, MAX_CHAIN_LENGTH)) {
    if (!agent?.id || agent.role === 'admin' || seen.has(agent.id)) continue
    seen.add(agent.id)
    clean.push(agent)
  }
  if (clean.length === 0) return { rows: [], warnings }

  const seller = clean[0]

  if (seller.role === 'agent_head') {
    return { rows: shareRows(salePrice, clean, [HEAD_SELLS_TOTAL]), warnings }
  }

  const shares = Array(clean.length).fill(undefined)

  if (seller.role === 'sub_agent') {
    const sellerRate = Number(rates?.['sub_agent'])
    if (!(sellerRate > 0)) {
      warnings.push(`No commission rate configured for ${seller.role}; skipped ${seller.name ?? seller.id}.`)
      return { rows: [], warnings }
    }
    shares[0] = sellerRate

    for (let i = 1; i <= 2; i++) {
      const member = clean[i]
      if (member && member.role === 'sub_agent') shares[i] = LEVEL_CUT
    }

    let directIndex = -1
    for (let i = 1; i < clean.length; i++) {
      if (clean[i].role === 'direct_agent') {
        directIndex = i
        break
      }
    }
    if (directIndex !== -1) {
      const directRate = Number(rates?.['direct_agent'])
      shares[directIndex] = directIndex === 1 && directRate > 0 ? directRate : LEVEL_CUT
    }
  } else if (seller.role === 'direct_agent') {
    shares[0] = DIRECT_SELLS_BASE
  }

  const headRate = Number(rates?.['agent_head'])
  const headIndexes = clean.map((a, i) => (a.role === 'agent_head' ? i : -1)).filter((i) => i >= 0)
  const headIndex = headIndexes[0] ?? -1

  if (headIndex !== -1) {
    if (!(headRate > 0)) {
      warnings.push(
        `No commission rate configured for agent_head; skipped ${clean[headIndex].name ?? clean[headIndex].id}.`,
      )
    } else {
      shares[headIndex] = headRate
    }
  }

  let total = shares.reduce((sum, s) => sum + (s !== undefined && s > 0 ? s : 0), 0)
  if (total > COMMISSION_CAP) {
    let excess = total - COMMISSION_CAP
    for (let i = shares.length - 1; i >= 1 && excess > 1e-9; i--) {
      const share = shares[i]
      if (share === undefined || share <= 0) continue
      const cut = Math.min(share, excess)
      shares[i] = share - cut
      excess -= cut
    }
  }

  return { rows: shareRows(salePrice, clean, shares), warnings }
}