import { useEffect, useState } from 'react'
import { fetchCurrentAgent, updateAgentAccount } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { Badge, Button, ErrorState, LoadingState, PageHeader, useToast } from '../shared/ui'

export default function AdminAccount() {
  const { showToast } = useToast()
  const [agent, setAgent] = useState(null)
  const [state, setState] = useState('loading')
  const [form, setForm] = useState({ email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchCurrentAgent()
      .then((row) => {
        if (!mounted) return
        setAgent(row)
        setForm({ email: row.email, password: '' })
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => {
      mounted = false
    }
  }, [])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setSaveError(null)
  }

  const save = async () => {
    if (saving) return
    if (!form.email.trim()) {
      setSaveError('Email is required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await updateAgentAccount(agent.id, { email: form.email, password: form.password })
      showToast('Account updated.')
    } catch (err) {
      setSaveError(err?.message || 'Could not update the account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Account" description="Your login credentials." />

      {state === 'loading' && <LoadingState label="Loading account…" />}
      {state === 'error' && <ErrorState message="Could not load your account." />}

      {state === 'ready' && (
        <div className="max-w-lg rounded-xl border border-mist bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <p className="font-display text-lg font-bold text-brand-deep">{agent.name}</p>
            <Badge tone={agent.role === 'admin' ? 'gold' : 'blue'}>{ROLE_LABELS[agent.role] ?? agent.role}</Badge>
          </div>

          <div className="grid gap-4">
            <label htmlFor="account-email" className="block">
              <span className="mb-1.5 block text-sm font-semibold text-brand-deep">Email</span>
              <input
                id="account-email"
                type="email"
                value={form.email}
                onChange={setField('email')}
                className="w-full rounded-md border border-mist bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
              />
            </label>

            <label htmlFor="account-password" className="block">
              <span className="mb-1.5 block text-sm font-semibold text-brand-deep">New password</span>
              <input
                id="account-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={setField('password')}
                placeholder="Leave blank to keep current"
                className="w-full rounded-md border border-mist bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/50">The password is never shown — leave it blank to keep the current one.</p>

          {saveError && (
            <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {saveError}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Account'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}