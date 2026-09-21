import { describe, expect, it } from 'vitest'
import { buildCommissionRows, formatRate, validateSale } from './commissions.js'

const rates = { sub_agent: 0.03, direct_agent: 0.015, agent_head: 0.005 }

const sub = { id: 'a1', name: 'Sub', role: 'sub_agent' }
const direct = { id: 'a2', name: 'Direct', role: 'direct_agent' }
const head = { id: 'a3', name: 'Head', role: 'agent_head' }

describe('commissions', () => {
  it('builds one row per chain level at that level rate', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct, head], rates)

    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { agent_id: 'a1', role_at_sale: 'sub_agent', sale_price: 1000000, rate: 0.03, amount: 30000 },
      { agent_id: 'a2', role_at_sale: 'direct_agent', sale_price: 1000000, rate: 0.015, amount: 15000 },
      { agent_id: 'a3', role_at_sale: 'agent_head', sale_price: 1000000, rate: 0.005, amount: 5000 },
    ])
  })

  it('skips agents with no configured rate and warns', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct], { sub_agent: 0.03 })

    expect(rows).toHaveLength(1)
    expect(warnings).toEqual(['No commission rate configured for direct_agent; skipped Direct.'])
  })

  it('de-duplicates agents and rounds amounts to centavos', () => {
    const { rows } = buildCommissionRows(333333, [{ ...sub }, sub], { sub_agent: 0.0333 })

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(11099.99)
  })

  it('rejects zero or missing price and missing seller', () => {
    expect(validateSale({ price: '', sold_by: 'a1' })).toEqual({ price: 'Set a price before marking this property sold.' })
    expect(validateSale({ price: 0, sold_by: null })).toEqual({
      price: 'Set a price before marking this property sold.',
      sold_by: 'Select the selling agent.',
    })
    expect(validateSale({ price: 1500000, sold_by: 'a1' })).toEqual({})
  })

  it('formats rates as percentages', () => {
    expect(formatRate(0.03)).toBe('3.00%')
    expect(formatRate(null)).toBe('—')
  })
})
