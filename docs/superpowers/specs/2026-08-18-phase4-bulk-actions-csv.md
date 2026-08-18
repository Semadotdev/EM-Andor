# Phase 4: Bulk Actions & CSV Export

## Feature Description

Add bulk selection, bulk actions, and CSV export to the AdminProperties and AdminInquiries components. Users can select multiple items via checkboxes, perform batch operations (delete, status change, pin/unpin, mark read/unread), and export filtered data to CSV files.

## Acceptance Criteria

### Properties Tab
- [ ] Checkbox column appears in the properties table header and each row
- [ ] Header checkbox selects/deselects all visible properties
- [ ] Individual row checkboxes toggle selection
- [ ] Bulk action toolbar appears when items are selected, showing "X items selected" and action buttons
- [ ] Bulk delete shows confirmation modal with count, then deletes all selected
- [ ] Bulk status change via dropdown (Available, Reserved, Sold) updates all selected
- [ ] Bulk pin/unpin toggle pins or unpins all selected
- [ ] CSV Export button always visible in toolbar area (exports all filtered results when no selection, or selected items only)
- [ ] CSV filename follows `{type}-export-{YYYY-MM-DD}.csv` pattern

### Inquiries Tab
- [ ] Checkboxes appear on each inquiry card
- [ ] Header-level select-all checkbox selects/deselects all visible inquiries
- [ ] Bulk action toolbar appears when items are selected
- [ ] Bulk delete shows confirmation modal with count
- [ ] Bulk mark as read/unread toggles all selected
- [ ] CSV Export button available in toolbar

### API Layer
- [ ] `bulkDeleteProperties(ids)` - deletes multiple properties by IDs
- [ ] `bulkUpdatePropertyStatus(ids, status)` - updates status for multiple properties
- [ ] `bulkSetPropertyPinned(ids, pinned)` - updates is_pinned for multiple properties
- [ ] `bulkDeleteInquiries(ids)` - deletes multiple inquiries by IDs
- [ ] `bulkSetInquiryRead(ids, is_read)` - updates is_read for multiple inquiries

### CSV Export
- [ ] Property CSV columns: Name, Type, Location, Price, Status, Pinned, Lot Area, Created Date
- [ ] Inquiry CSV columns: Name, Email, Phone, Project Type, Property, Message, Read Status, Created Date
- [ ] Browser-side generation (no server endpoint)
- [ ] Proper CSV escaping for values containing commas or quotes

### Cross-cutting
- [ ] Accessible: ARIA labels on checkboxes, keyboard navigation
- [ ] Selection clears when filters change
- [ ] Existing functionality (individual pin, delete, mark read) still works
- [ ] All existing tests pass
- [ ] Build succeeds

## API Changes

### `bulkDeleteProperties(ids)`
- Uses `supabase.from('properties').delete().in('id', ids)`
- Logs activity for each deleted property
- No return value needed

### `bulkUpdatePropertyStatus(ids, status)`
- Uses `supabase.from('properties').update({ status }).in('id', ids)`
- No return value needed

### `bulkSetPropertyPinned(ids, pinned)`
- Uses `supabase.from('properties').update({ is_pinned: pinned }).in('id', ids)`
- No return value needed

### `bulkDeleteInquiries(ids)`
- Uses `supabase.from('inquiries').delete().in('id', ids)`
- No return value needed

### `bulkSetInquiryRead(ids, is_read)`
- Uses `supabase.from('inquiries').update({ is_read }).in('id', ids)`
- No return value needed

## UI Components

### BulkActionToolbar
- Fixed bar appearing above the table/list when items are selected
- Shows "X items selected" count
- Action buttons: Delete, Status Change (properties), Pin/Unpin (properties), Mark Read/Unread (inquiries), Export CSV
- Deselect All button

### CSV Export
- Utility function `exportToCSV(headers, rows, filename)` in `src/lib/csv.js`
- Handles escaping: wrap values in quotes if they contain commas, newlines, or quotes
- Creates a Blob and triggers download via hidden anchor element

## Testing Requirements
- Unit tests for all bulk API functions
- Unit tests for CSV generation utility
- Component tests for checkbox selection behavior
- Component tests for bulk action toolbar visibility
- Component tests for bulk delete confirmation flow
- Component tests for bulk status change
- Component tests for bulk pin/unpin
- Component tests for bulk mark read/unread
- Component tests for CSV export trigger
- Update existing tests for new checkbox column (role queries may change)
