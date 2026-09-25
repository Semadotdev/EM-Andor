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