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
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suffix={
                  <button
                    type="button"
                    aria-label={showNew ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showNew}
                    onClick={() => setShowNew((shown) => !shown)}
                    className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
                  >
                    {showNew ? 'Hide' : 'Show'}
                  </button>
                }
              />
              <Input
                id="setup-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                label="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                suffix={
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirm}
                    onClick={() => setShowConfirm((shown) => !shown)}
                    className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                }
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