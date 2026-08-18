# Phase 7: CMS Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS content management system for static pages in the admin panel.

**Architecture:** Create AdminCMS component with list view and edit form. Add Supabase API functions for CRUD operations on cms_content table. Update AdminDashboard with new CMS tab.

**Tech Stack:** React 19, Tailwind CSS, Supabase, Vitest

---

## File Structure

| File | Action | Description |
|------|--------|-------------|
| `supabase/schema.sql` | Modify | Add cms_content table |
| `src/lib/api.js` | Modify | Add CMS API functions |
| `src/components/admin/AdminCMS.jsx` | Create | CMS management component |
| `src/components/admin/AdminCMS.test.jsx` | Create | Tests for AdminCMS |
| `src/components/admin/AdminDashboard.jsx` | Modify | Add CMS tab |
| `src/components/admin/AdminDashboard.test.jsx` | Modify | Update tests for CMS tab |

---

### Task 1: Database Schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add cms_content table to schema**

Append to end of `supabase/schema.sql`:

```sql
-- CMS Content table
create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  page_id text unique not null,
  title text,
  subtitle text,
  content text,
  image_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_content enable row level security;

do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on cms_content" on public.cms_content;
  execute format(
    'create policy "admin all on cms_content" on public.cms_content
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;

drop policy if exists "public read published cms_content" on public.cms_content;
create policy "public read published cms_content" on public.cms_content
  for select to anon using (status = 'published');

drop trigger if exists set_updated_at on public.cms_content;
create trigger set_updated_at before update on public.cms_content
  for each row execute function public.set_updated_at();

-- Seed default CMS pages
insert into public.cms_content (page_id, title, status) values
  ('home-hero', 'Home Hero Section', 'draft'),
  ('about', 'About Us', 'draft'),
  ('contact', 'Contact Information', 'draft')
on conflict (page_id) do nothing;
```

- [ ] **Step 2: Commit schema changes**

```bash
git add supabase/schema.sql
git commit -m "feat: add cms_content table to database schema"
```

---

### Task 2: API Layer

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add CMS API functions**

Append to end of `src/lib/api.js`:

```javascript
// CMS Content
export async function fetchCMSContentList() {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .order('page_id')
  if (error) throw error
  return data ?? []
}

export async function fetchCMSContent(pageId) {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('page_id', pageId)
    .single()
  if (error) throw error
  return data
}

export async function updateCMSContent(pageId, updates) {
  const { data, error } = await supabase
    .from('cms_content')
    .upsert({ page_id: pageId, ...updates }, { onConflict: 'page_id' })
    .select()
    .single()
  if (error) throw error
  logActivity('cms', pageId, 'update', { fields: Object.keys(updates) }).catch(() => {})
  return data
}
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 3: Commit API changes**

```bash
git add src/lib/api.js
git commit -m "feat: add CMS content API functions"
```

---

### Task 3: AdminCMS Component

**Files:**
- Create: `src/components/admin/AdminCMS.jsx`

- [ ] **Step 1: Create AdminCMS component**

Create `src/components/admin/AdminCMS.jsx`:

```jsx
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
```

- [ ] **Step 2: Commit AdminCMS component**

```bash
git add src/components/admin/AdminCMS.jsx
git commit -m "feat: add AdminCMS component for content management"
```

---

### Task 4: AdminDashboard Integration

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Add CMS tab to AdminDashboard**

In `src/components/admin/AdminDashboard.jsx`, add import and update tabs array:

```jsx
// Add import after line 6
import AdminCMS from './AdminCMS.jsx'

// Update tabs array (line 9-13)
const tabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'cms', label: 'CMS' },
  { id: 'inquiries', label: 'Inquiries' },
]
```

Add CMS tab render after line 90:

```jsx
{tab === 'cms' && <AdminCMS />}
```

- [ ] **Step 2: Commit AdminDashboard changes**

```bash
git add src/components/admin/AdminDashboard.jsx
git commit -m "feat: add CMS tab to admin dashboard"
```

---

### Task 5: AdminCMS Tests

**Files:**
- Create: `src/components/admin/AdminCMS.test.jsx`

- [ ] **Step 1: Create AdminCMS tests**

Create `src/components/admin/AdminCMS.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCMS from './AdminCMS.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchCMSContentList: vi.fn(),
  fetchCMSContent: vi.fn(),
  updateCMSContent: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { fetchCMSContentList, fetchCMSContent, updateCMSContent, uploadPropertyImage } from '../../lib/api.js'

