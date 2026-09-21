import { useEffect, useState } from 'react'
import { fetchCommissionRates } from '../../lib/agents.js'
import { createProject, fetchProjectRates, updateProject } from '../../lib/projects.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { COMMISSION_ROLES } from '../../lib/commissions.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const PROJECT_TYPES = [
  { value: 'farm_lot', label: 'Farm Lot', enabled: true },
  { value: 'housing', label: 'Housing', enabled: false },
  { value: 'commercial', label: 'Commercial', enabled: false },
  { value: 'development', label: 'Development', enabled: false },
]

export default function CreateProjectModal({ project, onClose, onCreated }) {
  const isEdit = Boolean(project?.id)

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
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
      onCreated()
    } catch (err) {
      setError(err?.message || `Could not ${isEdit ? 'update' : 'create'} the project. Please try again.`)
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
        className="w-full max-w-2xl rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit project' : 'Create project'}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">{isEdit ? 'Edit Project' : 'Create Project'}</h2>
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
            <label htmlFor="cp-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">Name</label>
            <input id="cp-name" autoFocus className={inputCls} value={form.name} onChange={setField('name')} placeholder="Andor Farm" />
            {errors.name && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="cp-type" className="mb-1.5 block text-sm font-semibold text-brand-deep">Type</label>
            <select id="cp-type" className={inputCls} value={form.type} onChange={setField('type')}>
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value} disabled={!type.enabled}>
                  {type.enabled ? type.label : `${type.label} (Coming soon)`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cp-price" className="mb-1.5 block text-sm font-semibold text-brand-deep">Price per m² (PHP)</label>
            <input
              id="cp-price"
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={form.pricePerSqm}
              onChange={setField('pricePerSqm')}
              placeholder="1200"
            />
            {errors.pricePerSqm && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.pricePerSqm}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="cp-address" className="mb-1.5 block text-sm font-semibold text-brand-deep">Address</label>
            <input id="cp-address" className={inputCls} value={form.address} onChange={setField('address')} placeholder="Brgy. Andor, Batangas City" />
            {errors.address && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.address}</p>
            )}
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
                  <div key={role}>
                    <label htmlFor={`cp-rate-${role}`} className="mb-1.5 block text-sm font-semibold text-brand-deep">
                      {ROLE_LABELS[role]} rate (%)
                    </label>
                    <input
                      id={`cp-rate-${role}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-32 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                      value={rateInputs[role] ?? ''}
                      onChange={setRate(role)}
                    />
                  </div>
                ))}
              </div>
            )}
            {errors.rates && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.rates}</p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} disabled={saving} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving || ratesState === 'loading'} className="btn btn-gold disabled:opacity-60">
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
