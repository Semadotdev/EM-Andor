import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  bulkDeleteInquiries,
  bulkDeleteProperties,
  bulkSetInquiryRead,
  bulkSetPropertyPinned,
  bulkUpdatePropertyStatus,
  createProperty,
  deleteInquiry,
  deleteProperty,
  fetchInquiries,
  fetchPinnedProperties,
  fetchProperties,
  fetchPropertyStatusCounts,
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
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single', 'insert', 'or', 'in']) {
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
    c.order.mockResolvedValue({ data, error: null, count: 1 })
    supabase.from.mockReturnValue(c)

    const result = await fetchProperties()

    expect(c.eq).not.toHaveBeenCalled()
    expect(result).toEqual({ data, count: 1 })
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
    c.order.mockResolvedValue({ data, error: null, count: 1 })
    supabase.from.mockReturnValue(c)

    const result = await fetchInquiries()

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(result).toEqual({ data, count: 1 })
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
    c.order.mockResolvedValue({ data: null, error: new Error('boom'), count: null })
    supabase.from.mockReturnValue(c)

    await expect(fetchProperties()).rejects.toThrow('boom')
  })

  it('submitInquiry throws when the insert fails', async () => {
    const c = makeChain()
    c.insert.mockResolvedValue({ data: null, error: new Error('insert failed') })
    supabase.from.mockReturnValue(c)

    await expect(submitInquiry({ name: 'Juan' })).rejects.toThrow('insert failed')
  })

  it('uploadPropertyImage throws when the upload fails', async () => {
    const file = new File(['img'], 'lot-a.jpg', { type: 'image/jpeg' })
    const bucket = {
      upload: vi.fn().mockResolvedValue({ data: null, error: new Error('storage down') }),
      getPublicUrl: vi.fn(),
    }
    supabase.storage.from.mockReturnValue(bucket)

    await expect(uploadPropertyImage(file)).rejects.toThrow('storage down')
  })

  it('uploadPropertyImage rejects non-image files', async () => {
    const file = new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' })

    await expect(uploadPropertyImage(file)).rejects.toThrow('Only JPG, PNG, or WebP images are allowed.')
  })

  it('uploadPropertyImage rejects svg files', async () => {
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })

    await expect(uploadPropertyImage(file)).rejects.toThrow('Only JPG, PNG, or WebP images are allowed.')
  })

  it('uploadPropertyImage rejects images over 5MB', async () => {
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })

    await expect(uploadPropertyImage(file)).rejects.toThrow('Image must be 5MB or smaller.')
  })

  it('fetchProperties applies search filter via or ilike', async () => {
    const data = [{ id: 'p1' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null, count: 1 })
    supabase.from.mockReturnValue(c)

    await fetchProperties({ search: 'lot' })

    expect(c.or).toHaveBeenCalledWith('name.ilike.%lot%,location.ilike.%lot%')
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('fetchProperties applies type filter', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchProperties({ type: 'residential lot' })

    expect(c.eq).toHaveBeenCalledWith('type', 'residential lot')
  })

  it('fetchProperties applies status filter', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchProperties({ status: 'sold' })

    expect(c.eq).toHaveBeenCalledWith('status', 'sold')
  })

  it('fetchProperties applies custom sort', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchProperties({ sort: 'price_asc' })

    expect(c.order).toHaveBeenCalledWith('price', { ascending: true })
  })

  it('fetchProperties returns data and count', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [{ id: 'p1' }], error: null, count: 1 })
    supabase.from.mockReturnValue(c)

    const result = await fetchProperties()

    expect(result).toEqual({ data: [{ id: 'p1' }], count: 1 })
  })

  it('fetchInquiries applies search filter via or ilike', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchInquiries({ search: 'juan' })

    expect(c.or).toHaveBeenCalledWith('name.ilike.%juan%,email.ilike.%juan%,message.ilike.%juan%')
  })

  it('fetchInquiries applies is_read filter', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchInquiries({ is_read: false })

    expect(c.eq).toHaveBeenCalledWith('is_read', false)
  })

  it('fetchInquiries applies custom sort', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(c)

    await fetchInquiries({ sort: 'name_asc' })

    expect(c.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('fetchPropertyStatusCounts aggregates status counts', async () => {
    const c = makeChain()
    c.select.mockResolvedValue({
      data: [
        { status: 'available' },
        { status: 'available' },
        { status: 'sold' },
        { status: 'reserved' },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(c)

    const result = await fetchPropertyStatusCounts()

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.select).toHaveBeenCalledWith('status')
    expect(result).toEqual({ available: 2, reserved: 1, sold: 1 })
  })

  it('bulkDeleteProperties deletes multiple properties by ids', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkDeleteProperties(['p1', 'p2'])

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.delete).toHaveBeenCalled()
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkUpdatePropertyStatus updates status for multiple properties', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkUpdatePropertyStatus(['p1', 'p2'], 'sold')

    expect(c.update).toHaveBeenCalledWith({ status: 'sold' })
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkSetPropertyPinned updates is_pinned for multiple properties', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkSetPropertyPinned(['p1', 'p2'], true)

    expect(c.update).toHaveBeenCalledWith({ is_pinned: true })
    expect(c.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('bulkDeleteInquiries deletes multiple inquiries by ids', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkDeleteInquiries(['q1', 'q2'])

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(c.delete).toHaveBeenCalled()
    expect(c.in).toHaveBeenCalledWith('id', ['q1', 'q2'])
  })

  it('bulkSetInquiryRead updates is_read for multiple inquiries', async () => {
    const c = makeChain()
    c.in.mockResolvedValue({ error: null })
    supabase.from.mockReturnValue(c)

    await bulkSetInquiryRead(['q1', 'q2'], true)

    expect(c.update).toHaveBeenCalledWith({ is_read: true })
    expect(c.in).toHaveBeenCalledWith('id', ['q1', 'q2'])
  })
})
