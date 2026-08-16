import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createProperty,
  deleteInquiry,
  deleteProperty,
  fetchInquiries,
  fetchPinnedProperties,
  fetchProperties,
  setInquiryRead,
  setPropertyPinned,
  submitInquiry,
  updateProperty,
  uploadPropertyImage,
} from './api.js'

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabase } from './supabase.js'

function makeChain() {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single', 'insert']) {
    c[m] = vi.fn(() => c)
  }
  return c
}

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchPinnedProperties reads pinned properties newest first', async () => {
    const data = [{ id: 'p1', name: 'Lot A' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchPinnedProperties()

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.select).toHaveBeenCalledWith('*')
    expect(c.eq).toHaveBeenCalledWith('is_pinned', true)
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(data)
  })

  it('fetchProperties reads all properties newest first', async () => {
    const data = [{ id: 'p1' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchProperties()

    expect(c.eq).not.toHaveBeenCalled()
    expect(result).toEqual(data)
  })

  it('submitInquiry inserts the inquiry', async () => {
    const inquiry = { name: 'Juan', email: 'juan@example.com', phone: '0917', project_type: null, message: 'Hi' }
    const c = makeChain()
    c.insert.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await submitInquiry(inquiry)

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(c.insert).toHaveBeenCalledWith(inquiry)
  })

  it('createProperty inserts and returns the new row', async () => {
    const row = { id: 'p1', name: 'Lot A' }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await createProperty({ name: 'Lot A' })

    expect(c.insert).toHaveBeenCalledWith({ name: 'Lot A' })
    expect(c.single).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('updateProperty updates by id and returns the row', async () => {
    const row = { id: 'p1', name: 'Lot A edited' }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await updateProperty('p1', { name: 'Lot A edited' })

    expect(c.update).toHaveBeenCalledWith({ name: 'Lot A edited' })
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
    expect(result).toEqual(row)
  })

  it('setPropertyPinned updates only is_pinned', async () => {
    const row = { id: 'p1', is_pinned: true }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    await setPropertyPinned('p1', true)

    expect(c.update).toHaveBeenCalledWith({ is_pinned: true })
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('deleteProperty deletes by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await deleteProperty('p1')

    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('fetchInquiries reads all inquiries newest first', async () => {
    const data = [{ id: 'q1' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchInquiries()

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(result).toEqual(data)
  })

  it('setInquiryRead updates is_read by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await setInquiryRead('q1', true)

    expect(c.update).toHaveBeenCalledWith({ is_read: true })
    expect(c.eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('deleteInquiry deletes by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await deleteInquiry('q1')

    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('uploadPropertyImage uploads and returns public URL', async () => {
    const file = new File(['img'], 'lot-a.jpg', { type: 'image/jpeg' })
    const bucket = {
      upload: vi.fn().mockResolvedValue({ data: { path: 'abc.jpg' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/abc.jpg' } }),
    }
    supabase.storage.from.mockReturnValue(bucket)

    const url = await uploadPropertyImage(file)

    expect(supabase.storage.from).toHaveBeenCalledWith('property-images')
    expect(bucket.upload).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), file)
    expect(url).toBe('https://cdn.example.com/abc.jpg')
  })

  it('throws when a query returns an error', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: null, error: new Error('boom') })
    supabase.from.mockReturnValue(c)

    await expect(fetchProperties()).rejects.toThrow('boom')
  })
})
