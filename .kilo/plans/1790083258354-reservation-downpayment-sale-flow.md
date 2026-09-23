# Reservation → Downpayment Sale Flow

## Current state (verified against codebase)

The **lib layer and three new components are already implemented** and all 490 tests pass. The work below completes the remaining wiring and removes the dead code.

### Already done (do not re-implement)
- `src/lib/ledger.js:11` `monthlyAmortization` — no-interest 12/24/36, annuity 48/60, DP ≥ TCP → 0. `PAYMENT_TERMS` exported.
- `src/lib/sales.js` — `reserveLot`, `cancelReservation`, `completeDownpayment`, `updateSale` all present; `recordSale` already removed.
- `src/components/admin/ReservationModal.jsx` — reservation form (no M.A./DP, required Terms Select, "Reserve Lot", toast "Reservation recorded.").
- `src/components/admin/ReservationActionsModal.jsx` — chooser (Make Downpayment / Cancel Reservation).
- `src/components/admin/DownpaymentModal.jsx` — loads sale row, editable Terms Select, DP input, live MA preview, "Record Downpayment".
- Tests for the above exist and pass.

## Remaining work

### 1. `src/components/admin/ProjectDetail.jsx` — wire the new lifecycle
- Replace the `MarkSoldModal` import with `ReservationModal`, `ReservationActionsModal`, `DownpaymentModal`.
- `lotActions(lot)` per status:
  - `available`: **Reserve** (was "Mark Sold") + Edit + Delete
  - `reserved`: single **Reservation** button → opens chooser
  - `sold`: **Ledger** (unchanged)
- Add state: `reservationLot`, `actionsLot`, `downpaymentLot`, `cancelTarget`.
- Reserve flow: `setReservationLot(lot)` → `ReservationModal` `onReserved` → `load()`.
- Chooser flow: `setActionsLot(lot)` → `ReservationActionsModal`:
  - **Make Downpayment** → close chooser, open `DownpaymentModal` (`onSold` → `load()`).
  - **Cancel Reservation** → close chooser, open shared `ConfirmModal` (destructive) → `cancelReservation(lot.id)` → `load()`, toast "Reservation cancelled." on success.
- Delete flow stays on the shared `ConfirmModal` (already wired).
- `counts` gains `reserved` and the counts line renders "N reserved".

### 2. Delete the dead Mark Sold path
- Remove `src/components/admin/MarkSoldModal.jsx`.
- Remove `src/components/admin/MarkSoldModal.test.jsx` (it mocks `recordSale`, which no longer exists — it currently passes only because the component is never imported by the suite; it will break on build/import).
- Remove the `MarkSoldModal` mock from `ProjectDetail.test.jsx`.

### 3. `src/components/admin/SaleDetailsModal.jsx` — Terms Select
- Replace the free-text Terms `Input` with the `Select` from `../shared/ui` using `PAYMENT_TERMS` from `../../lib/ledger.js`.
- Keep DP/M.A. as editable numeric inputs (admin override path). No behavioral change to validation.

### 4. `src/components/admin/BuyerLedgerModal.jsx` — price/m² source
- Line 244: change `project?.price_per_sqm` → `lot.price_per_sqm` in the "Price/m²" detail row.

### 5. Tests to update/add
- `ProjectDetail.test.jsx` — per-status buttons, chooser open, cancel confirm + `cancelReservation` call, "N reserved" count. Remove Mark Sold mock.
- `SaleDetailsModal.test.jsx` — Terms is a Select with the 5 options; existing override tests still pass.
- `BuyerLedgerModal.test.jsx` — price/m² reads `lot.price_per_sqm` (update the `project.price_per_sqm` expectation).
- New `ReservationActionsModal.test.jsx` — renders two actions, fires `onDownpayment` / `onCancelReservation`, closes on close/Escape.
- New `DownpaymentModal.test.jsx` — loads sale row, prefills terms, DP validation (>0, ≤TCP), live MA preview recomputes on DP/terms change, submit payload.

## Verification
1. `npm test` — full suite green.
2. `npm run build` — compiles (catches the removed `MarkSoldModal` import).
3. Commit on `main`.

## Out of scope
- No schema changes (confirmed: `status` is unconstrained text; `sales` columns exist).
- No migration for existing `sold` lots — they keep the Ledger path unchanged.