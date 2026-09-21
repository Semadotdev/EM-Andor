import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createLots,
  createProject,
  deleteLot,
  fetchProject,
  fetchProjectLots,
  fetchProjects,
  fetchProjectRates,
  fetchProjectRatesMap,
  lotPrice,
  repriceAvailableLots,
  updateLot,
  updateProject,
  upsertProjectRates,
} from './projects.js'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))
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
      pricePerSqm: 999.99,
      rates: { sub_agent: 0.03 },
    })

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'projects')
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'Andor Farm',
      type: 'farm_lot',
      address: 'Brgy. Andor',
      price_per_sqm: 999.99,
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

    await createProject({ name: 'Andor Farm', address: 'Brgy. Andor', pricePerSqm: 999.99 })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(logActivity).toHaveBeenCalledWith('project', 'pr9', 'create')
  })

  it('updateProject updates the project, upserts rates, and reprices available lots', async () => {
    const updateChain = chain({ data: { ...project, price_per_sqm: 1200 }, error: null })
    const ratesChain = chain({ data: [], error: null })
    const lotsChain = chain({ data: [{ id: 'lot1', lot_area_sqm: 250 }], error: null })
    const lotUpdateChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => updateChain)
      .mockImplementationOnce(() => ratesChain)
      .mockImplementationOnce(() => lotsChain)
      .mockImplementation(() => lotUpdateChain)

    const updated = await updateProject('pr1', {
      name: 'Andor Farm',
      type: 'farm_lot',
      address: 'Brgy. Andor',
      pricePerSqm: 1200,
      rates: { direct_agent: 0.01 },
    })

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'projects')
    expect(updateChain.update).toHaveBeenCalledWith({
      name: 'Andor Farm',
      type: 'farm_lot',
      address: 'Brgy. Andor',
      price_per_sqm: 1200,
    })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'pr1')
    expect(updateChain.single).toHaveBeenCalled()
    expect(ratesChain.upsert).toHaveBeenCalledWith(
      [{ project_id: 'pr1', role: 'direct_agent', rate: 0.01 }],
      { onConflict: 'project_id,role' },
    )
    expect(lotsChain.eq).toHaveBeenCalledWith('project_id', 'pr1')
    expect(lotsChain.eq).toHaveBeenCalledWith('status', 'available')
    expect(lotUpdateChain.update).toHaveBeenCalledWith({ price: 300000 })
    expect(lotUpdateChain.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(lotUpdateChain.eq).toHaveBeenCalledWith('status', 'available')
    expect(logActivity).toHaveBeenCalledWith('project', 'pr1', 'update')
    expect(updated.price_per_sqm).toBe(1200)
  })

  it('updateProject without rates skips the rates table but still reprices', async () => {
    const updateChain = chain({ data: { ...project, price_per_sqm: 1200 }, error: null })
    const lotsChain = chain({ data: [], error: null })
    supabase.from
      .mockImplementationOnce(() => updateChain)
      .mockImplementationOnce(() => lotsChain)

    await updateProject('pr1', { name: 'Andor Farm', address: 'Brgy. Andor', pricePerSqm: 1200 })

    expect(supabase.from).not.toHaveBeenCalledWith('project_commission_rates')
    expect(supabase.from).toHaveBeenCalledWith('properties')
  })

  it('repriceAvailableLots updates only available lots that have an area', async () => {
    const lotsChain = chain({
      data: [
        { id: 'lot1', lot_area_sqm: 250 },
        { id: 'lot2', lot_area_sqm: null },
      ],
      error: null,
    })
    const lotUpdateChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => lotsChain)
      .mockImplementation(() => lotUpdateChain)

    const repriced = await repriceAvailableLots('pr1', 1200)

    expect(repriced).toBe(1)
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(lotsChain.select).toHaveBeenCalledWith('id, lot_area_sqm')
    expect(lotsChain.eq).toHaveBeenCalledWith('project_id', 'pr1')
    expect(lotsChain.eq).toHaveBeenCalledWith('status', 'available')
    expect(lotUpdateChain.update).toHaveBeenCalledTimes(1)
    expect(lotUpdateChain.update).toHaveBeenCalledWith({ price: 300000 })
    expect(lotUpdateChain.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(lotUpdateChain.eq).toHaveBeenCalledWith('status', 'available')
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
    expect(c.select).toHaveBeenCalledWith('*')
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

  it('updateLot recomputes name and price from the project rate', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100 }
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
    })
    expect(c.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(c.select).toHaveBeenCalled()
    expect(c.single).toHaveBeenCalled()
  })

  it('updateLot falls back to the existing block, lot, and area', async () => {
    const lot = { id: 'lot1', project_id: 'pr1', block_no: '1', lot_no: '3', lot_area_sqm: 100 }
    const c = chain({ data: lot, error: null })
    supabase.from.mockReturnValue(c)

    await updateLot(lot, project, { area: 50 })

    expect(c.update).toHaveBeenCalledWith({
      block_no: '1',
      lot_no: '3',
      lot_area_sqm: 50,
      name: 'Block 1 Lot 3',
      price: 49999.5,
    })
  })

  it('deleteLot removes an available lot after checking its status', async () => {
    const readChain = chain({ data: { id: 'lot1', status: 'available' }, error: null })
    const deleteChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => readChain)
      .mockImplementationOnce(() => deleteChain)

    await deleteLot('lot1')

    expect(readChain.select).toHaveBeenCalledWith('id, status')
    expect(readChain.eq).toHaveBeenCalledWith('id', 'lot1')
    expect(readChain.single).toHaveBeenCalled()
    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'lot1')
  })

  it('deleteLot blocks a non-available lot', async () => {
    const readChain = chain({ data: { id: 'lot1', status: 'sold' }, error: null })
    supabase.from.mockReturnValue(readChain)

    await expect(deleteLot('lot1')).rejects.toThrow(
      'Only available lots can be deleted. Un-sell the lot first.',
    )
    expect(readChain.select).toHaveBeenCalledWith('id, status')
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('upsertProjectRates surfaces supabase errors', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: new Error('rates down') }))

    await expect(upsertProjectRates('pr1', { sub_agent: 0.03 })).rejects.toThrow('rates down')
  })
})
