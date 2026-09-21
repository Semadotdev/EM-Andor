import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Create a .env from .env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

/** @type {import('@supabase/supabase-js').SupabaseClient<import('./database.types').Database>} */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
