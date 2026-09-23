import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { buildCommissionRows, validateSale, MAX_CHAIN_LENGTH } from './commissions.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'
import { fetchProjectRatesMap } from './projects.js'

export async function clearCommissionsForProperty(propertyId) {
  const { data, error } = await supabase.from('commissions').select('id, status').eq('property_id', propertyId)
  if (error) throw error

  const rows = data ?? []
  if (rows.some((row) => row.status === 'paid')) {
    throw new Error('Commission already paid — reverse payment first.')
  }
  if (rows.length > 0) {
    const { error: deleteError } = await supabase.from('commissions').delete().eq('property_id', propertyId)
    if (deleteError) throw deleteError
  }
}

export async function resolveChainForAgent(sellerId) {
  const agents = await fetchAllAgents()
  const byId = new Map(agents.map((a) => [a.id, a]))
  const chain = []
  const seen = new Set()
  let current = byId.get(sellerId)

  while (current && !seen.has(current.id) && current.role !== 'admin' && chain.length < MAX_CHAIN_LENGTH) {
    seen.add(current.id)
    chain.push(current)
    current = current.upline_id ? byId.get(current.upline_id) : null
  }
  return chain
}

async function createCommissionRows(property) {
  const [projectRates, globalRates, chain] = await Promise.all([
    fetchProjectRatesMap(property.project_id),
    fetchCommissionRatesMap(),
    resolveChainForAgent(property.sold_by),
  ])
  const rates = { ...globalRates, ...projectRates }
  const { rows, warnings } = buildCommissionRows(Number(property.price), chain, rates)

  for (const warning of warnings) {
    logActivity('commission', property.id, 'skip', { warning }).catch(() => {})
  }
  if (rows.length === 0) return []

  const payload = rows.map((row) => ({ ...row, property_id: property.id, status: 'earned' }))
  const { data, error } = await supabase.from('commissions').insert(payload).select()
  if (error) throw error

  for (const row of data ?? []) {
    logActivity('commission', row.agent_id, 'earned', { property_id: property.id, amount: row.amount }).catch(() => {})
  }
  return data ?? []
}

async function commissionsMissing(propertyId) {
  const { data, error } = await supabase.from('commissions').select('id').eq('property_id', propertyId).limit(1)
  if (error) throw error
  return (data ?? []).length === 0
}

