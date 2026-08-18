import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import SubdivisionMap from './SubdivisionMap.jsx'
import { submitInquiry } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

const fallbackImage = '/images/project-1.jpg'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function PropertyModal({ property, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((errs) => ({ ...errs, [field]: undefined }))
    setSent(false)
    setError(null)
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your full name.'
    if (!form.email.trim()) next.email = 'Please enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Please enter a valid email address.'
    if (!form.phone.trim()) next.phone = 'Please enter your phone number.'
    else if (!/^[+\d\s()-]{7,20}$/.test(form.phone)) next.phone = 'Please enter a valid phone number.'
    if (!form.message.trim()) next.message = 'Please enter a message.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const next = validate()
    setErrors(next)
    setSent(false)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setError(null)
    try {
      await submitInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        property_id: property.id,
        property_name: property.name,
      })
      setSent(true)
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch {
      setError('Something went wrong while sending your inquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const errorText = (field) =>
    errors[field] ? (
      <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
        {errors[field]}
      </p>
    ) : null

  const lots = property.map_pins ?? []
  const lotPrices = lots.map((l) => l.price).filter((v) => v != null)
  const minLotPrice = lotPrices.length > 0 ? Math.min(...lotPrices) : null
  const showFrom = minLotPrice != null
  const displayPrice = showFrom ? minLotPrice : property.price

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={property.name}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-ink/60 shadow-sm backdrop-blur transition-colors hover:text-ink"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg">
          <img
            src={property.image_url || fallbackImage}
            alt={property.name}
            className="h-full w-full object-cover"
          />
          <span className="absolute left-4 top-4 rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-white">
            {property.type}
          </span>
        </div>

        <div className="p-6 sm:p-8">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
            <Icon name="pin" className="size-3.5" />
            {property.location}
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-brand-deep">{property.name}</h2>
          {property.description && (
            <p className="mt-3 text-sm leading-relaxed text-ink/70">{property.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {displayPrice != null && formatPrice(displayPrice) && (
              <p className="font-display text-lg font-bold text-brand">
                {showFrom ? `From ${formatPrice(displayPrice)}` : formatPrice(displayPrice)}
              </p>
            )}
            {property.lot_area_sqm != null && lots.length === 0 && (
              <span className="text-sm font-medium text-ink/60">
                {Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm
              </span>
            )}
            {lots.length > 0 && (
              <span className="text-sm font-medium text-ink/60">
                {lots.length} {lots.length === 1 ? 'lot' : 'lots'}
              </span>
            )}
          </div>

          {lots.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-md border border-mist bg-surface p-4">
              {lots.map((lot, j) => {
                const lotPrice = formatPrice(lot.price)
                return (
                  <li key={lot.id ?? j} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-brand-deep">{lot.name}</span>
                    <span className="text-xs text-ink/60">
                      {lotPrice}
                      {lot.lot_area_sqm != null &&
                        `${lotPrice ? ' · ' : ''}${Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {lots.length > 0 && (
            <div className="mt-6">
              <SubdivisionMap properties={[property]} />
            </div>
          )}

          <div className="mt-8 border-t border-mist pt-8">
            <h3 className="font-display text-lg font-bold text-brand-deep">Inquire About This Property</h3>
            <p className="mt-1 text-sm text-ink/60">Fill out the form below and our team will get back to you shortly.</p>

            {sent && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-brand/25 bg-brand/10 p-4 text-sm font-medium text-brand-deep" role="status">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 13 4 4 10-11" />
                </svg>
                Thank you! Your inquiry has been sent. Our team will get back to you soon.
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pm-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Full Name
                </label>
                <input id="pm-name" name="name" type="text" autoComplete="name" placeholder="Juan Dela Cruz" className={inputCls} value={form.name} onChange={setField('name')} />
                {errorText('name')}
              </div>

              <div>
                <label htmlFor="pm-email" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Email Address
                </label>
                <input id="pm-email" name="email" type="email" autoComplete="email" placeholder="you@email.com" className={inputCls} value={form.email} onChange={setField('email')} />
                {errorText('email')}
              </div>

              <div>
                <label htmlFor="pm-phone" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Phone Number
                </label>
                <input id="pm-phone" name="phone" type="tel" autoComplete="tel" placeholder="(043) 000 0000" className={inputCls} value={form.phone} onChange={setField('phone')} />
                {errorText('phone')}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="pm-message" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Message
                </label>
                <textarea
                  id="pm-message"
                  name="message"
                  rows="4"
                  placeholder={`I'm interested in ${property.name}. Please share more details…`}
                  className={`${inputCls} resize-y`}
                  value={form.message}
                  onChange={setField('message')}
                />
                {errorText('message')}
              </div>

              <div className="sm:col-span-2">
                <button type="submit" disabled={submitting} className="btn btn-gold w-full sm:w-auto disabled:opacity-60">
                  {submitting ? 'Sending…' : 'Send Inquiry'}
                  {!submitting && <Icon name="arrow-right" className="size-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
