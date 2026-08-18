# Phase 8: Email Notifications

## Feature Description

Email notification management for property inquiries and status updates. Admins can configure notification preferences, customize email templates for different event types, preview emails with variable substitution, send test emails, and view notification history.

## Acceptance Criteria

1. Notifications tab appears in admin dashboard after Inquiries
2. Admin can enable/disable individual notification types (new inquiry, status change, property sold)
3. Each notification type has configurable email template with subject and body
4. Templates support variable placeholders: `{property_name}`, `{customer_name}`, `{inquiry_message}`, `{property_status}`, `{date}`
5. Preview functionality shows how emails will look with sample data
6. Send test email button to verify configuration
7. Recipients configuration (array of email addresses)
8. Notification history/log shows recently sent notifications
9. Loading and error states are handled gracefully
10. Settings persist to Supabase database

## UI Components

- `AdminNotifications` - Main notification management component with tabs for settings, templates, and history

## Database Schema

New `notification_settings` table:
- `id` (uuid, primary key)
- `notification_type` (text, unique) - 'new_inquiry', 'status_change', 'property_sold'
- `enabled` (boolean, default true)
- `subject_template` (text)
- `body_template` (text)
- `recipients` (text[]) - array of email addresses
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

New `notification_history` table:
- `id` (uuid, primary key)
- `notification_type` (text)
- `recipient` (text)
- `subject` (text)
- `status` (text) - 'sent', 'failed'
- `created_at` (timestamptz)

## Testing Requirements

- Unit tests for AdminNotifications component
- Unit tests for AdminDashboard with new Notifications tab
- All existing tests must continue passing
