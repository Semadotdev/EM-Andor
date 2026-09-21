import { useEffect, useId, useRef } from 'react'

const modalStack = []

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export default function Modal({
  open,
  onClose,
  title,
  label,
  size = 'md',
  children,
  footer,
  busy = false,
  role = 'dialog',
  ...rest
}) {
  const dialogRef = useRef(null)
  const entryRef = useRef({})
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const entry = entryRef.current
    modalStack.push(entry)
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (modalStack[modalStack.length - 1] !== entry) return
      onCloseRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const index = modalStack.indexOf(entry)
      if (index !== -1) modalStack.splice(index, 1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey) {
      if (active === first || active === dialog) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || active === dialog) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        {...rest}
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? label : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={`w-full ${SIZES[size] ?? SIZES.md} rounded-lg bg-white p-6 shadow-lg outline-none`}
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-lg font-bold text-brand-deep">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md px-2 py-1 text-ink/50 transition-colors hover:text-ink disabled:opacity-60"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
