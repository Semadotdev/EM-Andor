import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  fetchAllAgents,
  fetchCommissionRates,
  fetchCurrentAgent,
  fetchMyDownline,
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
  beforeEach(() => vi.clearAllMocks())

  it('fetchCurrentAgent resolves the signed-in user row', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    supabase.from.mockReturnValue(chain({ data: sub, error: null }))

    const result = await fetchCurrentAgent()

    expect(supabase.from).toHaveBeenCalledWith('agents')
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
    supabase.from.mockReturnValue(chain({ data: { ...sub, is_active: false }, error: null }))

    const result = await setAgentActive('a1', false)

    expect(result.is_active).toBe(false)
    expect(supabase.from).toHaveBeenCalledWith('agents')
  })

  it('fetchCommissionRates returns configured rows', async () => {
    const rows = [{ role: 'sub_agent', rate: 0.03 }]
    supabase.from.mockReturnValue(chain({ data: rows, error: null }))

    expect(await fetchCommissionRates()).toEqual(rows)
  })

  it('updateCommissionRates upserts by role', async () => {
    supabase.from.mockReturnValue(chain({ data: [], error: null }))

    await updateCommissionRates({ sub_agent: 0.05 })

    expect(supabase.from).toHaveBeenCalledWith('commission_settings')
  })
})
