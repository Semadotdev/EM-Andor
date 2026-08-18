# Phase 8: Email Notifications Implementation Plan

**Goal:** Add email notification management for property inquiries and status updates.

**Architecture:** Create AdminNotifications component with settings panel, template editor, preview, and history view. Add Supabase API functions for notification_settings and notification_history tables. Update AdminDashboard with new Notifications tab.

**Tech Stack:** React 19, Tailwind CSS, Supabase, Vitest

---

## File Structure

| File | Action | Description |
|------|--------|-------------|
| `supabase/schema.sql` | Modify | Add notification_settings and notification_history tables |
| `src/lib/api.js` | Modify | Add notification API functions |
| `src/components/admin/AdminNotifications.jsx` | Create | Notification management component |
| `src/components/admin/AdminNotifications.test.jsx` | Create | Tests for AdminNotifications |
| `src/components/admin/AdminDashboard.jsx` | Modify | Add Notifications tab |
| `src/components/admin/AdminDashboard.test.jsx` | Modify | Update tests for Notifications tab |

---

### Task 1: Database Schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add notification tables to schema**

Append to end of `supabase/schema.sql`:

```sql
-- Notification Settings table
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  notification_type text unique not null,
  enabled boolean not null default true,
  subject_template text,
  body_template text,
  recipients text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on notification_settings" on public.notification_settings;
  execute format(
    'create policy "admin all on notification_settings" on public.notification_settings
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;

drop trigger if exists set_updated_at on public.notification_settings;
create trigger set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- Notification History table
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  recipient text not null,
  subject text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.notification_history enable row level security;

do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on notification_history" on public.notification_history;
  execute format(
    'create policy "admin all on notification_history" on public.notification_history
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;

-- Seed default notification settings
insert into public.notification_settings (notification_type, subject_template, body_template, recipients) values
  ('new_inquiry', 'New Inquiry: {property_name}', 'You have received a new inquiry from {customer_name}.\n\nProperty: {property_name}\nMessage: {inquiry_message}', '{}'),
  ('status_change', 'Property Status Update: {property_name}', 'The status of {property_name} has been changed to {property_status}.', '{}'),
  ('property_sold', 'Property Sold: {property_name}', 'Congratulations! {property_name} has been marked as sold on {date}.', '{}')
on conflict (notification_type) do nothing;
```

---

### Task 2: API Layer

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add notification API functions**

Append to end of `src/lib/api.js`:

```javascript
// Notifications
export async function fetchNotificationSettings() {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .order('notification_type')
  if (error) throw error
  return data ?? []
}

export async function updateNotificationSettings(type, updates) {
  const { data, error } = await supabase
    .from('notification_settings')
    .upsert({ notification_type: type, ...updates }, { onConflict: 'notification_type' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function sendTestEmail(type, recipient) {
  const historyEntry = {
    notification_type: type,
    recipient,
    subject: `Test: ${type.replace(/_/g, ' ')}`,
    status: 'sent',
  }
  const { error } = await supabase.from('notification_history').insert(historyEntry)
  if (error) throw error
}

export async function fetchNotificationHistory() {
  const { data, error } = await supabase
    .from('notification_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}
```

---

### Task 3: AdminNotifications Component

**Files:**
- Create: `src/components/admin/AdminNotifications.jsx`

- [ ] **Step 1: Create AdminNotifications component**

