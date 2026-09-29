# Plan: Custom Confirmation Modals for Admin Actions

## Goal
Replace `window.confirm()` with custom confirmation modals matching the app's design system. Add confirmation on property form submit.

## Changes

### 1. New Component — `ConfirmModal.jsx`
**File:** `src/components/shared/ConfirmModal.jsx`

A reusable confirmation modal with:
- Dark overlay backdrop (same pattern as PropertyModal / PropertyForm)
- Title, message, cancel button, confirm button
- Props: `open`, `onClose`, `onConfirm`, `title`, `message`, `confirmLabel`, `confirmVariant` (destructive = red, default = gold), `loading`
- Closes on Escape key and backdrop click
- Focus trap: confirm button auto-focused

### 2. `AdminProperties.jsx` — Delete confirmation
**File:** `src/components/admin/AdminProperties.jsx`

- Remove `window.confirm()` in `handleDelete`
- Add `confirmDelete` state to track which property is pending deletion
- Render `<ConfirmModal>` with destructive variant
- On confirm: call `deleteProperty()`

### 3. `AdminInquiries.jsx` — Delete confirmation
**File:** `src/components/admin/AdminInquiries.jsx`

- Remove `window.confirm()` in `handleDelete`
- Add `confirmDelete` state to track which inquiry is pending deletion
- Render `<ConfirmModal>` with destructive variant
- On confirm: call `deleteInquiry()`

### 4. `PropertyForm.jsx` — Submit confirmation
**File:** `src/components/admin/PropertyForm.jsx`

- Add `confirmSubmit` state (boolean)
- On form submit validation pass: set `confirmSubmit = true` instead of saving immediately
- Render `<ConfirmModal>` with gold variant, message: "Add this property?" / "Save changes to this property?"
- On confirm: proceed with the actual save logic (upload image, insert/update)
- On cancel: close modal, return to form

## Files Modified
| File | Action |
|------|--------|
| `src/components/shared/ConfirmModal.jsx` | **New** — reusable confirmation modal |
| `src/components/admin/AdminProperties.jsx` | Replace `window.confirm` with ConfirmModal |
| `src/components/admin/AdminInquiries.jsx` | Replace `window.confirm` with ConfirmModal |
| `src/components/admin/PropertyForm.jsx` | Add confirm modal on form submit |

## Verification
1. `npx vitest run` — all tests pass
2. `npm run build` — build succeeds
3. Manual: delete property shows custom confirmation modal
4. Manual: delete inquiry shows custom confirmation modal
5. Manual: add/edit property shows confirmation on submit
6. Manual: all modals close on Escape and backdrop click
