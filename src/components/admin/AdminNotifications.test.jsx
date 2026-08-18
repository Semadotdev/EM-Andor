import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
    expect(screen.getByText(/Sunset Ridge Estate/)).toBeInTheDocument()
    expect(screen.getAllByText('You have a new inquiry.').length).toBeGreaterThanOrEqual(2)
  })

  it('saves template changes', async () => {
    updateNotificationSettings.mockResolvedValue(sampleSettings[0])
    const user = userEvent.setup()

    render(<AdminNotifications />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit Template' })
    await user.click(editButtons[0])

    const subjectInput = screen.getByLabelText('Subject Line')
    fireEvent.change(subjectInput, { target: { value: 'Custom Subject: {property_name}' } })
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
