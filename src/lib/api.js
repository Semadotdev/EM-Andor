import { supabase } from './supabase.js'

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function logActivity(entityType, entityId, action, details = {}) {
  const { error } = await supabase.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    details,
  })
  if (error) throw error
}

export async function fetchPinnedProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProperties(filters = {}) {
  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`name.ilike.${term},location.ilike.${term}`)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const sortMap = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    price_asc: { column: 'price', ascending: true },
    price_desc: { column: 'price', ascending: false },
    name_asc: { column: 'name', ascending: true },
  }
  const s = sortMap[filters.sort] || sortMap.newest
  query = query.order(s.column, { ascending: s.ascending })

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function submitInquiry(inquiry) {
  const { error } = await supabase.from('inquiries').insert(inquiry)
  if (error) throw error
}

export async function createProperty(property) {
  const { data, error } = await supabase.from('properties').insert(property).select().single()
  if (error) throw error
  logActivity('property', data.id, 'create').catch(() => {})
  return data
}

export async function updateProperty(id, updates) {
  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  logActivity('property', id, 'update', { fields: Object.keys(updates) }).catch(() => {})
  return data
}

export async function setPropertyPinned(id, isPinned) {
  return updateProperty(id, { is_pinned: isPinned })
}

export async function deleteProperty(id) {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
  logActivity('property', id, 'delete').catch(() => {})
}

export async function uploadPropertyImage(file) {
  if (!IMAGE_EXT[file.type]) {
    throw new Error('Only JPG, PNG, or WebP images are allowed.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 5MB or smaller.')
  }
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${IMAGE_EXT[file.type]}`
  const { error } = await supabase.storage.from('property-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('property-images').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchInquiries(filters = {}) {
  let query = supabase
    .from('inquiries')
    .select('*', { count: 'exact' })

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`name.ilike.${term},email.ilike.${term},message.ilike.${term}`)
  }
  if (filters.is_read !== undefined && filters.is_read !== null) {
    query = query.eq('is_read', filters.is_read)
  }

  const sortMap = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    name_asc: { column: 'name', ascending: true },
  }
  const s = sortMap[filters.sort] || sortMap.newest
  query = query.order(s.column, { ascending: s.ascending })

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function setInquiryRead(id, isRead) {
  const { error } = await supabase.from('inquiries').update({ is_read: isRead }).eq('id', id)
  if (error) throw error
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw error
  logActivity('inquiry', id, 'delete').catch(() => {})
}

export async function bulkDeleteInquiries(ids) {
  const { error } = await supabase.from('inquiries').delete().in('id', ids)
  if (error) throw error
}

export async function bulkSetInquiryRead(ids, isRead) {
  const { error } = await supabase.from('inquiries').update({ is_read: isRead }).in('id', ids)
  if (error) throw error
}

export async function fetchPropertyStats() {
  const { data: all, error: e1 } = await supabase
    .from('properties')
    .select('id, is_pinned, type')
  if (e1) throw e1
  const { data: pinned, error: e2 } = await supabase
    .from('properties')
    .select('id')
    .eq('is_pinned', true)
  if (e2) throw e2
  const { data: projects, error: e3 } = await supabase
    .from('projects')
    .select('id')
  if (e3) throw e3
  const types = {}
  for (const p of all) {
    types[p.type] = (types[p.type] || 0) + 1
  }
  return {
    total: all.length,
    pinned: pinned.length,
    projects: projects.length,
    types,
  }
}

export async function fetchInquiryStats() {
  const { data: all, error: e1 } = await supabase
    .from('inquiries')
    .select('id, is_read')
  if (e1) throw e1
  const { data: unread, error: e2 } = await supabase
    .from('inquiries')
    .select('id')
    .eq('is_read', false)
  if (e2) throw e2
  return {
    total: all.length,
    unread: unread.length,
  }
}

export async function fetchRecentInquiries(limit = 5) {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, name, project_type, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// CMS Content
export async function fetchCMSContentList() {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .order('page_id')
  if (error) throw error
  return data ?? []
}

export async function fetchCMSContent(pageId) {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('page_id', pageId)
    .single()
  if (error) throw error
  return data
}

export async function updateCMSContent(pageId, updates) {
  const { data, error } = await supabase
    .from('cms_content')
    .upsert({ page_id: pageId, ...updates }, { onConflict: 'page_id' })
    .select()
    .single()
  if (error) throw error
  logActivity('cms', pageId, 'update', { fields: Object.keys(updates) }).catch(() => {})
  return data
}

// Notifications
export async function fetchNotificationSettings() {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .order('notification_type')
  if (error) throw error
  return data ?? []
}

export async function updateNotificationSettings(type, updates) {
  const { data, error } = await supabase
    .from('notification_settings')
    .upsert({ notification_type: type, ...updates }, { onConflict: 'notification_type' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function sendTestEmail(type, recipient) {
  const historyEntry = {
    notification_type: type,
    recipient,
    subject: `Test: ${type.replace(/_/g, ' ')}`,
    status: 'sent',
  }
  const { error } = await supabase.from('notification_history').insert(historyEntry)
  if (error) throw error
}

export async function fetchNotificationHistory() {
  const { data, error } = await supabase
    .from('notification_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function fetchActivityLog(filters = {}) {
  const PAGE_SIZE = 20
  const page = filters.page || 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })

  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type)
  }
  if (filters.search) {
    query = query.eq('entity_id', filters.search)
  }

  const sortAsc = filters.sort === 'oldest'
  query = query.order('created_at', { ascending: sortAsc }).range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}
