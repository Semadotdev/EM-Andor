import { supabase } from './supabase.js'
import { logActivity } from './api.js'

export function lotPrice(area, pricePerSqm) {
  return Math.round(Number(area) * Number(pricePerSqm) * 100) / 100
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchProject(id) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function fetchProjectRates(projectId) {
  const { data, error } = await supabase
    .from('project_commission_rates')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return data ?? []
}

export async function fetchProjectRatesMap(projectId) {
  if (!projectId) return {}
  const rows = await fetchProjectRates(projectId)
  return Object.fromEntries(rows.map((row) => [row.role, Number(row.rate)]))
}

export async function upsertProjectRates(projectId, rates) {
  const rows = Object.entries(rates ?? {}).map(([role, rate]) => ({
    project_id: projectId,
    role,
    rate,
  }))
  if (rows.length === 0) return []

  const { data, error } = await supabase
    .from('project_commission_rates')
    .upsert(rows, { onConflict: 'project_id,role' })
    .select()
  if (error) throw error
  return data ?? []
}

export async function createProject({ name, type = 'farm_lot', address, pricePerSqm, rates = {} }) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, type, address, price_per_sqm: pricePerSqm })
    .select()
    .single()
  if (error) throw error

  await upsertProjectRates(data.id, rates)
  logActivity('project', data.id, 'create').catch(() => {})
  return data
}

export async function updateProject(id, { name, type, address, pricePerSqm, rates }) {
  const { data, error } = await supabase
    .from('projects')
    .update({ name, type, address, price_per_sqm: pricePerSqm })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (rates !== undefined) {
    await upsertProjectRates(id, rates)
  }
  await repriceAvailableLots(id, data.price_per_sqm)
  logActivity('project', id, 'update').catch(() => {})
  return data
}

export async function repriceAvailableLots(projectId, pricePerSqm) {
  const { data, error } = await supabase
    .from('properties')
    .select('id, lot_area_sqm')
    .eq('project_id', projectId)
    .eq('status', 'available')
  if (error) throw error

  let repriced = 0
  for (const lot of data ?? []) {
    if (lot.lot_area_sqm === null || lot.lot_area_sqm === undefined) continue
    const { error: updateError } = await supabase
      .from('properties')
      .update({ price: lotPrice(lot.lot_area_sqm, pricePerSqm) })
      .eq('id', lot.id)
      .eq('status', 'available')
    if (updateError) throw updateError
    repriced++
  }
  return repriced
}

export async function fetchProjectLots(projectId) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('project_id', projectId)
    .order('block_no', { ascending: true })
    .order('lot_no', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createLots(projectId, project, rows) {
  if (!rows || rows.length === 0) return []

  const payload = rows.map((row) => ({
    project_id: projectId,
    name: `Block ${row.block_no} Lot ${row.lot_no}`,
    type: 'farm lot',
    location: project.address,
    block_no: row.block_no,
    lot_no: row.lot_no,
    lot_area_sqm: row.area,
    price: lotPrice(row.area, project.price_per_sqm),
    status: 'available',
    is_pinned: false,
    map_pins: [],
  }))

  const { data, error } = await supabase.from('properties').insert(payload).select()
  if (error) throw error

  logActivity('project', projectId, 'import_lots', { count: payload.length }).catch(() => {})
  return data ?? []
}

export async function updateLot(lot, project, updates = {}) {
  const blockNo = updates.block_no ?? lot.block_no
  const lotNo = updates.lot_no ?? lot.lot_no
  const area = updates.area ?? lot.lot_area_sqm

  const { data, error } = await supabase
    .from('properties')
    .update({
      block_no: blockNo,
      lot_no: lotNo,
      lot_area_sqm: area,
      name: `Block ${blockNo} Lot ${lotNo}`,
      price: lotPrice(area, project.price_per_sqm),
    })
    .eq('id', lot.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLot(id) {
  const { data, error } = await supabase.from('properties').select('id, status').eq('id', id).single()
  if (error) throw error

  if (data?.status !== 'available') {
    throw new Error('Only available lots can be deleted. Un-sell the lot first.')
  }

  const { error: deleteError } = await supabase.from('properties').delete().eq('id', id)
  if (deleteError) throw deleteError
}
