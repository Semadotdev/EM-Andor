import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import { fetchCMSContentList, fetchCMSContent, updateCMSContent, uploadPropertyImage } from '../../lib/api.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const PAGE_LABELS = {
  'home-hero': 'Home Hero Section',
  'about': 'About Us',
  'contact': 'Contact Information',
  'footer': 'Footer Content',
}

export default function AdminCMS() {
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', subtitle: '', content: '', image_url: '', status: 'draft' })
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const load = () => {
    setStatus('loading')
    setError(null)
    fetchCMSContentList()
      .then((data) => {
        setPages(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(load, [])

  const handleEdit = async (page) => {
    setEditing(page)
    setPreviewMode(false)
    setImageFile(null)
    try {
      const content = await fetchCMSContent(page.page_id)
      setForm({
        title: content.title ?? '',
        subtitle: content.subtitle ?? '',
        content: content.content ?? '',
        image_url: content.image_url ?? '',
        status: content.status ?? 'draft',
      })
    } catch {
      setError('Could not load content. Please try again.')
      setEditing(null)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      let imageUrl = form.image_url
      if (imageFile) imageUrl = await uploadPropertyImage(imageFile)
      await updateCMSContent(editing.page_id, {
        title: form.title,
        subtitle: form.subtitle,
        content: form.content,
        image_url: imageUrl || null,
        status: form.status,
      })
      setEditing(null)
      load()
    } catch {
      setError('Could not save content. Please try again.')
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  if (editing) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
            >
              ← Back
            </button>
            <h2 className="font-display text-xl font-extrabold text-brand-deep">
              Edit: {PAGE_LABELS[editing.page_id] ?? editing.page_id}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                previewMode
                  ? 'bg-brand text-white'
                  : 'border border-mist text-ink/70 hover:border-brand/40 hover:text-brand'
              }`}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {previewMode ? (
          <div className="rounded-lg border border-mist bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-brand-deep">{form.title || 'Untitled'}</h3>
            {form.subtitle && <p className="mt-2 text-lg text-ink/70">{form.subtitle}</p>}
            {form.image_url && (
              <img src={form.image_url} alt="" className="mt-4 max-h-64 rounded-lg object-cover" />
            )}
            {form.content && (
              <div className="mt-4 whitespace-pre-wrap text-ink/80">{form.content}</div>
            )}
            <div className="mt-4">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {form.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-mist bg-white p-6">
            <div className="grid gap-5">
              <div>
                <label htmlFor="cms-title" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Title
                </label>
                <input
                  id="cms-title"
                  className={inputCls}
                  value={form.title}
                  onChange={setField('title')}
                  placeholder="Page title"
                />
              </div>

              <div>
                <label htmlFor="cms-subtitle" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Subtitle
                </label>
                <input
                  id="cms-subtitle"
                  className={inputCls}
                  value={form.subtitle}
                  onChange={setField('subtitle')}
                  placeholder="Optional subtitle"
                />
              </div>

              <div>
                <label htmlFor="cms-content" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Content
                </label>
                <textarea
                  id="cms-content"
                  rows="8"
                  className={`${inputCls} resize-y`}
                  value={form.content}
                  onChange={setField('content')}
                  placeholder="Enter page content..."
                />
              </div>

              <div>
                <label htmlFor="cms-image" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Image (optional)
                </label>
                <input
                  id="cms-image"
                  type="file"
                  accept="image/*"
                  className={inputCls}
                  onChange={(e) => setImageFile(e.target.files[0] ?? null)}
                />
                {(form.image_url || imageFile) && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                      alt=""
                      className="size-16 rounded-md border border-mist object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="cms-status" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Status
                </label>
                <select
                  id="cms-status"
                  className={inputCls}
                  value={form.status}
                  onChange={setField('status')}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-mist bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/30 hover:text-brand"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmSave(true)}
                disabled={saving}
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-deep transition-colors hover:bg-gold/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <ConfirmModal
          open={confirmSave}
          onClose={() => setConfirmSave(false)}
          onConfirm={handleSave}
          title="Save Changes"
          message={`Save changes to "${PAGE_LABELS[editing.page_id] ?? editing.page_id}"?`}
          confirmLabel="Save"
          loading={saving}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">CMS Content</h1>
        <p className="mt-1 text-sm text-ink/60">Manage static page content for your website</p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading content…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load CMS content.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {status === 'ready' && pages.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No CMS pages found. Run the database migration to seed default pages.
        </p>
      )}

      {status === 'ready' && pages.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Page</th>
                <th className="hidden px-4 py-3 sm:table-cell">Title</th>
                <th className="hidden px-4 py-3 md:table-cell">Last Updated</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.page_id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
                        <Icon name="detail" className="size-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-brand-deep">{PAGE_LABELS[page.page_id] ?? page.page_id}</p>
                        <p className="text-xs text-ink/50">{page.page_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{page.title || '—'}</td>
                  <td className="hidden px-4 py-3 text-ink/50 md:table-cell">
                    {page.updated_at ? new Date(page.updated_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      page.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {page.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(page)}
                      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
