# Admin Dashboard + Available Properties — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-protected `/admin` dashboard (Supabase-backed) that manages an available-properties inventory shown in a new public section, and stores contact-form inquiries for admin review.

**Architecture:** Keep the existing Vite SPA on Vercel. Add `react-router-dom` for the `/admin` route and read/write Supabase (Postgres + Auth + Storage) directly from the browser via `@supabase/supabase-js`. Row-Level Security (RLS) in `supabase/schema.sql` is the security boundary: public reads only pinned properties, anonymous visitors can only insert inquiries, and any authenticated user (the single admin account) has full access.

**Tech Stack:** Vite 6, React 19, Tailwind 4, `react-router-dom`, `@supabase/supabase-js`, Vitest + Testing Library (jsdom).

**Supabase project:** `https://nfikkjuuzwphswutocao.supabase.co` (project ref `nfikkjuuzwphswutocao`). Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

**Existing conventions to reuse:** Tailwind theme tokens (`brand`, `brand-2`, `brand-deep`, `gold`, `surface`, `ink`, `mist`), component classes (`.container-x`, `.btn`, `.btn-gold`), `Reveal`, `SectionHeading`, `Icon` (existing icon names only: `residential`, `commercial`, `pin`, `arrow-right`, etc.), and the card pattern from `Projects.jsx`.

---

## File Structure

New files:
- `supabase/schema.sql` — DDL + RLS + storage policies (run once in Supabase SQL editor)
- `.env.example` — documented env vars (committed)
- `vercel.json` — SPA rewrite so `/admin/*` serves `index.html`
- `src/lib/supabase.js` — Supabase client singleton
- `src/lib/format.js` — `formatPrice()` pure helper
- `src/lib/api.js` — all Supabase data-access functions
- `src/components/sections/AvailableProperties.jsx` — public section
- `src/components/admin/AdminApp.jsx` — `/admin` route shell (login vs dashboard)
- `src/components/admin/AdminLogin.jsx` — sign-in page
- `src/components/admin/AdminDashboard.jsx` — guard + layout + tabs
- `src/components/admin/AdminProperties.jsx` — properties list, pin, delete
- `src/components/admin/PropertyForm.jsx` — add/edit modal + image upload
- `src/components/admin/AdminInquiries.jsx` — inquiries list
- `vitest.config.js` — test config
- `src/test/setup.js` — jest-dom + IntersectionObserver mock
- Test files: `src/lib/format.test.js`, `src/lib/api.test.js`, `src/components/sections/AvailableProperties.test.jsx`, `src/components/sections/Contact.test.jsx`, `src/components/admin/AdminLogin.test.jsx`, `src/components/admin/AdminDashboard.test.jsx`, `src/components/admin/AdminProperties.test.jsx`, `src/components/admin/PropertyForm.test.jsx`, `src/components/admin/AdminInquiries.test.jsx`

Modified files:
- `package.json` — deps + `test` script
- `.gitignore` — add `.env`
- `src/App.jsx` — router + public/admin split + new section
- `src/components/sections/Contact.jsx` — DB submit instead of `mailto:`

---

## Task 1: Dependencies + test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/test/smoke.test.js`

- [ ] **Step 1: Install runtime and dev dependencies**

Run:
```bash
npm install @supabase/supabase-js react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add the test script**

Edit `package.json` — add to `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
```

- [ ] **Step 4: Create `src/test/setup.js`**

```js
import '@testing-library/jest-dom/vitest'

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = IntersectionObserverMock
}
```

`Reveal.jsx` uses `IntersectionObserver`, which does not exist in jsdom — this mock keeps components renderable in tests.

- [ ] **Step 5: Create `src/test/smoke.test.js`**

```js
import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run tests to verify harness works**

Run: `npm test`
Expected: `1 passed`, no failures.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/test
git commit -m "chore: add supabase, router, and vitest test harness"
```

---

## Task 2: Supabase schema, env example, SPA rewrite

**Files:**
- Create: `supabase/schema.sql`
- Create: `.env.example`
- Create: `vercel.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `supabase/schema.sql`**

```sql
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  location text not null,
  lot_area_sqm numeric,
  price numeric,
  description text,
  image_url text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  project_type text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;
alter table public.inquiries enable row level security;

create policy "admin all on properties" on public.properties
  for all to authenticated using (true) with check (true);

create policy "public read pinned properties" on public.properties
  for select to anon using (is_pinned = true);

create policy "public insert inquiries" on public.inquiries
  for insert to anon with check (true);

create policy "admin all on inquiries" on public.inquiries
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

create policy "public read property-images" on storage.objects
  for select to anon using (bucket_id = 'property-images');

create policy "admin insert property-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-images');

create policy "admin update property-images" on storage.objects
  for update to authenticated using (bucket_id = 'property-images') with check (bucket_id = 'property-images');

create policy "admin delete property-images" on storage.objects
  for delete to authenticated using (bucket_id = 'property-images');
```

- [ ] **Step 2: Create `.env.example`**

