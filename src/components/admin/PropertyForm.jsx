import { useEffect, useMemo, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'
import { subdivisionMap } from '../../data/site.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const types = ['residential lot', 'commercial lot', 'house & lot', 'development lot']

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value * 100) / 100))

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function PropertyForm({ mode, property, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    name: property?.name ?? '',
    type: property?.type ?? '',
    location: property?.location ?? '',
    lot_area_sqm: property?.lot_area_sqm ?? '',
    price: property?.price ?? '',
    description: property?.description ?? '',
    status: property?.status ?? 'available',
    is_pinned: property?.is_pinned ?? false,
  })
  const [pins, setPins] = useState(() => (property?.map_pins ?? []).map((p) => ({ ...p })))
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(property?.image_url ?? '')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [mapNotice, setMapNotice] = useState('')

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

  const addPin = (x, y) => {
    const next = pins.reduce((max, p) => {
      const m = String(p.name ?? '').match(/^Lot\s+(\d+)$/)
      return m ? Math.max(max, Number(m[1])) : max
    }, 0) + 1
    setPins((prev) => [
      ...prev,
      { id: newId(), name: `Lot ${next}`, price: '', lot_area_sqm: '', x: clampPercent(x), y: clampPercent(y) },
    ])
    setMapNotice('Lot pin added')
    setErrors((errs) => ({ ...errs, pins: undefined }))
  }

  const removePin = (id) => {
    setPins((prev) => prev.filter((p) => p.id !== id))
    setMapNotice('Lot pin removed')
  }

  const updatePin = (id, field) => (e) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: e.target.value } : p)))
    setErrors((errs) => ({ ...errs, pins: undefined }))
  }

  const clearAll = () => {
    setPins([])
    setErrors((errs) => ({ ...errs, pins: undefined }))
    setMapNotice('All lot pins removed')
  }

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    addPin(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100)
  }

  const handleMapKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    addPin(50, 50)
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.type) next.type = 'Select a type.'
    if (!form.location.trim()) next.location = 'Location is required.'
    if (pins.some((p) => !p.name.trim())) next.pins = 'Each lot needs a name.'
    return next
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (saving) return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setConfirmSubmit(true)
  }

  const doSave = async () => {
    if (saving) return
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
        status: form.status,
        image_url: finalImageUrl || null,
        is_pinned: form.is_pinned,
        map_pins: pins.map((p) => {
          const price = p.price === '' || p.price == null ? null : Number(p.price)
          const lotArea = p.lot_area_sqm === '' || p.lot_area_sqm == null ? null : Number(p.lot_area_sqm)
          return {
            id: p.id,
            name: p.name.trim(),
            price: Number.isFinite(price) && price >= 0 ? price : null,
            lot_area_sqm: Number.isFinite(lotArea) && lotArea >= 0 ? lotArea : null,
            x: Number(p.x),
            y: Number(p.y),
          }
        }),
      }
      const saved = isEdit ? await updateProperty(property.id, payload) : await createProperty(payload)
      onSaved(saved)
    } catch {
      setError('Could not save the property. Please try again.')
    } finally {
      setSaving(false)
      setConfirmSubmit(false)
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
              <label className="text-sm font-semibold text-brand-deep">Map of lots (optional)</label>
              {pins.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-md border border-mist px-2.5 py-1 text-xs font-semibold text-ink/60 transition-colors hover:border-brand/40 hover:text-brand"
                >
                  Clear all
                </button>
              )}
            </div>
            <p className="mb-2 text-xs text-ink/50">
              Click the map to add a lot pin — each pin is a separate lot. Click an existing pin to remove it.
            </p>
            <div
              className="relative cursor-crosshair overflow-hidden rounded-lg border border-mist focus:outline-none focus:ring-2 focus:ring-brand/20"
              onClick={handleMapClick}
              onKeyDown={handleMapKeyDown}
              role="button"
              tabIndex={0}
              aria-label="Subdivision map — click to add a lot pin at that spot, or press Enter to add one at the center"
            >
              <img src={subdivisionMap.image} alt={subdivisionMap.alt} className="w-full" />
              {pins.map((pin, i) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePin(pin.id)
                  }}
                  aria-label={`Remove ${pin.name || `Lot ${i + 1}`} pin`}
                  className="absolute z-10 -translate-x-1/2 -translate-y-full text-brand drop-shadow transition-transform hover:scale-110"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                >
                  <Icon name="pin" className="size-7" />
                </button>
              ))}
            </div>
            {errors.pins && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.pins}
              </p>
            )}
            <span aria-live="polite" className="sr-only">
              {mapNotice}
            </span>

            {pins.length > 0 && (
              <div className="mt-4 space-y-3">
                {pins.map((pin, i) => (
                  <div
                    key={pin.id}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-mist bg-surface p-4 sm:grid-cols-[1fr_130px_130px_auto]"
                  >
                    <input
                      className={inputCls}
                      value={pin.name}
                      onChange={updatePin(pin.id, 'name')}
                      placeholder={`Lot ${i + 1} name`}
                      aria-label={`Lot ${i + 1} name`}
                    />
                    <input
                      className={inputCls}
                      value={pin.price ?? ''}
                      onChange={updatePin(pin.id, 'price')}
                      placeholder="Price"
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`Lot ${i + 1} price`}
                    />
                    <input
                      className={inputCls}
                      value={pin.lot_area_sqm ?? ''}
                      onChange={updatePin(pin.id, 'lot_area_sqm')}
                      placeholder="Area (sqm)"
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`Lot ${i + 1} area`}
                    />
                    <button
                      type="button"
                      onClick={() => removePin(pin.id)}
                      className="rounded-md border border-mist bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="pf-pinned" type="checkbox" className="size-4 accent-brand" checked={form.is_pinned} onChange={setField('is_pinned')} />
            <label htmlFor="pf-pinned" className="text-sm font-semibold text-brand-deep">
              Pin to website
            </label>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-status" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Status
            </label>
            <select id="pf-status" className={inputCls} value={form.status} onChange={setField('status')}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
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

      <ConfirmModal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={doSave}
        title={isEdit ? 'Save Changes' : 'Add Property'}
        message={isEdit ? 'Save changes to this property?' : 'Add this property to the website?'}
        confirmLabel={isEdit ? 'Save Changes' : 'Add Property'}
        loading={saving}
      >
        <dl className="rounded-lg border border-mist bg-surface p-4 text-sm space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Name</dt>
            <dd className="text-right text-ink/70 truncate">{form.name || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Type</dt>
            <dd className="text-right text-ink/70 capitalize">{form.type || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Location</dt>
            <dd className="text-right text-ink/70 truncate">{form.location || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Lot Area</dt>
            <dd className="text-right text-ink/70">{form.lot_area_sqm ? `${Number(form.lot_area_sqm).toLocaleString()} sqm` : '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Price</dt>
            <dd className="text-right text-ink/70">{form.price ? `₱${Number(form.price).toLocaleString()}` : '—'}</dd>
          </div>
          {form.description && (
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep shrink-0">Description</dt>
              <dd className="text-right text-ink/70 truncate max-w-[60%]">{form.description}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Image</dt>
            <dd className="text-right text-ink/70">{imageFile ? 'New image attached' : imageUrl ? 'Existing image' : 'No image'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Lot Pins</dt>
            <dd className="text-right text-ink/70">{pins.length > 0 ? `${pins.length} lot${pins.length > 1 ? 's' : ''} (${pins.map((p) => p.name).join(', ')})` : 'None'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Pinned</dt>
            <dd className="text-right text-ink/70">{form.is_pinned ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-brand-deep shrink-0">Status</dt>
            <dd className="text-right text-ink/70 capitalize">{form.status}</dd>
          </div>
        </dl>
      </ConfirmModal>
    </div>
  )
}
