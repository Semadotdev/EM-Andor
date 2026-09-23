import { useState } from 'react'
import { monthlyAmortization, PAYMENT_TERMS } from '../../lib/ledger.js'
import { formatPrice } from '../../lib/format.js'
import { Button, Input, Modal } from '../shared/ui'

export default function ComputationModal({ lot, onClose }) {
  const [tcp, setTcp] = useState(lot?.price != null ? String(lot.price) : '')
  const [downpayment, setDownpayment] = useState('')

  const tcpNumber = Number(tcp)
  const dpNumber = Number(downpayment)
  const canPreview =
    tcp !== '' &&
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
        {lotLabel} — estimate the monthly amortization for a given downpayment across all payment terms.
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

        {canPreview && (
          <div className="sm:col-span-2 overflow-hidden rounded-lg border border-mist bg-surface">
            <div className="flex items-center justify-between gap-4 border-b border-mist px-4 py-3 text-sm">
              <span className="text-ink/50">Balance after downpayment</span>
              <span className="font-semibold text-ink/70">{formatPrice(tcpNumber - dpNumber)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink/50">
                  <th className="px-4 pt-3 pb-1 font-medium">Terms of Payment</th>
                  <th className="px-4 pt-3 pb-1 text-right font-medium">Monthly Amortization</th>
                </tr>
              </thead>
              <tbody>
                {PAYMENT_TERMS.map((term) => (
                  <tr key={term.value} className="border-t border-mist/60">
                    <td className="px-4 py-2 text-ink/70">{term.label}</td>
                    <td className="px-4 py-2 text-right font-semibold text-brand-deep">
                      {formatPrice(monthlyAmortization(tcpNumber, dpNumber, term.value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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