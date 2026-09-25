# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-service password recovery to the `/admin` dashboard via Supabase Auth's built-in reset-password email flow.

**Architecture:** A public `/admin/forgot-password` page calls `supabase.auth.resetPasswordForEmail` with a `redirectTo` of `/admin/update-password`. The emailed link lands there with a recovery token supabase-js picks up from the URL hash; that page validates and persists a new password via `supabase.auth.updateUser`, then signs out and returns to login. Both routes are registered in `AdminApp.jsx` outside the `AdminLayout` session guard, mirroring the existing `AdminLogin` route.

**Tech Stack:** React 19 + React Router 7, Supabase JS v2, Vite, Vitest + Testing Library. Pattern to follow: `src/components/admin/AdminLogin.jsx` (page shell, `Input`, `btn btn-gold`) and `src/components/admin/AdminLogin.test.jsx` (supabase mock shape).

**Spec:** `docs/superpowers/specs/2026-09-25-forgot-password-design.md`

---

### Task 1: Auth helper functions

**Files:**
- Create: `src/lib/auth.js`
- Test: `src/lib/auth.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth.test.js`:

```jsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth.test.js`
Expected: FAIL — module `./auth.js` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/auth.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.js src/lib/auth.test.js
git commit -m "feat: add password recovery auth helpers"
```

---

### Task 2: ForgotPassword page

**Files:**
- Create: `src/components/admin/ForgotPassword.jsx`
- Test: `src/components/admin/ForgotPassword.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/ForgotPassword.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/forgot-password']}>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('requests a reset link with the email and a redirect to update-password', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('agent@emandor.com', {
      redirectTo: expect.stringMatching(/\/admin\/update-password$/),
    })
    expect(await screen.findByText(/If an account exists for that email, we've sent a reset link/i)).toBeInTheDocument()
  })

  it('shows the sent message even when the account does not exist', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    })
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'ghost@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByText(/If an account exists for that email, we've sent a reset link/i)).toBeInTheDocument()
  })

  it('rejects an invalid email before calling the API', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('shows a generic error and resets the button when the request fails', async () => {
    supabase.auth.resetPasswordForEmail.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/i)
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument()
  })

  it('surfaces the rate-limit message without revealing account existence', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'For security purposes, you can only request this after 60 seconds.' },
    })
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('Email'), 'agent@emandor.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Please wait a moment/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ForgotPassword.test.jsx`
Expected: FAIL — module `./ForgotPassword.jsx` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/admin/ForgotPassword.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resetPassword } from '../../lib/auth.js'
import Logo from '../shared/Logo.jsx'
import { Input } from '../shared/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_RE = /For security purposes/i

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      const message = err?.message || ''
      if (RATE_LIMIT_RE.test(message)) {
        setError('Please wait a moment before requesting another email.')
      } else if (message && !/User not found/i.test(message)) {
        setError('Something went wrong. Please try again.')
      } else {
        // Account does not exist — never reveal it. Show the generic sent message.
        setSent(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

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

            <h1 className="font-display text-2xl font-extrabold text-brand-deep">Reset your password</h1>
            <p className="mt-1 text-sm text-ink/60">Enter your account email and we&apos;ll send you a reset link.</p>

            {sent ? (
              <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
                If an account exists for that email, we&apos;ve sent a reset link. Check your inbox and follow the link
                to set a new password.
              </div>
            ) : (
              <>
                {error && (
                  <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}

                <div className="mt-6">
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
                  {submitting ? 'Sending…' : 'Send Reset Link'}
                </button>
              </>
            )}

            <p className="mt-6 text-center text-sm">
              <Link to="/admin/login" className="font-semibold text-brand transition-colors hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ForgotPassword.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ForgotPassword.jsx src/components/admin/ForgotPassword.test.jsx
git commit -m "feat: add forgot-password request page"
```

---

### Task 3: UpdatePassword page

**Files:**
- Create: `src/components/admin/UpdatePassword.jsx`
- Test: `src/components/admin/UpdatePassword.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/UpdatePassword.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UpdatePassword from './UpdatePassword.jsx'

let authListener

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((cb) => {
        authListener = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/update-password']}>
      <Routes>
        <Route path="/admin/update-password" element={<UpdatePassword />} />
        <Route path="/admin/login" element={<p>LoginTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('UpdatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authListener = undefined
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
  })

  it('shows the form when a recovery session exists', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
  })

  it('shows the invalid state when no recovery session exists', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Invalid or expired link' })).toBeInTheDocument()
  })

  it('shows the form when the PASSWORD_RECOVERY event fires', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderPage()
    await screen.findByRole('heading', { name: 'Invalid or expired link' })
    act(() => {
      authListener('PASSWORD_RECOVERY', { user: { id: 'u1' } })
    })

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
  })

  it('validates a short password', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), '123')
    await user.type(screen.getByLabelText('Confirm new password'), '123')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('validates that the passwords match', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm new password'), 'secret2')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password, signs out, and returns to login', async () => {
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass1' })
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('LoginTarget')).toBeInTheDocument()
  })

  it('surfaces an update error and resets the button', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password should be more complex' } })
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'weakpass')
    await user.type(screen.getByLabelText('Confirm new password'), 'weakpass')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password should be more complex')
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/UpdatePassword.test.jsx`
Expected: FAIL — module `./UpdatePassword.jsx` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/admin/UpdatePassword.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { updatePassword } from '../../lib/auth.js'
import Logo from '../shared/Logo.jsx'
import { Input } from '../shared/ui'

export default function UpdatePassword() {
  const [stage, setStage] = useState('loading') // loading | form | invalid
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setStage(data.session ? 'form' : 'invalid')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setStage(session ? 'form' : 'invalid')
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

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
      await updatePassword(password)
      await supabase.auth.signOut()
      navigate('/admin/login', { replace: true })
    } catch (err) {
      setError(err?.message || 'Something went wrong while updating your password.')
      setSubmitting(false)
    }
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

            {stage === 'invalid' ? (
              <>
                <h1 className="font-display text-2xl font-extrabold text-brand-deep">Invalid or expired link</h1>
                <p className="mt-2 text-sm text-ink/60">
                  This password-reset link is invalid or has expired. Request a new one to continue.
                </p>
                <Link to="/admin/forgot-password" className="btn btn-gold mt-6 block w-full text-center">
                  Request a new link
                </Link>
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl font-extrabold text-brand-deep">Choose a new password</h1>
                <p className="mt-1 text-sm text-ink/60">Use at least 6 characters.</p>

                {error && (
                  <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}

                <div className="mt-6 space-y-4">
                  <Input
                    id="update-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    label="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Input
                    id="update-confirm"
                    type="password"
                    autoComplete="new-password"
                    label="Confirm new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
                  {submitting ? 'Updating…' : 'Update Password'}
                </button>
              </>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/UpdatePassword.test.jsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UpdatePassword.jsx src/components/admin/UpdatePassword.test.jsx
git commit -m "feat: add password reset page"
```

