import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchCMSContentList, fetchCMSContent, updateCMSContent, uploadPropertyImage } from '../../lib/api.js'
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  inputClass,
  useToast,
} from '../shared/ui'

const PAGE_LABELS = {
  'home-hero': 'Home Hero Section',
  'about': 'About Us',
  'contact': 'Contact Information',
  'footer': 'Footer Content',
}

export default function AdminCMS() {
  const { showToast } = useToast()
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
      showToast('Content saved.')
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

  const columns = [
    {
      key: 'page',
      header: 'Page',
      render: (page) => (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
            <Icon name="detail" className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-brand-deep">{PAGE_LABELS[page.page_id] ?? page.page_id}</p>
            <p className="text-xs text-ink/50">{page.page_id}</p>
          </div>
        </div>
      ),
    },
    { key: 'title', header: 'Title', hideBelow: 'sm', className: 'text-ink/70', render: (page) => page.title || '—' },
    {
      key: 'updated',
      header: 'Last Updated',
      hideBelow: 'md',
      className: 'text-ink/50',
      render: (page) => (page.updated_at ? new Date(page.updated_at).toLocaleDateString('en-PH') : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (page) => (
        <Badge tone={page.status === 'published' ? 'green' : 'yellow'}>
          {page.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (page) => (
        <Button size="sm" variant="secondary" onClick={() => handleEdit(page)}>
          Edit
        </Button>
      ),
    },
  ]

  if (editing) {
    return (
      <div>
        <PageHeader
          title={`Edit: ${PAGE_LABELS[editing.page_id] ?? editing.page_id}`}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                ← Back
              </Button>
              <Button
                size="sm"
                variant={previewMode ? 'primary' : 'secondary'}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
            </>
          }
        />

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
              <Badge tone={form.status === 'published' ? 'green' : 'yellow'}>
                {form.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-mist bg-white p-6">
            <div className="grid gap-5">
              <Input id="cms-title" label="Title" value={form.title} onChange={setField('title')} placeholder="Page title" />

              <Input id="cms-subtitle" label="Subtitle" value={form.subtitle} onChange={setField('subtitle')} placeholder="Optional subtitle" />

              <Textarea
                id="cms-content"
                rows="8"
                className="resize-y"
                label="Content"
                value={form.content}
                onChange={setField('content')}
                placeholder="Enter page content..."
              />

              <div>
                <label htmlFor="cms-image" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Image (optional)
                </label>
                <input
                  id="cms-image"
                  type="file"
                  accept="image/*"
                  className={inputClass}
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

              <Select id="cms-status" label="Status" value={form.status} onChange={setField('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={() => setConfirmSave(true)} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
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
      <PageHeader title="CMS Content" description="Manage static page content for your website" />

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <LoadingState label="Loading content…" />}

      {status === 'error' && <ErrorState message="Could not load CMS content." onRetry={load} />}

      {status === 'ready' && (
        <DataTable
          columns={columns}
          rows={pages}
          getRowKey={(page) => page.page_id}
          emptyMessage="No CMS pages found. Run the database migration to seed default pages."
        />
      )}
    </div>
  )
}
