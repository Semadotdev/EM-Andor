import { useEffect, useState } from 'react'
import { fetchAllAgents } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { recordSale } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const detailFields = ['buyer_name', 'buyer_address', 'tcp', 'downpayment', 'monthly_amortization', 'terms_of_payment']

export default function MarkSoldModal({ lot, project, onClose, onSold }) {
  const [agents, setAgents] = useState([])
  const [agentsState, setAgentsState] = useState('loading')
  const [sellerId, setSellerId] = useState(lot?.sold_by ?? '')
  const [form, setForm] = useState({
    buyer_name: '',
    buyer_address: '',
    tcp: lot?.price != null ? String(lot.price) : '',
    downpayment: '',
    monthly_amortization: '',
    terms_of_payment: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
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
    fetchAllAgents()
      .then((rows) => {
        if (!mounted) return
        setAgents(rows.filter((a) => a.role !== 'admin' && a.is_active))
        setAgentsState('ready')
      })
      .catch(() => {
        if (mounted) setAgentsState('error')
      })
    return () => { mounted = false }
  }, [])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setFieldErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const setSeller = (e) => {
    setSellerId(e.target.value)
    setFieldErrors((errs) => ({ ...errs, sold_by: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return

    const errors = {}
    if (!sellerId) errors.sold_by = 'Select the selling agent.'
    if (!form.buyer_name.trim()) errors.buyer_name = 'Buyer name is required.'
    const tcp = Number(form.tcp)
    if (form.tcp === '' || Number.isNaN(tcp) || tcp <= 0) errors.tcp = 'TCP must be greater than 0.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setFieldErrors({})
    setError(null)
    try {
      const lotFields = { ...lot }
      delete lotFields.id
      delete lotFields.created_at
      delete lotFields.updated_at
      await recordSale({
        propertyId: lot.id,
        payload: { ...lotFields, status: 'sold', sold_by: sellerId },
        details: {
          buyer_name: form.buyer_name.trim(),
          buyer_address: form.buyer_address.trim(),
          tcp,
          downpayment: Number(form.downpayment) || 0,
          monthly_amortization: Number(form.monthly_amortization) || 0,
          terms_of_payment: form.terms_of_payment.trim(),
        },
      })
      onSold()
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        const hasNonSellerError = Object.keys(err.fieldErrors).some((field) => field !== 'sold_by')
        if (hasNonSellerError) setError('Could not record the sale. Please try again.')
      } else if (err?.message?.includes('Commission already paid') || err?.message?.includes('buyer details failed to save')) {
        setError(err.message)
      } else {
        setError('Could not record the sale. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const otherErrors = Object.entries(fieldErrors).filter(
    ([field]) => field !== 'sold_by' && !detailFields.includes(field),
  )

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
        aria-label="Mark lot sold"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Mark Sold</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <dl className="mb-5 space-y-2 rounded-lg border border-mist bg-surface p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep">Project</dt>
            <dd className="text-right text-ink/70">{project?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep">Lot</dt>
            <dd className="text-right text-ink/70">{lot.name ?? `Block ${lot.block_no} Lot ${lot.lot_no}`}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep">Price</dt>
            <dd className="text-right text-ink/70">{formatPrice(lot.price) ?? '—'}</dd>
          </div>
        </dl>

        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ms-seller" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Selling Agent
            </label>
            <select id="ms-seller" className={inputCls} value={sellerId} onChange={setSeller}>
              <option value="">
                {agentsState === 'loading' ? 'Loading agents…' : agentsState === 'error' ? 'Could not load agents' : 'Select agent…'}
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})
                </option>
              ))}
            </select>
            {fieldErrors.sold_by && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{fieldErrors.sold_by}</p>
            )}
            {otherErrors.map(([field, message]) => (
              <p key={field} className="mt-1.5 text-xs font-medium text-red-600" role="alert">{message}</p>
            ))}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ms-buyer-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Buyer Name
            </label>
            <input
              id="ms-buyer-name"
              className={inputCls}
              value={form.buyer_name}
              onChange={setField('buyer_name')}
              placeholder="Juan Dela Cruz"
            />
            {fieldErrors.buyer_name && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{fieldErrors.buyer_name}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ms-buyer-address" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Buyer Address
            </label>
            <input
              id="ms-buyer-address"
              className={inputCls}
              value={form.buyer_address}
              onChange={setField('buyer_address')}
              placeholder="Street, Barangay, City"
            />
          </div>

          <div>
            <label htmlFor="ms-tcp" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              TCP
            </label>
            <input
              id="ms-tcp"
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={form.tcp}
              onChange={setField('tcp')}
            />
            {fieldErrors.tcp && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{fieldErrors.tcp}</p>
            )}
          </div>

          <div>
            <label htmlFor="ms-downpayment" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Downpayment
            </label>
            <input
              id="ms-downpayment"
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={form.downpayment}
              onChange={setField('downpayment')}
            />
          </div>

          <div>
            <label htmlFor="ms-ma" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              M.A.
            </label>
            <input
              id="ms-ma"
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={form.monthly_amortization}
              onChange={setField('monthly_amortization')}
            />
          </div>

          <div>
            <label htmlFor="ms-terms" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Terms of Payment
            </label>
            <input
              id="ms-terms"
              className={inputCls}
              value={form.terms_of_payment}
              onChange={setField('terms_of_payment')}
              placeholder="e.g. 12 months"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} disabled={saving} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving || agentsState !== 'ready'} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Recording…' : 'Mark Sold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
