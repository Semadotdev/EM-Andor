import { useEffect, useMemo, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'
import { subdivisionMap } from '../../data/site.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const types = ['residential lot', 'commercial lot', 'house & lot', 'development lot']

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value * 100) / 100))

export default function PropertyForm({ mode, property, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    name: property?.name ?? '',
    type: property?.type ?? '',
    location: property?.location ?? '',
    lot_area_sqm: property?.lot_area_sqm ?? '',
    price: property?.price ?? '',
    description: property?.description ?? '',
    is_pinned: property?.is_pinned ?? false,
    map_x: property?.map_x ?? '',
    map_y: property?.map_y ?? '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(property?.image_url ?? '')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = clampPercent(((e.clientX - rect.left) / rect.width) * 100)
    const y = clampPercent(((e.clientY - rect.top) / rect.height) * 100)
    setForm((f) => ({ ...f, map_x: x, map_y: y }))
  }

  const hasMapPin = form.map_x !== '' && form.map_y !== ''

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.type) next.type = 'Select a type.'
    if (!form.location.trim()) next.location = 'Location is required.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setError(null)
    try {
      let finalImageUrl = imageUrl
      if (imageFile) finalImageUrl = await uploadPropertyImage(imageFile)
      const payload = {
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        lot_area_sqm: form.lot_area_sqm === '' ? null : Number(form.lot_area_sqm),
        price: form.price === '' ? null : Number(form.price),
        description: form.description.trim() || null,
        image_url: finalImageUrl || null,
        is_pinned: form.is_pinned,
        map_x: form.map_x === '' ? null : Number(form.map_x),
        map_y: form.map_y === '' ? null : Number(form.map_y),
      }
      const saved = isEdit ? await updateProperty(property.id, payload) : await createProperty(payload)
      onSaved(saved)
    } catch {
      setError('Could not save the property. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit property' : 'Add property'}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="pf-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Name
            </label>
            <input id="pf-name" autoFocus className={inputCls} value={form.name} onChange={setField('name')} placeholder="Andor Ridge Lot A" />
            {errors.name && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-type" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Type
            </label>
            <select id="pf-type" className={inputCls} value={form.type} onChange={setField('type')}>
              <option value="">Select type…</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-location" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Location
            </label>
            <input id="pf-location" className={inputCls} value={form.location} onChange={setField('location')} placeholder="Batangas City" />
            {errors.location && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.location}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-area" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Lot Area (sqm)
            </label>
            <input id="pf-area" type="number" min="0" step="any" className={inputCls} value={form.lot_area_sqm} onChange={setField('lot_area_sqm')} placeholder="150" />
          </div>

          <div>
            <label htmlFor="pf-price" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Price (PHP)
            </label>
            <input id="pf-price" type="number" min="0" step="any" className={inputCls} value={form.price} onChange={setField('price')} placeholder="1500000" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-description" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Description (optional)
            </label>
            <textarea id="pf-description" rows="3" className={`${inputCls} resize-y`} value={form.description} onChange={setField('description')} placeholder="Short description…" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-image" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Image
            </label>
            <input id="pf-image" type="file" accept="image/*" className={inputCls} onChange={(e) => setImageFile(e.target.files[0] ?? null)} />
            {(imageUrl || imageFile) && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={imageFile ? previewUrl : imageUrl}
                  alt=""
                  className="size-16 rounded-md border border-mist object-cover"
                />
                {imageUrl && !imageFile && <span className="text-xs text-ink/50">Current image on file</span>}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-brand-deep">Map position (optional)</label>
              {hasMapPin && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, map_x: '', map_y: '' }))}
                  className="rounded-md border border-mist px-2.5 py-1 text-xs font-semibold text-ink/60 transition-colors hover:border-brand/40 hover:text-brand"
                >
                  Clear pin
                </button>
              )}
            </div>
            <p className="mb-2 text-xs text-ink/50">Click the map where this lot is located.</p>
            <div className="relative overflow-hidden rounded-lg border border-mist" onClick={handleMapClick} role="img" aria-label="Subdivision map">
              <img src={subdivisionMap.image} alt={subdivisionMap.alt} className="w-full" />
              {hasMapPin && (
                <span
                  aria-hidden="true"
                  className="absolute z-10 -translate-x-1/2 -translate-y-full text-brand drop-shadow"
                  style={{ left: `${Number(form.map_x)}%`, top: `${Number(form.map_y)}%` }}
                >
                  <Icon name="pin" className="size-7" />
                </span>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="pf-pinned" type="checkbox" className="size-4 accent-brand" checked={form.is_pinned} onChange={setField('is_pinned')} />
            <label htmlFor="pf-pinned" className="text-sm font-semibold text-brand-deep">
              Pin to website
            </label>
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
