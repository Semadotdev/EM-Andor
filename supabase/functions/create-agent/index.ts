import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

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
  const { data: callerAgent, error: callerError } = await admin
    .from('agents')
    .select('id, role, is_active')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (callerError) {
    console.error('create-agent: caller lookup failed', callerError)
    return json({ error: 'Forbidden' }, 403)
  }
  if (!callerAgent || callerAgent.role !== 'admin' || !callerAgent.is_active) {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : null
  const role = typeof body?.role === 'string' ? body.role : ''
  const uplineId = typeof body?.upline_id === 'string' ? body.upline_id : null

  if (!name || !email || !password) {
    return json({ error: 'name, email, and password are required' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400)
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  if (uplineId) {
    const { data: upline, error: uplineError } = await admin
      .from('agents')
      .select('id, is_active')
      .eq('id', uplineId)
      .maybeSingle()
    if (uplineError) {
      console.error('create-agent: upline lookup failed', uplineError)
      return json({ error: 'Could not verify the upline agent.' }, 500)
    }
    if (!upline || !upline.is_active) {
      return json({ error: 'Select an active upline agent.' }, 400)
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    data: { password_setup_pending: true },
  })
  if (createError) {
    console.error('create-agent: createUser failed', createError)
    const message = /already/i.test(createError.message)
      ? 'Email already registered.'
      : 'Could not create the login. Please try again.'
    return json({ error: message }, 400)
  }

  const { data: agentRow, error: insertError } = await admin
    .from('agents')
    .insert({
      user_id: created.user.id,
      email,
      name,
      phone,
      role,
      upline_id: uplineId,
    })
    .select()
    .single()

  if (insertError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id)
    if (deleteError) console.error('create-agent: rollback deleteUser failed', deleteError)
    console.error('create-agent: agents insert failed', insertError)
    const message = insertError.code === '23503'
      ? 'The selected upline agent no longer exists.'
      : 'Could not create the agent profile. Please try again.'
    return json({ error: message }, 400)
  }

  return json({ agent: agentRow })
})
