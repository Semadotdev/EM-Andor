# Phase 6: Image Gallery Management

**Date:** 2026-08-18
**Status:** Draft

## Overview
Add a dedicated image gallery view to the admin panel for managing all property images. Currently, images are tied to individual properties via `PropertyForm`. This phase gives admins a centralized view to browse, search, sort, and delete property images.

## Requirements
- Display all property images in a responsive grid (2col mobile, 3col tablet, 4col desktop)
- Show property name, location, and image thumbnail for each card
- Search/filter by property name or location
- Sort by property name or upload date
- Click image to view full-size preview (light box/modal)
- Delete images with confirmation
- Upload images directly from gallery (attach to existing property)
- Loading and empty states
- Keyboard navigation and ARIA labels

## API
- `fetchProperties()` — reuse, fetches all properties with `image_url`
- `uploadPropertyImage(file, path)` — reuse for upload
- `updateProperty(id, data)` — reuse to update `image_url` after upload
- No new API functions needed

## Components
- `AdminImageGallery.jsx` — main gallery component
- Modified `AdminDashboard.jsx` — add Gallery tab
- Reuse: `ConfirmModal`, `Icon`

## Success Criteria
- Gallery displays all properties with images
- Search and sort work correctly
- Upload attaches image to existing property
- Delete removes image URL from property
- Lightbox shows full-size image
- All tests pass, build succeeds
