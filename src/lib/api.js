import { supabase } from './supabase.js'

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function fetchPinnedProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function submitInquiry(inquiry) {
  const { error } = await supabase.from('inquiries').insert(inquiry)
  if (error) throw error
}

export async function createProperty(property) {
  const { data, error } = await supabase.from('properties').insert(property).select().single()
  if (error) throw error
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
  return data
}

export async function setPropertyPinned(id, isPinned) {
  return updateProperty(id, { is_pinned: isPinned })
}

export async function deleteProperty(id) {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
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

export async function fetchInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function setInquiryRead(id, isRead) {
  const { error } = await supabase.from('inquiries').update({ is_read: isRead }).eq('id', id)
  if (error) throw error
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw error
}
