import { useCallback, useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchNotificationSettings, updateNotificationSettings, sendTestEmail, fetchNotificationHistory } from '../../lib/api.js'
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  useToast,
} from '../shared/ui'

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

export default function AdminNotifications() {
  const { showToast } = useToast()
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
      showToast('Notification setting updated.')
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
      showToast('Notification settings saved.')
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

  const settingsColumns = [
    {
      key: 'type',
      header: 'Notification Type',
      render: (setting) => (
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
      ),
    },
    {
      key: 'description',
      header: 'Description',
      hideBelow: 'md',
      className: 'text-ink/60',
      render: (setting) => TYPE_DESCRIPTIONS[setting.notification_type] ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: (setting) => (
        <button
          onClick={() => handleToggle(setting)}
          aria-pressed={setting.enabled}
          className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Badge tone={setting.enabled ? 'green' : 'gray'}>
            {setting.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      noWrap: true,
      render: (setting) => (
        <Button size="sm" variant="secondary" onClick={() => handleEdit(setting)}>
          Edit Template
        </Button>
      ),
    },
  ]

  const historyColumns = [
    {
      key: 'type',
      header: 'Type',
      render: (entry) => (
        <Badge tone="brand">{TYPE_LABELS[entry.notification_type] ?? entry.notification_type}</Badge>
      ),
    },
    { key: 'recipient', header: 'Recipient', className: 'text-ink/70', render: (entry) => entry.recipient },
    { key: 'subject', header: 'Subject', hideBelow: 'sm', className: 'text-ink/60', render: (entry) => entry.subject || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => <Badge tone={entry.status === 'sent' ? 'green' : 'red'}>{entry.status === 'sent' ? 'Sent' : 'Failed'}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      hideBelow: 'md',
      className: 'text-ink/50',
      render: (entry) => new Date(entry.created_at).toLocaleString('en-PH'),
    },
  ]

  if (editingType) {
    const previewSubject = replaceVariables(form.subject_template, sampleData)
    const previewBody = replaceVariables(form.body_template, sampleData)

    return (
      <div>
        <PageHeader
          title={`Edit: ${TYPE_LABELS[editingType.notification_type] ?? editingType.notification_type}`}
          actions={
            <Button variant="secondary" size="sm" onClick={() => setEditingType(null)}>
              ← Back
            </Button>
          }
        />

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
              <Checkbox
                id="notif-enabled"
                label="Enabled"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />

              <Input
                id="notif-subject"
                label="Subject Line"
                value={form.subject_template}
                onChange={setField('subject_template')}
                placeholder="e.g., New Inquiry: {property_name}"
              />

              <Textarea
                id="notif-body"
                rows="8"
                className="resize-y"
                label="Body Content"
                value={form.body_template}
                onChange={setField('body_template')}
                placeholder="Enter email body content..."
              />

              <Input
                id="notif-recipients"
                label="Recipients (comma-separated)"
                value={form.recipients}
                onChange={setField('recipients')}
                placeholder="admin@example.com, team@example.com"
              />

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
              <Button variant="secondary" onClick={() => setEditingType(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-mist bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-deep">Preview</h3>
              <Button
                size="sm"
                variant={previewEnabled ? 'primary' : 'secondary'}
                onClick={() => setPreviewEnabled(!previewEnabled)}
              >
                {previewEnabled ? 'Hide Preview' : 'Show Preview'}
              </Button>
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
                <div className="min-w-0 flex-1">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    aria-label="Test email recipient"
                  />
                </div>
                <Button onClick={handleSendTest} disabled={!testEmail.trim() || sendingTest}>
                  {sendingTest ? 'Sending…' : 'Send Test'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Configure email notification preferences and templates" />

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

      {status === 'loading' && <LoadingState label="Loading notifications…" />}

      {status === 'error' && <ErrorState message="Could not load notification settings." onRetry={load} />}

      {status === 'ready' && activeTab === 'settings' && (
        <DataTable
          columns={settingsColumns}
          rows={settings}
          getRowKey={(setting) => setting.notification_type}
          emptyMessage="No notification settings found. Run the database migration to seed default settings."
        />
      )}

      {status === 'ready' && activeTab === 'history' && (
        <DataTable
          columns={historyColumns}
          rows={history}
          getRowKey={(entry) => entry.id}
          emptyMessage="No notifications sent yet. Send a test email from the Settings tab to see history here."
        />
      )}
    </div>
  )
}
