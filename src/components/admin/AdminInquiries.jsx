import { useCallback, useEffect, useState } from 'react'
import { deleteInquiry, fetchInquiries, setInquiryRead } from '../../lib/api.js'

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [pendingReads, setPendingReads] = useState({})

  const load = useCallback(() => {
    setStatus('loading')
    fetchInquiries()
      .then((data) => {
        setInquiries(data ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  const toggleRead = async (inquiry) => {
    if (pendingReads[inquiry.id]) return
    const next = !inquiry.is_read
    const prev = inquiry.is_read
    setError(null)
    setPendingReads((reads) => ({ ...reads, [inquiry.id]: true }))
    setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: next } : x)))
    try {
      await setInquiryRead(inquiry.id, next)
    } catch {
      setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: prev } : x)))
      setError('Could not update status. Please try again.')
    } finally {
      setPendingReads((reads) => ({ ...reads, [inquiry.id]: false }))
    }
  }

  const handleDelete = async (inquiry) => {
    if (!window.confirm(`Delete inquiry from ${inquiry.name}?`)) return
    setError(null)
    try {
      await deleteInquiry(inquiry.id)
      setInquiries((list) => list.filter((x) => x.id !== inquiry.id))
    } catch {
      setError('Could not delete inquiry. Please try again.')
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">Inquiries</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading inquiries…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load inquiries.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && inquiries.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No inquiries yet. Submissions from the contact form will appear here.
        </p>
      )}

      {status === 'ready' && inquiries.length > 0 && (
        <ul className="space-y-4">
          {inquiries.map((inquiry) => {
            const isExpanded = expanded === inquiry.id
            return (
              <li
                key={inquiry.id}
                className={`rounded-lg border bg-white p-5 ${inquiry.is_read ? 'border-mist' : 'border-brand/40 ring-1 ring-brand/20'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button className="text-left" onClick={() => setExpanded(isExpanded ? null : inquiry.id)} aria-expanded={isExpanded}>
                    <span className="flex items-center gap-2">
                      {!inquiry.is_read && <span className="size-2 rounded-full bg-brand" aria-hidden="true" />}
                      <span className="font-semibold text-brand-deep">{inquiry.name}</span>
                      <span className="text-sm text-ink/50">
                        · <span>{inquiry.project_type || 'General'}</span>
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/50">
                      {new Date(inquiry.created_at).toLocaleString('en-PH')}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleRead(inquiry)}
                      disabled={Boolean(pendingReads[inquiry.id])}
                      aria-pressed={inquiry.is_read}
                      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      {inquiry.is_read ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button
                      onClick={() => handleDelete(inquiry)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 rounded-md bg-surface p-4 text-sm leading-relaxed text-ink/80">
                    <p>
                      <span className="font-semibold text-brand-deep">Email:</span> {inquiry.email}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-brand-deep">Phone:</span> {inquiry.phone}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">{inquiry.message}</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