export async function fetchPropertyById(id) {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function savePropertyWithCommission({ mode, propertyId, payload }) {
  const isSold = payload.status === 'sold'
  const existing = mode === 'edit' ? await fetchPropertyById(propertyId) : null

  if (isSold) {
    const fieldErrors = validateSale(payload)
    if (!fieldErrors.sold_by) {
      const agents = await fetchAllAgents()
      const seller = agents.find((a) => a.id === payload.sold_by)
      if (!seller || seller.role === 'admin' || seller.is_active === false) {
        fieldErrors.sold_by = 'Select an active selling agent.'
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      const error = new Error('Validation failed')
      error.fieldErrors = fieldErrors
      throw error
    }
  }

  const wasSold = existing?.status === 'sold'
  const sellerChanged = wasSold && existing.sold_by !== payload.sold_by

  let commissionStateChanged = isSold && (!wasSold || sellerChanged)
  if (isSold && !commissionStateChanged) {
    commissionStateChanged = await commissionsMissing(propertyId)
  }

  if (wasSold && (!isSold || sellerChanged)) {
    await clearCommissionsForProperty(propertyId)
  }

  const savePayload = isSold
    ? { ...payload, sold_at: wasSold && existing?.sold_at ? existing.sold_at : new Date().toISOString() }
    : { ...payload, sold_at: null }

  const saved = mode === 'edit' ? await updateProperty(propertyId, savePayload) : await createProperty(savePayload)

  if (commissionStateChanged) {
    await createCommissionRows(saved)
  }

  try {
    await applyEligiblePromotions()
  } catch {
    // The sale is recorded; promotions re-run on the next trigger.
  }
  return saved
}

export async function fetchSale(propertyId) {
  const { data, error } = await supabase.from('sales').select('*').eq('property_id', propertyId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertSale(propertyId, details) {
  const { data, error } = await supabase
    .from('sales')
    .upsert({ property_id: propertyId, ...details }, { onConflict: 'property_id' })
    .select()
    .single()
  if (error) throw error
  logActivity('sale', propertyId, 'save', { buyer: details.buyer_name }).catch(() => {})
  return data
}

export async function fetchPayments(propertyId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('property_id', propertyId)
    .order('entry_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPayment(propertyId, payment) {
  const { data, error } = await supabase
    .from('payments')
    .insert({ property_id: propertyId, ...payment })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePayment(id, updates) {
  const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}

export function lotFieldsForSale(lot) {
  const fields = { ...lot }
  delete fields.id
  delete fields.created_at
  delete fields.updated_at
  delete fields.sales
  return fields
}

export async function reserveLot({ propertyId, payload, details, reservationFee }) {
  const saved = await savePropertyWithCommission({ mode: 'edit', propertyId, payload })
  try {
    await upsertSale(propertyId, details)
  } catch (err) {
    throw new Error('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.', { cause: err })
  }
  const fee = Number(reservationFee)
  if (Number.isFinite(fee) && fee > 0) {
    await createPayment(propertyId, {
      entry_date: new Date().toISOString().slice(0, 10),
      amount: fee,
      or_number: null,
      surcharge: 0,
      interest: 0,
      remarks: 'Reservation',
    })
  }
  logActivity('property', propertyId, 'reserve', { buyer: details.buyer_name }).catch(() => {})
  return saved
}

export async function completeReservationWithDownpayment({ propertyId, payload, details, downpayment, terms, monthlyAmortization }) {
  const saved = await savePropertyWithCommission({ mode: 'edit', propertyId, payload })
  try {
    await upsertSale(propertyId, details)
  } catch (err) {
    throw new Error('Reservation recorded, but the buyer details failed to save. Cancel the reservation and try again.', { cause: err })
  }
  await createPayment(propertyId, {
    entry_date: new Date().toISOString().slice(0, 10),
    amount: downpayment,
    or_number: null,
    surcharge: 0,
    interest: 0,
    remarks: 'Downpayment',
  })
  logActivity('property', propertyId, 'downpayment', { downpayment, terms }).catch(() => {})
  return saved
}

export async function updateSale(propertyId, updates) {
  const { data, error } = await supabase
    .from('sales')
    .update(updates)
    .eq('property_id', propertyId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function cancelReservation(propertyId) {
  const { data, error } = await supabase
    .from('properties')
    .update({ status: 'available', sold_by: null, sold_at: null })
    .eq('id', propertyId)
    .eq('status', 'reserved')
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Only reserved lots can have their reservation cancelled.')
  }

  const { error: saleError } = await supabase.from('sales').delete().eq('property_id', propertyId)
  if (saleError) throw saleError

  const { error: paymentError } = await supabase.from('payments').delete().eq('property_id', propertyId)
  if (paymentError) throw paymentError
  logActivity('property', propertyId, 'cancel_reservation').catch(() => {})
}

export async function completeDownpayment({ propertyId, payload, downpayment, terms, monthlyAmortization }) {
  await updateSale(propertyId, { downpayment, terms_of_payment: terms, monthly_amortization: monthlyAmortization })
  await createPayment(propertyId, {
    entry_date: new Date().toISOString().slice(0, 10),
    amount: downpayment,
    or_number: null,
    surcharge: 0,
    interest: 0,
    remarks: 'Downpayment',
  })
  const saved = await savePropertyWithCommission({ mode: 'edit', propertyId, payload })
  logActivity('property', propertyId, 'downpayment', { downpayment, terms }).catch(() => {})
  return saved
}

export async function fetchMySales(agentId) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('sold_by', agentId)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function fetchTeamSales(agentIds) {
  if (!agentIds || agentIds.length === 0) return []
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .in('sold_by', agentIds)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCommissions(filters = {}) {
  let query = supabase
    .from('commissions')
    .select('*, properties(name), agents(name, role)')
    .order('created_at', { ascending: false })
  if (filters.agentId) query = query.eq('agent_id', filters.agentId)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function markCommissionPaid(id) {
  const { data, error } = await supabase
    .from('commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'earned')
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Commission is already paid.')
  logActivity('commission', id, 'paid', { amount: data.amount }).catch(() => {})
  return data
}
