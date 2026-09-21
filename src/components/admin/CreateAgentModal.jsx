import { useEffect, useState } from 'react'
import { createAgent } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const assignableRoles = ['sub_agent', 'direct_agent', 'agent_head']

export default function CreateAgentModal({ agents, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'sub_agent', uplineId: '', password: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAgent({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        uplineId: form.uplineId,
        password: form.password,
      })
      onCreated()
    } catch (err) {
      setError(err?.message || 'Could not create the agent account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create agent"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Create Agent</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ca-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">Name</label>
            <input id="ca-name" autoFocus className={inputCls} value={form.name} onChange={setField('name')} placeholder="Juan Dela Cruz" />
          </div>
          <div>
            <label htmlFor="ca-email" className="mb-1.5 block text-sm font-semibold text-brand-deep">Email</label>
            <input id="ca-email" type="email" className={inputCls} value={form.email} onChange={setField('email')} placeholder="agent@example.com" />
          </div>
          <div>
            <label htmlFor="ca-phone" className="mb-1.5 block text-sm font-semibold text-brand-deep">Phone (optional)</label>
            <input id="ca-phone" className={inputCls} value={form.phone} onChange={setField('phone')} placeholder="0917 000 0000" />
          </div>
          <div>
            <label htmlFor="ca-role" className="mb-1.5 block text-sm font-semibold text-brand-deep">Role</label>
            <select id="ca-role" className={inputCls} value={form.role} onChange={setField('role')}>
              {assignableRoles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ca-upline" className="mb-1.5 block text-sm font-semibold text-brand-deep">Upline (optional)</label>
            <select id="ca-upline" className={inputCls} value={form.uplineId} onChange={setField('uplineId')}>
              <option value="">No upline</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ca-password" className="mb-1.5 block text-sm font-semibold text-brand-deep">Temporary Password</label>
            <input id="ca-password" type="text" autoComplete="new-password" spellCheck={false} className={inputCls} value={form.password} onChange={setField('password')} placeholder="Share this with the agent" />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} disabled={saving} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
