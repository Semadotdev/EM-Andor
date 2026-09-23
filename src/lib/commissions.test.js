import { describe, expect, it } from 'vitest'
import { buildCommissionRows, formatRate, validateSale } from './commissions.js'

const rates = { sub_agent: 0.03, direct_agent: 0.02, agent_head: 0.01 }

const sub = { id: 'a1', name: 'Sub', role: 'sub_agent' }
const sub2 = { id: 'a2', name: 'Sub2', role: 'sub_agent' }
const sub3 = { id: 'a3', name: 'Sub3', role: 'sub_agent' }
const sub4 = { id: 'a4', name: 'Sub4', role: 'sub_agent' }
const sub5 = { id: 'a5', name: 'Sub5', role: 'sub_agent' }
const direct = { id: 'b1', name: 'Direct', role: 'direct_agent' }
const direct2 = { id: 'b2', name: 'Direct2', role: 'direct_agent' }
const head = { id: 'c1', name: 'Head', role: 'agent_head' }

const amounts = (rows) => rows.map((row) => row.amount)

describe('commissions', () => {
  it('pays a sub seller 3%, their direct 2%, and the head 1%', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct, head], rates)

    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { agent_id: 'a1', role_at_sale: 'sub_agent', sale_price: 1000000, rate: 0.03, amount: 30000 },
      { agent_id: 'b1', role_at_sale: 'direct_agent', sale_price: 1000000, rate: 0.02, amount: 20000 },
      { agent_id: 'c1', role_at_sale: 'agent_head', sale_price: 1000000, rate: 0.01, amount: 10000 },
    ])
  })

  it('pays a sub seller 3%, the nearest sub 1%, the direct 1%, and the head 1%', () => {
    const { rows } = buildCommissionRows(1000000, [sub, sub2, direct, head], rates)

    expect(amounts(rows)).toEqual([30000, 10000, 10000, 10000])
  })

  it('pays only the nearest two subs when many subs stack under a direct', () => {
    const { rows } = buildCommissionRows(1000000, [sub, sub2, sub3, sub4, sub5, direct, head], rates)

    expect(rows.map((row) => row.agent_id)).toEqual(['a1', 'a2', 'a3', 'b1', 'c1'])
    expect(amounts(rows)).toEqual([30000, 10000, 10000, 10000, 10000])
  })

  it('pays a direct seller 5% and the head 1%', () => {
    const { rows } = buildCommissionRows(1000000, [direct, head], rates)

    expect(amounts(rows)).toEqual([50000, 10000])
  })

  it('pays a direct seller a flat 5% and nothing to any directs above them', () => {
    const { rows } = buildCommissionRows(1000000, [direct, direct2, head], rates)

    expect(rows.map((row) => row.agent_id)).toEqual(['b1', 'c1'])
    expect(amounts(rows)).toEqual([50000, 10000])
  })

  it('pays a direct seller a flat 5% even when no direct rate is configured', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [direct, head], { agent_head: 0.01 })

    expect(warnings).toEqual([])
    expect(amounts(rows)).toEqual([50000, 10000])
  })

  it('gives a head seller the full 6%', () => {
    const { rows } = buildCommissionRows(1000000, [head], rates)

    expect(rows).toEqual([
      { agent_id: 'c1', role_at_sale: 'agent_head', sale_price: 1000000, rate: 0.06, amount: 60000 },
    ])
  })

  it('pays none of a direct seller to sub agents above them', () => {
    const { rows } = buildCommissionRows(1000000, [direct, sub2, head], rates)

    expect(amounts(rows)).toEqual([50000, 10000])
  })

  it('dissolves the direct slot when no direct agent is in the chain', () => {
    const { rows } = buildCommissionRows(1000000, [sub, head], rates)
    const deeper = buildCommissionRows(1000000, [sub, sub2, head], rates)

    expect(amounts(rows)).toEqual([30000, 10000])
    expect(amounts(deeper.rows)).toEqual([30000, 10000, 10000])
  })

  it('caps the total payout at 7% trimming the outermost recipients first', () => {
    const rich = { ...rates, sub_agent: 0.05, agent_head: 0.02 }
    const { rows } = buildCommissionRows(1000000, [sub, direct, head], rich)

    expect(amounts(rows)).toEqual([50000, 20000])
    expect(rows.map((row) => row.agent_id)).toEqual(['a1', 'b1'])
  })

  it('skips the whole sale when the seller role has no configured rate', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct], { direct_agent: 0.05 })

    expect(rows).toEqual([])
    expect(warnings).toEqual(['No commission rate configured for sub_agent; skipped Sub.'])
  })

  it('skips the head and warns when the head rate is missing', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct, head], { sub_agent: 0.03 })

    expect(rows).toHaveLength(2)
    expect(warnings).toEqual(['No commission rate configured for agent_head; skipped Head.'])
  })

  it('skips zero or negative seller rates and warns', () => {
    const zero = buildCommissionRows(1000000, [sub], { sub_agent: 0 })
    const negative = buildCommissionRows(1000000, [sub], { sub_agent: -0.01 })

    expect(zero.rows).toEqual([])
    expect(zero.warnings).toEqual(['No commission rate configured for sub_agent; skipped Sub.'])
    expect(negative.rows).toEqual([])
  })

  it('walks a chain deeper than three levels and pays the nearest two subs', () => {
    const { rows } = buildCommissionRows(1000000, [sub, sub2, sub3, direct, head], rates)

    expect(rows).toHaveLength(5)
    expect(amounts(rows)).toEqual([30000, 10000, 10000, 10000, 10000])
  })

  it('deduplicates agents and skips admin rows', () => {
    const admin = { id: 'x1', name: 'Admin', role: 'admin' }
    const { rows, warnings } = buildCommissionRows(333333, [{ ...sub }, sub, admin], { sub_agent: 0.0333 })

    expect(warnings).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].agent_id).toBe('a1')
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