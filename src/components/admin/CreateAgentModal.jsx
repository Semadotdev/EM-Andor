import { useState } from 'react'
import { createAgent } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { Button, Input, Modal, Select, useToast } from '../shared/ui'

const assignableRoles = ['sub_agent', 'direct_agent', 'agent_head']

const uplineRoleFor = (role) => (role === 'sub_agent' ? 'direct_agent' : role === 'direct_agent' ? 'agent_head' : null)

export default function CreateAgentModal({ agents, onClose, onCreated }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'sub_agent', uplineId: '', password: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const uplineRole = uplineRoleFor(form.role)
  const uplineCandidates = uplineRole ? agents.filter((a) => a.role === uplineRole) : []

  const setField = (field) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === 'role' ? { uplineId: '' } : {}),
    }))
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.')
      return
    }
    if (form.role !== 'agent_head' && !form.uplineId) {
      setError('Select an upline for this role.')
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
          disabled={form.role === 'agent_head'}
          required
        >
          <option value="" disabled>
            {form.role === 'agent_head' ? 'No upline for an agent head' : 'Choose an upline'}
          </option>
          {uplineCandidates.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})</option>
          ))}
        </Select>

        <div className="sm:col-span-2">
          <Input
            id="ca-password"
            type="text"
            autoComplete="new-password"
            spellCheck={false}
            label="Temporary Password"
            value={form.password}
            onChange={setField('password')}
            placeholder="Share this with the agent"
          />
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
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