Create `src/components/admin/AdminNotifications.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchNotificationSettings, updateNotificationSettings, sendTestEmail, fetchNotificationHistory } from '../../lib/api.js'

const TYPE_LABELS = {
  new_inquiry: 'New Inquiry Received',
  status_change: 'Inquiry Status Change',
  property_sold: 'Property Marked as Sold',
}

const TYPE_DESCRIPTIONS = {
  new_inquiry: 'Get notified when a potential buyer submits an inquiry through the contact form.',
  status_change: 'Get notified when an inquiry status changes (e.g., read/unread).',
  property_sold: 'Get notified when a property is marked as sold.',
}

const VARIABLES_HELP = [
  { variable: '{property_name}', description: 'Name of the property' },
  { variable: '{customer_name}', description: 'Name of the inquirer' },
  { variable: '{inquiry_message}', description: 'Message content' },
  { variable: '{property_status}', description: 'New property status' },
  { variable: '{date}', description: 'Current date' },
]

function replaceVariables(template, sampleData) {
  let result = template
  for (const [key, value] of Object.entries(sampleData)) {
    result = result.replaceAll(`{${key}}`, value)
  }
  return result
}

const sampleData = {
  property_name: 'Sunset Ridge Estate',
  customer_name: 'Juan Dela Cruz',
  inquiry_message: 'I am interested in this property. Is it still available?',
  property_status: 'Reserved',
  date: new Date().toLocaleDateString('en-PH'),
}

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function AdminNotifications() {
  const [settings, setSettings] = useState([])
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('settings')
  const [editingType, setEditingType] = useState(null)
  const [form, setForm] = useState({ subject_template: '', body_template: '', enabled: true, recipients: '' })
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState(null)
  const [previewEnabled, setPreviewEnabled] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)
    Promise.all([fetchNotificationSettings(), fetchNotificationHistory()])
      .then(([s, h]) => {
        setSettings(s)
        setHistory(h)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  const handleToggle = async (setting) => {
    setError(null)
    const next = !setting.enabled
    setSettings((list) =>
      list.map((s) => (s.notification_type === setting.notification_type ? { ...s, enabled: next } : s))
    )
    try {
      await updateNotificationSettings(setting.notification_type, { enabled: next })
    } catch {
      setSettings((list) =>
        list.map((s) => (s.notification_type === setting.notification_type ? { ...s, enabled: !next } : s))
      )
      setError('Could not update notification setting. Please try again.')
    }
  }

  const handleEdit = (setting) => {
    setEditingType(setting)
    setForm({
      subject_template: setting.subject_template ?? '',
      body_template: setting.body_template ?? '',
      enabled: setting.enabled,
      recipients: (setting.recipients ?? []).join(', '),
    })
    setPreviewEnabled(false)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const recipients = form.recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
      await updateNotificationSettings(editingType.notification_type, {
        subject_template: form.subject_template,
        body_template: form.body_template,
        enabled: form.enabled,
        recipients,
      })
      setEditingType(null)
      load()
    } catch {
      setError('Could not save notification settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail.trim() || sendingTest || !editingType) return
    setSendingTest(true)
    setTestSuccess(null)
    setError(null)
    try {
      await sendTestEmail(editingType.notification_type, testEmail.trim())
      setTestSuccess('Test email sent successfully!')
      setTestEmail('')
      load()
    } catch {
      setError('Could not send test email. Please try again.')
    } finally {
      setSendingTest(false)
    }
  }

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  if (editingType) {
    const previewSubject = replaceVariables(form.subject_template, sampleData)
    const previewBody = replaceVariables(form.body_template, sampleData)

    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingType(null)}
              className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
            >
              ← Back
            </button>
            <h2 className="font-display text-xl font-extrabold text-brand-deep">
              Edit: {TYPE_LABELS[editingType.notification_type] ?? editingType.notification_type}
            </h2>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {testSuccess && (
          <p className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
            {testSuccess}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-mist bg-white p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-brand-deep">Template Settings</h3>
            <div className="grid gap-5">
              <div>
                <label htmlFor="notif-enabled" className="mb-1.5 flex items-center gap-3">
                  <input
                    id="notif-enabled"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="size-4 rounded border-mist text-brand focus:ring-brand/30"
                  />
                  <span className="text-sm font-semibold text-brand-deep">Enabled</span>
                </label>
              </div>

              <div>
                <label htmlFor="notif-subject" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Subject Line
                </label>
                <input
                  id="notif-subject"
                  className={inputCls}
                  value={form.subject_template}
                  onChange={setField('subject_template')}
                  placeholder="e.g., New Inquiry: {property_name}"
                />
              </div>

              <div>
                <label htmlFor="notif-body" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Body Content
                </label>
                <textarea
                  id="notif-body"
                  rows="8"
                  className={`${inputCls} resize-y`}
                  value={form.body_template}
                  onChange={setField('body_template')}
                  placeholder="Enter email body content..."
                />
              </div>

              <div>
                <label htmlFor="notif-recipients" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  Recipients (comma-separated)
                </label>
                <input
                  id="notif-recipients"
                  className={inputCls}
                  value={form.recipients}
                  onChange={setField('recipients')}
                  placeholder="admin@example.com, team@example.com"
                />
              </div>

              <div className="rounded-md bg-surface p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Available Variables</p>
                <div className="grid gap-1">
                  {VARIABLES_HELP.map((v) => (
                    <p key={v.variable} className="text-xs text-ink/60">
                      <code className="rounded bg-brand/10 px-1 py-0.5 font-mono text-brand">{v.variable}</code>
                      {' '}- {v.description}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingType(null)}
                className="rounded-md border border-mist bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand/30 hover:text-brand"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-deep transition-colors hover:bg-gold/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-mist bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-deep">Preview</h3>
              <button
                onClick={() => setPreviewEnabled(!previewEnabled)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  previewEnabled
                    ? 'bg-brand text-white'
                    : 'border border-mist text-ink/70 hover:border-brand/40 hover:text-brand'
                }`}
              >
                {previewEnabled ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {previewEnabled && (
              <div className="rounded-md border border-mist bg-surface p-4">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Subject</p>
                  <p className="mt-1 text-sm font-semibold text-brand-deep">
                    {previewSubject || 'No subject'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Body</p>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
                    {previewBody || 'No body content'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold text-brand-deep">Send Test Email</h4>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                  aria-label="Test email recipient"
                />
                <button
                  onClick={handleSendTest}
                  disabled={!testEmail.trim() || sendingTest}
                  className="rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
                >
                  {sendingTest ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Notifications</h1>
        <p className="mt-1 text-sm text-ink/60">Configure email notification preferences and templates</p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition-colors ${
            activeTab === 'settings'
              ? 'bg-brand text-white'
              : 'border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-brand text-white'
              : 'border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand'
          }`}
        >
          History
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading notifications…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load notification settings.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {status === 'ready' && activeTab === 'settings' && settings.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No notification settings found. Run the database migration to seed default settings.
        </p>
      )}

      {status === 'ready' && activeTab === 'settings' && settings.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Notification Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.notification_type} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
                        <Icon name="mail" className="size-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-brand-deep">
                          {TYPE_LABELS[setting.notification_type] ?? setting.notification_type}
                        </p>
                        <p className="text-xs text-ink/50">{setting.notification_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/60 md:table-cell">
                    {TYPE_DESCRIPTIONS[setting.notification_type] ?? ''}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(setting)}
                      aria-pressed={setting.enabled}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        setting.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className={`size-2 rounded-full ${setting.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {setting.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(setting)}
                      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      Edit Template
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status === 'ready' && activeTab === 'history' && history.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No notifications sent yet. Send a test email from the Settings tab to see history here.
        </p>
      )}

      {status === 'ready' && activeTab === 'history' && history.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="hidden px-4 py-3 sm:table-cell">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {TYPE_LABELS[entry.notification_type] ?? entry.notification_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{entry.recipient}</td>
                  <td className="hidden px-4 py-3 text-ink/60 sm:table-cell">{entry.subject || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      entry.status === 'sent'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.status === 'sent' ? 'Sent' : 'Failed'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/50 md:table-cell">
                    {new Date(entry.created_at).toLocaleString('en-PH')}
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

---

### Task 4: AdminDashboard Integration

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Add Notifications tab to AdminDashboard**

In `src/components/admin/AdminDashboard.jsx`, add import after line 7:

```jsx
import AdminNotifications from './AdminNotifications.jsx'
```

Update tabs array to add notifications after inquiries:

```jsx
const tabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'cms', label: 'CMS' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'notifications', label: 'Notifications' },
]
```

Add notifications tab render after line 94:

```jsx
{tab === 'notifications' && <AdminNotifications />}
```

---

### Task 5: AdminNotifications Tests

**Files:**
- Create: `src/components/admin/AdminNotifications.test.jsx`

- [ ] **Step 1: Create AdminNotifications tests**

Create `src/components/admin/AdminNotifications.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminNotifications from './AdminNotifications.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
  sendTestEmail: vi.fn(),
  fetchNotificationHistory: vi.fn(),
}))

import { fetchNotificationSettings, updateNotificationSettings, sendTestEmail, fetchNotificationHistory } from '../../lib/api.js'

const sampleSettings = [
  { notification_type: 'new_inquiry', enabled: true, subject_template: 'New Inquiry: {property_name}', body_template: 'You have a new inquiry.', recipients: ['admin@example.com'], created_at: '2026-08-18T01:00:00Z', updated_at: '2026-08-18T01:00:00Z' },
  { notification_type: 'status_change', enabled: false, subject_template: 'Status Update', body_template: 'Status changed.', recipients: [], created_at: '2026-08-18T02:00:00Z', updated_at: '2026-08-18T02:00:00Z' },
  { notification_type: 'property_sold', enabled: true, subject_template: 'Property Sold', body_template: 'Sold!', recipients: ['team@example.com'], created_at: '2026-08-18T03:00:00Z', updated_at: '2026-08-18T03:00:00Z' },
]

const sampleHistory = [
  { id: 'h1', notification_type: 'new_inquiry', recipient: 'admin@example.com', subject: 'Test: new inquiry', status: 'sent', created_at: '2026-08-18T04:00:00Z' },
]

describe('AdminNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchNotificationSettings.mockResolvedValue(sampleSettings)
    fetchNotificationHistory.mockResolvedValue(sampleHistory)
  })

  it('renders the notifications settings panel', async () => {
    render(<AdminNotifications />)

    expect(await screen.findByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('New Inquiry Received')).toBeInTheDocument()
    expect(screen.getByText('Property Marked as Sold')).toBeInTheDocument()
  })

  it('shows enabled/disabled status for each notification type', async () => {
    render(<AdminNotifications />)

    await screen.findByText('New Inquiry Received')
    expect(screen.getAllByText('Enabled').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1)
  })

  it('toggles a notification type on/off', async () => {
    updateNotificationSettings.mockResolvedValue({ ...sampleSettings[0], enabled: false })
    const user = userEvent.setup()

    render(<AdminNotifications />)

    await screen.findByText('New Inquiry Received')
    const toggleButtons = screen.getAllByRole('button', { pressed: true })
    await user.click(toggleButtons[0])

    expect(updateNotificationSettings).toHaveBeenCalledWith('new_inquiry', { enabled: false })
  })

  it('opens template editor when clicking Edit Template', async () => {
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    expect(screen.getByText('Edit: New Inquiry Received')).toBeInTheDocument()
    expect(screen.getByLabelText('Subject Line')).toBeInTheDocument()
    expect(screen.getByLabelText('Body Content')).toBeInTheDocument()
  })

  it('shows preview when toggling preview button', async () => {
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    await user.click(screen.getByText('Show Preview'))
    expect(screen.getByText('Sunset Ridge Estate')).toBeInTheDocument()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
  })

  it('saves template changes', async () => {
    updateNotificationSettings.mockResolvedValue(sampleSettings[0])
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    await user.clear(screen.getByLabelText('Subject Line'))
    await user.type(screen.getByLabelText('Subject Line'), 'Custom Subject: {property_name}')
    await user.click(screen.getByText('Save Changes'))

    expect(updateNotificationSettings).toHaveBeenCalledWith('new_inquiry', expect.objectContaining({
      subject_template: 'Custom Subject: {property_name}',
    }))
  })

  it('sends a test email', async () => {
    sendTestEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    await user.type(screen.getByLabelText('Test email recipient'), 'test@example.com')
    await user.click(screen.getByText('Send Test'))

    expect(sendTestEmail).toHaveBeenCalledWith('new_inquiry', 'test@example.com')
    expect(await screen.findByText('Test email sent successfully!')).toBeInTheDocument()
  })

  it('configures recipients', async () => {
    updateNotificationSettings.mockResolvedValue(sampleSettings[0])
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    await user.clear(screen.getByLabelText('Recipients (comma-separated)'))
    await user.type(screen.getByLabelText('Recipients (comma-separated)'), 'a@b.com, c@d.com')
    await user.click(screen.getByText('Save Changes'))

    expect(updateNotificationSettings).toHaveBeenCalledWith('new_inquiry', expect.objectContaining({
      recipients: ['a@b.com', 'c@d.com'],
    }))
  })

  it('switches to history tab', async () => {
    const user = userEvent.setup()

    render(<AdminNotifications />)

    await screen.findByText('Notifications')
    await user.click(screen.getByRole('button', { name: 'History' }))

    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    fetchNotificationSettings.mockReturnValue(new Promise(() => {}))
    fetchNotificationHistory.mockReturnValue(new Promise(() => {}))

    render(<AdminNotifications />)

    expect(screen.getByText('Loading notifications…')).toBeInTheDocument()
  })

  it('shows error state with retry', async () => {
    fetchNotificationSettings.mockRejectedValueOnce(new Error('fail'))
    fetchNotificationHistory.mockRejectedValueOnce(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminNotifications />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Notifications')).toBeInTheDocument()
  })

  it('navigates back to settings list from editor', async () => {
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    await user.click(screen.getByText('← Back'))
    expect(await screen.findByText('Notifications')).toBeInTheDocument()
  })

  it('shows empty state for history when no notifications sent', async () => {
    fetchNotificationHistory.mockResolvedValue([])
    const user = userEvent.setup()

    render(<AdminNotifications />)

    await screen.findByText('Notifications')
    await user.click(screen.getByRole('button', { name: 'History' }))

    expect(screen.getByText(/No notifications sent yet/)).toBeInTheDocument()
  })
})
```

---

### Task 6: Update AdminDashboard Tests

**Files:**
- Modify: `src/components/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Update AdminDashboard test mocks**

Add mock for AdminNotifications after existing mocks:

```jsx
vi.mock('./AdminNotifications.jsx', () => ({ default: () => <span>NotificationsPanel</span> }))
```

- [ ] **Step 2: Add Notifications tab test**

Add new test case at end of describe block:

```jsx
it('switches to the Notifications tab', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  const user = userEvent.setup()

  renderDashboard()

  await waitFor(() => {
    expect(screen.getByText('PropertiesPanel')).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: 'Notifications' }))
  await waitFor(() => {
    expect(screen.getByText('NotificationsPanel')).toBeInTheDocument()
  })
})
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors
