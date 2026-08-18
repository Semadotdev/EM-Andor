# Phase 5: Portfolio Admin

## Feature Description

Add a dedicated portfolio management view to the admin panel that shows properties in a visual grid/card layout (similar to the public-facing AvailableProperties view) but with admin controls. This gives administrators a visual-first way to manage their property portfolio, with quick actions directly on each card.

## Acceptance Criteria

### Portfolio Tab
- [ ] New "Portfolio" tab appears in the admin navigation between "Properties" and "Inquiries"
- [ ] Portfolio tab renders the `AdminPortfolio` component
- [ ] Clicking the Portfolio tab loads the portfolio view; other tabs still work

### Property Cards
- [ ] Properties displayed in a responsive grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- [ ] Each card shows: property image (or placeholder), name, type badge, location, price (formatted), status badge, pinned indicator
- [ ] Type badge overlays the image (top-left) matching the public view style
- [ ] Status badge is color-coded: green=available, yellow=reserved, red=sold
- [ ] Pinned indicator shows a pin icon when property is pinned
- [ ] Cards have hover effect (lift/shadow) matching the public AvailableProperties style

### Quick Actions on Each Card
- [ ] "Edit" button opens PropertyForm in edit mode for that property
- [ ] Pin/Unpin toggle button (optimistic update with rollback on failure)
- [ ] Status dropdown (Available, Reserved, Sold) for quick status change
- [ ] "Delete" button shows ConfirmModal before deleting
- [ ] Quick actions are accessible via keyboard and have ARIA labels

### Search, Filter, Sort
- [ ] Search input filters by name or location (debounced, same pattern as AdminProperties)
- [ ] Type filter dropdown (All Types, Residential Lot, Commercial Lot, House & Lot, Development Lot)
- [ ] Status filter dropdown (All Statuses, Available, Reserved, Sold)
- [ ] Sort dropdown (Newest, Oldest, Price Low→High, Price High→Low, Name A→Z)
- [ ] "Clear filters" button appears when any filter is active

### Add New Property
- [ ] "Add New Property" button at the top opens PropertyForm in create mode
- [ ] After saving, the portfolio grid refreshes to show the new property

### PropertyForm Enhancements
- [ ] Image preview shows current image when editing (already exists, verify it works)
- [ ] "Cancel" button closes the form without saving (already exists)
- [ ] Form works well when opened from the portfolio view

### Empty & Loading States
- [ ] Loading state shows skeleton placeholder cards
- [ ] Empty state shows appropriate message
- [ ] Error state shows retry button
- [ ] "No properties match your filters" shown when filters return empty

### Cross-cutting
- [ ] Responsive: works on mobile, tablet, desktop
- [ ] Accessible: ARIA labels, keyboard navigation, focus management
- [ ] Consistent with existing design tokens (brand colors, fonts, spacing)
- [ ] All existing tests pass
- [ ] Build succeeds

## UI Components

### AdminPortfolio
- Main component for the portfolio management view
- Contains search/filter/sort controls, property grid, and modals
- Manages its own state for properties, filters, form visibility, and confirmations

### Property Card (inline in AdminPortfolio)
- Not a separate component — rendered inline in the grid
- Structure: image container (with type badge overlay + status badge) → info section (name, location, price) → actions bar (edit, pin, status, delete)

### PropertyForm (existing, minor enhancements)
- Already supports create/edit modes
- Already has image preview and cancel button
- No structural changes needed — verify it works from portfolio context

## Testing Requirements
- Test AdminPortfolio renders property cards in a grid
- Test search input filters displayed properties
- Test type filter and status filter
- Test sort controls
- Test "Add New Property" button opens PropertyForm in create mode
- Test card "Edit" button opens PropertyForm in edit mode
- Test pin toggle on a card (optimistic update + rollback)
- Test status change on a card
- Test delete on a card (confirmation flow)
- Test loading state
- Test error state with retry
- Test empty state
- Test responsive grid classes are applied
- Update AdminDashboard tests for the new Portfolio tab
