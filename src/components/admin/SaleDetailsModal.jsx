import { useEffect, useState } from 'react'
import { fetchSale, upsertSale } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const emptyForm = {
  buyer_name: '',
  buyer_address: '',
  tcp: '',
  downpayment: '',
  monthly_amortization: '',
  terms_of_payment: '',
}

export default function SaleDetailsModal({ lot, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let mounted = true
    fetchSale(lot.id)
      .then((sale) => {
        if (!mounted) return
        if (sale) {
          setForm({
            buyer_name: sale.buyer_name ?? '',
            buyer_address: sale.buyer_address ?? '',
            tcp: sale.tcp != null ? String(sale.tcp) : '',
            downpayment: sale.downpayment != null ? String(sale.downpayment) : '',
            monthly_amortization: sale.monthly_amortization != null ? String(sale.monthly_amortization) : '',
            terms_of_payment: sale.terms_of_payment ?? '',
          })
        } else if (lot?.price != null) {
          setForm((f) => ({ ...f, tcp: String(lot.price) }))
        }
      })
      .catch(() => {
        if (mounted) setError('Could not load the buyer details.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [lot.id, lot?.price])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setFieldErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return

    const errors = {}
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
      await upsertSale(lot.id, {
        buyer_name: form.buyer_name.trim(),
        buyer_address: form.buyer_address.trim(),
        tcp,
        downpayment: Number(form.downpayment) || 0,
        monthly_amortization: Number(form.monthly_amortization) || 0,
        terms_of_payment: form.terms_of_payment.trim(),
      })
      onSaved()
    } catch {
      setError('Could not save the buyer details. Please try again.')
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
        aria-label="Edit sale"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Edit Sale</h2>
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
            <dt className="font-semibold text-brand-deep">Lot</dt>
            <dd className="text-right text-ink/70">{lot.name ?? `Block ${lot.block_no} Lot ${lot.lot_no}`}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep">Lot Price</dt>
            <dd className="text-right text-ink/70">{formatPrice(lot.price) ?? '—'}</dd>
          </div>
        </dl>

        {loading ? (
          <p className="py-6 text-center text-sm text-ink/60">Loading buyer details…</p>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="sd-buyer-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                Buyer Name
              </label>
              <input
                id="sd-buyer-name"
                autoFocus
                className={inputCls}
                value={form.buyer_name}
                onChange={setField('buyer_name')}
              />
              {fieldErrors.buyer_name && (
                <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{fieldErrors.buyer_name}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sd-buyer-address" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                Buyer Address
              </label>
              <input
                id="sd-buyer-address"
                className={inputCls}
                value={form.buyer_address}
                onChange={setField('buyer_address')}
              />
            </div>

            <div>
              <label htmlFor="sd-tcp" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                TCP
              </label>
              <input
                id="sd-tcp"
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
              <label htmlFor="sd-downpayment" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                Downpayment
              </label>
              <input
                id="sd-downpayment"
                type="number"
                min="0"
                step="any"
                className={inputCls}
                value={form.downpayment}
                onChange={setField('downpayment')}
              />
            </div>

            <div>
              <label htmlFor="sd-ma" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                M.A.
              </label>
              <input
                id="sd-ma"
                type="number"
                min="0"
                step="any"
                className={inputCls}
                value={form.monthly_amortization}
                onChange={setField('monthly_amortization')}
              />
            </div>

            <div>
              <label htmlFor="sd-terms" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                Terms of Payment
              </label>
              <input
                id="sd-terms"
                className={inputCls}
                value={form.terms_of_payment}
                onChange={setField('terms_of_payment')}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={onClose} disabled={saving} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand disabled:opacity-60">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
