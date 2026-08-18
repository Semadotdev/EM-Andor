# Phase 7: CMS Content Management

## Feature Description

A content management system (CMS) for static pages like About, Contact, Home hero section, etc. This allows non-technical administrators to edit website content without developer intervention.

## Acceptance Criteria

1. Admin can view a list of editable CMS sections (Home Hero, About, Contact, etc.)
2. Each section shows: title, last updated, status (draft/published)
3. Clicking a section opens an edit form with:
   - Title field
   - Subtitle/description field
   - Rich text content area (textarea)
   - Image upload (optional)
   - Save/Cancel buttons
   - Status toggle (draft/published)
4. Preview changes before saving
5. CMS tab appears in admin dashboard after Gallery
6. All content changes persist to Supabase database
7. Loading and error states are handled gracefully
8. Empty state shown when no CMS pages exist

## UI Components

- `AdminCMS` - Main CMS management component
- `CMSForm` - Edit form for individual CMS sections

## Database Schema

New `cms_content` table:
- `id` (uuid, primary key)
- `page_id` (text, unique) - e.g., 'home-hero', 'about', 'contact'
- `title` (text)
- `subtitle` (text)
- `content` (text) - markdown/plain text
- `image_url` (text)
- `status` (text) - 'draft' or 'published'
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Testing Requirements

- Unit tests for AdminCMS component
- Unit tests for AdminDashboard with new CMS tab
- All existing tests must continue passing