---

### Task 4: "Forgot password?" link on the login page

**Files:**
- Modify: `src/components/admin/AdminLogin.jsx`
- Modify: `src/components/admin/AdminLogin.test.jsx`

- [ ] **Step 1: Write the failing test**

Append this test inside the existing `describe('AdminLogin', ...)` block in `src/components/admin/AdminLogin.test.jsx`:

```jsx
  it('links to the forgot-password page', () => {
    renderLogin()

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/admin/forgot-password',
    )
  })
```

(`renderLogin` and all imports already exist in that file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx`
Expected: FAIL — Unable to find role `link` with name `Forgot password?`.

- [ ] **Step 3: Implement the link**

In `src/components/admin/AdminLogin.jsx`:

1. Change the import on line 2 from `import { useNavigate } from 'react-router-dom'` to:

```jsx
import { Link, useNavigate } from 'react-router-dom'
```

2. Inside the password field wrapper, immediately after the caps-lock paragraph (line 92, `{capsLock && ( <p ...>Caps Lock is on</p> )}`), add:

```jsx
                <Link
                  to="/admin/forgot-password"
                  className="mt-2 inline-block text-xs font-semibold text-brand transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
```

The password block should now read:

```jsx
              <div>
                <Input ... />
                {capsLock && <p className="mt-1.5 text-xs font-medium text-amber-600">Caps Lock is on</p>}
                <Link
                  to="/admin/forgot-password"
                  className="mt-2 inline-block text-xs font-semibold text-brand transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx`
Expected: PASS (5 tests — 4 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminLogin.jsx src/components/admin/AdminLogin.test.jsx
git commit -m "feat: add forgot-password link to login page"
```

---

### Task 5: Register the routes

**Files:**
- Modify: `src/components/admin/AdminApp.jsx`
- Modify: `src/components/admin/AdminApp.test.jsx`

- [ ] **Step 1: Write the failing test**

Add these mocks at the top of `src/components/admin/AdminApp.test.jsx` (next to the other `vi.mock('./AdminLogin.jsx', ...)` entries):

```jsx
vi.mock('./ForgotPassword.jsx', () => ({ default: () => <span>ForgotPasswordPage</span> }))
vi.mock('./UpdatePassword.jsx', () => ({ default: () => <span>UpdatePasswordPage</span> }))
```

Add these tests inside the existing `describe('AdminApp', ...)` block:

```jsx
  it('renders the forgot-password page without the admin layout', async () => {
    renderApp('/admin/forgot-password')

    expect(await screen.findByText('ForgotPasswordPage')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders the update-password page without the admin layout', async () => {
    renderApp('/admin/update-password')

    expect(await screen.findByText('UpdatePasswordPage')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminApp.test.jsx`
Expected: FAIL — the two new tests fall through to the `*` catch-all and hit the dashboard instead.

- [ ] **Step 3: Register the routes**

In `src/components/admin/AdminApp.jsx`, add the imports after line 3 (`import AdminLogin from './AdminLogin.jsx'`):

```jsx
import ForgotPassword from './ForgotPassword.jsx'
import UpdatePassword from './UpdatePassword.jsx'
```

Then, in the `<Routes>` block, add the two public routes directly after the `login` route line 34:

```jsx
        <Route path="login" element={<AdminLogin />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="update-password" element={<UpdatePassword />} />
```

They must be siblings of `login` — outside the `<Route element={<AdminLayout />}>` guard so the recovery session is not absorbed by the layout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminApp.test.jsx`
Expected: PASS (12 tests — 10 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminApp.jsx src/components/admin/AdminApp.test.jsx
git commit -m "feat: register forgot-password and update-password routes"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: ALL PASS (no failures; existing smoke tests and component tests remain green).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Check nothing else regressed**

Run: `git status --short`
Expected: clean working tree.

---

### Manual configuration (after deploy, not code)

1. Supabase dashboard → Authentication → URL Configuration → set **Site URL** to the deployed origin (e.g. `https://<vercel-site>.vercel.app`).
2. Add that same origin and `.../admin/update-password` to **Redirect URLs**.
3. Leave the default **Reset password** email template in place — it builds the link from Site URL + the `redirectTo` passed by `resetPasswordForEmail`.