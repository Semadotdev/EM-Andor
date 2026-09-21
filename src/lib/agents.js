import { supabase } from './supabase.js'
import { logActivity } from './api.js'
import { eligibleAgents } from './promotions.js'

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
  if (isActive) applyEligiblePromotions().catch(() => {})
  return data
}

export async function fetchSoldCounts() {
  const { data, error } = await supabase.from('properties').select('sold_by').eq('status', 'sold')
  if (error) throw error
  const counts = {}
  for (const row of data ?? []) {
    if (!row.sold_by) continue
    counts[row.sold_by] = (counts[row.sold_by] ?? 0) + 1
  }
  return counts
}

export async function applyEligiblePromotions() {
  const promoted = []
  for (let pass = 0; pass < 10; pass++) {
    const [agents, soldCounts] = await Promise.all([fetchAllAgents(), fetchSoldCounts()])
    const eligible = eligibleAgents(agents, soldCounts)
    let changed = false

    for (const { agent, eligibleFor, counts } of eligible.values()) {
      const { error } = await supabase.from('agents').update({ role: eligibleFor }).eq('id', agent.id)
      if (error) throw error
      logActivity('agent', agent.id, 'promote', { from: agent.role, to: eligibleFor, counts }).catch(() => {})
      promoted.push({ id: agent.id, name: agent.name, from: agent.role, to: eligibleFor })
      changed = true
    }

    if (!changed) break
  }
  return promoted
}

export async function createAgent({ name, email, phone, role, uplineId, password }) {
  const { data, error } = await supabase.functions.invoke('create-agent', {
    body: {
      name,
      email,
      phone: phone || null,
      role,
      upline_id: uplineId || null,
      password,
    },
  })

  if (error) {
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch {
      // keep the SDK message when the body cannot be read
    }
    throw new Error(message || 'Could not create the agent account.')
  }
  if (data?.error) throw new Error(data.error)

  await applyEligiblePromotions()
  return data.agent
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
