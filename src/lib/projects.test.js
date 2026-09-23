import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createLots,
  createProject,
  deleteLot,
  deleteProject,
  fetchProject,
  fetchProjectLots,
  fetchProjects,
  fetchProjectRates,
  fetchProjectRatesMap,
  lotPrice,
  resolveLotPrice,
  updateLot,
  updateProject,
  upsertProjectRates,
} from './projects.js'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('./api.js', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))

import { supabase } from './supabase.js'
import { logActivity } from './api.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'maybeSingle', 'neq', 'in', 'upsert', 'limit']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return c
}

const project = {
  id: 'pr1',
  name: 'Andor Farm',
  type: 'farm_lot',
  address: 'Brgy. Andor',
  price_per_sqm: 999.99,
}

describe('projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lotPrice rounds to the nearest centavo', () => {
    expect(lotPrice(100.001, 999.99)).toBe(100000)
    expect(lotPrice(200, 999.99)).toBe(199998)
    expect(lotPrice(250, 1200)).toBe(300000)
  })

  it('fetchProjects lists newest first', async () => {
    const c = chain({ data: [project], error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchProjects()).toEqual([project])
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(c.select).toHaveBeenCalledWith('*')
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('fetchProjects returns an empty list when data is null', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }))

    expect(await fetchProjects()).toEqual([])
  })

  it('fetchProject loads one project by id', async () => {
    const c = chain({ data: project, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchProject('pr1')).toEqual(project)
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(c.select).toHaveBeenCalledWith('*')
    expect(c.eq).toHaveBeenCalledWith('id', 'pr1')
    expect(c.single).toHaveBeenCalled()
  })

  it('fetchProject surfaces supabase errors', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: new Error('boom') }))

    await expect(fetchProject('pr1')).rejects.toThrow('boom')
  })

  it('fetchProjectRates loads the rows for a project', async () => {
    const rows = [
      { id: 'r1', project_id: 'pr1', role: 'sub_agent', rate: 0.03 },
      { id: 'r2', project_id: 'pr1', role: 'direct_agent', rate: 0.015 },
    ]
    const c = chain({ data: rows, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchProjectRates('pr1')).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('project_commission_rates')
    expect(c.select).toHaveBeenCalledWith('*')
    expect(c.eq).toHaveBeenCalledWith('project_id', 'pr1')
  })

  it('fetchProjectRatesMap turns rows into a numeric role map', async () => {
    const c = chain({
      data: [
        { role: 'sub_agent', rate: '0.0300' },
        { role: 'direct_agent', rate: 0.015 },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(c)

    expect(await fetchProjectRatesMap('pr1')).toEqual({ sub_agent: 0.03, direct_agent: 0.015 })
    expect(c.eq).toHaveBeenCalledWith('project_id', 'pr1')
  })

  it('fetchProjectRatesMap returns an empty map without a project id', async () => {
    expect(await fetchProjectRatesMap(null)).toEqual({})
    expect(await fetchProjectRatesMap(undefined)).toEqual({})
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('upsertProjectRates upserts one row per role', async () => {
    const c = chain({ data: [{ id: 'r1' }, { id: 'r2' }], error: null })
    supabase.from.mockReturnValue(c)

    const rows = await upsertProjectRates('pr1', { sub_agent: 0.03, direct_agent: 0.015 })

    expect(rows).toHaveLength(2)
    expect(supabase.from).toHaveBeenCalledWith('project_commission_rates')
    expect(c.upsert).toHaveBeenCalledWith(
      [
        { project_id: 'pr1', role: 'sub_agent', rate: 0.03 },
        { project_id: 'pr1', role: 'direct_agent', rate: 0.015 },
      ],
      { onConflict: 'project_id,role' },
    )
  })

  it('upsertProjectRates skips the query when there are no rates', async () => {
    expect(await upsertProjectRates('pr1', {})).toEqual([])
    expect(await upsertProjectRates('pr1')).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('createProject inserts the project, upserts rates, and logs', async () => {
    const insertChain = chain({ data: { ...project, id: 'pr9' }, error: null })
    const ratesChain = chain({ data: [], error: null })
    supabase.from
      .mockImplementationOnce(() => insertChain)
      .mockImplementationOnce(() => ratesChain)

    const created = await createProject({
      name: 'Andor Farm',
      address: 'Brgy. Andor',
      rates: { sub_agent: 0.03 },
    })

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'projects')
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'Andor Farm',
      type: 'farm_lot',
      address: 'Brgy. Andor',
    })
    expect(insertChain.select).toHaveBeenCalled()
    expect(insertChain.single).toHaveBeenCalled()
    expect(ratesChain.upsert).toHaveBeenCalledWith(
      [{ project_id: 'pr9', role: 'sub_agent', rate: 0.03 }],
      { onConflict: 'project_id,role' },
    )
    expect(logActivity).toHaveBeenCalledWith('project', 'pr9', 'create')
    expect(created.id).toBe('pr9')
  })

  it('createProject without rates only inserts the project', async () => {
    const insertChain = chain({ data: { ...project, id: 'pr9' }, error: null })
    supabase.from.mockReturnValue(insertChain)

    await createProject({ name: 'Andor Farm', address: 'Brgy. Andor' })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(logActivity).toHaveBeenCalledWith('project', 'pr9', 'create')
  })

  it('updateProject updates the project and upserts rates', async () => {
    const updateChain = chain({ data: { ...project, name: 'Andor Farm Updated' }, error: null })
    const ratesChain = chain({ data: [], error: null })
    supabase.from
      .mockImplementationOnce(() => updateChain)
      .mockImplementationOnce(() => ratesChain)

    const updated = await updateProject('pr1', {
      name: 'Andor Farm Updated',
      type: 'farm_lot',
      address: 'Brgy. Andor',
      rates: { direct_agent: 0.01 },
    })

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'projects')
    expect(updateChain.update).toHaveBeenCalledWith({
      name: 'Andor Farm Updated',
      type: 'farm_lot',
      address: 'Brgy. Andor',
    })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'pr1')
    expect(updateChain.single).toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalledWith('properties')
    expect(ratesChain.upsert).toHaveBeenCalledWith(
      [{ project_id: 'pr1', role: 'direct_agent', rate: 0.01 }],
      { onConflict: 'project_id,role' },
    )
    expect(logActivity).toHaveBeenCalledWith('project', 'pr1', 'update')
    expect(updated.name).toBe('Andor Farm Updated')
  })

  it('updateProject without rates skips the rates table', async () => {
    const updateChain = chain({ data: { ...project }, error: null })
    supabase.from.mockReturnValue(updateChain)

    await updateProject('pr1', { name: 'Andor Farm', address: 'Brgy. Andor' })

    expect(supabase.from).not.toHaveBeenCalledWith('project_commission_rates')
    expect(supabase.from).not.toHaveBeenCalledWith('properties')
  })

  it('resolveLotPrice uses the row total first, then price per m², then the project rate', () => {
    const row = { rowNumber: 2, block_no: '1', lot_no: '2', area: 100 }

    expect(resolveLotPrice({ ...row, price: 750000 }, project)).toBe(750000)
    expect(resolveLotPrice({ ...row, price_per_sqm: 6500 }, project)).toBe(650000)
    expect(resolveLotPrice(row, project)).toBe(99999)
    expect(resolveLotPrice({ ...row, price: 0, price_per_sqm: 6500 }, project)).toBe(650000)
  })

  it('resolveLotPrice leaves the price unset when nothing is priced', () => {
    const noRate = { ...project, price_per_sqm: null }
    expect(resolveLotPrice({ rowNumber: 2, block_no: '1', lot_no: '2', area: 100 }, noRate)).toBeUndefined()
    expect(resolveLotPrice({ rowNumber: 2, block_no: '1', lot_no: '2', area: 100 }, {})).toBeUndefined()
  })

  it('fetchProjectLots filters by project and sorts by block then lot', async () => {
    const lots = [
      { id: 'lot1', block_no: '1', lot_no: '2' },
      { id: 'lot2', block_no: '1', lot_no: '10' },
    ]
    const c = chain({ data: lots, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchProjectLots('pr1')).toEqual(lots)
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.select).toHaveBeenCalledWith('*, sales(buyer_name)')
    expect(c.eq).toHaveBeenCalledWith('project_id', 'pr1')
    expect(c.order).toHaveBeenNthCalledWith(1, 'block_no', { ascending: true })
    expect(c.order).toHaveBeenNthCalledWith(2, 'lot_no', { ascending: true })
  })

  it('createLots derives name, type, location, and price per row', async () => {
    const rows = [
      { rowNumber: 2, block_no: '1', lot_no: '3', area: 100.001 },
      { rowNumber: 3, block_no: '2', lot_no: '1', area: 200 },
    ]
    const inserted = [{ id: 'p1' }, { id: 'p2' }]
    const c = chain({ data: inserted, error: null })
    supabase.from.mockReturnValue(c)

    const created = await createLots('pr1', project, rows)

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.insert).toHaveBeenCalledWith([
      {
        project_id: 'pr1',
        name: 'Block 1 Lot 3',
        type: 'farm lot',
        location: 'Brgy. Andor',
        block_no: '1',
        lot_no: '3',
        lot_area_sqm: 100.001,
        price: 100000,
        price_per_sqm: 999.99,
        status: 'available',
        is_pinned: false,
        map_pins: [],
      },
      {
        project_id: 'pr1',
        name: 'Block 2 Lot 1',
        type: 'farm lot',
        location: 'Brgy. Andor',
        block_no: '2',
        lot_no: '1',
        lot_area_sqm: 200,
        price: 199998,
        price_per_sqm: 999.99,
        status: 'available',
        is_pinned: false,
        map_pins: [],
      },
    ])
    expect(logActivity).toHaveBeenCalledWith('project', 'pr1', 'import_lots', { count: 2 })
    expect(created).toEqual(inserted)
  })

  it('createLots skips the insert when there are no rows', async () => {
    expect(await createLots('pr1', project, [])).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('createLots uses the excel total price and per-m² price when present', async () => {
    const rows = [
      { rowNumber: 2, block_no: '1', lot_no: '3', area: 100, price: 750000, lot_location: 'Corner' },
      { rowNumber: 3, block_no: '2', lot_no: '1', area: 200, price_per_sqm: 6500, lot_location: 'Inner' },
    ]
    const c = chain({ data: [{ id: 'p1' }, { id: 'p2' }], error: null })
    supabase.from.mockReturnValue(c)

    await createLots('pr1', project, rows)

    const payload = c.insert.mock.calls[0][0]
    expect(payload).toHaveLength(2)
    expect(payload[0]).toMatchObject({ block_no: '1', lot_no: '3', price: 750000, description: 'Corner' })
    expect(payload[1]).toMatchObject({ block_no: '2', lot_no: '1', price: 1300000, description: 'Inner' })
  })

  it('createLots stores price_per_sqm from the excel or derives it from the resolved price', async () => {
    const rows = [
      { rowNumber: 2, block_no: '1', lot_no: '3', area: 100, price_per_sqm: 6500 },
      { rowNumber: 3, block_no: '2', lot_no: '1', area: 100, price: 750000 },
      { rowNumber: 4, block_no: '3', lot_no: '1', area: 100 },
    ]
    const c = chain({ data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], error: null })
    supabase.from.mockReturnValue(c)

    await createLots('pr1', project, rows)

    const payload = c.insert.mock.calls[0][0]
    expect(payload[0]).toMatchObject({ price: 650000, price_per_sqm: 6500 })
    expect(payload[1]).toMatchObject({ price: 750000, price_per_sqm: 7500 })
    expect(payload[2]).toMatchObject({ price: 99999, price_per_sqm: 999.99 })
  })

  it('createLots leaves the price unset when neither the excel nor the project has a price', async () => {
    const noRate = { ...project, price_per_sqm: null }
    const rows = [{ rowNumber: 2, block_no: '1', lot_no: '3', area: 100 }]
    const c = chain({ data: [{ id: 'p1' }], error: null })
    supabase.from.mockReturnValue(c)

    await createLots('pr1', noRate, rows)

    const payload = c.insert.mock.calls[0][0]
    expect(payload[0]).toMatchObject({ block_no: '1', lot_no: '3', lot_area_sqm: 100 })
    expect(payload[0]).not.toHaveProperty('price')
  })

  it('updateLot recomputes name and price from the project rate', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100, status: 'available' }
    const updated = { ...lot, block_no: '2', lot_no: '5', lot_area_sqm: 120 }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    expect(await updateLot(lot, project, { block_no: '2', lot_no: '5', area: 120 })).toEqual(updated)
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.update).toHaveBeenCalledWith({
      block_no: '2',
      lot_no: '5',
      lot_area_sqm: 120,
      name: 'Block 2 Lot 5',
      price: 119998.8,
      price_per_sqm: 999.99,
    })
    expect(c.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(c.select).toHaveBeenCalled()
    expect(c.single).toHaveBeenCalled()
  })

  it('updateLot falls back to the existing block, lot, and area', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100, status: 'available' }
    const c = chain({ data: lot, error: null })
    supabase.from.mockReturnValue(c)

    await updateLot(lot, project, { area: 50 })

    expect(c.update).toHaveBeenCalledWith({
      block_no: '1',
      lot_no: '3',
      lot_area_sqm: 50,
      name: 'Block 1 Lot 3',
      price: 49999.5,
      price_per_sqm: 999.99,
    })
  })

  it('updateLot keeps a sold lot price and area while renaming it', async () => {
    const lot = {
      id: 'lot1',
      project_id: 'pr1',
      block_no: '1',
      lot_no: '3',
      lot_area_sqm: 100,
      price: 95000,
      status: 'sold',
    }
    const updated = { ...lot, block_no: '2', lot_no: '5' }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    expect(await updateLot(lot, project, { block_no: '2', lot_no: '5', area: 250 })).toEqual(updated)
    expect(c.update).toHaveBeenCalledWith({
      block_no: '2',
      lot_no: '5',
      name: 'Block 2 Lot 5',
    })
  })

  it('updateLot reprices from the stored per-m² rate when only the area changes', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100, price: 800000, price_per_sqm: 8000, status: 'available' }
    const updated = { ...lot, lot_area_sqm: 120 }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    await updateLot(lot, project, { area: 120 })

    expect(c.update).toHaveBeenCalledWith({
      block_no: '1',
      lot_no: '3',
      name: 'Block 1 Lot 3',
      lot_area_sqm: 120,
      price: 960000,
      price_per_sqm: 8000,
    })
  })

  it('updateLot uses an explicitly edited per-m² price and reprices the total', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100, price: 800000, price_per_sqm: 8000, status: 'available' }
    const updated = { ...lot, lot_area_sqm: 120, price: 1200000, price_per_sqm: 10000 }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    await updateLot(lot, project, { area: 120, price_per_sqm: 10000 })

    expect(c.update).toHaveBeenCalledWith({
      block_no: '1',
      lot_no: '3',
      name: 'Block 1 Lot 3',
      lot_area_sqm: 120,
      price: 1200000,
      price_per_sqm: 10000,
    })
  })

  it('updateLot does not reprice available lots when the project has no price', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100, status: 'available' }
    const updated = { ...lot, block_no: '2', lot_no: '5', lot_area_sqm: 120 }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    expect(await updateLot(lot, { ...project, price_per_sqm: null }, { block_no: '2', lot_no: '5', area: 120 })).toEqual(updated)
    expect(c.update).toHaveBeenCalledWith({
      block_no: '2',
      lot_no: '5',
      name: 'Block 2 Lot 5',
      lot_area_sqm: 120,
    })
  })

  it('deleteLot deletes an available lot in one guarded statement', async () => {
    const deleteChain = chain({ data: [{ id: 'lot1' }], error: null })
    supabase.from.mockImplementationOnce(() => deleteChain)

    await deleteLot('lot1')

    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(deleteChain.eq).toHaveBeenCalledWith('status', 'available')
    expect(deleteChain.select).toHaveBeenCalledWith('id')
    expect(logActivity).toHaveBeenCalledWith('property', 'lot1', 'delete')
  })

  it('deleteLot blocks a non-available lot', async () => {
    supabase.from.mockReturnValue(chain({ data: [], error: null }))

    await expect(deleteLot('lot1')).rejects.toThrow(
      'Only available lots can be deleted. Un-sell the lot first.',
    )
  })

  it('createProject rolls back the project when the rates upsert fails', async () => {
    const insertChain = chain({ data: { ...project, id: 'pr9' }, error: null })
    const ratesChain = chain({ data: null, error: new Error('rates down') })
    const rollbackChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => insertChain)
      .mockImplementationOnce(() => ratesChain)
      .mockImplementationOnce(() => rollbackChain)

    await expect(
      createProject({
        name: 'Andor Farm',
        address: 'Brgy. Andor',
        rates: { sub_agent: 0.03 },
      }),
    ).rejects.toThrow('rates down')

    expect(rollbackChain.delete).toHaveBeenCalled()
    expect(rollbackChain.eq).toHaveBeenCalledWith('id', 'pr9')
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('upsertProjectRates surfaces supabase errors', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: new Error('rates down') }))

    await expect(upsertProjectRates('pr1', { sub_agent: 0.03 })).rejects.toThrow('rates down')
  })

  it('deleteProject invokes the delete-project edge function and logs the activity', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })

    await deleteProject('pr1', 'secret')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-project', {
      body: { project_id: 'pr1', password: 'secret' },
    })
    expect(logActivity).toHaveBeenCalledWith('project', 'pr1', 'delete')
  })

  it('deleteProject surfaces the edge function error body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'Incorrect password.' }) },
      },
    })

    await expect(deleteProject('pr1', 'wrong')).rejects.toThrow('Incorrect password.')
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('deleteProject rejects when the response has a data error', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { error: 'The delete_project helper is not installed. Run the database migration first.' },
      error: null,
    })

    await expect(deleteProject('pr1', 'secret')).rejects.toThrow('The delete_project helper is not installed')
    expect(logActivity).not.toHaveBeenCalled()
  })
})
