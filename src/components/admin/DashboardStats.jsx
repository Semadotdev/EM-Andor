import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchPropertyStats, fetchInquiryStats, fetchRecentInquiries } from '../../lib/api.js'

const statCardCls = 'rounded-lg border border-mist bg-white p-5 flex items-center gap-4'
const iconCls = 'size-10 shrink-0 grid place-items-center rounded-full'

export default function DashboardStats({ onJumpToInquiries }) {
  const [propertyStats, setPropertyStats] = useState(null)
  const [inquiryStats, setInquiryStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchPropertyStats(), fetchInquiryStats(), fetchRecentInquiries()])
      .then(([ps, is, rec]) => {
        if (!mounted) return
        setPropertyStats(ps)
        setInquiryStats(is)
        setRecent(rec)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return <p className="py-6 text-center text-ink/50 text-sm">Loading stats…</p>
  }

  const typeLabels = {
    'residential lot': 'Residential Lot',
    'commercial lot': 'Commercial Lot',
    'house & lot': 'House & Lot',
    'development lot': 'Development Lot',
  }

  return (
    <div className="mb-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={statCardCls}>
          <span className={`${iconCls} bg-brand/10 text-brand`}>
            <Icon name="residential" className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{propertyStats?.total ?? 0}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">Total Properties</p>
          </div>
        </div>
        <div className={statCardCls}>
          <span className={`${iconCls} bg-gold/20 text-yellow-700`}>
            <Icon name="pin" className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{propertyStats?.pinned ?? 0}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">Pinned</p>
          </div>
        </div>
        <div className={statCardCls}>
          <span className={`${iconCls} bg-blue-100 text-blue-600`}>
            <Icon name="detail" className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{inquiryStats?.total ?? 0}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">Total Inquiries</p>
          </div>
        </div>
        <div className={statCardCls}>
          <span className={`${iconCls} bg-red-100 text-red-600`}>
            <Icon name="safety" className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{inquiryStats?.unread ?? 0}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">Unread</p>
          </div>
        </div>
      </div>

      {propertyStats?.types && Object.keys(propertyStats.types).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(propertyStats.types).map(([type, count]) => (
            <span key={type} className="rounded-full border border-mist bg-white px-3 py-1 text-xs font-semibold text-ink/70">
              {typeLabels[type] || type}: {count}
            </span>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="rounded-lg border border-mist bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-brand-deep">Recent Inquiries</h3>
            {onJumpToInquiries && (
              <button
                onClick={onJumpToInquiries}
                className="text-xs font-semibold text-brand hover:underline"
              >
                View all
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {recent.map((inq) => (
              <li key={inq.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {!inq.is_read && <span className="size-1.5 rounded-full bg-brand" />}
                  <span className="font-medium text-brand-deep">{inq.name}</span>
                  <span className="text-ink/40">·</span>
                  <span className="text-ink/50">{inq.project_type || 'General'}</span>
                </span>
                <span className="text-xs text-ink/40">{new Date(inq.created_at).toLocaleDateString('en-PH')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
