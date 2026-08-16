import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

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
    <div className="grid min-h-screen place-items-center bg-brand-deep px-5">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Admin Sign In</h1>
        <p className="mt-1 text-sm text-ink/60">E.M. Andor — properties &amp; inquiries</p>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