```
VITE_SUPABASE_URL=https://nfikkjuuzwphswutocao.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

- [ ] **Step 3: Add `.env` to `.gitignore`**

Current `.gitignore`:
```
node_modules
dist
*.local
.DS_Store
```
Add a line so it becomes:
```
node_modules
dist
*.local
.env
.DS_Store
```

- [ ] **Step 4: Create `vercel.json`**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

(Vercel serves real static files first, so `/images/*`, `/favicon.svg`, etc. still resolve; only unmatched paths fall through to `index.html`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql .env.example vercel.json .gitignore
git commit -m "feat: add supabase schema, env example, and SPA rewrite"
```

---

## Task 3: Supabase client + price formatter (TDD)

**Files:**
- Create: `src/lib/format.test.js`
- Create: `src/lib/format.js`
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Write the failing test — `src/lib/format.test.js`**

```js
import { describe, expect, it } from 'vitest'
import { formatPrice } from './format.js'

describe('formatPrice', () => {
  it('formats a number with peso sign and thousands separators', () => {
    expect(formatPrice(1500000)).toBe('₱ 1,500,000')
  })

  it('formats a numeric string', () => {
    expect(formatPrice('1234567.5')).toBe('₱ 1,234,567.5')
  })

  it('returns null for empty string', () => {
    expect(formatPrice('')).toBeNull()
  })

  it('returns null for null and undefined', () => {
    expect(formatPrice(null)).toBeNull()
    expect(formatPrice(undefined)).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(formatPrice('abc')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.js`
Expected: FAIL — module `./format.js` not found.

- [ ] **Step 3: Create `src/lib/format.js`**

```js
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return `₱ ${num.toLocaleString('en-PH')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.js`
Expected: `5 passed`.

- [ ] **Step 5: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.test.js src/lib/format.js src/lib/supabase.js
git commit -m "feat: add supabase client and price formatter"
```

---

## Task 4: API layer (TDD)

**Files:**
- Create: `src/lib/api.test.js`
- Create: `src/lib/api.js`

- [ ] **Step 1: Write the failing test — `src/lib/api.test.js`**

```js
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createProperty,
  deleteInquiry,
  deleteProperty,
  fetchInquiries,
  fetchPinnedProperties,
  fetchProperties,
  setInquiryRead,
  setPropertyPinned,
  submitInquiry,
  updateProperty,
  uploadPropertyImage,
} from './api.js'

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabase } from './supabase.js'

function makeChain() {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single', 'insert']) {
    c[m] = vi.fn(() => c)
  }
  return c
}

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchPinnedProperties reads pinned properties newest first', async () => {
    const data = [{ id: 'p1', name: 'Lot A' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchPinnedProperties()

    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.select).toHaveBeenCalledWith('*')
    expect(c.eq).toHaveBeenCalledWith('is_pinned', true)
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(data)
  })

  it('fetchProperties reads all properties newest first', async () => {
    const data = [{ id: 'p1' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchProperties()

    expect(c.eq).not.toHaveBeenCalled()
    expect(result).toEqual(data)
  })

  it('submitInquiry inserts the inquiry', async () => {
    const inquiry = { name: 'Juan', email: 'juan@example.com', phone: '0917', project_type: null, message: 'Hi' }
    const c = makeChain()
    c.insert.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await submitInquiry(inquiry)

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(c.insert).toHaveBeenCalledWith(inquiry)
  })

  it('createProperty inserts and returns the new row', async () => {
    const row = { id: 'p1', name: 'Lot A' }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await createProperty({ name: 'Lot A' })

    expect(c.insert).toHaveBeenCalledWith({ name: 'Lot A' })
    expect(c.single).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('updateProperty updates by id and returns the row', async () => {
    const row = { id: 'p1', name: 'Lot A edited' }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await updateProperty('p1', { name: 'Lot A edited' })

    expect(c.update).toHaveBeenCalledWith({ name: 'Lot A edited' })
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
    expect(result).toEqual(row)
  })

  it('setPropertyPinned updates only is_pinned', async () => {
    const row = { id: 'p1', is_pinned: true }
    const c = makeChain()
    c.single.mockResolvedValue({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    await setPropertyPinned('p1', true)

    expect(c.update).toHaveBeenCalledWith({ is_pinned: true })
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('deleteProperty deletes by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await deleteProperty('p1')

    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('fetchInquiries reads all inquiries newest first', async () => {
    const data = [{ id: 'q1' }]
    const c = makeChain()
    c.order.mockResolvedValue({ data, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchInquiries()

    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(result).toEqual(data)
  })

  it('setInquiryRead updates is_read by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await setInquiryRead('q1', true)

    expect(c.update).toHaveBeenCalledWith({ is_read: true })
    expect(c.eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('deleteInquiry deletes by id', async () => {
    const c = makeChain()
    c.eq.mockResolvedValue({ data: null, error: null })
    supabase.from.mockReturnValue(c)

    await deleteInquiry('q1')

    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('uploadPropertyImage uploads and returns public URL', async () => {
    const file = new File(['img'], 'lot-a.jpg', { type: 'image/jpeg' })
    const bucket = {
      upload: vi.fn().mockResolvedValue({ data: { path: 'abc.jpg' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/abc.jpg' } }),
    }
    supabase.storage.from.mockReturnValue(bucket)

    const url = await uploadPropertyImage(file)

    expect(supabase.storage.from).toHaveBeenCalledWith('property-images')
    expect(bucket.upload).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), file)
    expect(url).toBe('https://cdn.example.com/abc.jpg')
  })

  it('throws when a query returns an error', async () => {
    const c = makeChain()
    c.order.mockResolvedValue({ data: null, error: new Error('boom') })
    supabase.from.mockReturnValue(c)

    await expect(fetchProperties()).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api.test.js`
Expected: FAIL — module `./api.js` not found.

- [ ] **Step 3: Create `src/lib/api.js`**

```js
import { supabase } from './supabase.js'

export async function fetchPinnedProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function submitInquiry(inquiry) {
  const { error } = await supabase.from('inquiries').insert(inquiry)
  if (error) throw error
}

export async function createProperty(property) {
  const { data, error } = await supabase.from('properties').insert(property).select().single()
  if (error) throw error
  return data
}

export async function updateProperty(id, updates) {
  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setPropertyPinned(id, isPinned) {
  return updateProperty(id, { is_pinned: isPinned })
}

export async function deleteProperty(id) {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
}

export async function uploadPropertyImage(file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('property-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('property-images').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function setInquiryRead(id, isRead) {
  const { error } = await supabase.from('inquiries').update({ is_read: isRead }).eq('id', id)
  if (error) throw error
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api.test.js`
Expected: `11 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.test.js src/lib/api.js
git commit -m "feat: add supabase data-access api layer"
```

---

## Task 5: Public "Available Properties" section (TDD)

**Files:**
- Create: `src/components/sections/AvailableProperties.test.jsx`
- Create: `src/components/sections/AvailableProperties.jsx`
- Modify: `src/App.jsx` (insert section between `<Projects />` and `<WhyChooseUs />`)

- [ ] **Step 1: Write the failing test — `src/components/sections/AvailableProperties.test.jsx`**

```jsx
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import AvailableProperties from './AvailableProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchPinnedProperties: vi.fn(),
}))

import { fetchPinnedProperties } from '../../lib/api.js'

const sample = [
  {
    id: 'p1',
    name: 'Andor Ridge Lot A',
    type: 'residential lot',
    location: 'Batangas City',
    lot_area_sqm: 150,
    price: 1500000,
    description: 'Corner lot',
    image_url: '/images/hero.jpg',
  },
]

describe('AvailableProperties', () => {
  beforeEach(() => {
    fetchPinnedProperties.mockReset()
  })

  it('shows a loading state, then renders pinned properties', async () => {
    let resolveFetch
    fetchPinnedProperties.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    render(<AvailableProperties />)

    expect(screen.getByLabelText('Loading available properties')).toBeInTheDocument()

    await act(async () => {
      resolveFetch(sample)
    })

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(screen.getByText('150 sqm')).toBeInTheDocument()
    expect(screen.getByText('residential lot')).toBeInTheDocument()
  })

  it('shows an empty state when nothing is pinned', async () => {
    fetchPinnedProperties.mockResolvedValue([])

    render(<AvailableProperties />)

    expect(await screen.findByText(/No available properties/i)).toBeInTheDocument()
  })

  it('shows an error state with a retry button that reloads', async () => {
    fetchPinnedProperties
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([
        { id: 'p2', name: 'Andor Ridge Lot B', type: 'house & lot', location: 'Lipa', lot_area_sqm: null, price: null, description: null, image_url: null },
      ])

    render(<AvailableProperties />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Andor Ridge Lot B')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/AvailableProperties.test.jsx`
Expected: FAIL — module `./AvailableProperties.jsx` not found.

- [ ] **Step 3: Create `src/components/sections/AvailableProperties.jsx`**

```jsx
import { useEffect, useState } from 'react'
import Reveal from '../shared/Reveal.jsx'
import SectionHeading from '../shared/SectionHeading.jsx'
import Icon from '../shared/Icon.jsx'
import { fetchPinnedProperties } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

const fallbackImage = '/images/project-1.jpg'

export default function AvailableProperties() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setStatus('loading')
    fetchPinnedProperties()
      .then((data) => {
        if (!mounted) return
        setProperties(data ?? [])
        setStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('error')
      })
    return () => {
      mounted = false
    }
  }, [reloadKey])

  return (
    <section id="available-properties" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading
          eyebrow="Available Properties"
          title="Lots & Properties for Sale"
          description="Browse currently available lots and properties — updated live. Interested? Reach out through the contact form below."
        />

        {status === 'loading' && (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading available properties">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-mist bg-surface">
                <div className="aspect-[16/11] bg-mist" />
                <div className="space-y-3 p-6">
                  <div className="h-4 w-24 rounded bg-mist" />
                  <div className="h-5 w-3/4 rounded bg-mist" />
                  <div className="h-4 w-1/2 rounded bg-mist" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-lg border border-mist bg-surface p-10 text-center">
            <p className="text-ink/70">We couldn’t load the available properties right now.</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn btn-gold">
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && properties.length === 0 && (
          <p className="mt-12 rounded-lg border border-mist bg-surface p-10 text-center text-ink/70">
            No available properties at the moment. Check back soon!
          </p>
        )}

        {status === 'ready' && properties.length > 0 && (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, i) => (
              <Reveal key={property.id} delay={(i % 3) * 90}>
                <article className="group overflow-hidden rounded-lg bg-surface shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <img
                      src={property.image_url || fallbackImage}
                      alt={property.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-white">
                      {property.type}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-2">
                        <Icon name="pin" className="size-3.5" />
                        {property.location}
                      </p>
                      {property.lot_area_sqm != null && (
                        <span className="text-xs font-semibold text-ink/60">
                          {Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-bold text-brand-deep">{property.name}</h3>
                    {property.description && <p className="mt-2 text-sm leading-relaxed text-ink/70">{property.description}</p>}
                    {formatPrice(property.price) && (
                      <p className="mt-3 font-display text-lg font-bold text-brand">{formatPrice(property.price)}</p>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/AvailableProperties.test.jsx`
Expected: `3 passed`.

- [ ] **Step 5: Wire the section into the public page**

Edit `src/App.jsx` — add the import and place `<AvailableProperties />` between `<Projects />` and `<WhyChooseUs />`. Do NOT add routing yet (that is Task 7); this task only inserts the section:

```jsx
import AvailableProperties from './components/sections/AvailableProperties.jsx'
```

```jsx
        <Projects />
        <AvailableProperties />
        <WhyChooseUs />
```

- [ ] **Step 6: Verify build still passes**

Run: `npm run build`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/AvailableProperties.test.jsx src/components/sections/AvailableProperties.jsx src/App.jsx
git commit -m "feat: add available properties section to public site"
```

---

## Task 6: Contact form stores inquiries in the database (TDD)

**Files:**
- Create: `src/components/sections/Contact.test.jsx`
- Modify: `src/components/sections/Contact.jsx`

- [ ] **Step 1: Write the failing test — `src/components/sections/Contact.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Contact from './Contact.jsx'

vi.mock('../../lib/api.js', () => ({
  submitInquiry: vi.fn(),
}))

import { submitInquiry } from '../../lib/api.js'

describe('Contact form', () => {
  beforeEach(() => {
    submitInquiry.mockReset()
  })

  it('submits a valid inquiry to the database and shows a success message', async () => {
    submitInquiry.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<Contact />)

    await user.type(screen.getByLabelText('Full Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Email Address'), 'juan@example.com')
    await user.type(screen.getByLabelText('Phone Number'), '09171234567')
    await user.selectOptions(screen.getByLabelText('Project Type'), 'Residential Construction')
    await user.type(screen.getByLabelText('Message'), 'I want to build a house.')
    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(submitInquiry).toHaveBeenCalledWith({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: '09171234567',
      project_type: 'Residential Construction',
      message: 'I want to build a house.',
    })
    expect(await screen.findByText(/Thank you!/)).toBeInTheDocument()
  })

  it('does not submit when validation fails', async () => {
    const user = userEvent.setup()

    render(<Contact />)

    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(await screen.findByText(/Please enter your full name/i)).toBeInTheDocument()
  })

  it('shows an error message when submission fails', async () => {
    submitInquiry.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<Contact />)

    await user.type(screen.getByLabelText('Full Name'), 'Juan Dela Cruz')
    await user.type(screen.getByLabelText('Email Address'), 'juan@example.com')
    await user.type(screen.getByLabelText('Phone Number'), '09171234567')
    await user.type(screen.getByLabelText('Message'), 'I want to build a house.')
    await user.click(screen.getByRole('button', { name: 'Submit Inquiry' }))

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sections/Contact.test.jsx`
Expected: FAIL — `submitInquiry` is not called (current code uses `mailto:`); the first test fails on `expect(submitInquiry).toHaveBeenCalledWith(...)`.

- [ ] **Step 3: Modify `src/components/sections/Contact.jsx`**

Replace the top of the component with the new import and state. The existing file has these pieces you must change:

**(a)** Add import (after the `Icon` import on line 4):
```jsx
import { submitInquiry } from '../../lib/api.js'
```

**(b)** Replace the state block (current lines 18-27):
```jsx
export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', projectType: '', message: '' })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((errs) => ({ ...errs, [field]: undefined }))
    setSent(false)
    setError(null)
  }
```

**(c)** Replace the `handleSubmit` function (current lines 40-53):
```jsx
  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setError(null)
    try {
      await submitInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        project_type: form.projectType || null,
        message: form.message.trim(),
      })
      setSent(true)
      setForm({ name: '', email: '', phone: '', projectType: '', message: '' })
    } catch {
      setError('Something went wrong while sending your inquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
```

**(d)** Replace the success banner (current lines 107-114) so it reflects the new flow:
```jsx
              {sent && (
                <div className="mb-6 flex items-start gap-3 rounded-md border border-brand/25 bg-brand/10 p-4 text-sm font-medium text-brand-deep" role="status">
                  <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 13 4 4 10-11" />
                  </svg>
                  Thank you! Your inquiry has been sent. Our team will get back to you soon.
                </div>
              )}

              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
                  <span aria-hidden="true">!</span>
                  {error}
                </div>
              )}
```

**(e)** Replace the submit button (current lines 172-175) to add the spinner state and disable while submitting:
```jsx
              <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full sm:w-auto disabled:opacity-60">
                {submitting ? 'Sending…' : 'Submit Inquiry'}
                {!submitting && <Icon name="arrow-right" className="size-4" />}
              </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sections/Contact.test.jsx`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Contact.test.jsx src/components/sections/Contact.jsx
git commit -m "feat: store contact inquiries in supabase instead of mailto"
```

---

## Task 7: Public/admin routing split

**Files:**
- Modify: `src/App.jsx`
- Create: `src/components/admin/AdminApp.jsx`

This task has no unit test — it is pure wiring. It is verified by `npm run build` (Task 13) plus the admin component tests in Tasks 8-12 that render against `/admin` routes.

- [ ] **Step 1: Create `src/components/admin/AdminApp.jsx`**

```jsx
import { Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'
import AdminLogin from './AdminLogin.jsx'

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route path="*" element={<AdminDashboard />} />
    </Routes>
  )
}
```

(Imports `AdminLogin.jsx` and `AdminDashboard.jsx`, which do not exist yet — they are created in Tasks 8 and 9. The build will fail until then, so commit this task together with Task 8.)

- [ ] **Step 2: Replace the entire `src/App.jsx`**

```jsx
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/layout/Navbar.jsx'
import Footer from './components/layout/Footer.jsx'
import Hero from './components/sections/Hero.jsx'
import Stats from './components/sections/Stats.jsx'
import About from './components/sections/About.jsx'
import Services from './components/sections/Services.jsx'
import Projects from './components/sections/Projects.jsx'
import AvailableProperties from './components/sections/AvailableProperties.jsx'
import WhyChooseUs from './components/sections/WhyChooseUs.jsx'
import CTA from './components/sections/CTA.jsx'
import Contact from './components/sections/Contact.jsx'
import AdminApp from './components/admin/AdminApp.jsx'

function PublicSite() {
  return (
    <>
      <a href="#home" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <About />
        <Services />
        <Projects />
        <AvailableProperties />
        <WhyChooseUs />
        <CTA />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<PublicSite />} />
      </Routes>
    </BrowserRouter>
  )
}
```

`main.jsx` stays unchanged — `App` now owns the router.

Note: the public page's existing anchor links (`#home`, `#about`, …) keep working because `BrowserRouter` routes on the pathname, not the hash; the browser still scrolls to the matching element ids.

- [ ] **Step 3: Do not commit yet**

The next task (Task 8) creates `AdminLogin.jsx` so the app compiles. Commit both together at the end of Task 8.

---

## Task 8: Admin login page (TDD)

**Files:**
- Create: `src/components/admin/AdminLogin.test.jsx`
- Create: `src/components/admin/AdminLogin.jsx`

- [ ] **Step 1: Write the failing test — `src/components/admin/AdminLogin.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLogin from './AdminLogin.jsx'

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderLogin(initialPath = '/admin/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<p>DashboardTarget</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  })

  it('signs in and navigates to /admin on success', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'admin@emandor.com', password: 'secret' })
    expect(await screen.findByText('DashboardTarget')).toBeInTheDocument()
  })

  it('shows an error message on failed sign-in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'admin@emandor.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx`
Expected: FAIL — module `./AdminLogin.jsx` not found.

- [ ] **Step 3: Create `src/components/admin/AdminLogin.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand-deep px-5">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Admin Sign In</h1>
        <p className="mt-1 text-sm text-ink/60">E.M. Andor — properties &amp; inquiries</p>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn btn-gold mt-7 w-full disabled:opacity-60">
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminLogin.test.jsx`
Expected: `2 passed`.

- [ ] **Step 5: Verify the whole app compiles (Task 7 + this task)**

Run: `npm run build`
Expected: succeeds. If it fails only because `AdminDashboard.jsx` is missing (Task 9), that is expected — proceed; the app compiles again after Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/admin/AdminApp.jsx src/components/admin/AdminLogin.test.jsx src/components/admin/AdminLogin.jsx
git commit -m "feat: add admin routing and login page"
```

---

## Task 9: Admin dashboard shell + auth guard + tabs (TDD)

**Files:**
- Create: `src/components/admin/AdminDashboard.test.jsx`
- Create: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Write the failing test — `src/components/admin/AdminDashboard.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'

vi.mock('./AdminProperties.jsx', () => ({ default: () => 'PropertiesPanel' }))
vi.mock('./AdminInquiries.jsx', () => ({ default: () => 'InquiriesPanel' }))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../../lib/supabase.js'

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/login" element={<p>LoginPage</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /admin/login when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    renderDashboard()

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('renders the properties tab when authenticated', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderDashboard()

    expect(await screen.findByText('PropertiesPanel')).toBeInTheDocument()
  })

  it('switches to the inquiries tab', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const user = userEvent.setup()

    renderDashboard()

    await screen.findByText('PropertiesPanel')
    await user.click(screen.getByRole('button', { name: 'Inquiries' }))
    expect(await screen.findByText('InquiriesPanel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminDashboard.test.jsx`
Expected: FAIL — module `./AdminDashboard.jsx` not found.

- [ ] **Step 3: Create `src/components/admin/AdminDashboard.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import AdminProperties from './AdminProperties.jsx'
import AdminInquiries from './AdminInquiries.jsx'

const tabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'inquiries', label: 'Inquiries' },
]

export default function AdminDashboard() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState('properties')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-deep">
        <p className="font-display text-lg text-white">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-mist bg-white">
        <div className="container-x flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="font-display text-lg font-extrabold text-brand-deep">E.M. Andor Admin</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:text-brand"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="container-x py-8">
        <nav className="mb-8 flex gap-2" aria-label="Admin sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-brand text-white'
                  : 'border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'properties' ? <AdminProperties /> : <AdminInquiries />}
      </div>
    </div>
  )
}
```

(`AdminProperties` and `AdminInquiries` are created in Tasks 11 and 12; the build stays red for those until then.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminDashboard.test.jsx`
Expected: `3 passed`. (The test mocks `./AdminProperties.jsx` and `./AdminInquiries.jsx`, so the real section components and the not-yet-existing `PropertyForm.jsx` are never loaded.)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminDashboard.test.jsx src/components/admin/AdminDashboard.jsx
git commit -m "feat: add admin dashboard shell with auth guard and tabs"
```

---

## Task 10: Property add/edit form with image upload (TDD)

**Files:**
- Create: `src/components/admin/PropertyForm.test.jsx`
- Create: `src/components/admin/PropertyForm.jsx`

- [ ] **Step 1: Write the failing test — `src/components/admin/PropertyForm.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertyForm from './PropertyForm.jsx'

vi.mock('../../lib/api.js', () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'

const payload = {
  name: 'Andor Ridge Lot A',
  type: 'residential lot',
  location: 'Batangas City',
  lot_area_sqm: 150,
  price: 1500000,
  description: 'Corner lot',
  image_url: null,
  is_pinned: false,
}

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText('Name'), payload.name)
  await user.selectOptions(screen.getByLabelText('Type'), payload.type)
  await user.type(screen.getByLabelText('Location'), payload.location)
  await user.type(screen.getByLabelText('Lot Area (sqm)'), '150')
  await user.type(screen.getByLabelText('Price (PHP)'), '1500000')
  await user.type(screen.getByLabelText('Description (optional)'), payload.description)
}

describe('PropertyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a property from typed fields', async () => {
    const created = { id: 'p1', ...payload }
    createProperty.mockResolvedValue(created)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={onSaved} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(createProperty).toHaveBeenCalledWith(payload)
    expect(onSaved).toHaveBeenCalledWith(created)
  })

  it('edits an existing property by id', async () => {
    const existing = { id: 'p7', ...payload, price: 2000000 }
    const updated = { ...existing, name: 'Andor Ridge Lot A (Reserved)' }
    updateProperty.mockResolvedValue(updated)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByLabelText('Name')).toHaveValue(existing.name)
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Andor Ridge Lot A (Reserved)')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateProperty).toHaveBeenCalledWith('p7', expect.objectContaining({ name: 'Andor Ridge Lot A (Reserved)', price: 2000000 }))
    expect(onSaved).toHaveBeenCalledWith(updated)
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Select a type.')).toBeInTheDocument()
    expect(screen.getByText('Location is required.')).toBeInTheDocument()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('uploads a selected image and includes its URL in the payload', async () => {
    uploadPropertyImage.mockResolvedValue('https://cdn.example.com/lot-a.jpg')
    createProperty.mockResolvedValue({ id: 'p1' })
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    const file = new File(['img'], 'lot-a.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Image'), file)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(uploadPropertyImage).toHaveBeenCalledWith(file)
    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'https://cdn.example.com/lot-a.jpg' }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/PropertyForm.test.jsx`
Expected: FAIL — module `./PropertyForm.jsx` not found.

- [ ] **Step 3: Create `src/components/admin/PropertyForm.jsx`**

```jsx
import { useState } from 'react'
import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const types = ['residential lot', 'commercial lot', 'house & lot', 'development lot']

export default function PropertyForm({ mode, property, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    name: property?.name ?? '',
    type: property?.type ?? '',
    location: property?.location ?? '',
    lot_area_sqm: property?.lot_area_sqm ?? '',
    price: property?.price ?? '',
    description: property?.description ?? '',
    is_pinned: property?.is_pinned ?? false,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(property?.image_url ?? '')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((errs) => ({ ...errs, [field]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.type) next.type = 'Select a type.'
    if (!form.location.trim()) next.location = 'Location is required.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setError(null)
    try {
      let finalImageUrl = imageUrl
      if (imageFile) finalImageUrl = await uploadPropertyImage(imageFile)
      const payload = {
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        lot_area_sqm: form.lot_area_sqm === '' ? null : Number(form.lot_area_sqm),
        price: form.price === '' ? null : Number(form.price),
        description: form.description.trim() || null,
        image_url: finalImageUrl || null,
        is_pinned: form.is_pinned,
      }
      const saved = isEdit ? await updateProperty(property.id, payload) : await createProperty(payload)
      onSaved(saved)
    } catch {
      setError('Could not save the property. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit property' : 'Add property'}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="pf-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Name
            </label>
            <input id="pf-name" className={inputCls} value={form.name} onChange={setField('name')} placeholder="Andor Ridge Lot A" />
            {errors.name && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-type" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Type
            </label>
            <select id="pf-type" className={inputCls} value={form.type} onChange={setField('type')}>
              <option value="">Select type…</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-location" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Location
            </label>
            <input id="pf-location" className={inputCls} value={form.location} onChange={setField('location')} placeholder="Batangas City" />
            {errors.location && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.location}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pf-area" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Lot Area (sqm)
            </label>
            <input id="pf-area" type="number" min="0" step="any" className={inputCls} value={form.lot_area_sqm} onChange={setField('lot_area_sqm')} placeholder="150" />
          </div>

          <div>
            <label htmlFor="pf-price" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Price (PHP)
            </label>
            <input id="pf-price" type="number" min="0" step="any" className={inputCls} value={form.price} onChange={setField('price')} placeholder="1500000" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-description" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Description (optional)
            </label>
            <textarea id="pf-description" rows="3" className={`${inputCls} resize-y`} value={form.description} onChange={setField('description')} placeholder="Short description…" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-image" className="mb-1.5 block text-sm font-semibold text-brand-deep">
              Image
            </label>
            <input id="pf-image" type="file" accept="image/*" className={inputCls} onChange={(e) => setImageFile(e.target.files[0] ?? null)} />
            {(imageUrl || imageFile) && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                  alt=""
                  className="size-16 rounded-md border border-mist object-cover"
                />
                {imageUrl && !imageFile && <span className="text-xs text-ink/50">Current image on file</span>}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="pf-pinned" type="checkbox" className="size-4 accent-brand" checked={form.is_pinned} onChange={setField('is_pinned')} />
            <label htmlFor="pf-pinned" className="text-sm font-semibold text-brand-deep">
              Pin to website
            </label>
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/PropertyForm.test.jsx`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PropertyForm.test.jsx src/components/admin/PropertyForm.jsx
git commit -m "feat: add property add/edit form with image upload"
```

---

## Task 11: Admin properties list — pin, edit, delete (TDD)

**Files:**
- Create: `src/components/admin/AdminProperties.test.jsx`
- Create: `src/components/admin/AdminProperties.jsx`

- [ ] **Step 1: Write the failing test — `src/components/admin/AdminProperties.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminProperties from './AdminProperties.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchProperties: vi.fn(),
  setPropertyPinned: vi.fn(),
  deleteProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
}))

import { fetchProperties, setPropertyPinned, deleteProperty } from '../../lib/api.js'

const sample = [
  { id: 'p1', name: 'Lot A', type: 'residential lot', location: 'Batangas City', lot_area_sqm: 150, price: 1500000, description: null, image_url: null, is_pinned: false },
  { id: 'p2', name: 'Lot B', type: 'commercial lot', location: 'Lipa', lot_area_sqm: 300, price: 3000000, description: null, image_url: null, is_pinned: true },
]

describe('AdminProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchProperties.mockResolvedValue(sample)
  })

  it('lists properties with pinned state', async () => {
    render(<AdminProperties />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('Lot B')).toBeInTheDocument()
    expect(screen.getByText('Pinned')).toBeInTheDocument()
  })

  it('pins a property optimistically and persists it', async () => {
    setPropertyPinned.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(setPropertyPinned).toHaveBeenCalledWith('p1', true)
    expect(screen.getAllByRole('button', { name: 'Pinned' })).toHaveLength(2)
  })

  it('reverts the pin toggle on failure and shows an error', async () => {
    setPropertyPinned.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()

    render(<AdminProperties />)

    const pinButtons = await screen.findAllByRole('button', { name: 'Pin' })
    await user.click(pinButtons[0])

    expect(await screen.findByText(/Could not update pin status/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Pin' })).toHaveLength(1)
  })

  it('deletes a property after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteProperty.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminProperties />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(deleteProperty).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Lot A')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('shows a retry state when loading fails', async () => {
    fetchProperties.mockResolvedValue(sample)
    fetchProperties.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()

    render(<AdminProperties />)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Lot A')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminProperties.test.jsx`
Expected: FAIL — module `./AdminProperties.jsx` not found.

- [ ] **Step 3: Create `src/components/admin/AdminProperties.jsx`**

```jsx
import { useCallback, useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import PropertyForm from './PropertyForm.jsx'
import { deleteProperty, fetchProperties, setPropertyPinned } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

export default function AdminProperties() {
  const [properties, setProperties] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    fetchProperties()
      .then((data) => {
        setProperties(data ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  const togglePin = async (property) => {
    const next = !property.is_pinned
    const prev = property.is_pinned
    setError(null)
    setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: next } : x)))
    try {
      await setPropertyPinned(property.id, next)
    } catch {
      setProperties((list) => list.map((x) => (x.id === property.id ? { ...x, is_pinned: prev } : x)))
      setError('Could not update pin status. Please try again.')
    }
  }

  const handleDelete = async (property) => {
    if (!window.confirm(`Delete "${property.name}"? This cannot be undone.`)) return
    setError(null)
    try {
      await deleteProperty(property.id)
      setProperties((list) => list.filter((x) => x.id !== property.id))
    } catch {
      setError('Could not delete property. Please try again.')
    }
  }

  const handleSaved = (saved) => {
    if (form?.mode === 'edit') {
      setProperties((list) => list.map((x) => (x.id === saved.id ? saved : x)))
    } else {
      setProperties((list) => [saved, ...list])
    }
    setForm(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Properties</h1>
        <button onClick={() => setForm({ mode: 'create' })} className="btn btn-gold">
          <Icon name="residential" className="size-4" />
          Add Property
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading properties…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load properties.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && properties.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No properties yet. Click “Add Property” to create one.
        </p>
      )}

      {status === 'ready' && properties.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                <th className="hidden px-4 py-3 md:table-cell">Location</th>
                <th className="hidden px-4 py-3 lg:table-cell">Price</th>
                <th className="px-4 py-3 text-center">Pinned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {property.image_url ? (
                        <img src={property.image_url} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-mist text-ink/40">
                          <Icon name="residential" className="size-5" />
                        </span>
                      )}
                      <div>
                        <p className="font-semibold text-brand-deep">{property.name}</p>
                        {property.lot_area_sqm != null && (
                          <p className="text-xs text-ink/50">{Number(property.lot_area_sqm).toLocaleString('en-PH')} sqm</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{property.type}</td>
                  <td className="hidden px-4 py-3 text-ink/70 md:table-cell">{property.location}</td>
                  <td className="hidden px-4 py-3 font-semibold text-ink lg:table-cell">{formatPrice(property.price) ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePin(property)}
                      aria-pressed={property.is_pinned}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        property.is_pinned
                          ? 'bg-gold text-brand-deep'
                          : 'border border-mist text-ink/50 hover:border-brand/40 hover:text-brand'
                      }`}
                    >
                      <Icon name="pin" className="size-3.5" />
                      {property.is_pinned ? 'Pinned' : 'Pin'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setForm({ mode: 'edit', property })}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <PropertyForm
          mode={form.mode}
          property={form.mode === 'edit' ? form.property : null}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminProperties.test.jsx`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminProperties.test.jsx src/components/admin/AdminProperties.jsx
git commit -m "feat: add admin properties list with pin, edit, and delete"
```

---

## Task 12: Admin inquiries list (TDD)

**Files:**
- Create: `src/components/admin/AdminInquiries.test.jsx`
- Create: `src/components/admin/AdminInquiries.jsx`

- [ ] **Step 1: Write the failing test — `src/components/admin/AdminInquiries.test.jsx`**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminInquiries from './AdminInquiries.jsx'

vi.mock('../../lib/api.js', () => ({
  fetchInquiries: vi.fn(),
  setInquiryRead: vi.fn(),
  deleteInquiry: vi.fn(),
}))

import { fetchInquiries, setInquiryRead, deleteInquiry } from '../../lib/api.js'

const sample = [
  { id: 'q1', name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567', project_type: 'Residential Construction', message: 'Build a house', is_read: false, created_at: '2026-08-16T01:00:00Z' },
  { id: 'q2', name: 'Maria Santos', email: 'maria@example.com', phone: '09181234567', project_type: null, message: 'Lot inquiry', is_read: true, created_at: '2026-08-16T02:00:00Z' },
]

describe('AdminInquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchInquiries.mockResolvedValue(sample)
  })

  it('lists inquiries with names and types', async () => {
    render(<AdminInquiries />)

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('Residential Construction')).toBeInTheDocument()
  })

  it('marks an unread inquiry as read', async () => {
    setInquiryRead.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const readButtons = await screen.findAllByRole('button', { name: 'Mark read' })
    await user.click(readButtons[0])

    expect(setInquiryRead).toHaveBeenCalledWith('q1', true)
    expect(screen.getAllByRole('button', { name: 'Mark unread' })).toHaveLength(2)
  })

  it('deletes an inquiry after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteInquiry.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AdminInquiries />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(deleteInquiry).toHaveBeenCalledWith('q1')
    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('expands an inquiry to show full details', async () => {
    const user = userEvent.setup()

    render(<AdminInquiries />)

    await user.click(await screen.findByText('Maria Santos'))

    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.getByText('09181234567')).toBeInTheDocument()
    expect(screen.getByText('Lot inquiry')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminInquiries.test.jsx`
Expected: FAIL — module `./AdminInquiries.jsx` not found.

- [ ] **Step 3: Create `src/components/admin/AdminInquiries.jsx`**

```jsx
import { useCallback, useEffect, useState } from 'react'
import { deleteInquiry, fetchInquiries, setInquiryRead } from '../../lib/api.js'

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    fetchInquiries()
      .then((data) => {
        setInquiries(data ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  const toggleRead = async (inquiry) => {
    const next = !inquiry.is_read
    const prev = inquiry.is_read
    setError(null)
    setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: next } : x)))
    try {
      await setInquiryRead(inquiry.id, next)
    } catch {
      setInquiries((list) => list.map((x) => (x.id === inquiry.id ? { ...x, is_read: prev } : x)))
      setError('Could not update status. Please try again.')
    }
  }

  const handleDelete = async (inquiry) => {
    if (!window.confirm(`Delete inquiry from ${inquiry.name}?`)) return
    setError(null)
    try {
      await deleteInquiry(inquiry.id)
      setInquiries((list) => list.filter((x) => x.id !== inquiry.id))
    } catch {
      setError('Could not delete inquiry. Please try again.')
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">Inquiries</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="py-10 text-center text-ink/60">Loading inquiries…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load inquiries.</p>
          <button onClick={load} className="btn btn-gold">
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && inquiries.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No inquiries yet. Submissions from the contact form will appear here.
        </p>
      )}

      {status === 'ready' && inquiries.length > 0 && (
        <ul className="space-y-4">
          {inquiries.map((inquiry) => {
            const isExpanded = expanded === inquiry.id
            return (
              <li
                key={inquiry.id}
                className={`rounded-lg border bg-white p-5 ${inquiry.is_read ? 'border-mist' : 'border-brand/40 ring-1 ring-brand/20'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button className="text-left" onClick={() => setExpanded(isExpanded ? null : inquiry.id)} aria-expanded={isExpanded}>
                    <span className="flex items-center gap-2">
                      {!inquiry.is_read && <span className="size-2 rounded-full bg-brand" aria-hidden="true" />}
                      <span className="font-semibold text-brand-deep">{inquiry.name}</span>
                      <span className="text-sm text-ink/50">· {inquiry.project_type || 'General'}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/50">
                      {new Date(inquiry.created_at).toLocaleString('en-PH')}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleRead(inquiry)}
                      className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      {inquiry.is_read ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button
                      onClick={() => handleDelete(inquiry)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 rounded-md bg-surface p-4 text-sm leading-relaxed text-ink/80">
                    <p>
                      <span className="font-semibold text-brand-deep">Email:</span> {inquiry.email}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-brand-deep">Phone:</span> {inquiry.phone}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">{inquiry.message}</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminInquiries.test.jsx`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminInquiries.test.jsx src/components/admin/AdminInquiries.jsx
git commit -m "feat: add admin inquiries list"
```

---

## Task 13: Full verification + Supabase setup + deploy

**Files:**
- None (verification + external setup)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass — 5 (format) + 11 (api) + 3 (available properties) + 3 (contact) + 2 (login) + 3 (dashboard) + 4 (property form) + 5 (admin properties) + 4 (inquiries) + 1 (smoke) = **41 passing**.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 3: Run the dev server and manually verify the full flow locally**

Run: `npm run dev` and open the printed local URL.

Verify:
1. Public site loads; the **Available Properties** section shows an empty state (nothing pinned yet).
2. Contact form submits → green success banner (requires `.env` with real keys first, see Step 4).
3. Open `http://localhost:5173/admin` → redirected to `/admin/login`.
4. Sign in with the admin account (created in Step 5) → dashboard shows Properties.
5. Add a property (with image), pin it → it appears on the public site's Available Properties section (refresh `/`).
6. Unpin → disappears from public; Edit changes fields; Delete removes it.
7. Inquiries tab shows the inquiry submitted in step 2 with the unread indicator; expand, mark read, delete all work.

- [ ] **Step 4: Create `.env` for local dev**

Create `.env` in the project root (gitignored):
```
VITE_SUPABASE_URL=https://nfikkjuuzwphswutocao.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard: Settings → API>
```

- [ ] **Step 5: Set up Supabase (dashboard — one-time)**

1. **Schema:** Supabase dashboard → SQL Editor → paste the contents of `supabase/schema.sql` → **Run**. This creates both tables, RLS policies, the storage bucket, and its policies.
2. **Admin user:** Authentication → Users → **Add user** with email + password. Use this account to sign in at `/admin`.
3. **Storage:** Storage → confirm the `property-images` bucket exists (created by the script).

- [ ] **Step 6: Push and deploy to Vercel**

```bash
git push origin main
```

In Vercel dashboard (project is auto-deployed from `main`):
1. **Settings → Environment Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → **Save**.
2. **Deployments** → latest build → click **Redeploy** (so the env vars take effect).
3. Open the live URL: `/` shows pinned properties; `/admin` shows login; submit a contact inquiry and confirm it appears under Inquiries.

- [ ] **Step 7: Commit any leftover changes**

Run: `git status --short`
If clean, done. Otherwise commit leftovers with a sensible message.

---

## Self-Review Notes

- **Spec coverage:** properties schema ✓ (Task 2), public section ✓ (Task 5), contact DB submit ✓ (Task 6), `/admin` login ✓ (Task 8), guard ✓ (Task 9), CRUD + pin + upload ✓ (Tasks 10-11), inquiries ✓ (Task 12), SPA rewrite + env ✓ (Task 2), verification ✓ (Task 13).
- **Type/name consistency:** all API functions used in components match the exports defined in `src/lib/api.js`; the query-builder mock in `api.test.js` matches each function's exact chain; `is_pinned`/`is_read`/`project_type` snake_case is consistent between SQL, api layer, and component payloads.
- **No placeholders:** every step contains full code and exact commands.
