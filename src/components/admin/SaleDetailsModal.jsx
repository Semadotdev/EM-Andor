import { useEffect, useState } from 'react'
import { fetchSale, upsertSale } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { Button, Input, LoadingState, Modal, useToast } from '../shared/ui'

const emptyForm = {
  buyer_name: '',
  buyer_address: '',
  tcp: '',
  downpayment: '',
  monthly_amortization: '',
  terms_of_payment: '',
}

export default function SaleDetailsModal({ lot, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)

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
      showToast('Sale details saved.')
      onSaved()
    } catch {
      setError('Could not save the buyer details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} label="Edit sale" size="md" busy={saving}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Edit Sale</h2>
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
        <LoadingState label="Loading buyer details…" />
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input id="sd-buyer-name" autoFocus label="Buyer Name" value={form.buyer_name} onChange={setField('buyer_name')} error={fieldErrors.buyer_name} />
          </div>

          <div className="sm:col-span-2">
            <Input id="sd-buyer-address" label="Buyer Address" value={form.buyer_address} onChange={setField('buyer_address')} error={fieldErrors.buyer_address} />
          </div>

          <Input id="sd-tcp" type="number" min="0" step="any" label="TCP" value={form.tcp} onChange={setField('tcp')} error={fieldErrors.tcp} />

          <Input id="sd-downpayment" type="number" min="0" step="any" label="Downpayment" value={form.downpayment} onChange={setField('downpayment')} error={fieldErrors.downpayment} />

          <Input id="sd-ma" type="number" min="0" step="any" label="M.A." value={form.monthly_amortization} onChange={setField('monthly_amortization')} error={fieldErrors.monthly_amortization} />

          <Input id="sd-terms" label="Terms of Payment" value={form.terms_of_payment} onChange={setField('terms_of_payment')} error={fieldErrors.terms_of_payment} />

          <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
