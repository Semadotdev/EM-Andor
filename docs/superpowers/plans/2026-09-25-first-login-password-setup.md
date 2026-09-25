# First-Time Password Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force newly created agents to choose their own password at first login; remove admin-set passwords from agent management, replacing them with a "Require new password" reset that re-flags the agent.

**Architecture:** A `user_metadata.password_setup_pending` flag drives the flow end-to-end. `create-agent` sets it at creation; `AdminLogin` and `AdminLayout` redirect flagged users to a new public `/admin/set-password` page; that page calls `updateUser({ password, data: { password_setup_pending: false } })` (password + flag in one call) and stays signed in. Admins stop typing passwords for other agents — a reset button calls `update-agent-account` with `reset_password: true`, which re-sets the flag. Admin self-service password change (`AdminAccount`) is untouched. No schema, RLS, or SMTP changes.

**Tech Stack:** React 19, React Router 7, Supabase (supabase-js ^2.112.3), Supabase Edge Functions (Deno), Vitest + Testing Library. Commands: `npm test` (vitest run), `npm run build` (vite build).

---

### Task 0: Spec + plan docs

**Files:**
- Create: `docs/superpowers/specs/2026-09-25-first-login-password-setup-design.md`
- Create: `docs/superpowers/plans/2026-09-25-first-login-password-setup.md`

- [x] **Step 1: Write the spec**
- [x] **Step 2: Write the plan**

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-25-first-login-password-setup-design.md docs/superpowers/plans/2026-09-25-first-login-password-setup.md
git commit -m "docs: plan first-time password setup for agents"
```

---

### Task 1: Flag new agents at creation

**Files:**
- Modify: `supabase/functions/create-agent/index.ts:86-90`
- Test: none (edge functions have no unit harness in this repo)

- [ ] **Step 1: Set the metadata flag on the created auth user**

In `supabase/functions/create-agent/index.ts`, change the `createUser` call to:

```ts
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    data: { password_setup_pending: true },
  })
```

- [ ] **Step 2: Verify the change**

Run: `npm test` — Expected: all existing tests still PASS.
Run: `grep -n "password_setup_pending" supabase/functions/create-agent/index.ts` — Expected: 1 match on the `data` line.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-agent/index.ts
git commit -m "feat: flag new agents for first-login password setup"
```

---

### Task 2: Server-side reset-by-flagging in `update-agent-account`

**Files:**
- Modify: `supabase/functions/update-agent-account/index.ts:54-87`
- Test: none (edge functions have no unit harness in this repo)

- [ ] **Step 1: Accept a `reset_password` flag**

In `supabase/functions/update-agent-account/index.ts`, replace lines 54-66 with:

```ts
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
```

- [ ] **Step 2: Patch the metadata flag**

Replace lines 82-87 with:

```ts
  const patch: { email?: string; password?: string; data?: { password_setup_pending: boolean } } = {}
  if (email && email !== agent.email) patch.email = email
  if (password) patch.password = password
  if (resetPassword) patch.data = { password_setup_pending: true }
  if (Object.keys(patch).length === 0) {
    return json({ error: 'Nothing to update.' }, 400)
  }
```

Lines 89-113 (the `updateUserById` call, agents email sync, response) stay exactly as-is.

- [ ] **Step 3: Verify the change**

