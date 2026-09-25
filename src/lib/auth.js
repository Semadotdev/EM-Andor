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

export function needsPasswordSetup(user) {
  return Boolean(user?.user_metadata?.password_setup_pending)
}

export async function setupInitialPassword(password) {
  const { error } = await supabase.auth.updateUser({
    password,
    data: { password_setup_pending: false },
  })
  if (error) throw new Error(error.message)
}

export async function verifyCurrentUserPassword(password) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) throw new Error('Could not verify your identity.')
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
  if (error) throw new Error('Incorrect password. Please try again.')
}