# Implementation Plan: Phase 6 — Image Gallery Management

**Date:** 2026-08-18

## Overview
Centralized image gallery for the admin panel. Reuses existing API and UI patterns.

---

## Step 1: Modify AdminDashboard.jsx
- Add `{id: 'gallery', label: 'Gallery'}` to the `tabs` array
- Add conditional render for `selectedTab === 'gallery'` rendering `AdminImageGallery`

## Step 2: Create AdminImageGallery.jsx
State:
- `properties` — array of all properties
- `loading` — initial fetch
- `searchTerm` — search filter
- `sortBy` — 'name' or 'created_at'
- `previewImage` — selected image for lightbox (or null)
- `uploadModal` — open/close state
- `selectedPropertyId` — for upload target
- `uploadFile` — file to upload
- `uploading` — upload in progress

Features:
1. **Data Fetching** — fetch all properties on mount, filter those with `image_url`
2. **Search** — filter by `name` or `location` (case-insensitive)
3. **Sort** — by `name` (alphabetical) or `created_at` (newest first)
4. **Grid Display** — responsive Tailwind grid with property image cards
5. **Image Preview** — click card → full-size modal/lightbox overlay
6. **Upload** — button → select property from dropdown → choose file → upload via `uploadPropertyImage` → update property `image_url` via `updateProperty`
7. **Delete** — ConfirmModal → clear `image_url` via `updateProperty(id, {image_url: null})`
8. **Empty State** — "No images found" when no results
9. **Loading State** — skeleton/spinner during fetch

## Step 3: Tests (AdminImageGallery.test.jsx)
- Renders gallery with property images
- Filters by search term
- Sorts by name and date
- Opens lightbox on click
- Calls updateProperty on delete confirmation
- Shows empty state when no images
- Shows loading state during fetch

## Verification
- `npm run test` — all tests pass
- `npm run build` — build succeeds
- Manual: Gallery tab appears, images display, upload/delete/preview work
