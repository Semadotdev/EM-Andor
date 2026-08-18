# Phase 3: Search, Filter, and Status Management

## Feature Description

Add server-side search, filtering, and sorting to the admin panel's Properties and Inquiries tabs. Currently, every fetch returns the entire table with zero filtering. This phase adds text search inputs, filter dropdowns, sort controls, and result counts to both tabs, plus a property status breakdown in DashboardStats.

## Acceptance Criteria

### Properties Tab
- [ ] Text search input that searches `name` and `location` columns (ilike, case-insensitive)
- [ ] Type filter dropdown: All, Residential Lot, Commercial Lot, House & Lot, Development Lot
- [ ] Status filter dropdown: All, Available, Reserved, Sold
- [ ] Sort dropdown: Newest, Oldest, Price Low-High, Price High-Low, Name A-Z
- [ ] Result count display: "Showing X of Y properties"
- [ ] Clear filters button that resets all filters to defaults
- [ ] Search is debounced at 300ms
- [ ] All filtering is server-side (Supabase query chain), not client-side

### Inquiries Tab
- [ ] Text search input that searches `name`, `email`, and `message` columns (ilike)
- [ ] Read status filter: All, Read, Unread
- [ ] Sort dropdown: Newest, Oldest, Name A-Z
- [ ] Result count display: "Showing X of Y inquiries"
- [ ] Clear filters button
- [ ] Search is debounced at 300ms
- [ ] All filtering is server-side

### DashboardStats
- [ ] Property status breakdown: Available: X, Reserved: Y, Sold: Z

### Cross-cutting
- [ ] Filters stack vertically on mobile
- [ ] Accessible: proper labels, keyboard navigation
- [ ] Existing functionality (pin, delete, mark read) still works
- [ ] All existing tests pass
- [ ] Build succeeds

## API Changes

### `fetchProperties(filters)`
Accepts optional filter object:
```js
{
  search: 'lot',          // ilike on name, location
  type: 'residential lot', // exact match
  status: 'available',     // exact match
  sort: 'newest'           // one of: newest, oldest, price_asc, price_desc, name_asc
}
```
Returns `{ data: Property[], count: number }` — uses `select('*', { count: 'exact' })`.

### `fetchInquiries(filters)`
Accepts optional filter object:
```js
{
  search: 'juan',          // ilike on name, email, message
  is_read: false,           // exact match (boolean)
  sort: 'newest'           // one of: newest, oldest, name_asc
}
```
Returns `{ data: Inquiry[], count: number }`.

### `fetchPropertyStatusCounts()`
New function. Returns `{ available: number, reserved: number, sold: number }`.

## UI Components

No new components created. Modifications to existing:
- `AdminProperties.jsx` — filter bar above table
- `AdminInquiries.jsx` — filter bar above list
- `DashboardStats.jsx` — add status breakdown row
- `api.js` — filter support in fetch functions

## Testing Requirements

- Unit tests for API filter chain construction
- Component tests for search input debounce behavior
- Component tests for filter dropdown interactions
- Component tests for sort control
- Component tests for result count display
- Component tests for clear filters
- Update existing tests to work with new component structure
