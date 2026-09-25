import { supabase } from './supabase.js'

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/admin/update-password`,
  })
  if (error) throw new Error(error.message)
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
}