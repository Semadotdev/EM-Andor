import { supabase } from './supabase.js'
import { logActivity } from './api.js'

export async function fetchCurrentAgent() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No active session.')
  const { data, error } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
  if (error) throw error
  return data
}

export async function fetchAllAgents() {
  const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchMyDownline() {
  const me = await fetchCurrentAgent()
  const { data, error } = await supabase.from('agents').select('*').neq('id', me.id).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).filter((a) => a.role !== 'admin' && a.id !== me.id)
}

export async function setAgentActive(id, isActive) {
  const { data, error } = await supabase.from('agents').update({ is_active: isActive }).eq('id', id).select().single()
  if (error) throw error
  logActivity('agent', id, isActive ? 'activate' : 'deactivate').catch(() => {})
  return data
}

export async function fetchCommissionRates() {
  const { data, error } = await supabase.from('commission_settings').select('*').order('role')
  if (error) throw error
  return data ?? []
}

export async function fetchCommissionRatesMap() {
  const rows = await fetchCommissionRates()
  return Object.fromEntries(rows.map((r) => [r.role, Number(r.rate)]))
}

export async function updateCommissionRates(rates) {
  const rows = Object.entries(rates).map(([role, rate]) => ({ role, rate: Number(rate) }))
  const { data, error } = await supabase.from('commission_settings').upsert(rows, { onConflict: 'role' }).select()
  if (error) throw error
  return data ?? []
}
