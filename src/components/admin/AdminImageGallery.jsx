import { useCallback, useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import { fetchProperties, updateProperty, uploadPropertyImage } from '../../lib/api.js'

export default function AdminImageGallery() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [previewImage, setPreviewImage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    fetchProperties()
      .then((result) => {
        const withImages = (result.data ?? []).filter((p) => p.image_url)
        setProperties(withImages)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = properties
    .filter((p) => {
      if (!searchInput) return true
      const term = searchInput.toLowerCase()
      return p.name.toLowerCase().includes(term) || (p.location ?? '').toLowerCase().includes(term)
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      return new Date(a.created_at) - new Date(b.created_at)
    })

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return
    setError(null)
    setDeleting(true)
    try {
      await updateProperty(confirmDelete.id, { image_url: null })
      setProperties((list) => list.filter((p) => p.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch {
      setError('Could not remove image. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !selectedPropertyId || uploading) return
    setError(null)
    setUploading(true)
    try {
      const url = await uploadPropertyImage(uploadFile)
      await updateProperty(selectedPropertyId, { image_url: url })
      setUploadOpen(false)
      setUploadFile(null)
      setSelectedPropertyId('')
      load()
    } catch {
      setError('Could not upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const allProperties = properties

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-brand-deep">Image Gallery</h1>
          <button onClick={() => setUploadOpen(true)} className="btn btn-gold">
            <Icon name="upload" className="size-4" />
            Upload Image
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search by property name or location…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search images"
            className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort images"
            className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
          >
            <option value="name_asc">Name: A → Z</option>
            <option value="name_desc">Name: Z → A</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading images…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load images.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          {searchInput ? 'No images match your search.' : 'No property images found. Upload an image to get started.'}
        </p>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <p className="mb-3 text-xs font-semibold text-ink/50">
          Showing {filtered.length} image{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((property) => (
            <div
              key={property.id}
              className="group relative overflow-hidden rounded-lg border border-mist bg-white"
            >
              <button
                type="button"
                onClick={() => setPreviewImage(property)}
                className="block aspect-[4/3] w-full cursor-pointer"
                aria-label={`Preview ${property.name} image`}
              >
                <img
                  src={property.image_url}
                  alt={property.name}
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>
              <div className="border-t border-mist p-3">
                <p className="truncate text-sm font-semibold text-brand-deep">{property.name}</p>
                {property.location && (
                  <p className="mt-0.5 truncate text-xs text-ink/50">{property.location}</p>
                )}
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setPreviewImage(property)}
                  className="grid size-8 place-items-center rounded-full bg-white/90 text-ink/70 shadow-sm transition-colors hover:bg-white hover:text-brand"
                  aria-label={`Preview ${property.name}`}
                >
                  <Icon name="image" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(property)}
                  className="grid size-8 place-items-center rounded-full bg-white/90 text-ink/70 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${property.name} image`}
                >
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewImage && (() => {
        const closePreview = () => setPreviewImage(null)
        return (
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-brand-deep/80 p-4"
            onClick={closePreview}
            onKeyDown={(e) => { if (e.key === 'Escape') closePreview() }}
            role="dialog"
            aria-modal="true"
            aria-label={`${previewImage.name} image preview`}
            tabIndex={-1}
            ref={(el) => { if (el) el.focus() }}
          >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-3 -top-3 z-10 grid size-8 place-items-center rounded-full bg-white text-ink/70 shadow-lg transition-colors hover:text-brand"
              aria-label="Close preview"
            >
              <Icon name="close" className="size-4" />
            </button>
            <img
              src={previewImage.image_url}
              alt={previewImage.name}
              className="max-h-[80vh] rounded-lg object-contain shadow-xl"
            />
            <div className="mt-3 text-center">
              <p className="font-display text-sm font-bold text-white">{previewImage.name}</p>
              {previewImage.location && (
                <p className="mt-0.5 text-xs text-white/70">{previewImage.location}</p>
              )}
            </div>
          </div>
          </div>
        )
      })()}

      {/* Upload Modal */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-brand-deep/60 p-4"
          onClick={() => { setUploadOpen(false); setUploadFile(null); setSelectedPropertyId('') }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="upload-title" className="font-display text-lg font-bold text-brand-deep">
              Upload Property Image
            </h3>
            <p className="mt-2 text-sm text-ink/70">
              Choose a property and select an image file to upload.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="upload-property" className="mb-1 block text-xs font-semibold text-ink/60">
                  Property
                </label>
                <select
                  id="upload-property"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                >
                  <option value="">Select a property…</option>
                  {allProperties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="upload-file" className="mb-1 block text-xs font-semibold text-ink/60">
                  Image File
                </label>
                <input
                  id="upload-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                />
                <p className="mt-1 text-xs text-ink/50">JPG, PNG, or WebP. Max 5MB.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setUploadOpen(false); setUploadFile(null); setSelectedPropertyId('') }}
                disabled={uploading}
                className="rounded-md border border-mist bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/30 hover:text-brand disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || !selectedPropertyId || uploading}
                className="rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 btn-gold"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Remove Image"
        message={confirmDelete ? `Remove the image from "${confirmDelete.name}"? This will clear the image URL but not delete the property.` : ''}
        confirmLabel="Remove"
        destructive
        loading={deleting}
      />
    </div>
  )
}
