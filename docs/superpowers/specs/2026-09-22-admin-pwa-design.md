# Admin PWA Installability — Design

Date: 2026-09-22
Status: Approved

## Context

EM-Andor is a single React 19 + Vite SPA deployed on Vercel. It contains a public
marketing site (`*`) and an authenticated admin app (`/admin/*`) backed by
Supabase. Admins/agents currently reach the dashboard by typing the URL in a
browser. There is no web manifest or service worker, so the browser cannot
offer "Install app" and the app cannot be launched like a native app.

## Goal

Make the admin side installable on all platforms (Android Chrome, iOS Safari,
desktop Chrome/Edge) as a PWA: an app icon on the home screen / desktop that
launches `/admin` full-screen without browser chrome.

Scope chosen by the user: installable app icon only. Live data still requires
internet (no Supabase response caching, no offline data).

## Approach

**Approach A — `vite-plugin-pwa`** (chosen over a hand-rolled service worker
and over a separate admin-only build). The plugin generates the manifest and a
Workbox service worker whose precache list is rebuilt from hashed build assets
on every deploy, eliminating stale-cache risk. It is the community standard for
Vite SPAs and adds offline app-shell loading as a harmless side effect.

## Design

### 1. Dependencies & build config

- Add `vite-plugin-pwa` as a dev dependency.
- Configure in `vite.config.js`:
  - `registerType: 'auto'` — a new service worker activates in the background
    on the next visit; no mid-session reload prompt.
  - Service worker disabled in dev (plugin default; `devOptions` untouched).
  - Plugin auto-injects the manifest `<link>` and SW registration into
    `index.html` — no `main.jsx` changes.

### 2. Web manifest (admin-focused)

Generated at build time:

- `name`: "EM Andor Admin", `short_name`: "EM Admin"
- `start_url: "/admin"`, `scope: "/"`, `id: "/admin"` (stable install identity)
- `display: "standalone"` — full-screen launch on all platforms
- `theme_color: "#006B3C"` (existing brand green), `background_color: "#ffffff"`
- Icons: 192px + 512px (`purpose: any`) and maskable 192px + 512px
  (`purpose: maskable`)

### 3. Icons

One-time generation from `src/assets/logo.png` (1080×1080 RGBA) via a committed
Python/PIL script (`scripts/generate-pwa-icons.py`) that writes PNGs into
`public/icons/`:

- `pwa-192.png`, `pwa-512.png` — plain resizes
- `pwa-maskable-192.png`, `pwa-maskable-512.png` — logo scaled to ~60% inside
  the 80% safe-zone circle on a solid `#006B3C` background
- `apple-touch-icon.png` — 180px, solid background (iOS requires no
  transparency)

Generated PNGs are committed to the repo; no image tooling runs at build time.
Generated maskable renders are eyeballed for legibility before committing.

### 4. `index.html` head

Manually added:

- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` — iOS
  ignores manifest icons during Add to Home Screen
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`

Existing `<meta name="theme-color" content="#006B3C">` stays as-is.

### 5. Service worker behavior

Workbox `generateSW`:

- Precaches all hashed build assets (app shell).
- `navigateFallback: "index.html"` so SPA deep links (e.g. `/admin/projects/3`)
  resolve at the shell level when offline.
- Supabase API requests are never cached — all data remains live.
- Outdated caches are cleaned up automatically on activate.

### 6. "Install app" button

- `src/hooks/useInstallPrompt.js`: listens for `beforeinstallprompt`
  (Chrome/Edge/Android), stores the event, exposes `promptInstall()` and
  `canInstall`. Cleans up its listener on unmount.
- Admin sidebar (AdminLayout) shows an "Install app" action only when
  `canInstall` is true. After a successful install the event is consumed and the
  action disappears.
- iOS shows no button (no prompt API); users there use Safari's Share → Add to
  Home Screen.

### 7. Testing

- Vitest unit tests for `useInstallPrompt` (event capture, prompt() invocation,
  listener cleanup) alongside existing admin tests.
- Existing test suite must keep passing (`npm test`).
- `npm run build` output must contain `manifest.webmanifest` and `sw.js`.
- Lighthouse PWA audit on the built site.
- Manual checklist: install on desktop Chrome, desktop Edge, Android Chrome
  (install prompt), and iOS Safari (Share → Add to Home Screen).

## Out of scope

- Offline data / Supabase response caching
- Push notifications
- Separate admin-only build
- Update-confirmation UI (registerType is silent)

## Risks & mitigations

- **Stale code after deploys** — Workbox precache is derived from hashed asset
  names at each build; service worker updates itself in the background.
- **iOS quirks** — no install prompt exists; the apple-touch-icon + A2HS path
  is the only option and is covered by the icon/head work above.
- **Maskable icon legibility** — safe-zone padding plus manual review of
  generated renders.