Run: `npm test` — Expected: all existing tests still PASS.
Run: `grep -n "resetPassword\|reset_password\|password_setup_pending" supabase/functions/update-agent-account/index.ts` — Expected: matches in body parsing, the validation, and the `patch.data` line.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/update-agent-account/index.ts
git commit -m "feat: allow admins to re-flag an agent's password for setup"
```

---

### Task 3: Auth helpers + tests

**Files:**
- Modify: `src/lib/auth.js`
- Test: `src/lib/auth.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/auth.test.js`:

```js
import { resetPassword, updatePassword, needsPasswordSetup, setupInitialPassword } from './auth.js'
```

Replace the single import line with the one above, then append inside `describe('auth helpers', ...)`:

```js
  it('reports when the user has no pending password setup', () => {
    expect(needsPasswordSetup({ user_metadata: {} })).toBe(false)
    expect(needsPasswordSetup(undefined)).toBe(false)
  })

  it('reports when the user must set a password on next login', () => {
    expect(needsPasswordSetup({ user_metadata: { password_setup_pending: true } })).toBe(true)
  })

  it('clears the pending flag when the initial password is set', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await setupInitialPassword('newpass1')

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpass1',
      data: { password_setup_pending: false },
    })
  })

  it('throws when the initial password update fails', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password too weak' } })

    await expect(setupInitialPassword('abc')).rejects.toThrow('Password too weak')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/auth.test.js`
Expected: FAIL — `needsPasswordSetup` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/auth.js`:

```js
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/auth.test.js` — Expected: PASS (all 8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.js src/lib/auth.test.js
git commit -m "feat: add password-setup auth helpers"
```

---

### Task 4: Route first-time logins to password setup

**Files:**
- Modify: `src/components/admin/AdminLogin.jsx:2-6,22-27`
- Test: `src/components/admin/AdminLogin.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/components/admin/AdminLogin.test.jsx`, add a route to `renderLogin`:

```jsx
        <Route path="/admin/set-password" element={<p>SetupTarget</p>} />
```

Append:

```js
  it('routes a first-time agent to set up their password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'a1', user_metadata: { password_setup_pending: true } } },
      error: null,
    })
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ana@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'temp1234')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('SetupTarget')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx`
Expected: FAIL — still shows `DashboardTarget`.

- [ ] **Step 3: Implement**

In `AdminLogin.jsx`, change the import to add `needsPasswordSetup`, and capture the sign-in data:

```js
import { needsPasswordSetup } from '../../lib/auth.js'
```

```js
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      navigate(needsPasswordSetup(data.user) ? '/admin/set-password' : '/admin', { replace: true })
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx` — Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminLogin.jsx src/components/admin/AdminLogin.test.jsx
git commit -m "feat: send first-time agents to password setup after login"
```

---

### Task 5: `SetInitialPassword` page + tests

**Files:**
- Create: `src/components/admin/SetInitialPassword.jsx`
- Create: `src/components/admin/SetInitialPassword.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/SetInitialPassword.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SetInitialPassword from './SetInitialPassword.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

const pendingSession = { data: { session: { user: { id: 'a1', user_metadata: { password_setup_pending: true } } } } }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/set-password']}>
      <Routes>
        <Route path="/admin/set-password" element={<SetInitialPassword />} />
        <Route path="/admin/login" element={<p>LoginTarget</p>} />
        <Route path="/admin" element={<p>DashboardTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SetInitialPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue(pendingSession)
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'a1' } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('shows the form when the session has the pending flag', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Choose your password' })).toBeInTheDocument()
  })

  it('redirects to login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()

    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })

  it('redirects to the dashboard when the flag is already cleared', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'a1' } } } })

    renderPage()

    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('validates a short password', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), '123')
    await user.type(screen.getByLabelText('Confirm new password'), '123')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('validates that the passwords match', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm new password'), 'secret2')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('sets the password and stays signed in to the dashboard', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpass1',
      data: { password_setup_pending: false },
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('surfaces an update error and resets the button', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password should be more complex' } })
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.type(screen.getByLabelText('New password'), 'weakpass')
    await user.type(screen.getByLabelText('Confirm new password'), 'weakpass')
    await user.click(screen.getByRole('button', { name: 'Set Password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password should be more complex')
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument()
  })

  it('signs out from the set-password page', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose your password' })
    await user.click(screen.getByRole('button', { name: 'Sign out instead' }))

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/admin/SetInitialPassword.test.jsx`
Expected: FAIL — module not found / component renders nothing.

- [ ] **Step 3: Implement the component**

