import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchCommissions, fetchMySales, fetchTeamSales, markCommissionPaid, savePropertyWithCommission } from './sales.js'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./api.js', () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  logActivity: vi.fn(() => Promise.resolve()),
}))
vi.mock('./agents.js', () => ({
  fetchAllAgents: vi.fn(),
  applyEligiblePromotions: vi.fn(() => Promise.resolve([])),
  fetchCommissionRatesMap: vi.fn(),
}))

import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'neq', 'in', 'upsert', 'limit']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return c
}

const sub = { id: 'a1', name: 'Sub', role: 'sub_agent', upline_id: 'a2', is_active: true }
const direct = { id: 'a2', name: 'Direct', role: 'direct_agent', upline_id: null, is_active: true }
const property = { id: 'p1', name: 'Lot A', price: 1000000, status: 'sold', sold_by: 'a1' }

const soldPayload = { name: 'Lot A', price: 1000000, status: 'sold', sold_by: 'a1' }

describe('sales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a sold save without a price or seller', async () => {
    await expect(
      savePropertyWithCommission({ mode: 'create', payload: { ...soldPayload, price: '', sold_by: null } }),
    ).rejects.toMatchObject({ fieldErrors: { price: expect.any(String), sold_by: expect.any(String) } })
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('creates the property and one commission row per chain level', async () => {
    createProperty.mockResolvedValue(property)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null })
    supabase.from.mockImplementation(() => insertChain)

    const saved = await savePropertyWithCommission({ mode: 'create', payload: soldPayload })

    expect(createProperty).toHaveBeenCalledWith(expect.objectContaining({ ...soldPayload, sold_at: expect.any(String) }))
    expect(supabase.from).toHaveBeenCalledWith('commissions')
    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', role_at_sale: 'sub_agent', sale_price: 1000000, rate: 0.03, amount: 30000, status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'earned' }),
    ])
    expect(applyEligiblePromotions).toHaveBeenCalled()
    expect(saved).toEqual(property)
  })

  it('saves an available property without generating commissions', async () => {
    createProperty.mockResolvedValue({ ...property, status: 'available', sold_by: null })

    await savePropertyWithCommission({
      mode: 'create',
      payload: { ...soldPayload, status: 'available', sold_by: null },
    })

    expect(supabase.from).not.toHaveBeenCalledWith('commissions')
    expect(applyEligiblePromotions).toHaveBeenCalled()
  })

  it('un-selling clears earned commission rows', async () => {
    const existing = property
    updateProperty.mockResolvedValue({ ...property, status: 'available', sold_by: null })
    const deleteChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'earned' }], error: null }))
      .mockImplementationOnce(() => deleteChain)

    await savePropertyWithCommission({
      mode: 'edit',
      propertyId: 'p1',
      payload: { ...soldPayload, status: 'available', sold_by: null },
    })

    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'available', sold_at: null }))
  })

  it('blocks un-selling when a commission is already paid', async () => {
    updateProperty.mockResolvedValue({})
    supabase.from
      .mockImplementationOnce(() => chain({ data: property, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'paid' }], error: null }))

    await expect(
      savePropertyWithCommission({
        mode: 'edit',
        propertyId: 'p1',
        payload: { ...soldPayload, status: 'available', sold_by: null },
      }),
    ).rejects.toThrow('Commission already paid — reverse payment first.')

    expect(updateProperty).not.toHaveBeenCalled()
  })

  it('does not regenerate commissions when a sold property is saved again with the same seller', async () => {
    const existing = { ...property }
    updateProperty.mockResolvedValue(existing)
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1' }], error: null }))

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold' }))
  })

  it('regenerates commissions when a sold property is missing them', async () => {
    const existing = { ...property }
    updateProperty.mockResolvedValue(existing)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c9' }], error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }))
      .mockImplementationOnce(() => insertChain)

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', status: 'earned' }),
    ])
  })

  it('rejects an inactive or unknown selling agent before saving', async () => {
    fetchAllAgents.mockResolvedValue([{ ...sub, is_active: false }])

    await expect(
      savePropertyWithCommission({ mode: 'create', payload: soldPayload }),
    ).rejects.toMatchObject({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('logs a warning and saves without commissions when no rates are configured', async () => {
    createProperty.mockResolvedValue(property)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({})

    await savePropertyWithCommission({ mode: 'create', payload: soldPayload })

    expect(logActivity).toHaveBeenCalledWith('commission', 'p1', 'skip', {
      warning: 'No commission rate configured for sub_agent; skipped Sub.',
    })
    expect(supabase.from).not.toHaveBeenCalledWith('commissions')
  })

  it('regenerates commissions when the selling agent changes', async () => {
    const existing = { ...property, sold_by: 'a2' }
    updateProperty.mockResolvedValue({ ...property, sold_by: 'a1' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c2' }, { id: 'c3' }], error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'earned' }], error: null }))
      .mockImplementationOnce(() => chain({ data: null, error: null }))
      .mockImplementationOnce(() => insertChain)

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'earned' }),
    ])
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold' }))
  })

  it('fetchMySales filters properties by seller', async () => {
    const sales = [{ id: 'p1', sold_by: 'a1' }]
    supabase.from.mockReturnValue(chain({ data: sales, error: null }))

    expect(await fetchMySales('a1')).toEqual(sales)
    expect(supabase.from).toHaveBeenCalledWith('properties')
  })

  it('fetchTeamSales returns nothing for an empty team', async () => {
    expect(await fetchTeamSales([])).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fetchCommissions applies agent and status filters', async () => {
    const rows = [{ id: 'c1', agent_id: 'a1', status: 'earned', amount: 30000 }]
    const c = chain({ data: rows, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchCommissions({ agentId: 'a1', status: 'earned' })

    expect(result).toEqual(rows)
    expect(c.eq).toHaveBeenCalledWith('agent_id', 'a1')
    expect(c.eq).toHaveBeenCalledWith('status', 'earned')
  })

  it('markCommissionPaid stamps status and paid_at', async () => {
    const row = { id: 'c1', status: 'paid', amount: 30000 }
    supabase.from.mockReturnValue(chain({ data: row, error: null }))

    const result = await markCommissionPaid('c1')

    expect(result).toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('commissions')
  })
})
