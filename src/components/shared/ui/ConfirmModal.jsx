import { useEffect, useRef } from 'react'
import Icon from '../Icon.jsx'
import Modal from './Modal.jsx'

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  children,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => confirmRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  const confirmCls = destructive
    ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600'
    : 'btn-gold'

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={title}
      role="alertdialog"
      busy={loading}
      aria-describedby={message ? 'confirm-message' : undefined}
    >
      <div className="flex items-start gap-4">
        <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full ${destructive ? 'bg-red-100 text-red-600' : 'bg-brand/10 text-brand'}`}>
          <Icon name={destructive ? 'safety' : 'detail'} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-brand-deep">{title}</h3>
          <p id="confirm-message" className="mt-2 text-sm leading-relaxed text-ink/70">
            {message}
          </p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-md border border-mist bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/30 hover:text-brand disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmCls}`}
        >
          {loading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