Create `src/components/admin/SetInitialPassword.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { needsPasswordSetup, setupInitialPassword } from '../../lib/auth.js'
import Logo from '../shared/Logo.jsx'
import { Input } from '../shared/ui'

export default function SetInitialPassword() {
  const [stage, setStage] = useState('loading') // loading | form
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const session = data.session
      if (!session) {
        navigate('/admin/login', { replace: true })
        return
      }
      if (!needsPasswordSetup(session.user)) {
        navigate('/admin', { replace: true })
      } else {
        setStage('form')
      }
    })
    return () => { mounted = false }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    let message = null
    if (password.length < 6) {
      message = 'Password must be at least 6 characters.'
    } else if (password !== confirm) {
      message = 'Passwords do not match.'
    }
    if (message) {
      setError(message)
      return
    }
    setSubmitting(true)
    try {
      await setupInitialPassword(password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err?.message || 'Something went wrong while setting your password.')
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  if (stage === 'loading') return null

  return (
    <div className="relative min-h-screen bg-brand-deep">
      <div className="hero-lines absolute inset-0" aria-hidden="true" />

      <main className="relative grid min-h-screen place-items-center px-5 py-12">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} noValidate className="w-full rounded-xl bg-white p-8 shadow-lift">
            <div className="mb-6 flex flex-col items-center gap-4">
              <span className="gold-rule" aria-hidden="true" />
              <Logo variant="dark" noLink />
            </div>

            <h1 className="font-display text-2xl font-extrabold text-brand-deep">Choose your password</h1>
            <p className="mt-1 text-sm text-ink/60">
              This is your first sign-in. Pick a password you&apos;ll use from now on — at least 6 characters.
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-4">
              <Input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                autoFocus
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                id="setup-confirm"
                type="password"
                autoComplete="new-password"
                label="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
              {submitting ? 'Saving…' : 'Set Password'}
            </button>

            <p className="mt-6 text-center">
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
              >
                Sign out instead
              </button>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/components/admin/SetInitialPassword.test.jsx` — Expected: PASS (all 8).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/SetInitialPassword.jsx src/components/admin/SetInitialPassword.test.jsx
git commit -m "feat: add first-login password setup page"
```

---

### Task 6: Register the route in `AdminApp`

**Files:**
- Modify: `src/components/admin/AdminApp.jsx:1-5,38`
- Test: `src/components/admin/AdminApp.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `AdminApp.test.jsx`, add a mock next to the other page mocks:

```jsx
vi.mock('./SetInitialPassword.jsx', () => ({ default: () => <span>SetInitialPasswordPage</span> }))
```

Append:

```js
  it('renders the set-password page without the admin layout', async () => {
    renderApp('/admin/set-password')

    expect(await screen.findByText('SetInitialPasswordPage')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('redirects first-time agents from the layout to set-password', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'a1', user_metadata: { password_setup_pending: true } } } },
    })

    renderApp('/admin')

    expect(await screen.findByText('SetInitialPasswordPage')).toBeInTheDocument()
    expect(screen.queryByText('DashboardPage')).not.toBeInTheDocument()
  })
```

The second test depends on Task 7's `AdminLayout` guard — it will FAIL until then. That's expected; implement Task 6 and Task 7 together before running.

(Note: the plan file's guard lives in Task 6's Step 3 here — the `AdminLayout` change is part of this task.)

- [ ] **Step 2: Register the route**

In `AdminApp.jsx`, add the import and the sibling route:

```jsx
import SetInitialPassword from './SetInitialPassword.jsx'
```

```jsx
      <Route path="set-password" element={<SetInitialPassword />} />
```

- [ ] **Step 3: Guard `AdminLayout`**

In `src/components/admin/AdminLayout.jsx`, directly after line 142 (`if (!session) return <Navigate to="/admin/login" replace />`), add:

```jsx
  if (session.user?.user_metadata?.password_setup_pending) {
    return <Navigate to="/admin/set-password" replace />
  }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/components/admin/AdminApp.test.jsx` — Expected: PASS (all 13).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminApp.jsx src/components/admin/AdminApp.test.jsx src/components/admin/AdminLayout.jsx
