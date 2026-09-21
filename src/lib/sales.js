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
  const rates = await fetchCommissionRatesMap()
  const chain = await resolveChainForAgent(property.sold_by)
  const { rows, warnings } = buildCommissionRows(Number(property.price), chain, rates)
  if (rows.length === 0) return []

  const payload = rows.map((row) => ({ ...row, property_id: property.id, status: 'earned' }))
  const { data, error } = await supabase.from('commissions').insert(payload).select()
  if (error) throw error

  for (const warning of warnings) {
    logActivity('commission', property.id, 'skip', { warning }).catch(() => {})
  }
  for (const row of data ?? []) {
    logActivity('commission', row.agent_id, 'earned', { property_id: property.id, amount: row.amount }).catch(() => {})
  }
  return data ?? []
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
    if (Object.keys(fieldErrors).length > 0) {
      const error = new Error('Validation failed')
      error.fieldErrors = fieldErrors
      throw error
    }
  }

  const wasSold = existing?.status === 'sold'
  const sellerChanged = wasSold && existing.sold_by !== payload.sold_by
  const commissionStateChanged = isSold && (!wasSold || sellerChanged)

  if (wasSold && (!isSold || sellerChanged)) {
    await clearCommissionsForProperty(propertyId)
  }

  const saved = mode === 'edit' ? await updateProperty(propertyId, payload) : await createProperty(payload)

  if (commissionStateChanged) {
    await createCommissionRows(saved)
  }

  await applyEligiblePromotions()
  return saved
}
