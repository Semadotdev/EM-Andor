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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    console.error('update-agent-account: caller lookup failed', callerError)
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

  const agentId = typeof body?.agent_id === 'string' ? body.agent_id : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const resetPassword = body?.reset_password === true

  if (!agentId) {
    return json({ error: 'agent_id is required' }, 400)
  }
  if (email && !EMAIL_RE.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400)
  }
  if (password && password.length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400)
  }
  if (!email && !password && !resetPassword) {
    return json({ error: 'Nothing to update.' }, 400)
  }

  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('id, email, user_id')
    .eq('id', agentId)
    .maybeSingle()
  if (agentError) {
    console.error('update-agent-account: agent lookup failed', agentError)
    return json({ error: 'Could not find the agent.' }, 500)
  }
  if (!agent) return json({ error: 'Could not find the agent.' }, 404)
  if (!agent.user_id) {
    return json({ error: 'This agent has no login account yet.' }, 400)
  }

  const patch: { email?: string; password?: string; data?: { password_setup_pending: boolean } } = {}
  if (email && email !== agent.email) patch.email = email
  if (password) patch.password = password
  if (resetPassword) patch.data = { password_setup_pending: true }
  if (Object.keys(patch).length === 0) {
    return json({ error: 'Nothing to update.' }, 400)
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(agent.user_id, patch)
  if (updateError) {
    console.error('update-agent-account: updateUser failed', updateError)
    const message = /(already|in use)/i.test(updateError.message)
      ? 'Email already registered.'
      : 'Could not update the login. Please try again.'
    return json({ error: message }, 400)
  }

  let updated = agent
  if (email && email !== agent.email) {
    const { data: row, error: rowError } = await admin
      .from('agents')
      .update({ email })
      .eq('id', agentId)
      .select()
      .single()
    if (rowError) {
      console.error('update-agent-account: agents email sync failed', rowError)
      return json({ error: 'Could not sync the profile email. Please try again.' }, 500)
    }
    updated = row
  }

  return json({ agent: updated })
})