import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const ALLOWED_ROLES = ['agent_head', 'direct_agent', 'sub_agent']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: callerAgent } = await admin
    .from('agents')
    .select('id, role, is_active')
    .eq('user_id', userData.user.id)
    .single()

  if (!callerAgent || callerAgent.role !== 'admin' || !callerAgent.is_active) {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: Record<string, string | null>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { name, email, phone, role, upline_id, password } = body ?? {}
  if (!name || !email || !password) {
    return json({ error: 'name, email, and password are required' }, 400)
  }
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) return json({ error: createError.message }, 400)

  const { data: agentRow, error: insertError } = await admin
    .from('agents')
    .insert({
      user_id: created.user.id,
      email,
      name,
      phone: phone || null,
      role,
      upline_id: upline_id || null,
    })
    .select()
    .single()

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: insertError.message }, 400)
  }

  return json({ agent: agentRow })
})
