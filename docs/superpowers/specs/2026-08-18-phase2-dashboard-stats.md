# Phase 2: Dashboard Stats

## Goal

Add a stats overview at the top of the admin dashboard showing key metrics at a glance.

## Changes

### 1. Stats cards

Four stat cards at the top of AdminDashboard:
- **Total Properties** — count from `properties` table
- **Pinned** — count where `is_pinned = true`
- **Total Inquiries** — count from `inquiries` table
- **Unread Inquiries** — count where `is_read = false`

### 2. Property type breakdown

A compact row below the stat cards showing count per type:
- Residential Lot: N
- Commercial Lot: N
- House & Lot: N
- Development Lot: N

### 3. Recent inquiries

Last 5 inquiries shown as a mini-list below the type breakdown:
- Name, project type, date, unread indicator
- Clickable to jump to Inquiries tab

## Files to modify

| File | Change |
|------|--------|
| `src/lib/api.js` | Add `fetchPropertyStats()`, `fetchInquiryStats()`, `fetchRecentInquiries()` |
| `src/components/admin/AdminDashboard.jsx` | Add stats section above tabs |
| `src/components/admin/AdminDashboard.test.jsx` | Add stats rendering tests |
