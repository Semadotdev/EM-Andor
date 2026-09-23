import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  cancelReservation,
  completeDownpayment,
  completeReservationWithDownpayment,
  createPayment,
  deletePayment,
  fetchCommissions,
  fetchMySales,
  fetchPayments,
  fetchSale,
  fetchTeamSales,
  markCommissionPaid,
  reserveLot,
  savePropertyWithCommission,
  updatePayment,
  updateSale,
  upsertSale,
} from './sales.js'

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
vi.mock('./projects.js', () => ({ fetchProjectRatesMap: vi.fn().mockResolvedValue({}) }))

import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'
import { fetchProjectRatesMap } from './projects.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'maybeSingle', 'neq', 'in', 'upsert', 'limit']) {
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
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProjectRatesMap.mockResolvedValue({})
  })

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

  it('project rates override global rates and missing project roles fall back to global', async () => {
    createProperty.mockResolvedValue({ ...property, project_id: 'pr1' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    fetchProjectRatesMap.mockResolvedValue({ sub_agent: 0.05 })
    const insertChain = chain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null })
    supabase.from.mockImplementation(() => insertChain)

    await savePropertyWithCommission({ mode: 'create', payload: soldPayload })

    expect(fetchProjectRatesMap).toHaveBeenCalledWith('pr1')
    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ agent_id: 'a1', role_at_sale: 'sub_agent', rate: 0.05, amount: 50000 }),
      expect.objectContaining({ agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000 }),
    ])
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
    const c = chain({ data: sales, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchMySales('a1')).toEqual(sales)
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.eq).toHaveBeenCalledWith('sold_by', 'a1')
    expect(c.eq).toHaveBeenCalledWith('status', 'sold')
    expect(c.order).toHaveBeenCalledWith('sold_at', { ascending: false, nullsFirst: false })
  })

  it('fetchTeamSales returns nothing for an empty team', async () => {
    expect(await fetchTeamSales([])).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fetchTeamSales queries by seller ids', async () => {
    const sales = [{ id: 'p1', sold_by: 'a1' }]
    const c = chain({ data: sales, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchTeamSales(['a1', 'a2'])).toEqual(sales)
    expect(c.in).toHaveBeenCalledWith('sold_by', ['a1', 'a2'])
    expect(c.eq).toHaveBeenCalledWith('status', 'sold')
    expect(c.order).toHaveBeenCalledWith('sold_at', { ascending: false, nullsFirst: false })
  })

  it('fetchCommissions applies agent and status filters', async () => {
    const rows = [{ id: 'c1', agent_id: 'a1', status: 'earned', amount: 30000 }]
    const c = chain({ data: rows, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchCommissions({ agentId: 'a1', status: 'earned' })

    expect(result).toEqual(rows)
    expect(c.select).toHaveBeenCalledWith('*, properties(name), agents(name, role)')
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(c.eq).toHaveBeenCalledWith('agent_id', 'a1')
    expect(c.eq).toHaveBeenCalledWith('status', 'earned')
  })

  it('markCommissionPaid stamps status and paid_at', async () => {
    const row = { id: 'c1', status: 'paid', amount: 30000 }
    const c = chain({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await markCommissionPaid('c1')

    expect(result).toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('commissions')
    expect(c.update).toHaveBeenCalledWith({ status: 'paid', paid_at: expect.any(String) })
    expect(c.eq).toHaveBeenCalledWith('id', 'c1')
    expect(c.eq).toHaveBeenCalledWith('status', 'earned')
    expect(logActivity).toHaveBeenCalledWith('commission', 'c1', 'paid', { amount: 30000 })
  })

  it('markCommissionPaid rejects an already paid commission', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }))

    await expect(markCommissionPaid('c1')).rejects.toThrow('Commission is already paid.')
  })

  it('fetchSale returns the buyer row for a property', async () => {
    const sale = { id: 's1', property_id: 'p1', buyer_name: 'Juan' }
    const c = chain({ data: sale, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchSale('p1')).toEqual(sale)
    expect(supabase.from).toHaveBeenCalledWith('sales')
    expect(c.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(c.maybeSingle).toHaveBeenCalled()
  })

  it('fetchSale returns null when the property has no buyer', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }))

    expect(await fetchSale('p1')).toBeNull()
  })

  it('upsertSale saves buyer details by property and logs the activity', async () => {
    const sale = { id: 's1', property_id: 'p1', buyer_name: 'Juan' }
    const c = chain({ data: sale, error: null })
    supabase.from.mockReturnValue(c)

    const result = await upsertSale('p1', { buyer_name: 'Juan', tcp: 2000000 })

    expect(result).toEqual(sale)
    expect(supabase.from).toHaveBeenCalledWith('sales')
    expect(c.upsert).toHaveBeenCalledWith(
      { property_id: 'p1', buyer_name: 'Juan', tcp: 2000000 },
      { onConflict: 'property_id' },
    )
    expect(logActivity).toHaveBeenCalledWith('sale', 'p1', 'save', { buyer: 'Juan' })
  })

  it('fetchPayments filters by property and orders by entry date', async () => {
    const rows = [{ id: 'pay1', property_id: 'p1', entry_date: '2026-01-05', amount: 5000 }]
    const c = chain({ data: rows, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchPayments('p1')).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(c.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(c.order).toHaveBeenCalledWith('entry_date', { ascending: true })
  })

  it('fetchPayments returns an empty list when there are no rows', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }))

    expect(await fetchPayments('p1')).toEqual([])
  })

  it('createPayment inserts the payment against the property', async () => {
    const payment = { entry_date: '2026-01-05', or_number: 'OR-1', amount: 5000, surcharge: 0, interest: 0 }
    const row = { id: 'pay1', property_id: 'p1', ...payment }
    const c = chain({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    expect(await createPayment('p1', payment)).toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(c.insert).toHaveBeenCalledWith({ property_id: 'p1', ...payment })
  })

  it('updatePayment updates the payment by id', async () => {
    const row = { id: 'pay1', amount: 6000 }
    const c = chain({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    expect(await updatePayment('pay1', { amount: 6000 })).toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(c.update).toHaveBeenCalledWith({ amount: 6000 })
    expect(c.eq).toHaveBeenCalledWith('id', 'pay1')
  })

  it('deletePayment deletes the payment by id', async () => {
    const c = chain({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await deletePayment('pay1')

    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'pay1')
  })

  it('reserveLot saves the reserved property, the buyer details, and the reservation fee payment', async () => {
    const existing = { ...property, status: 'reserved' }
    const today = new Date().toISOString().slice(0, 10)
    updateProperty.mockResolvedValue(existing)
    const salesChain = chain({ data: { id: 's1', property_id: 'p1', buyer_name: 'Juan' }, error: null })
    const paymentChain = chain({ data: { id: 'pay1' }, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => salesChain)
      .mockImplementationOnce(() => paymentChain)

    const saved = await reserveLot({
      propertyId: 'p1',
      payload: { ...property, status: 'reserved', sold_by: 'a1' },
      details: { buyer_name: 'Juan', tcp: 500000, downpayment: 0, monthly_amortization: 0, terms_of_payment: '24' },
      reservationFee: 5000,
    })

    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'reserved', sold_at: null }))
    expect(salesChain.upsert).toHaveBeenCalledWith(
      {
        property_id: 'p1',
        buyer_name: 'Juan',
        tcp: 500000,
        downpayment: 0,
        monthly_amortization: 0,
        terms_of_payment: '24',
      },
      { onConflict: 'property_id' },
    )
    expect(updateProperty.mock.invocationCallOrder[0]).toBeLessThan(salesChain.upsert.mock.invocationCallOrder[0])
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'payments')
    expect(paymentChain.insert).toHaveBeenCalledWith({
      property_id: 'p1',
      entry_date: today,
      amount: 5000,
      or_number: null,
      surcharge: 0,
      interest: 0,
      remarks: 'Reservation',
    })
    expect(saved).toEqual(existing)
    expect(logActivity).toHaveBeenCalledWith('property', 'p1', 'reserve', { buyer: 'Juan' })
  })

  it('reserveLot skips the reservation fee payment when no fee is provided', async () => {
    const existing = { ...property, status: 'reserved' }
    updateProperty.mockResolvedValue(existing)
    const salesChain = chain({ data: { id: 's1', property_id: 'p1', buyer_name: 'Juan' }, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => salesChain)

    await reserveLot({
      propertyId: 'p1',
      payload: { ...property, status: 'reserved', sold_by: 'a1' },
      details: { buyer_name: 'Juan' },
    })

    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(salesChain.upsert).toHaveBeenCalled()
  })

  it('reserveLot reports a buyer details failure after the property save succeeds', async () => {
    updateProperty.mockResolvedValue({ ...property })
    supabase.from
      .mockImplementationOnce(() => chain({ data: { ...property, status: 'reserved' }, error: null }))
      .mockImplementationOnce(() => chain({ data: null, error: new Error('upsert failed') }))

    await expect(
      reserveLot({ propertyId: 'p1', payload: { ...property, status: 'reserved' }, details: { buyer_name: 'Juan' } }),
    ).rejects.toThrow('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.')
  })

  it('updateSale patches the sale row by property without a full buyer payload', async () => {
    const c = chain({ data: { id: 's1', downpayment: 50000 }, error: null })
    supabase.from.mockReturnValue(c)

    await updateSale('p1', { downpayment: 50000, terms_of_payment: '24', monthly_amortization: 18750 })

    expect(supabase.from).toHaveBeenCalledWith('sales')
    expect(c.update).toHaveBeenCalledWith({ downpayment: 50000, terms_of_payment: '24', monthly_amortization: 18750 })
    expect(c.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(c.maybeSingle).toHaveBeenCalled()
  })

  it('cancelReservation only frees a reserved lot, clears its sale row, and deletes its payments', async () => {
    const propertiesChain = chain({ data: [{ id: 'p1' }], error: null })
    const salesChain = chain({ data: null, error: null })
    const paymentsChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => propertiesChain)
      .mockImplementationOnce(() => salesChain)
      .mockImplementationOnce(() => paymentsChain)

    await cancelReservation('p1')

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'properties')
    expect(propertiesChain.update).toHaveBeenCalledWith({ status: 'available', sold_by: null, sold_at: null })
    expect(propertiesChain.eq).toHaveBeenCalledWith('status', 'reserved')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'sales')
    expect(salesChain.delete).toHaveBeenCalled()
    expect(salesChain.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'payments')
    expect(paymentsChain.delete).toHaveBeenCalled()
    expect(paymentsChain.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(logActivity).toHaveBeenCalledWith('property', 'p1', 'cancel_reservation')
  })

  it('cancelReservation refuses to touch a lot that is not reserved', async () => {
    const propertiesChain = chain({ data: [], error: null })
    supabase.from.mockReturnValue(propertiesChain)

    await expect(cancelReservation('p1')).rejects.toThrow('Only reserved lots can have their reservation cancelled.')

    expect(propertiesChain.update).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('completeDownpayment records the downpayment payment, marks the lot sold, and earns commissions', async () => {
    const today = new Date().toISOString().slice(0, 10)
    updateProperty.mockResolvedValue({ ...property, status: 'sold' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.05, direct_agent: 0.02 })
    const saleChain = chain({ data: { id: 's1' }, error: null })
    const paymentChain = chain({ data: { id: 'pay1' }, error: null })
    const propertyChain = chain({ data: { ...property, status: 'reserved' }, error: null })
    const commissionChain = chain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null })
    supabase.from
      .mockImplementationOnce(() => saleChain)
      .mockImplementationOnce(() => paymentChain)
      .mockImplementationOnce(() => propertyChain)
      .mockImplementationOnce(() => commissionChain)

    const saved = await completeDownpayment({
      propertyId: 'p1',
      payload: soldPayload,
      downpayment: 100000,
      terms: '48',
      monthlyAmortization: 10533.53,
    })

    expect(saleChain.update).toHaveBeenCalledWith({ downpayment: 100000, terms_of_payment: '48', monthly_amortization: 10533.53 })
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'payments')
    expect(paymentChain.insert).toHaveBeenCalledWith({
      property_id: 'p1',
      entry_date: today,
      amount: 100000,
      or_number: null,
      surcharge: 0,
      interest: 0,
      remarks: 'Downpayment',
    })
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold', sold_by: 'a1' }))
    expect(saleChain.update.mock.invocationCallOrder[0]).toBeLessThan(updateProperty.mock.invocationCallOrder[0])
    expect(supabase.from).toHaveBeenNthCalledWith(4, 'commissions')
    expect(commissionChain.insert).toHaveBeenCalled()
    expect(saved).toEqual({ ...property, status: 'sold' })
    expect(logActivity).toHaveBeenCalledWith('property', 'p1', 'downpayment', { downpayment: 100000, terms: '48' })
  })

  it('completeReservationWithDownpayment saves the sold lot, the sale row, and the downpayment payment', async () => {
    const today = new Date().toISOString().slice(0, 10)
    updateProperty.mockResolvedValue({ ...property, status: 'sold' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.05, direct_agent: 0.02 })
    const propertyChain = chain({ data: { ...property, status: 'reserved' }, error: null })
    const commissionChain = chain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null })
    const salesChain = chain({ data: { id: 's1', property_id: 'p1', buyer_name: 'Juan' }, error: null })
    const paymentChain = chain({ data: { id: 'pay1' }, error: null })
    supabase.from
      .mockImplementationOnce(() => propertyChain)
      .mockImplementationOnce(() => commissionChain)
      .mockImplementationOnce(() => salesChain)
      .mockImplementationOnce(() => paymentChain)

    const saved = await completeReservationWithDownpayment({
      propertyId: 'p1',
      payload: soldPayload,
      details: { buyer_name: 'Juan', tcp: 500000, downpayment: 100000, monthly_amortization: 16666.67, terms_of_payment: '24' },
      downpayment: 100000,
      terms: '24',
      monthlyAmortization: 16666.67,
    })

    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold', sold_by: 'a1' }))
    expect(salesChain.upsert).toHaveBeenCalledWith(
      {
        property_id: 'p1',
        buyer_name: 'Juan',
        tcp: 500000,
        downpayment: 100000,
        monthly_amortization: 16666.67,
        terms_of_payment: '24',
      },
      { onConflict: 'property_id' },
    )
    expect(supabase.from).toHaveBeenNthCalledWith(4, 'payments')
    expect(paymentChain.insert).toHaveBeenCalledWith({
      property_id: 'p1',
      entry_date: today,
      amount: 100000,
      or_number: null,
      surcharge: 0,
      interest: 0,
      remarks: 'Downpayment',
    })
    expect(salesChain.upsert.mock.invocationCallOrder[0]).toBeLessThan(paymentChain.insert.mock.invocationCallOrder[0])
    expect(saved).toEqual({ ...property, status: 'sold' })
    expect(logActivity).toHaveBeenCalledWith('property', 'p1', 'downpayment', { downpayment: 100000, terms: '24' })
  })

  it('completeReservationWithDownpayment reports a buyer details failure after the property save succeeds', async () => {
    updateProperty.mockResolvedValue({ ...property, status: 'sold' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.05, direct_agent: 0.02 })
    const propertyChain = chain({ data: { ...property, status: 'reserved' }, error: null })
    const commissionChain = chain({ data: [], error: null })
    const salesChain = chain({ data: null, error: new Error('upsert failed') })
    supabase.from
      .mockImplementationOnce(() => propertyChain)
      .mockImplementationOnce(() => commissionChain)
      .mockImplementationOnce(() => salesChain)

    await expect(
      completeReservationWithDownpayment({
        propertyId: 'p1',
        payload: soldPayload,
        details: { buyer_name: 'Juan' },
        downpayment: 100000,
        terms: '24',
        monthlyAmortization: 16666.67,
      }),
    ).rejects.toThrow('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.')
  })
})
