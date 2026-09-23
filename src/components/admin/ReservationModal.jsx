import { useEffect, useState } from 'react'
import { fetchAllAgents } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { lotFieldsForSale, completeReservationWithDownpayment, reserveLot } from '../../lib/sales.js'
import { minimumEquity, monthlyAmortization, PAYMENT_TERMS } from '../../lib/ledger.js'
import { formatPrice } from '../../lib/format.js'
import { Button, FieldError, Input, Modal, Select, useToast } from '../shared/ui'

const detailFields = ['buyer_name', 'buyer_address', 'tcp', 'reservation_fee', 'terms_of_payment']

export default function ReservationModal({ lot, project, onClose, onReserved }) {
  const { showToast } = useToast()
  const [agents, setAgents] = useState([])
  const [agentsState, setAgentsState] = useState('loading')
  const [sellerId, setSellerId] = useState(lot?.sold_by ?? '')
  const [form, setForm] = useState({
    buyer_name: '',
    buyer_address: '',
    tcp: lot?.price != null ? String(lot.price) : '',
    reservation_fee: '',
    terms_of_payment: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

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
    if (form.reservation_fee !== '' && (Number.isNaN(Number(form.reservation_fee)) || Number(form.reservation_fee) < 0)) {
      errors.reservation_fee = 'Reservation fee cannot be negative.'
    }
    if (!form.terms_of_payment) errors.terms_of_payment = 'Select the terms of payment.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setFieldErrors({})
    setError(null)
    const details = {
      buyer_name: form.buyer_name.trim(),
      buyer_address: form.buyer_address.trim(),
      tcp,
      terms_of_payment: form.terms_of_payment,
    }
    const fee = Number(form.reservation_fee) || 0
    try {
      if (fee >= minimumEquity(tcp)) {
        await completeReservationWithDownpayment({
          propertyId: lot.id,
          payload: { ...lotFieldsForSale(lot), status: 'sold', sold_by: sellerId },
          details: {
            ...details,
            downpayment: fee,
            monthly_amortization: monthlyAmortization(tcp, fee, form.terms_of_payment),
          },
          downpayment: fee,
          terms: form.terms_of_payment,
          monthlyAmortization: monthlyAmortization(tcp, fee, form.terms_of_payment),
        })
        showToast('Reservation recorded as a downpayment.')
      } else {
        await reserveLot({
          propertyId: lot.id,
          payload: { ...lotFieldsForSale(lot), status: 'reserved', sold_by: sellerId },
          details: { ...details, downpayment: 0, monthly_amortization: 0 },
          reservationFee: fee,
        })
        showToast('Reservation recorded.')
      }
      onReserved()
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        const hasNonSellerError = Object.keys(err.fieldErrors).some((field) => field !== 'sold_by')
        if (hasNonSellerError) setError('Could not record the reservation. Please try again.')
      } else if (err?.message?.includes('Commission already paid') || err?.message?.includes('buyer details failed to save')) {
        setError(err.message)
      } else {
        setError('Could not record the reservation. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const otherErrors = Object.entries(fieldErrors).filter(
    ([field]) => field !== 'sold_by' && !detailFields.includes(field),
  )

  const tcp = Number(form.tcp)

  return (
    <Modal open onClose={onClose} label="Reserve lot" size="md" busy={saving}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Reserve Lot</h2>
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
          <Select id="rs-seller" label="Selling Agent" value={sellerId} onChange={setSeller} error={fieldErrors.sold_by}>
            <option value="">
              {agentsState === 'loading' ? 'Loading agents…' : agentsState === 'error' ? 'Could not load agents' : 'Select agent…'}
            </option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})
              </option>
            ))}
          </Select>
          {otherErrors.map(([field, message]) => (
            <FieldError key={field}>{message}</FieldError>
          ))}
        </div>

        <div className="sm:col-span-2">
          <Input
            id="rs-buyer-name"
            label="Buyer Name"
            value={form.buyer_name}
            onChange={setField('buyer_name')}
            placeholder="Juan Dela Cruz"
            error={fieldErrors.buyer_name}
          />
        </div>

        <div className="sm:col-span-2">
          <Input
            id="rs-buyer-address"
            label="Buyer Address"
            value={form.buyer_address}
            onChange={setField('buyer_address')}
            placeholder="Street, Barangay, City"
            error={fieldErrors.buyer_address}
          />
        </div>

        <Input id="rs-tcp" type="number" min="0" step="any" label="TCP" value={form.tcp} onChange={setField('tcp')} error={fieldErrors.tcp} readOnly className="cursor-not-allowed bg-mist/30" />

        <div>
          <Input
            id="rs-fee"
            type="number"
            min="0"
            step="any"
            label="Reservation Fee"
            value={form.reservation_fee}
            onChange={setField('reservation_fee')}
            error={fieldErrors.reservation_fee}
          />
          {Number.isFinite(tcp) && tcp > 0 && (
            <p className="mt-1.5 text-xs text-ink/50">
              20% of TCP: {formatPrice(minimumEquity(tcp))} — a reservation fee of at least this amount is recorded as the
              downpayment and completes the sale.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Select
            id="rs-terms"
            label="Terms of Payment"
            value={form.terms_of_payment}
            onChange={setField('terms_of_payment')}
            error={fieldErrors.terms_of_payment}
          >
            <option value="">Select terms…</option>
            {PAYMENT_TERMS.map((term) => (
              <option key={term.value} value={term.value}>
                {term.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || agentsState !== 'ready'}>
            {saving ? 'Saving…' : 'Reserve Lot'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
