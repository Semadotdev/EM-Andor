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
    console.error('delete-project: caller lookup failed', callerError)
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

  const projectId = typeof body?.project_id === 'string' ? body.project_id : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!projectId) {
    return json({ error: 'project_id is required' }, 400)
  }
  if (!password) {
    return json({ error: 'Enter your password to confirm.' }, 400)
  }

  const adminEmail = userData.user.email
  if (!adminEmail) {
    return json({ error: 'Your account has no email to verify against.' }, 400)
  }

  const verify = await admin.auth.signInWithPassword({ email: adminEmail, password })
  if (verify.error) {
    return json({ error: 'Incorrect password.' }, 401)
  }

  const { error: rpcError } = await admin.rpc('delete_project', { p_id: projectId })
  if (rpcError) {
    console.error('delete-project: delete_project failed', rpcError)
    const message = /function.*not found/.test(rpcError.message)
      ? 'The delete_project helper is not installed. Run the database migration first.'
      : 'Could not delete the project. Please try again.'
    return json({ error: message }, 500)
  }

  return json({ ok: true })
})