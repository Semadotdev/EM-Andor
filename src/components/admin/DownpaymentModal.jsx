import { useEffect, useState } from 'react'
import { completeDownpayment, fetchPayments, fetchSale, lotFieldsForSale } from '../../lib/sales.js'
import { minimumEquity, monthlyAmortization, PAYMENT_TERMS } from '../../lib/ledger.js'
import { formatPrice } from '../../lib/format.js'
import { Button, ErrorState, Input, LoadingState, Modal, Select, useToast } from '../shared/ui'

export default function DownpaymentModal({ lot, project, onClose, onSold }) {
  const { showToast } = useToast()
  const [sale, setSale] = useState(null)
  const [state, setState] = useState('loading')
  const [reservationFee, setReservationFee] = useState(0)
  const [downpayment, setDownpayment] = useState('')
  const [terms, setTerms] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setState('loading')
    Promise.all([fetchSale(lot.id), fetchPayments(lot.id)])
      .then(([row, payments]) => {
        setSale(row)
        if (row?.terms_of_payment) setTerms(String(row.terms_of_payment))
        const fee = (payments ?? [])
          .filter((p) => p?.remarks === 'Reservation')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        setReservationFee(fee)
        setState('ready')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [lot.id])

  const tcp = Number(sale?.tcp ?? lot?.price)
  const dpNumber = Number(downpayment)
  const minEquity = minimumEquity(tcp)
  const remainingToMin = Math.max(0, minEquity - reservationFee)
  const previewMa = monthlyAmortization(tcp, dpNumber, terms)
  const canPreview =
    state === 'ready' &&
    terms !== '' &&
    downpayment !== '' &&
    Number.isFinite(dpNumber) &&
    dpNumber > 0 &&
    dpNumber <= tcp

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return

    const errors = {}
    if (downpayment === '' || Number.isNaN(dpNumber) || dpNumber <= 0) {
      errors.downpayment = 'Downpayment must be greater than 0.'
    } else if (dpNumber > tcp) {
      errors.downpayment = 'Downpayment cannot exceed the TCP.'
    } else if (dpNumber + reservationFee < minEquity) {
      errors.downpayment = `Downpayment must be at least ${formatPrice(remainingToMin)} to reach 20% of the TCP with the reservation fee.`
    }
    if (!terms) errors.terms_of_payment = 'Select the terms of payment.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setFieldErrors({})
    setError(null)
    try {
      await completeDownpayment({
        propertyId: lot.id,
        payload: { ...lotFieldsForSale(lot), status: 'sold', sold_by: lot.sold_by },
        downpayment: dpNumber,
        terms,
        monthlyAmortization: monthlyAmortization(tcp, dpNumber, terms),
      })
      showToast('Downpayment recorded.')
      onSold()
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        setError('Could not record the downpayment. Please try again.')
      } else {
        setError(err?.message || 'Could not record the downpayment. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const lotLabel = lot.name ?? `Block ${lot.block_no ?? '—'} Lot ${lot.lot_no ?? '—'}`

  return (
    <Modal open onClose={onClose} label="Make downpayment" size="md" busy={saving}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Make Downpayment</h2>
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

      {state === 'loading' && <LoadingState label="Loading reservation…" />}

      {state === 'error' && <ErrorState message="Could not load the reservation." onRetry={load} />}

      {state === 'ready' && (
        <>
          <dl className="mb-5 space-y-2 rounded-lg border border-mist bg-surface p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">Lot</dt>
              <dd className="text-right text-ink/70">{lotLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">Buyer</dt>
              <dd className="text-right text-ink/70">{sale?.buyer_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">TCP</dt>
              <dd className="text-right text-ink/70">{formatPrice(sale?.tcp) ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">Reservation fee paid</dt>
              <dd className="text-right text-ink/70">{formatPrice(reservationFee)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">20% of TCP (minimum)</dt>
              <dd className="text-right text-ink/70">{formatPrice(minEquity)}</dd>
            </div>
            {remainingToMin > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">Still needed to reach 20%</dt>
                <dd className="text-right font-semibold text-brand-deep">{formatPrice(remainingToMin)}</dd>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-brand-deep">20% minimum</dt>
                <dd className="text-right font-semibold text-emerald-700">Met by the reservation fee</dd>
              </div>
            )}
          </dl>

          <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
            <Input
              id="dp-amount"
              type="number"
              min="0"
              step="any"
              label="Downpayment"
              value={downpayment}
              onChange={(e) => {
                setDownpayment(e.target.value)
                setFieldErrors((errs) => ({ ...errs, downpayment: undefined }))
                setError(null)
              }}
              error={fieldErrors.downpayment}
            />

            <Select
              id="dp-terms"
              label="Terms of Payment"
              value={terms}
              onChange={(e) => {
                setTerms(e.target.value)
                setFieldErrors((errs) => ({ ...errs, terms_of_payment: undefined }))
                setError(null)
              }}
              error={fieldErrors.terms_of_payment}
            >
              <option value="">Select terms…</option>
              {PAYMENT_TERMS.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </Select>

            {canPreview && (
              <dl className="space-y-2 rounded-lg border border-mist bg-surface p-4 text-sm sm:col-span-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/50">Balance after downpayment</dt>
                  <dd className="text-ink/70">{formatPrice(tcp - dpNumber)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-brand-deep">Monthly Amortization</dt>
                  <dd className="font-semibold text-brand-deep">{formatPrice(previewMa)}</dd>
                </div>
              </dl>
            )}

            <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Record Downpayment'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