const samplePages = [
  { page_id: 'home-hero', title: 'Home Hero Section', subtitle: 'Welcome', content: 'Hello', image_url: null, status: 'draft', created_at: '2026-08-18T01:00:00Z', updated_at: '2026-08-18T01:00:00Z' },
  { page_id: 'about', title: 'About Us', subtitle: '', content: 'About content', image_url: null, status: 'published', created_at: '2026-08-18T02:00:00Z', updated_at: '2026-08-18T02:00:00Z' },
]

describe('AdminCMS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCMSContentList.mockResolvedValue(samplePages)
  })

  it('renders the CMS section list', async () => {
    render(<AdminCMS />)

    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
    expect(screen.getByText('Home Hero Section')).toBeInTheDocument()
    expect(screen.getByText('About Us')).toBeInTheDocument()
  })

  it('displays status badges for each page', async () => {
    render(<AdminCMS />)

    await screen.findByText('Home Hero Section')
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(1)
  })

  it('opens edit form when clicking Edit', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    expect(await screen.findByText('Edit: Home Hero Section')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Content')).toBeInTheDocument()
  })

  it('saves content after confirmation', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    updateCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('Save Changes'))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('alertdialog').querySelector('button:last-child'))

    expect(updateCMSContent).toHaveBeenCalledWith('home-hero', expect.objectContaining({
      title: 'Home Hero Section',
      status: 'draft',
    }))
  })

  it('toggles status between draft and published', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    const statusSelect = screen.getByLabelText('Status')
    await user.selectOptions(statusSelect, 'published')

    expect(statusSelect).toHaveValue('published')
  })

  it('shows loading state', () => {
    fetchCMSContentList.mockReturnValue(new Promise(() => {}))

    render(<AdminCMS />)

    expect(screen.getByText('Loading content…')).toBeInTheDocument()
  })

  it('shows error state with retry', async () => {
    fetchCMSContentList.mockRejectedValueOnce(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminCMS />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
  })

  it('shows empty state when no pages exist', async () => {
    fetchCMSContentList.mockResolvedValue([])

    render(<AdminCMS />)

    expect(await screen.findByText(/No CMS pages found/)).toBeInTheDocument()
  })

  it('toggles preview mode', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('Preview'))

    expect(screen.getByText('Home Hero Section')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()

    await user.click(screen.getByText('Edit'))
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('navigates back to list', async () => {
    fetchCMSContent.mockResolvedValue(samplePages[0])
    const user = userEvent.setup()

    render(<AdminCMS />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await screen.findByText('Edit: Home Hero Section')
    await user.click(screen.getByText('← Back'))

    expect(await screen.findByText('CMS Content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit tests**

```bash
git add src/components/admin/AdminCMS.test.jsx
git commit -m "test: add AdminCMS component tests"
```

---

### Task 6: Update AdminDashboard Tests

**Files:**
- Modify: `src/components/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Update AdminDashboard test mocks**

In `src/components/admin/AdminDashboard.test.jsx`, add mock after line 8:

```jsx
vi.mock('./AdminCMS.jsx', () => ({ default: () => <span>CMSPanel</span> }))
```

- [ ] **Step 2: Add CMS tab test**

Add new test case at end of describe block:

```jsx
it('switches to the CMS tab', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  const user = userEvent.setup()

  renderDashboard()

  await waitFor(() => {
    expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: 'CMS' }))
  await waitFor(() => {
    expect(screen.getByText('CMSPanel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass including new CMS tab test

- [ ] **Step 4: Commit changes**

```bash
git add src/components/admin/AdminDashboard.test.jsx
git commit -m "test: add CMS tab test to AdminDashboard"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final verification fixes"
```
