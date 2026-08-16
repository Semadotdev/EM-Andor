import { useState } from 'react'
import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { submitInquiry } from '../../lib/api.js'
import { contact } from '../../data/site.js'

const infoItems = [
  { icon: 'phone', label: 'Phone', value: contact.phone, href: contact.phoneHref },
  { icon: 'mail', label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
  { icon: 'pin', label: 'Address', value: contact.address },
]

const projectTypes = ['Residential Construction', 'Commercial Construction', 'Renovation & Improvement', 'Design & Build', 'Other']

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', projectType: '', message: '' })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
    if (!form.message.trim()) next.message = 'Please tell us a little about your project.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setError(null)
    try {
      await submitInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        project_type: form.projectType || null,
        message: form.message.trim(),
      })
      setSent(true)
      setForm({ name: '', email: '', phone: '', projectType: '', message: '' })
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

  return (
    <section id="contact" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading
          eyebrow="Get in Touch"
          title="Let’s Talk About Your Project"
          description="Share your plans with us — our team will get back to you with honest advice and a clear next step."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
          <Reveal className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {infoItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href ?? undefined}
                  className={`group flex items-start gap-4 rounded-lg border border-mist bg-surface p-5 transition-all duration-300 hover:border-brand/25 hover:bg-white hover:shadow-card ${
                    item.href ? '' : 'pointer-events-none'
                  }`}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand text-white transition-colors duration-300 group-hover:bg-gold group-hover:text-brand-deep">
                    <Icon name={item.icon} className="size-6" />
                  </span>
                  <span>
                    <span className="block font-display text-xs font-bold uppercase tracking-[0.16em] text-ink/50">{item.label}</span>
                    <span className="mt-1 block break-words font-semibold text-brand-deep">{item.value}</span>
                  </span>
                </a>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-mist shadow-card">
              <iframe
                title="Map — E.M. Andor, Batangas City"
                src={contact.mapEmbed}
                className="h-72 w-full border-0 lg:h-[380px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-mist bg-surface p-6 sm:p-8">
              {sent && (
                <div className="mb-6 flex items-start gap-3 rounded-md border border-brand/25 bg-brand/10 p-4 text-sm font-medium text-brand-deep" role="status">
                  <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 13 4 4 10-11" />
                  </svg>
                  Thank you! Your inquiry has been sent. Our team will get back to you soon.
                </div>
              )}

              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
                  <span aria-hidden="true">!</span>
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                    Full Name
                  </label>
                  <input id="name" name="name" type="text" autoComplete="name" placeholder="Juan Dela Cruz" className={inputCls} value={form.name} onChange={setField('name')} />
                  {errorText('name')}
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                    Email Address
                  </label>
                  <input id="email" name="email" type="email" autoComplete="email" placeholder="you@email.com" className={inputCls} value={form.email} onChange={setField('email')} />
                  {errorText('email')}
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                    Phone Number
                  </label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(043) 000 0000" className={inputCls} value={form.phone} onChange={setField('phone')} />
                  {errorText('phone')}
                </div>

                <div>
                  <label htmlFor="projectType" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                    Project Type
                  </label>
                  <select id="projectType" name="projectType" className={inputCls} value={form.projectType} onChange={setField('projectType')}>
                    <option value="">Select a project type…</option>
                    {projectTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows="5"
                    placeholder="Tell us about your project, timeline, and goals…"
                    className={`${inputCls} resize-y`}
                    value={form.message}
                    onChange={setField('message')}
                  />
                  {errorText('message')}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full sm:w-auto disabled:opacity-60">
                {submitting ? 'Sending…' : 'Submit Inquiry'}
                {!submitting && <Icon name="arrow-right" className="size-4" />}
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
