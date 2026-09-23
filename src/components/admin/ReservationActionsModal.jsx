import { Button, Modal } from '../shared/ui'

export default function ReservationActionsModal({ lot, onClose, onDownpayment, onCancelReservation }) {
  const lotLabel = lot.name ?? `Block ${lot.block_no ?? '—'} Lot ${lot.lot_no ?? '—'}`

  return (
    <Modal open onClose={onClose} label="Reservation actions" size="sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-brand-deep">Reservation</h2>
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
        {lotLabel} is reserved. Choose what to do with this reservation.
      </p>

      <div className="grid gap-3">
        <Button onClick={onDownpayment}>Make Downpayment</Button>
        <Button variant="danger" onClick={onCancelReservation}>
          Cancel Reservation
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
