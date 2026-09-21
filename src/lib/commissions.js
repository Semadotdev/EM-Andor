export const COMMISSION_ROLES = ['sub_agent', 'direct_agent', 'agent_head']
export const MAX_COMMISSION_LEVELS = 3

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

export function buildCommissionRows(price, chain, rates) {
  const rows = []
  const warnings = []
  const seen = new Set()
  const salePrice = Number(price)

  for (const agent of chain.slice(0, MAX_COMMISSION_LEVELS)) {
    if (!agent?.id || agent.role === 'admin' || seen.has(agent.id)) continue
    seen.add(agent.id)
    const rate = Number(rates?.[agent.role])
    if (!(rate > 0)) {
      warnings.push(`No commission rate configured for ${agent.role}; skipped ${agent.name ?? agent.id}.`)
      continue
    }
    rows.push({
      agent_id: agent.id,
      role_at_sale: agent.role,
      sale_price: salePrice,
      rate,
      amount: Math.round(salePrice * rate * 100) / 100,
    })
  }

  return { rows, warnings }
}
