import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { company, contact } from '../../data/site.js'
import Logo from '../shared/Logo.jsx'
import { Input } from '../shared/ui'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      navigate('/admin', { replace: true })
    } catch {
      setError('Something went wrong while signing in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-deep text-white lg:flex lg:w-1/2">
        <div className="hero-lines absolute inset-0" aria-hidden="true" />
        <div className="relative flex w-full flex-col justify-between gap-10 p-12">
          <Logo variant="light" />

          <div className="max-w-md">
            <p className="eyebrow text-gold">Admin access</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight">{company.tagline}</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{company.description}</p>
          </div>

          <p className="text-xs text-white/60">
            <a href={contact.phoneHref} className="transition-colors hover:text-gold">
              {contact.phone}
            </a>
            {' · '}
            <a href={`mailto:${contact.email}`} className="transition-colors hover:text-gold">
              {contact.email}
            </a>
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12 sm:px-8">
        <form onSubmit={handleSubmit} noValidate className="w-full max-w-md rounded-lg bg-white p-8 shadow-lift">
          <div className="mb-6 flex justify-center lg:hidden">
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
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="mt-6 text-center text-xs text-ink/40">
            Protected area — authorized personnel only.
          </p>
        </form>
      </main>
    </div>
  )
}
