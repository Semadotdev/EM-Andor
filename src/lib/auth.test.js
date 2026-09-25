import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resetPassword, updatePassword } from './auth.js'

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

import { supabase } from './supabase.js'

describe('auth helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests a reset link pointing at the update-password route', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    await resetPassword('agent@emandor.com')

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('agent@emandor.com', {
      redirectTo: expect.stringMatching(/\/admin\/update-password$/),
    })
  })

  it('throws when the reset request fails', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    })

    await expect(resetPassword('agent@emandor.com')).rejects.toThrow('User not found')
  })

  it('updates the password through updateUser', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await updatePassword('newpass1')

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass1' })
  })

  it('throws when the password update fails', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password too weak' } })

    await expect(updatePassword('abc')).rejects.toThrow('Password too weak')
  })
})