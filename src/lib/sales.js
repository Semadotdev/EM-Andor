import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { buildCommissionRows, validateSale, MAX_COMMISSION_LEVELS } from './commissions.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'

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

  while (current && !seen.has(current.id) && current.role !== 'admin' && chain.length < MAX_COMMISSION_LEVELS) {
    seen.add(current.id)
    chain.push(current)
    current = current.upline_id ? byId.get(current.upline_id) : null
  }
  return chain
}

async function createCommissionRows(property) {
  const [rates, chain] = await Promise.all([
    fetchCommissionRatesMap(),
    resolveChainForAgent(property.sold_by),
  ])
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
