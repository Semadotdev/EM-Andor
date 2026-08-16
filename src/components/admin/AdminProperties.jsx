import { useCallback, useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import PropertyForm from './PropertyForm.jsx'
import { deleteProperty, fetchProperties, setPropertyPinned } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

export default function AdminProperties() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    fetchProperties()
      .then((data) => {
        setProperties(data ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  const togglePin = async (property) => {
    const next = !property.is_pinned
    const prev = property.is_pinned
    setError(null)
    setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: next } : x)))
    try {
      await setPropertyPinned(property.id, next)
    } catch {
      setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: prev } : x)))
      setError('Could not update pin status. Please try again.')
    }
  }

  const handleDelete = async (property) => {
    if (!window.confirm(`Delete "${property.name}"? This cannot be undone.`)) return
    setError(null)
    try {
      await deleteProperty(property.id)
      setProperties((list) => list.filter((x) => x.id !== property.id))
    } catch {
      setError('Could not delete property. Please try again.')
    }
  }

  const handleSaved = (saved) => {
    if (form?.mode === 'edit') {
      setProperties((list) => list.map((x) => (x.id === saved.id ? saved : x)))
    } else {
      setProperties((list) => [saved, ...list])
    }
    setForm(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Properties</h1>
        <button onClick={() => setForm({ mode: 'create' })} className="btn btn-gold">
          <Icon name="residential" className="size-4" />
          Add Property
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading properties…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load properties.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && properties.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No properties yet. Click “Add Property” to create one.
        </p>
      )}

      {status === 'ready' && properties.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Location</th>
                <th className="hidden px-4 py-3 lg:table-cell">Price</th>
                <th className="px-4 py-3 text-center">Pinned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {property.image_url ? (
                        <img src={property.image_url} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-mist text-ink/40">
                          <Icon name="residential" className="size-5" />
                        </span>
                      )}
                      <div>
                        <p className="font-semibold text-brand-deep">{property.name}</p>
                        {property.lot_area_sqm != null && (
                          <p className="text-xs text-ink/50">{Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{property.type}</td>
                  <td className="hidden px-4 py-3 text-ink/70 md:table-cell">{property.location}</td>
                  <td className="hidden px-4 py-3 font-semibold text-ink lg:table-cell">{formatPrice(property.price) ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePin(property)}
                      aria-pressed={property.is_pinned}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        property.is_pinned
                          ? 'bg-gold text-brand-deep'
                          : 'border border-mist text-ink/50 hover:border-brand/40 hover:text-brand'
                      }`}
                    >
                      <Icon name="pin" className="size-3.5" />
                      {property.is_pinned ? 'Pinned' : 'Pin'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setForm({ mode: 'edit', property })}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <PropertyForm
          mode={form.mode}
          property={form.mode === 'edit' ? form.property : null}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
