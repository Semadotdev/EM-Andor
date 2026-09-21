import { useEffect, useState } from 'react'
import { fetchCommissionRates } from '../../lib/agents.js'
import { createProject, fetchProjectRates, updateProject } from '../../lib/projects.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { COMMISSION_ROLES } from '../../lib/commissions.js'
import { Button, FieldError, Input, Modal, Select, useToast } from '../shared/ui'

const PROJECT_TYPES = [
  { value: 'farm_lot', label: 'Farm Lot', enabled: true },
  { value: 'housing', label: 'Housing', enabled: false },
  { value: 'commercial', label: 'Commercial', enabled: false },
  { value: 'development', label: 'Development', enabled: false },
]

export default function CreateProjectModal({ project, onClose, onCreated }) {
  const isEdit = Boolean(project?.id)
  const { showToast } = useToast()

  const [form, setForm] = useState({
    name: project?.name ?? '',
    type: project?.type ?? 'farm_lot',
    address: project?.address ?? '',
    pricePerSqm: project?.price_per_sqm ?? '',
  })
  const [rateInputs, setRateInputs] = useState({})
  const [ratesState, setRatesState] = useState('loading')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadRates = async () => {
      const globalRows = await fetchCommissionRates()
      const rates = Object.fromEntries(globalRows.map((r) => [r.role, Number(r.rate)]))
      if (project?.id) {
        try {
          const projectRows = await fetchProjectRates(project.id)
          for (const row of projectRows) rates[row.role] = Number(row.rate)
        } catch {
          // fall back to the global rates when the project rates cannot be read
        }
      }
      return rates
    }
    loadRates()
      .then((rates) => {
        if (!mounted) return
        setRateInputs(Object.fromEntries(Object.entries(rates).map(([role, rate]) => [role, String(+(rate * 100).toFixed(2))])))
        setRatesState('ready')
      })
      .catch(() => {
        if (mounted) setRatesState('error')
      })
    return () => { mounted = false }
  }, [project?.id])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const setRate = (role) => (e) => {
    setRateInputs((inputs) => ({ ...inputs, [role]: e.target.value }))
    setErrors((errs) => ({ ...errs, rates: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.address.trim()) next.address = 'Address is required.'
    const price = Number(form.pricePerSqm)
    if (form.pricePerSqm === '' || Number.isNaN(price) || price <= 0) {
      next.pricePerSqm = 'Price per m² must be greater than 0.'
    }
    const invalidRate = COMMISSION_ROLES.some((role) => {
      const value = rateInputs[role]
      const num = Number(value)
      return value === undefined || value === '' || Number.isNaN(num) || num < 0 || num > 100
    })
    if (invalidRate) next.rates = 'Rates must be between 0 and 100.'
    return next
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving || ratesState === 'loading') return
    const next = validate()
    setErrors(next)
    setError(null)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
        pricePerSqm: Number(form.pricePerSqm),
        rates: Object.fromEntries(COMMISSION_ROLES.map((role) => [role, Number(rateInputs[role]) / 100])),
      }
      if (isEdit) await updateProject(project.id, payload)
      else await createProject(payload)
      showToast(isEdit ? 'Project updated.' : 'Project created.')
      onCreated()
    } catch (err) {
      setError(err?.message || `Could not ${isEdit ? 'update' : 'create'} the project. Please try again.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      label={isEdit ? 'Edit project' : 'Create project'}
      size="lg"
      busy={saving}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">{isEdit ? 'Edit Project' : 'Create Project'}</h2>
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
          <Input id="cp-name" autoFocus label="Name" value={form.name} onChange={setField('name')} placeholder="Andor Farm" error={errors.name} />
        </div>

        <Select id="cp-type" label="Type" value={form.type} onChange={setField('type')}>
          {PROJECT_TYPES.map((type) => (
            <option key={type.value} value={type.value} disabled={!type.enabled}>
              {type.enabled ? type.label : `${type.label} (Coming soon)`}
            </option>
          ))}
        </Select>

        <Input
          id="cp-price"
          type="number"
          min="0"
          step="any"
          label="Price per m² (PHP)"
          value={form.pricePerSqm}
          onChange={setField('pricePerSqm')}
          placeholder="1200"
          error={errors.pricePerSqm}
        />

        <div className="sm:col-span-2">
          <Input id="cp-address" label="Address" value={form.address} onChange={setField('address')} placeholder="Brgy. Andor, Batangas City" error={errors.address} />
        </div>

        <div className="sm:col-span-2">
          <h3 className="mb-1 font-display text-sm font-bold text-brand-deep">Commission Rates</h3>
          <p className="mb-3 text-xs text-ink/50">Percent of the lot price paid to each level. Defaults come from the global rates.</p>
          {ratesState === 'error' && (
            <p className="mb-3 text-sm text-ink/60">Could not load current rates — enter them manually.</p>
          )}
          {ratesState !== 'loading' && (
            <div className="flex flex-wrap gap-4">
              {COMMISSION_ROLES.map((role) => (
                <Input
                  key={role}
                  id={`cp-rate-${role}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-32"
                  label={`${ROLE_LABELS[role]} rate (%)`}
                  value={rateInputs[role] ?? ''}
                  onChange={setRate(role)}
                />
              ))}
            </div>
          )}
          {errors.rates && <FieldError>{errors.rates}</FieldError>}
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || ratesState === 'loading'}>
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
