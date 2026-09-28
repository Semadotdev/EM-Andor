import { useState } from 'react'
import { createAgent } from '../../lib/agents.js'
import { ROLE_LABELS, ROLE_RANK } from '../../lib/agentMeta.js'
import { Button, Input, Modal, Select, useToast } from '../shared/ui'

const assignableRoles = ['sub_agent', 'direct_agent', 'agent_head', 'admin']

export default function CreateAgentModal({ agents, onClose, onCreated }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'sub_agent', uplineId: '', password: '' })
  const [adminPassword, setAdminPassword] = useState('')
  const [showTemporary, setShowTemporary] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const isAdminTarget = form.role === 'admin'
  const uplineCandidates = isAdminTarget
    ? []
    : agents.filter((a) => (ROLE_RANK[a.role] ?? 0) >= (ROLE_RANK[form.role] ?? 0))

  const setField = (field) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === 'role' ? { uplineId: '' } : {}),
    }))
    if (field === 'role') setAdminPassword('')
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.')
      return
    }
    if (form.role !== 'agent_head' && form.role !== 'admin' && !form.uplineId) {
      setError('Select an upline for this role.')
      return
    }
    if (isAdminTarget && !adminPassword) {
      setError('Enter your admin password to continue.')
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
        adminPassword: isAdminTarget ? adminPassword : undefined,
      })
      showToast('Agent created.')
      onCreated()
    } catch (err) {
      setError(err?.message || 'Could not create the agent account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} label="Create agent" size="md" busy={saving}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Create Agent</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-md px-2 py-1 text-ink/50 transition-colors hover:text-ink disabled:opacity-60"
          aria-label="Close"
        >
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
          <Input id="ca-name" autoFocus label="Name" value={form.name} onChange={setField('name')} placeholder="Juan Dela Cruz" />
        </div>
        <Input id="ca-email" type="email" label="Email" value={form.email} onChange={setField('email')} placeholder="agent@example.com" />
        <Input id="ca-phone" label="Phone (optional)" value={form.phone} onChange={setField('phone')} placeholder="0917 000 0000" />

        <Select id="ca-role" label="Role" value={form.role} onChange={setField('role')}>
          {assignableRoles.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </Select>

        <Select
          id="ca-upline"
          label="Upline"
          value={form.uplineId}
          onChange={setField('uplineId')}
          disabled={form.role === 'agent_head' || isAdminTarget}
          required={form.role !== 'agent_head' && !isAdminTarget}
        >
          <option value="" disabled>
            {isAdminTarget
              ? 'No upline for an admin'
              : form.role === 'agent_head'
                ? 'No upline for an agent head'
                : 'Choose an upline'}
          </option>
          {uplineCandidates.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})</option>
          ))}
        </Select>

        <div className="sm:col-span-2">
          <Input
            id="ca-password"
            type={showTemporary ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck={false}
            label="Temporary Password"
            value={form.password}
            onChange={setField('password')}
            placeholder="Share this with the agent"
            suffix={
              <button
                type="button"
                aria-label={showTemporary ? 'Hide temporary password' : 'Show temporary password'}
                aria-pressed={showTemporary}
                onClick={() => setShowTemporary((shown) => !shown)}
                className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
              >
                {showTemporary ? 'Hide' : 'Show'}
              </button>
            }
          />
        </div>

        {isAdminTarget && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
            <p className="mb-1 text-sm font-semibold text-amber-800">Admin account</p>
            <p className="mb-3 text-xs text-amber-700">Enter your admin password to create another admin account.</p>
            <Input
              id="ca-admin-password"
              type={showAdmin ? 'text' : 'password'}
              autoComplete="current-password"
              label="Admin password"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value)
                setError(null)
              }}
              suffix={
                <button
                  type="button"
                  aria-label={showAdmin ? 'Hide admin password' : 'Show admin password'}
                  aria-pressed={showAdmin}
                  onClick={() => setShowAdmin((shown) => !shown)}
                  className="text-xs font-semibold text-ink/50 transition-colors hover:text-brand"
                >
                  {showAdmin ? 'Hide' : 'Show'}
                </button>
              }
            />
          </div>
        )}

        <div className="modal-actions mt-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Agent'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
