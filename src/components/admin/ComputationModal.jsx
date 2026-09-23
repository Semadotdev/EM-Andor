import { useState } from 'react'
import { monthlyAmortization, PAYMENT_TERMS } from '../../lib/ledger.js'
import { formatPrice } from '../../lib/format.js'
import { Button, Input, Modal, Select } from '../shared/ui'

export default function ComputationModal({ lot, onClose }) {
  const [tcp, setTcp] = useState(lot?.price != null ? String(lot.price) : '')
  const [downpayment, setDownpayment] = useState('')
  const [terms, setTerms] = useState('')

  const tcpNumber = Number(tcp)
  const dpNumber = Number(downpayment)
  const previewMa = monthlyAmortization(tcpNumber, dpNumber, terms)
  const canPreview =
    tcp !== '' &&
    terms !== '' &&
    downpayment !== '' &&
    Number.isFinite(tcpNumber) &&
    tcpNumber > 0 &&
    Number.isFinite(dpNumber) &&
    dpNumber > 0 &&
    dpNumber <= tcpNumber

  const lotLabel = lot?.name ?? `Block ${lot?.block_no ?? '—'} Lot ${lot?.lot_no ?? '—'}`

  return (
    <Modal open onClose={onClose} label="Quick computation" size="md">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Quick Computation</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-ink/50 transition-colors hover:text-ink"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <p className="mb-5 text-sm text-ink/70">
        {lotLabel} — estimate the monthly amortization for a given downpayment and payment terms.
      </p>

      <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-5 sm:grid-cols-2">
        <Input
          id="qc-tcp"
          type="number"
          min="0"
          step="any"
          label="TCP"
          value={tcp}
          onChange={(e) => setTcp(e.target.value)}
        />

        <Input
          id="qc-dp"
          type="number"
          min="0"
          step="any"
          label="Downpayment"
          value={downpayment}
          onChange={(e) => setDownpayment(e.target.value)}
        />

        <div className="sm:col-span-2">
          <Select id="qc-terms" label="Terms of Payment" value={terms} onChange={(e) => setTerms(e.target.value)}>
            <option value="">Select terms…</option>
            {PAYMENT_TERMS.map((term) => (
              <option key={term.value} value={term.value}>
                {term.label}
              </option>
            ))}
          </Select>
        </div>

        {canPreview && (
          <dl className="space-y-2 rounded-lg border border-mist bg-surface p-4 text-sm sm:col-span-2">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/50">Balance after downpayment</dt>
              <dd className="text-ink/70">{formatPrice(tcpNumber - dpNumber)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep">Monthly Amortization</dt>
              <dd className="font-semibold text-brand-deep">{formatPrice(previewMa)}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </Modal>
  )
}