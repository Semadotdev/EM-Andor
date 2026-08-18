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