git commit -m "feat: guard the dashboard for agents with a pending password setup"
```

---

### Task 7: `resetAgentAccountPassword` lib helper + tests

**Files:**
- Modify: `src/lib/agents.js`
- Test: `src/lib/agents.test.js`

- [ ] **Step 1: Write the failing tests**

In `src/lib/agents.test.js`, add to the import block:

```js
  resetAgentAccountPassword,
```

Append at the end of `describe('agents', ...)`:

```js
  it('resetAgentAccountPassword flags the agent and logs it', async () => {
    const updated = { id: 'a1', email: 'sub@x.com', name: 'Sub', role: 'sub_agent' }
    supabase.functions.invoke.mockResolvedValue({ data: { agent: updated }, error: null })

    const result = await resetAgentAccountPassword('a1')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('update-agent-account', {
      body: { agent_id: 'a1', reset_password: true },
    })
    expect(result).toEqual(updated)
    expect(logActivity).toHaveBeenCalledWith('agent', 'a1', 'reset_password_required')
  })

  it('resetAgentAccountPassword surfaces the edge function error body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'Nothing to update.' }) },
      },
    })

    await expect(resetAgentAccountPassword('a1')).rejects.toThrow('Nothing to update.')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/agents.test.js`
Expected: FAIL — `resetAgentAccountPassword` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/agents.js`, append after `updateAgentAccount` (after line 73):

```js
export async function resetAgentAccountPassword(id) {
  const { data, error } = await supabase.functions.invoke('update-agent-account', {
    body: { agent_id: id, reset_password: true },
  })

  if (error) {
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch {
      // keep the SDK message when the body cannot be read
    }
    throw new Error(message || 'Could not reset the password.')
  }
  if (data?.error) throw new Error(data.error)

  const agent = data?.agent
  if (!agent) throw new Error('Could not reset the password.')
  logActivity('agent', id, 'reset_password_required').catch(() => {})
  return agent
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/agents.test.js` — Expected: PASS (all 17).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents.js src/lib/agents.test.js
git commit -m "feat: add resetAgentAccountPassword helper"
```

---

### Task 8: Remove admin password field, add "Require new password"

**Files:**
- Modify: `src/components/admin/AdminAgents.jsx`
- Modify: `src/components/admin/AdminAgents.test.jsx`
- Modify: `src/components/admin/AdminAgents.test.jsx` (mock + import)

- [ ] **Step 1: Write the failing tests**

In `src/components/admin/AdminAgents.test.jsx`, the agents mock (top of file) must add `resetAgentAccountPassword: vi.fn()`, and the import (line 26) adds `resetAgentAccountPassword`.

Replace the `edits the agent email from the profile tab` test (lines 304-328) with:

```js
  it('edits the agent email from the profile tab', async () => {
    const user = userEvent.setup()
    updateAgent.mockResolvedValue({ ...sub, email: 'new@x.com' })
    updateAgentAccount.mockResolvedValue({ ...sub, email: 'new@x.com' })

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))

    expect(within(dialog).queryByLabelText('New password')).not.toBeInTheDocument()

    const emailInput = within(dialog).getByLabelText('Email')
    expect(emailInput).toHaveValue('ana@x.com')
    await user.clear(emailInput)
    await user.type(emailInput, 'new@x.com')
    await user.click(within(dialog).getByRole('button', { name: 'Save Profile' }))

    expect(updateAgentAccount).toHaveBeenCalledWith('a1', { email: 'new@x.com' })
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })
```

Replace the `uses the password-only flow when the email is unchanged` test (lines 330-348) with:

```js
  it('marks an agent to require a new password at their next sign-in', async () => {
    const user = userEvent.setup()
    resetAgentAccountPassword.mockResolvedValue({ ...sub })

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ana Sub details' })
    await user.click(within(dialog).getByRole('tab', { name: 'Profile' }))

    await user.click(within(dialog).getByRole('button', { name: 'Require new password' }))

    expect(resetAgentAccountPassword).toHaveBeenCalledWith('a1')
    expect(await screen.findByText('Password reset required.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/admin/AdminAgents.test.jsx`
Expected: FAIL — `resetAgentAccountPassword` undefined, `New password` still present, profile flow still sends `password`.

- [ ] **Step 3: Implement**

In `src/components/admin/AdminAgents.jsx`:

1. Import the new helper (line 3):

```js
import { fetchAllAgents, fetchSoldCounts, resetAgentAccountPassword, setAgentActive, updateAgent, updateAgentAccount } from '../../lib/agents.js'
```

2. In `AgentDetail`, change the form initializer (line 73) to drop `password`:

```js
  const [form, setForm] = useState({ name: agent.name, phone: agent.phone ?? '', email: agent.email })
```

and add reset state next to `saving` (line 74):

```js
  const [resetting, setResetting] = useState(false)
```

3. Change `saveProfile` (lines 195-199) so the account call runs only on email change and never sends a password:

```js
      let updated = await updateAgent(agent.id, { name: form.name, phone: form.phone })
      if (form.email.trim() !== agent.email) {
        updated = await updateAgentAccount(agent.id, { email: form.email })
      }
      onSaved(updated)
```

4. Add the reset handler after `saveProfile`:

```js
  const resetAccountPassword = async () => {
    if (resetting) return
    setResetting(true)
    setSaveError(null)
    try {
      const updated = await resetAgentAccountPassword(agent.id)
      onSaved(updated, 'Password reset required.')
    } catch (err) {
      setSaveError(err?.message || 'Could not require a new password. Please try again.')
    } finally {
      setResetting(false)
    }
  }
```

5. Remove the `ap-password` `Input` (lines 360-368) so the email sits alone in its row:

```jsx
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ap-name" label="Name" value={form.name} onChange={setField('name')} required />
            <Input id="ap-phone" label="Phone" value={form.phone} onChange={setField('phone')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="ap-email" label="Email" type="email" value={form.email} onChange={setField('email')} required />
        </div>
```

(Only the email input remains in the second grid — delete the wrapping structure so the email grid stays intact; the helper text follows.)

6. Update the helper text (line 370):

```jsx
          <p className="text-xs text-ink/50">Email is the agent's login. To change their password, use the Require new password button below.</p>
```

7. Insert the reset control between the Save button row and the deactivate row, wrapped in its own bordered row:

```jsx
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-mist pt-4">
            <p className="text-xs text-ink/50">Force the agent to choose a new password at their next sign-in.</p>
            <Button variant="secondary" onClick={resetAccountPassword} disabled={resetting}>
              {resetting ? 'Requesting…' : 'Require new password'}
            </Button>
          </div>
```

8. In the parent `AdminAgents`, change `handleSaved` (lines 517-521) to accept a message:

```js
  const handleSaved = useCallback((updated, message = 'Profile saved.') => {
    setAgents((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))
    setDetail((d) => (d && d.id === updated.id ? { ...d, ...updated } : d))
    showToast(message)
  }, [showToast])
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/components/admin/AdminAgents.test.jsx` — Expected: PASS.
Run: `npm test` — Expected: full suite PASS.
Run: `npm run build` — Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminAgents.jsx src/components/admin/AdminAgents.test.jsx
git commit -m "feat: replace admin password editing with require-new-password reset"
```

---

### Task 9: Final verification + deploy notes

- [ ] **Step 1: Full suite + build**

Run: `npm test` — Expected: PASS (582 existing + added tests).
Run: `npm run build` — Expected: build succeeds.

- [ ] **Step 2: Report manual deploy steps**

After implementation the user must deploy the two edge functions (no schema changes):

```bash
supabase functions deploy create-agent
supabase functions deploy update-agent-account
```

---

## Manual verification (post-deploy)
1. Admin creates an agent via Agents → Create Agent (temp password shared with agent).
2. That agent signs in with the temp password → lands on `Choose your password`, sets a new one → lands on dashboard; next sign-in uses the new password (no setup prompt).
3. Admin opens that agent's Profile → no password field; click **Require new password** → toast "Password reset required."; the agent's next sign-in forces setup again.
4. Admin's own Account page still allows self-service email/password changes.
5. Existing agents (created before deploy) sign in normally — no setup prompt.