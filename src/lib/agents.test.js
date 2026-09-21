import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  applyEligiblePromotions,
  createAgent,
  fetchAllAgents,
  fetchCommissionRates,
  fetchCommissionRatesMap,
  fetchCurrentAgent,
  fetchMyDownline,
  fetchSoldCounts,
  setAgentActive,
  updateCommissionRates,
} from './agents.js'

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))
vi.mock('./api.js', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))

import { supabase } from './supabase.js'
import { logActivity } from './api.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'neq', 'in', 'upsert']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return c
}

const admin = { id: 'admin1', user_id: 'u-admin', email: 'admin@x.com', name: 'Admin', role: 'admin', is_active: true }
const sub = { id: 'a1', user_id: 'u1', email: 'sub@x.com', name: 'Sub', role: 'sub_agent', upline_id: null, is_active: true }

describe('agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockReset()
  })

  it('fetchCurrentAgent resolves the signed-in user row', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const c = chain({ data: sub, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchCurrentAgent()

    expect(supabase.from).toHaveBeenCalledWith('agents')
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(c.single).toHaveBeenCalled()
    expect(result).toEqual(sub)
  })

  it('fetchAllAgents returns every row', async () => {
    supabase.from.mockReturnValue(chain({ data: [admin, sub], error: null }))

    const result = await fetchAllAgents()

    expect(result).toEqual([admin, sub])
  })

  it('fetchMyDownline excludes self and admin rows', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    supabase.from
      .mockImplementationOnce(() => chain({ data: sub, error: null }))
      .mockImplementationOnce(() => chain({ data: [admin, sub, { ...sub, id: 'a2', name: 'Downline' }], error: null }))

    const result = await fetchMyDownline()

    expect(result).toEqual([{ ...sub, id: 'a2', name: 'Downline' }])
  })

  it('setAgentActive updates the flag and logs it', async () => {
    const updated = { ...sub, is_active: false }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    const result = await setAgentActive('a1', false)

    expect(c.update).toHaveBeenCalledWith({ is_active: false })
    expect(c.eq).toHaveBeenCalledWith('id', 'a1')
    expect(result).toEqual(updated)
    expect(logActivity).toHaveBeenCalledWith('agent', 'a1', 'deactivate')
  })

  it('fetchCommissionRates returns configured rows', async () => {
    const rows = [{ role: 'sub_agent', rate: 0.03 }]
    supabase.from.mockReturnValue(chain({ data: rows, error: null }))

    expect(await fetchCommissionRates()).toEqual(rows)
  })

  it('fetchCommissionRatesMap coerces rates to numbers', async () => {
    supabase.from.mockReturnValue(chain({ data: [{ role: 'sub_agent', rate: '0.0300' }], error: null }))

    expect(await fetchCommissionRatesMap()).toEqual({ sub_agent: 0.03 })
  })

  it('updateCommissionRates upserts by role', async () => {
    const c = chain({ data: [], error: null })
    supabase.from.mockReturnValue(c)

    await updateCommissionRates({ sub_agent: 0.05 })

    expect(supabase.from).toHaveBeenCalledWith('commission_settings')
    expect(c.upsert).toHaveBeenCalledWith([{ role: 'sub_agent', rate: 0.05 }], { onConflict: 'role' })
  })

  it('fetchSoldCounts aggregates sold lots per agent', async () => {
    supabase.from.mockReturnValue(
      chain({
        data: [{ sold_by: 'a1' }, { sold_by: 'a1' }, { sold_by: 'a2' }, { sold_by: null }],
        error: null,
      }),
    )

    expect(await fetchSoldCounts()).toEqual({ a1: 2, a2: 1 })
  })

  it('applyEligiblePromotions promotes an eligible sub agent and logs it', async () => {
    const recruits = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      name: `Recruit ${i}`,
      role: 'sub_agent',
      upline_id: 'a1',
      is_active: true,
    }))
    const agents = [{ ...sub, id: 'a1' }, ...recruits]
    const sold = Array.from({ length: 5 }, () => ({ sold_by: 'a1' }))
    const updateChain = chain({ data: { ...sub, role: 'direct_agent' }, error: null })

    supabase.from
      .mockImplementationOnce(() => chain({ data: agents, error: null }))
      .mockImplementationOnce(() => chain({ data: sold, error: null }))
      .mockImplementationOnce(() => updateChain)
      .mockImplementationOnce(() => chain({ data: [{ ...sub, role: 'direct_agent' }, ...recruits], error: null }))
      .mockImplementationOnce(() => chain({ data: sold, error: null }))

    const promoted = await applyEligiblePromotions()

    expect(updateChain.update).toHaveBeenCalledWith({ role: 'direct_agent' })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'a1')
    expect(promoted).toEqual([{ id: 'a1', name: 'Sub', from: 'sub_agent', to: 'direct_agent' }])
    expect(logActivity).toHaveBeenCalledWith('agent', 'a1', 'promote', {
      from: 'sub_agent',
      to: 'direct_agent',
      counts: { ownSales: 5, directRecruits: 5 },
    })
  })

  it('createAgent invokes the edge function and returns the new agent', async () => {
    const created = { id: 'a9', name: 'New', email: 'new@x.com', role: 'sub_agent' }
    supabase.functions.invoke.mockResolvedValue({ data: { agent: created }, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: [], error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }))

    const result = await createAgent({
      name: 'New',
      email: 'new@x.com',
      phone: '0917',
      role: 'sub_agent',
      uplineId: 'a1',
      password: 'secret123',
    })

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-agent', {
      body: { name: 'New', email: 'new@x.com', phone: '0917', role: 'sub_agent', upline_id: 'a1', password: 'secret123' },
    })
    expect(result).toEqual(created)
  })

  it('createAgent surfaces the edge function error body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'Email already registered' }) },
      },
    })

    await expect(
      createAgent({ name: 'New', email: 'new@x.com', role: 'sub_agent', password: 'secret123' }),
    ).rejects.toThrow('Email already registered')
  })
})
