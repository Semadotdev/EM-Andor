import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { needsPasswordSetup } from '../../lib/auth.js'
import { contact } from '../../data/site.js'
import Logo from '../shared/Logo.jsx'
import { Input } from '../shared/ui'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      navigate(needsPasswordSetup(data.user) ? '/admin/set-password' : '/admin', { replace: true })
    } catch {
      setError('Something went wrong while signing in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordKey = (e) => {
    setCapsLock(Boolean(e.getModifierState?.('CapsLock')))
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

            <h1 className="font-display text-2xl font-extrabold text-brand-deep">Sign in to the dashboard</h1>
            <p className="mt-1 text-sm text-ink/60">Use your agent account to continue.</p>

            {error && (
              <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-4">
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                autoFocus
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div>
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKey}
                  onKeyUp={handlePasswordKey}
                  suffix={
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((shown) => !shown)}
                      className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  }
                />
                {capsLock && <p className="mt-1.5 text-xs font-medium text-amber-600">Caps Lock is on</p>}
                <Link
                  to="/admin/forgot-password"
                  className="mt-2 inline-block text-xs font-semibold text-brand transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="mt-6 text-center text-xs text-ink/40">
              Protected area — authorized personnel only.
            </p>
          </form>

          <p className="mt-6 text-center text-xs text-white/70">
            <a href={contact.phoneHref} className="transition-colors hover:text-gold">
              {contact.phone}
            </a>
            {' · '}
            <a href={`mailto:${contact.email}`} className="transition-colors hover:text-gold">
              {contact.email}
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
