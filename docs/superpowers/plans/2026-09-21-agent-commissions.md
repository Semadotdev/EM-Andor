# Agent & Commission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a four-level agent hierarchy with lot-sale commissions, earned/paid payout tracking, rule-based promotions, and role-gated admin/agent dashboard tabs to the EM Andor site.

**Architecture:** Supabase Postgres gains `agents`, `commission_settings`, and `commissions` tables plus role-based RLS helper functions; a single Supabase Edge Function provisions auth users because that needs the service-role key. Pure business logic (commission math, promotion rules) lives in `src/lib/` and is unit-tested; data access lives in `src/lib/agents.js` and `src/lib/sales.js`; the existing admin dashboard becomes role-gated and renders admin tabs or agent tabs.

**Tech Stack:** React 19, Vite 6, Tailwind CSS v4, react-router-dom 7, Vitest 4 + Testing Library, Supabase (Postgres, Auth, Edge Functions, Storage).

**Spec:** `docs/superpowers/specs/2026-09-21-agent-commissions-design.md`

---

## File Structure

**New files:**

| File | Responsibility |
| --- | --- |
| `src/lib/commissions.js` | Pure commission validation + row builder (rate math, chain limits) |
| `src/lib/promotions.js` | Pure promotion rules + recursive downline role counting |
| `src/lib/agentMeta.js` | Pure role labels + org tree builder (no Supabase import, safe to load in component tests) |
| `src/lib/agents.js` | Agent data access, activation, promotion cascade, commission rates |
| `src/lib/sales.js` | Sale recording/commission generation, commission reads, mark paid, my/team sales |
| `supabase/functions/create-agent/index.ts` | Admin-only auth-user + agent-row provisioning (service role) |
| `src/components/admin/AdminAgents.jsx` | Agents tab: tree, activation, eligibility, per-agent detail |
| `src/components/admin/CreateAgentModal.jsx` | Create agent form calling the Edge Function |
| `src/components/admin/AdminCommissions.jsx` | Rates panel, all commissions, mark paid |
| `src/components/admin/AgentStats.jsx` | Agent-facing summary cards |
| `src/components/admin/AgentLots.jsx` | Available lots list |
| `src/components/admin/AgentSales.jsx` | Agent's own sold lots |
| `src/components/admin/AgentCommissions.jsx` | Agent's own commission rows + totals |
| `src/components/admin/AgentDownline.jsx` | Downline members with sales/commission totals |
| Co-located `*.test.js(x)` | Unit + component tests for every module above |

**Modified files:**

| File | Change |
| --- | --- |
| `supabase/schema.sql` | New tables/columns, helper functions, role-based policy replacement |
| `src/components/admin/AdminDashboard.jsx` | Resolve agent role, render admin or agent tabs |
| `src/components/admin/AdminDashboard.test.jsx` | Mock `agents.js`, cover both role paths |
| `src/components/admin/PropertyForm.jsx` | Selling-agent select when sold; save via `savePropertyWithCommission` |
| `src/components/admin/PropertyForm.test.jsx` | Mock `sales.js`, cover sold and unsold saves |
| `src/components/admin/AdminProperties.jsx` | "Sold by" display using an agent-name map |

**Dependency direction:** `commissions.js`, `promotions.js`, and `agentMeta.js` are pure. `agents.js` imports `supabase.js`, `api.js` (`logActivity`), and `promotions.js`. `sales.js` imports `supabase.js`, `api.js`, `commissions.js`, and `agents.js`. Components import the libs and `agentMeta.js`. No cycles.

---

## Milestone A — Database foundation & pure logic

### Task 1: Commission math library

**Files:**
- Create: `src/lib/commissions.js`
- Test: `src/lib/commissions.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest'
import { buildCommissionRows, formatRate, validateSale } from './commissions.js'

const rates = { sub_agent: 0.03, direct_agent: 0.015, agent_head: 0.005 }

const sub = { id: 'a1', name: 'Sub', role: 'sub_agent' }
const direct = { id: 'a2', name: 'Direct', role: 'direct_agent' }
const head = { id: 'a3', name: 'Head', role: 'agent_head' }

describe('commissions', () => {
  it('builds one row per chain level at that level rate', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct, head], rates)

    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { agent_id: 'a1', role_at_sale: 'sub_agent', sale_price: 1000000, rate: 0.03, amount: 30000 },
      { agent_id: 'a2', role_at_sale: 'direct_agent', sale_price: 1000000, rate: 0.015, amount: 15000 },
      { agent_id: 'a3', role_at_sale: 'agent_head', sale_price: 1000000, rate: 0.005, amount: 5000 },
    ])
  })

  it('skips agents with no configured rate and warns', () => {
    const { rows, warnings } = buildCommissionRows(1000000, [sub, direct], { sub_agent: 0.03 })

    expect(rows).toHaveLength(1)
    expect(warnings).toEqual(['No commission rate configured for direct_agent; skipped Direct.'])
  })

  it('skips a zero or negative rate and warns', () => {
    const zero = buildCommissionRows(1000000, [sub], { sub_agent: 0 })
    const negative = buildCommissionRows(1000000, [sub], { sub_agent: -0.01 })

    expect(zero.rows).toEqual([])
    expect(zero.warnings).toEqual(['No commission rate configured for sub_agent; skipped Sub.'])
    expect(negative.rows).toEqual([])
  })

  it('never builds more than three levels', () => {
    const fourth = { id: 'a4', name: 'Fourth', role: 'sub_agent' }
    const { rows } = buildCommissionRows(1000000, [sub, direct, head, fourth], rates)

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.agent_id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('de-duplicates agents and rounds amounts to centavos', () => {
    const { rows } = buildCommissionRows(333333, [{ ...sub }, sub], { sub_agent: 0.0333 })

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(11099.99)
  })

  it('rejects zero or missing price and missing seller', () => {
    expect(validateSale({ price: '', sold_by: 'a1' })).toEqual({ price: 'Set a price before marking this property sold.' })
    expect(validateSale({ price: 0, sold_by: null })).toEqual({
      price: 'Set a price before marking this property sold.',
      sold_by: 'Select the selling agent.',
    })
    expect(validateSale({ price: 1500000, sold_by: 'a1' })).toEqual({})
  })

  it('formats rates as percentages', () => {
    expect(formatRate(0.03)).toBe('3.00%')
    expect(formatRate(null)).toBe('—')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/commissions.test.js`
Expected: FAIL — cannot resolve `./commissions.js`.

- [ ] **Step 3: Write the implementation**

```js
export const COMMISSION_ROLES = ['sub_agent', 'direct_agent', 'agent_head']
export const MAX_COMMISSION_LEVELS = 3

export function formatRate(rate) {
  const num = Number(rate)
  if (rate === null || rate === undefined || Number.isNaN(num)) return '—'
  return `${(num * 100).toFixed(2)}%`
}

export function validateSale({ price, sold_by }) {
  const errors = {}
  const numPrice = Number(price)
  if (price === '' || price === null || price === undefined || Number.isNaN(numPrice) || numPrice <= 0) {
    errors.price = 'Set a price before marking this property sold.'
  }
  if (!sold_by) {
    errors.sold_by = 'Select the selling agent.'
  }
  return errors
}

export function buildCommissionRows(price, chain, rates) {
  const rows = []
  const warnings = []
  const seen = new Set()
  const salePrice = Number(price)

  for (const agent of chain.slice(0, MAX_COMMISSION_LEVELS)) {
    if (!agent?.id || agent.role === 'admin' || seen.has(agent.id)) continue
    seen.add(agent.id)
    const rate = Number(rates?.[agent.role])
    if (!(rate > 0)) {
      warnings.push(`No commission rate configured for ${agent.role}; skipped ${agent.name ?? agent.id}.`)
      continue
    }
    rows.push({
      agent_id: agent.id,
      role_at_sale: agent.role,
      sale_price: salePrice,
      rate,
      amount: Math.round(salePrice * rate * 100) / 100,
    })
  }

  return { rows, warnings }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/commissions.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/commissions.js src/lib/commissions.test.js
git commit -m "feat: add pure commission math library"
```

---

### Task 2: Promotion rules library

**Files:**
- Create: `src/lib/promotions.js`
- Test: `src/lib/promotions.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest'
import {
  computePromotion,
  countDirectRecruits,
  countDownlineDirectAgents,
  eligibleAgents,
} from './promotions.js'

const agent = (id, role, upline_id = null, is_active = true) => ({ id, name: id, role, upline_id, is_active })

describe('promotions', () => {
  it('promotes a sub agent with 5 own sales and 5 recruits', () => {
    expect(computePromotion({ role: 'sub_agent', ownSales: 5, directRecruits: 5 })).toEqual({
      eligibleFor: 'direct_agent',
      counts: { ownSales: 5, directRecruits: 5 },
    })
    expect(computePromotion({ role: 'sub_agent', ownSales: 5, directRecruits: 4 }).eligibleFor).toBeNull()
    expect(computePromotion({ role: 'sub_agent', ownSales: 4, directRecruits: 5 }).eligibleFor).toBeNull()
  })

  it('promotes a direct agent when 5 direct agents are in the downline', () => {
    expect(computePromotion({ role: 'direct_agent', downlineDirectAgents: 5 }).eligibleFor).toBe('agent_head')
    expect(computePromotion({ role: 'direct_agent', downlineDirectAgents: 4 }).eligibleFor).toBeNull()
  })

  it('never promotes an agent head or admin', () => {
    expect(computePromotion({ role: 'agent_head', ownSales: 99, directRecruits: 99 }).eligibleFor).toBeNull()
    expect(computePromotion({ role: 'admin' }).eligibleFor).toBeNull()
  })

  it('counts only active direct recruits', () => {
    const agents = [
      agent('a1', 'sub_agent'),
      agent('r1', 'sub_agent', 'a1'),
      agent('r2', 'sub_agent', 'a1', false),
      agent('r3', 'direct_agent', 'other'),
    ]
    expect(countDirectRecruits(agents, 'a1')).toBe(1)
  })

  it('counts direct agents anywhere below, not just one level down', () => {
    const agents = [
      agent('head1', 'agent_head'),
      agent('d1', 'direct_agent', 'head1'),
      agent('d2', 'direct_agent', 'd1'),
      agent('s1', 'sub_agent', 'd2'),
      agent('d3', 'direct_agent', 's1'),
      agent('d4', 'direct_agent', 's1', false),
    ]
    expect(countDownlineDirectAgents(agents, 'head1')).toBe(3)
  })

  it('returns every agent that is currently eligible', () => {
    const agents = [agent('s1', 'sub_agent')]
    for (let i = 0; i < 5; i++) agents.push(agent(`r${i}`, 'sub_agent', 's1'))
    const eligible = eligibleAgents(agents, { s1: 5 })

    expect(eligible.get('s1').eligibleFor).toBe('direct_agent')
    expect(eligible.get('s1').counts).toEqual({ ownSales: 5, directRecruits: 5 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/promotions.test.js`
Expected: FAIL — cannot resolve `./promotions.js`.

- [ ] **Step 3: Write the implementation**

```js
export const PROMOTION_THRESHOLDS = {
  sub_to_direct_sales: 5,
  sub_to_direct_recruits: 5,
  direct_to_head_direct_agents: 5,
}

export function computePromotion({ role, ownSales = 0, directRecruits = 0, downlineDirectAgents = 0 }) {
  if (role === 'sub_agent') {
    const eligible =
      ownSales >= PROMOTION_THRESHOLDS.sub_to_direct_sales &&
      directRecruits >= PROMOTION_THRESHOLDS.sub_to_direct_recruits
    return { eligibleFor: eligible ? 'direct_agent' : null, counts: { ownSales, directRecruits } }
  }
  if (role === 'direct_agent') {
    const eligible = downlineDirectAgents >= PROMOTION_THRESHOLDS.direct_to_head_direct_agents
    return { eligibleFor: eligible ? 'agent_head' : null, counts: { downlineDirectAgents } }
  }
  return { eligibleFor: null, counts: {} }
}

export function countDirectRecruits(agents, agentId) {
  return agents.filter((a) => a.upline_id === agentId && a.is_active !== false).length
}

export function childrenOf(agents) {
  const map = new Map()
  for (const a of agents) {
    if (!a.upline_id) continue
    if (!map.has(a.upline_id)) map.set(a.upline_id, [])
    map.get(a.upline_id).push(a)
  }
  return map
}

export function countDownlineDirectAgents(agents, agentId) {
  const map = childrenOf(agents)
  const seen = new Set()
  const stack = [agentId]
  let count = 0

  while (stack.length > 0) {
    const id = stack.pop()
    for (const child of map.get(id) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      if (child.role === 'direct_agent' && child.is_active !== false) count++
      stack.push(child.id)
    }
  }
  return count
}

export function eligibleAgents(agents, soldCounts = {}) {
  const result = new Map()
  for (const agent of agents) {
    if (agent.role === 'admin' || agent.is_active === false) continue
    const { eligibleFor, counts } = computePromotion({
      role: agent.role,
      ownSales: soldCounts[agent.id] ?? 0,
      directRecruits: countDirectRecruits(agents, agent.id),
      downlineDirectAgents: countDownlineDirectAgents(agents, agent.id),
    })
    if (eligibleFor) result.set(agent.id, { agent, eligibleFor, counts })
  }
  return result
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/promotions.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/promotions.js src/lib/promotions.test.js
git commit -m "feat: add pure promotion rules library"
```

---

### Task 3: Schema — agent tables, commission tables, property columns

**Files:**
- Modify: `supabase/schema.sql`

There is no automated test for this task: `schema.sql` is a client-side, manually applied file (matching the existing repo convention), verified by review and later by the setup checklist.

- [ ] **Step 1: Insert the new tables, columns, and RLS helpers**

In `supabase/schema.sql`, find this exact anchor line:

```sql
alter table public.properties enable row level security;
```

Insert the following block **immediately before it**:

```sql
-- Agents
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'sub_agent' check (role in ('admin', 'agent_head', 'direct_agent', 'sub_agent')),
  upline_id uuid references public.agents(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_user_id_idx on public.agents(user_id);
create index if not exists agents_upline_id_idx on public.agents(upline_id);

-- Commission rates per role
create table if not exists public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  role text unique not null check (role in ('sub_agent', 'direct_agent', 'agent_head')),
  rate numeric(6,4) not null default 0 check (rate >= 0 and rate <= 1),
  updated_at timestamptz not null default now()
);

insert into public.commission_settings (role, rate) values
  ('sub_agent', 0.0300),
  ('direct_agent', 0.0150),
  ('agent_head', 0.0050)
on conflict (role) do nothing;

-- Commission ledger: one snapshot row per agent per sale
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  role_at_sale text not null,
  sale_price numeric not null,
  rate numeric(6,4) not null,
  amount numeric not null,
  status text not null default 'earned' check (status in ('earned', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, agent_id)
);

create index if not exists commissions_agent_id_idx on public.commissions(agent_id);
create index if not exists commissions_status_idx on public.commissions(status);

-- Sale attribution on properties
alter table public.properties add column if not exists sold_by uuid references public.agents(id) on delete set null;
alter table public.properties add column if not exists sold_at timestamptz;

-- RLS helper functions (security definer so policies cannot recurse)
create or replace function public.current_agent_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.agents where user_id = auth.uid() and is_active limit 1 $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.agents where user_id = auth.uid() and role = 'admin' and is_active) $$;

create or replace function public.get_downline(root uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  with recursive d as (
    select id from public.agents where root is not null and upline_id = root
    union
    select a.id from public.agents a join d on a.upline_id = d.id
  )
  select id from d;
$$;

alter table public.agents enable row level security;
alter table public.commission_settings enable row level security;
alter table public.commissions enable row level security;
```

- [ ] **Step 2: Add RLS policies for the new tables**

Immediately after the block from Step 1 (still before `alter table public.properties enable row level security;`), add:

```sql
drop policy if exists "admin all on agents" on public.agents;
create policy "admin all on agents" on public.agents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "agent read self and downline" on public.agents;
create policy "agent read self and downline" on public.agents
  for select to authenticated
  using (
    user_id = auth.uid()
    or id in (select public.get_downline(public.current_agent_id()))
  );

drop policy if exists "admin all on commission_settings" on public.commission_settings;
create policy "admin all on commission_settings" on public.commission_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "authenticated read commission_settings" on public.commission_settings;
create policy "authenticated read commission_settings" on public.commission_settings
  for select to authenticated using (true);

drop policy if exists "admin all on commissions" on public.commissions;
create policy "admin all on commissions" on public.commissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "agent read commissions" on public.commissions;
create policy "agent read commissions" on public.commissions
  for select to authenticated
  using (
    agent_id = public.current_agent_id()
    or agent_id in (select public.get_downline(public.current_agent_id()))
  );
```

- [ ] **Step 2b: Attach the new updated_at triggers after the function definition**

`set_updated_at()` is defined later in the file (in the `-- updated_at trigger` section), so creating the triggers above would fail on a fresh database. Find this existing block:

```sql
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
```

Insert immediately after it:

```sql
drop trigger if exists set_updated_at on public.agents;
create trigger set_updated_at before update on public.agents
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.commission_settings;
create trigger set_updated_at before update on public.commission_settings
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): add agents, commission settings, and commissions tables"
```

---

### Task 4: Schema — replace email-hardcoded policies with role-based policies

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Replace the properties + inquiries admin block**

Find and delete this block:

```sql
do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on properties" on public.properties;
  execute format(
    'create policy "admin all on properties" on public.properties
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );

  drop policy if exists "admin all on inquiries" on public.inquiries;
  execute format(
    'create policy "admin all on inquiries" on public.inquiries
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

Replace it with:

```sql
drop policy if exists "admin all on properties" on public.properties;
create policy "admin all on properties" on public.properties
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "agent read properties" on public.properties;
create policy "agent read properties" on public.properties
  for select to authenticated
  using (
    status = 'available'
    or sold_by = public.current_agent_id()
    or sold_by in (select public.get_downline(public.current_agent_id()))
  );

drop policy if exists "admin all on inquiries" on public.inquiries;
create policy "admin all on inquiries" on public.inquiries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 2: Replace the activity_log admin block**

Find:

```sql
do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on activity_log" on public.activity_log;
  execute format(
    'create policy "admin all on activity_log" on public.activity_log
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

Replace with:

```sql
drop policy if exists "admin all on activity_log" on public.activity_log;
create policy "admin all on activity_log" on public.activity_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 3: Replace the cms_content admin block**

Find:

```sql
do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on cms_content" on public.cms_content;
  execute format(
    'create policy "admin all on cms_content" on public.cms_content
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

Replace with:

```sql
drop policy if exists "admin all on cms_content" on public.cms_content;
create policy "admin all on cms_content" on public.cms_content
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 4: Replace the notification_settings admin block**

Find:

```sql
do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on notification_settings" on public.notification_settings;
  execute format(
    'create policy "admin all on notification_settings" on public.notification_settings
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

Replace with:

```sql
drop policy if exists "admin all on notification_settings" on public.notification_settings;
create policy "admin all on notification_settings" on public.notification_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 5: Replace the notification_history admin block**

Find:

```sql
do $$
declare admin_email text := 'admin@gmail.com';
begin
  drop policy if exists "admin all on notification_history" on public.notification_history;
  execute format(
    'create policy "admin all on notification_history" on public.notification_history
       for all to authenticated
       using (auth.jwt() ->> ''email'' = %L)
       with check (auth.jwt() ->> ''email'' = %L)',
    admin_email, admin_email
  );
end $$;
```

Replace with:

```sql
drop policy if exists "admin all on notification_history" on public.notification_history;
create policy "admin all on notification_history" on public.notification_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 6: Restrict the storage admin policies to real admins**

Find the four storage policies and add `and public.is_admin()` to each. The four replacements, one at a time:

```sql
drop policy if exists "admin read property-images" on storage.objects;
create policy "admin read property-images" on storage.objects
  for select to authenticated using (bucket_id = 'property-images' and public.is_admin());
```

```sql
drop policy if exists "admin insert property-images" on storage.objects;
create policy "admin insert property-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-images' and public.is_admin());
```

```sql
drop policy if exists "admin update property-images" on storage.objects;
create policy "admin update property-images" on storage.objects
  for update to authenticated using (bucket_id = 'property-images' and public.is_admin())
  with check (bucket_id = 'property-images' and public.is_admin());
```

```sql
drop policy if exists "admin delete property-images" on storage.objects;
create policy "admin delete property-images" on storage.objects
  for delete to authenticated using (bucket_id = 'property-images' and public.is_admin());
```

- [ ] **Step 7: Append the admin bootstrap snippet as a comment**

At the very end of `supabase/schema.sql`, append:

```sql
-- Bootstrap the admin agent row after creating the login in Authentication → Users.
-- Run this in the SAME maintenance session as this schema change: until it runs, the
-- existing admin account has no access (all admin policies require public.is_admin()).
-- If the select finds no matching auth user it inserts 0 rows and still reports success,
-- leaving the admin locked out — always verify with the select below.
-- insert into public.agents (user_id, email, name, role)
-- select id, email, 'Admin', 'admin' from auth.users where email = 'admin@gmail.com'
-- on conflict (email) do update set role = 'admin', user_id = excluded.user_id, is_active = true;
-- verify (must return exactly 1 row: role = 'admin', is_active = true, user_id not null):
-- select id, email, role, user_id, is_active from public.agents where email = 'admin@gmail.com';
```

- [ ] **Step 7b: Move the `status` column addition before its first policy use**

The new `agent read properties` policy references `properties.status`, but `alter table public.properties add column if not exists status ...` currently appears later in the file (in the activity-log section), so a fresh database install would fail with `column "status" does not exist`.

Find and delete:

```sql
-- Add status to properties
alter table public.properties add column if not exists status text not null default 'available';
```

Insert it immediately before:

```sql
alter table public.properties enable row level security;
```

- [ ] **Step 8: Verify no stale email checks remain**

Run: `grep -n "admin_email\|auth.jwt()" supabase/schema.sql`
Expected: only the commented bootstrap block mentions `admin@gmail.com`; no `admin_email` or `auth.jwt()` code remains.

- [ ] **Step 9: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): replace email-hardcoded admin policies with role-based RLS"
```

---

## Milestone B — API layers & agent provisioning

### Task 5: Agent metadata + data access

**Files:**
- Create: `src/lib/agentMeta.js`
- Test: `src/lib/agentMeta.test.js`
- Create: `src/lib/agents.js`
- Test: `src/lib/agents.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  fetchAllAgents,
  fetchCommissionRates,
  fetchCommissionRatesMap,
  fetchCurrentAgent,
  fetchMyDownline,
  setAgentActive,
  updateCommissionRates,
} from './agents.js'

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))
vi.mock('./api.js', () => ({ logActivity: vi.fn(() => Promise.resolve()) }))

import { supabase } from './supabase.js'
import { logActivity } from './api.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'neq', 'in', 'upsert']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return c
}

const admin = { id: 'admin1', user_id: 'u-admin', email: 'admin@x.com', name: 'Admin', role: 'admin', is_active: true }
const sub = { id: 'a1', user_id: 'u1', email: 'sub@x.com', name: 'Sub', role: 'sub_agent', upline_id: null, is_active: true }

describe('agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockReset()
  })

  it('fetchCurrentAgent resolves the signed-in user row', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const c = chain({ data: sub, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchCurrentAgent()

    expect(supabase.from).toHaveBeenCalledWith('agents')
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(c.single).toHaveBeenCalled()
    expect(result).toEqual(sub)
  })

  it('fetchAllAgents returns every row', async () => {
    supabase.from.mockReturnValue(chain({ data: [admin, sub], error: null }))

    const result = await fetchAllAgents()

    expect(result).toEqual([admin, sub])
  })

  it('fetchMyDownline excludes self and admin rows', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    supabase.from
      .mockImplementationOnce(() => chain({ data: sub, error: null }))
      .mockImplementationOnce(() => chain({ data: [admin, sub, { ...sub, id: 'a2', name: 'Downline' }], error: null }))

    const result = await fetchMyDownline()

    expect(result).toEqual([{ ...sub, id: 'a2', name: 'Downline' }])
  })

  it('setAgentActive updates the flag and logs it', async () => {
    const updated = { ...sub, is_active: false }
    const c = chain({ data: updated, error: null })
    supabase.from.mockReturnValue(c)

    const result = await setAgentActive('a1', false)

    expect(c.update).toHaveBeenCalledWith({ is_active: false })
    expect(c.eq).toHaveBeenCalledWith('id', 'a1')
    expect(result).toEqual(updated)
    expect(logActivity).toHaveBeenCalledWith('agent', 'a1', 'deactivate')
  })

  it('fetchCommissionRates returns configured rows', async () => {
    const rows = [{ role: 'sub_agent', rate: 0.03 }]
    supabase.from.mockReturnValue(chain({ data: rows, error: null }))

    expect(await fetchCommissionRates()).toEqual(rows)
  })

  it('fetchCommissionRatesMap coerces rates to numbers', async () => {
    supabase.from.mockReturnValue(chain({ data: [{ role: 'sub_agent', rate: '0.0300' }], error: null }))

    expect(await fetchCommissionRatesMap()).toEqual({ sub_agent: 0.03 })
  })

  it('updateCommissionRates upserts by role', async () => {
    const c = chain({ data: [], error: null })
    supabase.from.mockReturnValue(c)

    await updateCommissionRates({ sub_agent: 0.05 })

    expect(supabase.from).toHaveBeenCalledWith('commission_settings')
    expect(c.upsert).toHaveBeenCalledWith([{ role: 'sub_agent', rate: 0.05 }], { onConflict: 'role' })
  })
})
```

- [ ] **Step 1b: Write the agentMeta tests**

Create `src/lib/agentMeta.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { ROLE_LABELS, buildAgentTree } from './agentMeta.js'

const admin = { id: 'admin1', name: 'Admin', role: 'admin', upline_id: null, is_active: true }
const sub = { id: 'a1', name: 'Sub', role: 'sub_agent', upline_id: null, is_active: true }

describe('agentMeta', () => {
  it('labels every role', () => {
    expect(ROLE_LABELS).toEqual({
      admin: 'Admin',
      agent_head: 'Agent Head',
      direct_agent: 'Direct Agent',
      sub_agent: 'Sub Agent',
    })
  })

  it('nests children under their upline', () => {
    const tree = buildAgentTree([admin, { ...sub, id: 'a2', upline_id: 'a1' }, sub])

    expect(tree).toHaveLength(2)
    const subNode = tree.find((n) => n.id === 'a1')
    expect(subNode.children.map((c) => c.id)).toEqual(['a2'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/agents.test.js src/lib/agentMeta.test.js`
Expected: FAIL — cannot resolve `./agents.js` and `./agentMeta.js`.

- [ ] **Step 3: Write the implementations**

Create `src/lib/agentMeta.js` (pure — no Supabase import, so component tests can load it without mocking):

```js
export const ROLE_LABELS = {
  admin: 'Admin',
  agent_head: 'Agent Head',
  direct_agent: 'Direct Agent',
  sub_agent: 'Sub Agent',
}

export function buildAgentTree(agents) {
  const byId = new Map(agents.map((a) => [a.id, { ...a, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    if (node.upline_id && byId.has(node.upline_id)) {
      byId.get(node.upline_id).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
```

Create `src/lib/agents.js`:

```js
import { supabase } from './supabase.js'
import { logActivity } from './api.js'

export async function fetchCurrentAgent() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No active session.')
  const { data, error } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
  if (error) throw error
  return data
}

export async function fetchAllAgents() {
  const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchMyDownline() {
  const me = await fetchCurrentAgent()
  const { data, error } = await supabase.from('agents').select('*').neq('id', me.id).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).filter((a) => a.role !== 'admin' && a.id !== me.id)
}

export async function setAgentActive(id, isActive) {
  const { data, error } = await supabase.from('agents').update({ is_active: isActive }).eq('id', id).select().single()
  if (error) throw error
  logActivity('agent', id, isActive ? 'activate' : 'deactivate').catch(() => {})
  return data
}

export async function fetchCommissionRates() {
  const { data, error } = await supabase.from('commission_settings').select('*').order('role')
  if (error) throw error
  return data ?? []
}

export async function fetchCommissionRatesMap() {
  const rows = await fetchCommissionRates()
  return Object.fromEntries(rows.map((r) => [r.role, Number(r.rate)]))
}

export async function updateCommissionRates(rates) {
  const rows = Object.entries(rates).map(([role, rate]) => ({ role, rate: Number(rate) }))
  const { data, error } = await supabase.from('commission_settings').upsert(rows, { onConflict: 'role' }).select()
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/agents.test.js src/lib/agentMeta.test.js`
Expected: PASS — 9 tests (7 data + 2 meta).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agentMeta.js src/lib/agentMeta.test.js src/lib/agents.js src/lib/agents.test.js
git commit -m "feat: add agent metadata and data access layer"
```

---

### Task 6: Sold-lot counts and the promotion cascade

**Files:**
- Modify: `src/lib/agents.js`
- Modify: `src/lib/agents.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/agents.test.js` (add the new imports to the existing import list):

```js
import { applyEligiblePromotions, fetchSoldCounts } from './agents.js'
```

```js
  it('fetchSoldCounts aggregates sold lots per agent', async () => {
    supabase.from.mockReturnValue(
      chain({
        data: [{ sold_by: 'a1' }, { sold_by: 'a1' }, { sold_by: 'a2' }, { sold_by: null }],
        error: null,
      }),
    )

    expect(await fetchSoldCounts()).toEqual({ a1: 2, a2: 1 })
  })

  it('applyEligiblePromotions promotes an eligible sub agent and logs it', async () => {
    const recruits = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      name: `Recruit ${i}`,
      role: 'sub_agent',
      upline_id: 'a1',
      is_active: true,
    }))
    const agents = [{ ...sub, id: 'a1' }, ...recruits]
    const sold = Array.from({ length: 5 }, () => ({ sold_by: 'a1' }))
    const updateChain = chain({ data: { ...sub, role: 'direct_agent' }, error: null })

    supabase.from
      .mockImplementationOnce(() => chain({ data: agents, error: null }))
      .mockImplementationOnce(() => chain({ data: sold, error: null }))
      .mockImplementationOnce(() => updateChain)
      .mockImplementationOnce(() => chain({ data: [{ ...sub, role: 'direct_agent' }, ...recruits], error: null }))
      .mockImplementationOnce(() => chain({ data: sold, error: null }))

    const promoted = await applyEligiblePromotions()

    expect(updateChain.update).toHaveBeenCalledWith({ role: 'direct_agent' })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'a1')
    expect(promoted).toEqual([{ id: 'a1', name: 'Sub', from: 'sub_agent', to: 'direct_agent' }])
    expect(logActivity).toHaveBeenCalledWith('agent', 'a1', 'promote', {
      from: 'sub_agent',
      to: 'direct_agent',
      counts: { ownSales: 5, directRecruits: 5 },
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/agents.test.js`
Expected: FAIL — `applyEligiblePromotions is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/lib/agents.js` (import `eligibleAgents` at the top):

```js
import { eligibleAgents } from './promotions.js'
```

```js
export async function fetchSoldCounts() {
  const { data, error } = await supabase.from('properties').select('sold_by').eq('status', 'sold')
  if (error) throw error
  const counts = {}
  for (const row of data ?? []) {
    if (!row.sold_by) continue
    counts[row.sold_by] = (counts[row.sold_by] ?? 0) + 1
  }
  return counts
}

export async function applyEligiblePromotions() {
  const promoted = []
  for (let pass = 0; pass < 10; pass++) {
    const [agents, soldCounts] = await Promise.all([fetchAllAgents(), fetchSoldCounts()])
    const eligible = eligibleAgents(agents, soldCounts)
    let changed = false

    for (const { agent, eligibleFor, counts } of eligible.values()) {
      const { error } = await supabase.from('agents').update({ role: eligibleFor }).eq('id', agent.id)
      if (error) throw error
      logActivity('agent', agent.id, 'promote', { from: agent.role, to: eligibleFor, counts }).catch(() => {})
      promoted.push({ id: agent.id, name: agent.name, from: agent.role, to: eligibleFor })
      changed = true
    }

    if (!changed) break
  }
  return promoted
}
```

Then update `setAgentActive` so re-activating an agent re-evaluates the upline's eligibility (fire-and-forget so activation cannot fail because of the refresh):

```js
export async function setAgentActive(id, isActive) {
  const { data, error } = await supabase.from('agents').update({ is_active: isActive }).eq('id', id).select().single()
  if (error) throw error
  logActivity('agent', id, isActive ? 'activate' : 'deactivate').catch(() => {})
  if (isActive) applyEligiblePromotions().catch(() => {})
  return data
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/agents.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents.js src/lib/agents.test.js
git commit -m "feat: add sold-lot counting and promotion cascade"
```

---

### Task 7: Create agent through the Edge Function

**Files:**
- Modify: `src/lib/agents.js`
- Modify: `src/lib/agents.test.js`

- [ ] **Step 1: Write the failing tests**

Add `createAgent` to the import list in `src/lib/agents.test.js`, then append:

```js
  it('createAgent invokes the edge function and returns the new agent', async () => {
    const created = { id: 'a9', name: 'New', email: 'new@x.com', role: 'sub_agent' }
    supabase.functions.invoke.mockResolvedValue({ data: { agent: created }, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: [], error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }))

    const result = await createAgent({
      name: 'New',
      email: 'new@x.com',
      phone: '0917',
      role: 'sub_agent',
      uplineId: 'a1',
      password: 'secret123',
    })

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-agent', {
      body: { name: 'New', email: 'new@x.com', phone: '0917', role: 'sub_agent', upline_id: 'a1', password: 'secret123' },
    })
    expect(supabase.from).toHaveBeenCalledWith('agents')
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(result).toEqual(created)
  })

  it('createAgent surfaces the edge function error body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'Email already registered' }) },
      },
    })

    await expect(
      createAgent({ name: 'New', email: 'new@x.com', role: 'sub_agent', password: 'secret123' }),
    ).rejects.toThrow('Email already registered')
  })

  it('createAgent falls back to the SDK message when there is no error body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Failed to send a request to the Edge Function' },
    })

    await expect(
      createAgent({ name: 'New', email: 'new@x.com', role: 'sub_agent', password: 'secret123' }),
    ).rejects.toThrow('Failed to send a request to the Edge Function')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/agents.test.js`
Expected: FAIL — `createAgent is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/lib/agents.js`:

```js
export async function createAgent({ name, email, phone, role, uplineId, password }) {
  const { data, error } = await supabase.functions.invoke('create-agent', {
    body: {
      name,
      email,
      phone: phone || null,
      role,
      upline_id: uplineId || null,
      password,
    },
  })

  if (error) {
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch {
      // keep the SDK message when the body cannot be read
    }
    throw new Error(message || 'Could not create the agent account.')
  }
  if (data?.error) throw new Error(data.error)

  const agent = data?.agent
  if (!agent) throw new Error('Could not create the agent account.')

  try {
    await applyEligiblePromotions()
  } catch {
    // The account already exists; a later trigger (or deactivate/reactivate) re-runs promotions.
  }
  return agent
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/agents.test.js`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents.js src/lib/agents.test.js
git commit -m "feat: provision agent accounts through the edge function"
```

---

### Task 8: Sale recording and commission generation

**Files:**
- Create: `src/lib/sales.js`
- Test: `src/lib/sales.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { savePropertyWithCommission } from './sales.js'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./api.js', () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  logActivity: vi.fn(() => Promise.resolve()),
}))
vi.mock('./agents.js', () => ({
  fetchAllAgents: vi.fn(),
  applyEligiblePromotions: vi.fn(() => Promise.resolve([])),
  fetchCommissionRatesMap: vi.fn(),
}))

import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'

function chain(result) {
  const c = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'insert', 'single', 'neq', 'in', 'upsert', 'limit', 'maybeSingle']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return c
}

const sub = { id: 'a1', name: 'Sub', role: 'sub_agent', upline_id: 'a2', is_active: true }
const direct = { id: 'a2', name: 'Direct', role: 'direct_agent', upline_id: null, is_active: true }
const property = { id: 'p1', name: 'Lot A', price: 1000000, status: 'sold', sold_by: 'a1' }

const soldPayload = { name: 'Lot A', price: 1000000, status: 'sold', sold_by: 'a1' }

describe('sales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a sold save without a price or seller', async () => {
    await expect(
      savePropertyWithCommission({ mode: 'create', payload: { ...soldPayload, price: '', sold_by: null } }),
    ).rejects.toMatchObject({ fieldErrors: { price: expect.any(String), sold_by: expect.any(String) } })
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('creates the property and one commission row per chain level', async () => {
    createProperty.mockResolvedValue(property)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null })
    supabase.from.mockImplementation(() => insertChain)

    const saved = await savePropertyWithCommission({ mode: 'create', payload: soldPayload })

    expect(createProperty).toHaveBeenCalledWith(expect.objectContaining({ ...soldPayload, sold_at: expect.any(String) }))
    expect(supabase.from).toHaveBeenCalledWith('commissions')
    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', role_at_sale: 'sub_agent', sale_price: 1000000, rate: 0.03, amount: 30000, status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'earned' }),
    ])
    expect(applyEligiblePromotions).toHaveBeenCalled()
    expect(saved).toEqual(property)
  })

  it('saves an available property without generating commissions', async () => {
    createProperty.mockResolvedValue({ ...property, status: 'available', sold_by: null })

    await savePropertyWithCommission({
      mode: 'create',
      payload: { ...soldPayload, status: 'available', sold_by: null },
    })

    expect(supabase.from).not.toHaveBeenCalledWith('commissions')
    expect(applyEligiblePromotions).toHaveBeenCalled()
  })

  it('un-selling clears earned commission rows', async () => {
    const existing = property
    updateProperty.mockResolvedValue({ ...property, status: 'available', sold_by: null })
    const deleteChain = chain({ data: null, error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'earned' }], error: null }))
      .mockImplementationOnce(() => deleteChain)

    await savePropertyWithCommission({
      mode: 'edit',
      propertyId: 'p1',
      payload: { ...soldPayload, status: 'available', sold_by: null },
    })

    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'available', sold_at: null }))
  })

  it('blocks un-selling when a commission is already paid', async () => {
    updateProperty.mockResolvedValue({})
    supabase.from
      .mockImplementationOnce(() => chain({ data: property, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'paid' }], error: null }))

    await expect(
      savePropertyWithCommission({
        mode: 'edit',
        propertyId: 'p1',
        payload: { ...soldPayload, status: 'available', sold_by: null },
      }),
    ).rejects.toThrow('Commission already paid — reverse payment first.')

    expect(updateProperty).not.toHaveBeenCalled()
  })

  it('does not regenerate commissions when a sold property is saved again with the same seller', async () => {
    const existing = { ...property }
    updateProperty.mockResolvedValue(existing)
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1' }], error: null }))

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold' }))
  })

  it('regenerates commissions when a sold property is missing them', async () => {
    const existing = { ...property }
    updateProperty.mockResolvedValue(existing)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c9' }], error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }))
      .mockImplementationOnce(() => insertChain)

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', status: 'earned' }),
    ])
  })

  it('rejects an inactive or unknown selling agent before saving', async () => {
    fetchAllAgents.mockResolvedValue([{ ...sub, is_active: false }])

    await expect(
      savePropertyWithCommission({ mode: 'create', payload: soldPayload }),
    ).rejects.toMatchObject({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('logs a warning and saves without commissions when no rates are configured', async () => {
    createProperty.mockResolvedValue(property)
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({})

    await savePropertyWithCommission({ mode: 'create', payload: soldPayload })

    expect(logActivity).toHaveBeenCalledWith('commission', 'p1', 'skip', {
      warning: 'No commission rate configured for sub_agent; skipped Sub.',
    })
    expect(supabase.from).not.toHaveBeenCalledWith('commissions')
  })

  it('regenerates commissions when the selling agent changes', async () => {
    const existing = { ...property, sold_by: 'a2' }
    updateProperty.mockResolvedValue({ ...property, sold_by: 'a1' })
    fetchAllAgents.mockResolvedValue([sub, direct])
    fetchCommissionRatesMap.mockResolvedValue({ sub_agent: 0.03, direct_agent: 0.015 })
    const insertChain = chain({ data: [{ id: 'c2' }, { id: 'c3' }], error: null })
    supabase.from
      .mockImplementationOnce(() => chain({ data: existing, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'c1', status: 'earned' }], error: null }))
      .mockImplementationOnce(() => chain({ data: null, error: null }))
      .mockImplementationOnce(() => insertChain)

    await savePropertyWithCommission({ mode: 'edit', propertyId: 'p1', payload: soldPayload })

    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ property_id: 'p1', agent_id: 'a1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned' }),
      expect.objectContaining({ property_id: 'p1', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'earned' }),
    ])
    expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'sold' }))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sales.test.js`
Expected: FAIL — cannot resolve `./sales.js`.

- [ ] **Step 3: Write the implementation**

```js
import { supabase } from './supabase.js'
import { createProperty, updateProperty, logActivity } from './api.js'
import { buildCommissionRows, validateSale, MAX_COMMISSION_LEVELS } from './commissions.js'
import { applyEligiblePromotions, fetchAllAgents, fetchCommissionRatesMap } from './agents.js'

export async function clearCommissionsForProperty(propertyId) {
  const { data, error } = await supabase.from('commissions').select('id, status').eq('property_id', propertyId)
  if (error) throw error

  const rows = data ?? []
  if (rows.some((row) => row.status === 'paid')) {
    throw new Error('Commission already paid — reverse payment first.')
  }
  if (rows.length > 0) {
    const { error: deleteError } = await supabase.from('commissions').delete().eq('property_id', propertyId)
    if (deleteError) throw deleteError
  }
}

export async function resolveChainForAgent(sellerId) {
  const agents = await fetchAllAgents()
  const byId = new Map(agents.map((a) => [a.id, a]))
  const chain = []
  const seen = new Set()
  let current = byId.get(sellerId)

  while (current && !seen.has(current.id) && current.role !== 'admin' && chain.length < MAX_COMMISSION_LEVELS) {
    seen.add(current.id)
    chain.push(current)
    current = current.upline_id ? byId.get(current.upline_id) : null
  }
  return chain
}

async function createCommissionRows(property) {
  const [rates, chain] = await Promise.all([
    fetchCommissionRatesMap(),
    resolveChainForAgent(property.sold_by),
  ])
  const { rows, warnings } = buildCommissionRows(Number(property.price), chain, rates)

  for (const warning of warnings) {
    logActivity('commission', property.id, 'skip', { warning }).catch(() => {})
  }
  if (rows.length === 0) return []

  const payload = rows.map((row) => ({ ...row, property_id: property.id, status: 'earned' }))
  const { data, error } = await supabase.from('commissions').insert(payload).select()
  if (error) throw error

  for (const row of data ?? []) {
    logActivity('commission', row.agent_id, 'earned', { property_id: property.id, amount: row.amount }).catch(() => {})
  }
  return data ?? []
}

async function commissionsMissing(propertyId) {
  const { data, error } = await supabase.from('commissions').select('id').eq('property_id', propertyId).limit(1)
  if (error) throw error
  return (data ?? []).length === 0
}

export async function fetchPropertyById(id) {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function savePropertyWithCommission({ mode, propertyId, payload }) {
  const isSold = payload.status === 'sold'
  const existing = mode === 'edit' ? await fetchPropertyById(propertyId) : null

  if (isSold) {
    const fieldErrors = validateSale(payload)
    if (!fieldErrors.sold_by) {
      const agents = await fetchAllAgents()
      const seller = agents.find((a) => a.id === payload.sold_by)
      if (!seller || seller.role === 'admin' || seller.is_active === false) {
        fieldErrors.sold_by = 'Select an active selling agent.'
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      const error = new Error('Validation failed')
      error.fieldErrors = fieldErrors
      throw error
    }
  }

  const wasSold = existing?.status === 'sold'
  const sellerChanged = wasSold && existing.sold_by !== payload.sold_by

  let commissionStateChanged = isSold && (!wasSold || sellerChanged)
  if (isSold && !commissionStateChanged) {
    commissionStateChanged = await commissionsMissing(propertyId)
  }

  if (wasSold && (!isSold || sellerChanged)) {
    await clearCommissionsForProperty(propertyId)
  }

  const savePayload = isSold
    ? { ...payload, sold_at: wasSold && existing?.sold_at ? existing.sold_at : new Date().toISOString() }
    : { ...payload, sold_at: null }

  const saved = mode === 'edit' ? await updateProperty(propertyId, savePayload) : await createProperty(savePayload)

  if (commissionStateChanged) {
    await createCommissionRows(saved)
  }

  try {
    await applyEligiblePromotions()
  } catch {
    // The sale is recorded; promotions re-run on the next trigger.
  }
  return saved
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sales.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales.js src/lib/sales.test.js
git commit -m "feat: record lot sales and generate commission rows"
```

---

### Task 9: Commission reads, mark paid, my/team sales

**Files:**
- Modify: `src/lib/sales.js`
- Modify: `src/lib/sales.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the import list in `src/lib/sales.test.js`:

```js
import { fetchCommissions, fetchMySales, fetchTeamSales, markCommissionPaid } from './sales.js'
```

Append:

```js
  it('fetchMySales filters properties by seller', async () => {
    const sales = [{ id: 'p1', sold_by: 'a1' }]
    const c = chain({ data: sales, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchMySales('a1')).toEqual(sales)
    expect(supabase.from).toHaveBeenCalledWith('properties')
    expect(c.eq).toHaveBeenCalledWith('sold_by', 'a1')
    expect(c.eq).toHaveBeenCalledWith('status', 'sold')
    expect(c.order).toHaveBeenCalledWith('sold_at', { ascending: false, nullsFirst: false })
  })

  it('fetchTeamSales returns nothing for an empty team', async () => {
    expect(await fetchTeamSales([])).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fetchTeamSales queries by seller ids', async () => {
    const sales = [{ id: 'p1', sold_by: 'a1' }]
    const c = chain({ data: sales, error: null })
    supabase.from.mockReturnValue(c)

    expect(await fetchTeamSales(['a1', 'a2'])).toEqual(sales)
    expect(c.in).toHaveBeenCalledWith('sold_by', ['a1', 'a2'])
    expect(c.eq).toHaveBeenCalledWith('status', 'sold')
    expect(c.order).toHaveBeenCalledWith('sold_at', { ascending: false, nullsFirst: false })
  })

  it('fetchCommissions applies agent and status filters', async () => {
    const rows = [{ id: 'c1', agent_id: 'a1', status: 'earned', amount: 30000 }]
    const c = chain({ data: rows, error: null })
    supabase.from.mockReturnValue(c)

    const result = await fetchCommissions({ agentId: 'a1', status: 'earned' })

    expect(result).toEqual(rows)
    expect(c.select).toHaveBeenCalledWith('*, properties(name), agents(name, role)')
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(c.eq).toHaveBeenCalledWith('agent_id', 'a1')
    expect(c.eq).toHaveBeenCalledWith('status', 'earned')
  })

  it('markCommissionPaid stamps status and paid_at', async () => {
    const row = { id: 'c1', status: 'paid', amount: 30000 }
    const c = chain({ data: row, error: null })
    supabase.from.mockReturnValue(c)

    const result = await markCommissionPaid('c1')

    expect(result).toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('commissions')
    expect(c.update).toHaveBeenCalledWith({ status: 'paid', paid_at: expect.any(String) })
    expect(c.eq).toHaveBeenCalledWith('id', 'c1')
    expect(c.eq).toHaveBeenCalledWith('status', 'earned')
    expect(logActivity).toHaveBeenCalledWith('commission', 'c1', 'paid', { amount: 30000 })
  })

  it('markCommissionPaid rejects an already paid commission', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }))

    await expect(markCommissionPaid('c1')).rejects.toThrow('Commission is already paid.')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sales.test.js`
Expected: FAIL — `fetchCommissions is not a function` (and similar).

- [ ] **Step 3: Write the implementation**

Append to `src/lib/sales.js`:

```js
export async function fetchMySales(agentId) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('sold_by', agentId)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function fetchTeamSales(agentIds) {
  if (!agentIds || agentIds.length === 0) return []
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .in('sold_by', agentIds)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCommissions(filters = {}) {
  let query = supabase
    .from('commissions')
    .select('*, properties(name), agents(name, role)')
    .order('created_at', { ascending: false })
  if (filters.agentId) query = query.eq('agent_id', filters.agentId)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function markCommissionPaid(id) {
  const { data, error } = await supabase
    .from('commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'earned')
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Commission is already paid.')
  logActivity('commission', id, 'paid', { amount: data.amount }).catch(() => {})
  return data
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sales.test.js`
Expected: PASS — 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales.js src/lib/sales.test.js
git commit -m "feat: add commission reads, mark-paid, and agent sales queries"
```

---

### Task 10: Edge Function `create-agent`

**Files:**
- Create: `supabase/functions/create-agent/index.ts`
- Modify: `.gitignore`

There is no Vitest coverage for this task (Deno runtime). Verification is manual, listed in Task 19.

- [ ] **Step 1: Write the function**

````ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const ALLOWED_ROLES = ['agent_head', 'direct_agent', 'sub_agent']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: callerAgent, error: callerError } = await admin
    .from('agents')
    .select('id, role, is_active')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (callerError) {
    console.error('create-agent: caller lookup failed', callerError)
    return json({ error: 'Forbidden' }, 403)
  }
  if (!callerAgent || callerAgent.role !== 'admin' || !callerAgent.is_active) {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : null
  const role = typeof body?.role === 'string' ? body.role : ''
  const uplineId = typeof body?.upline_id === 'string' ? body.upline_id : null

  if (!name || !email || !password) {
    return json({ error: 'name, email, and password are required' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400)
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  if (uplineId) {
    const { data: upline, error: uplineError } = await admin
      .from('agents')
      .select('id, is_active')
      .eq('id', uplineId)
      .maybeSingle()
    if (uplineError) {
      console.error('create-agent: upline lookup failed', uplineError)
      return json({ error: 'Could not verify the upline agent.' }, 500)
    }
    if (!upline || !upline.is_active) {
      return json({ error: 'Select an active upline agent.' }, 400)
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) {
    console.error('create-agent: createUser failed', createError)
    const message = /already/i.test(createError.message)
      ? 'Email already registered.'
      : 'Could not create the login. Please try again.'
    return json({ error: message }, 400)
  }

  const { data: agentRow, error: insertError } = await admin
    .from('agents')
    .insert({
      user_id: created.user.id,
      email,
      name,
      phone,
      role,
      upline_id: uplineId,
    })
    .select()
    .single()

  if (insertError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id)
    if (deleteError) console.error('create-agent: rollback deleteUser failed', deleteError)
    console.error('create-agent: agents insert failed', insertError)
    const message = insertError.code === '23503'
      ? 'The selected upline agent no longer exists.'
      : 'Could not create the agent profile. Please try again.'
    return json({ error: message }, 400)
  }

  return json({ agent: agentRow })
})
````

- [ ] **Step 2: Ignore Supabase CLI scratch files**

Add to `.gitignore`:

```
.supabase
```

- [ ] **Step 3: Verify the function compiles via the CLI link flow**

Run (only if `supabase/config.toml` does not exist):

```bash
npx supabase init
npx supabase link --project-ref nfikkjuuzwphswutocao
```

Expected: link succeeds. The `service_role` key is injected automatically into deployed Edge Functions by Supabase; do not add it to `.env`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-agent/index.ts .gitignore
git commit -m "feat: add admin-only create-agent edge function"
```

---

## Milestone C — Dashboard role gating & admin UI

### Task 11: Selling agent in PropertyForm

**Files:**
- Modify: `src/components/admin/PropertyForm.jsx`
- Modify: `src/components/admin/PropertyForm.test.jsx`

**Save routing rule:** create + non-sold saves keep using `createProperty` (no commissions possible); create + sold, and **every** edit, go through `savePropertyWithCommission` so un-selling and seller changes clear commissions correctly.

- [ ] **Step 1: Update the component imports and state**

In `src/components/admin/PropertyForm.jsx`, replace:

```js
import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'
```

with:

```js
import { createProperty, uploadPropertyImage } from '../../lib/api.js'
import { fetchAllAgents } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { savePropertyWithCommission } from '../../lib/sales.js'
```

Add state after the `mapNotice` state:

```js
  const [sellerId, setSellerId] = useState(property?.sold_by ?? '')
  const [agents, setAgents] = useState([])
  const [agentsState, setAgentsState] = useState('idle')
```

- [ ] **Step 1b: Reset the agent-load state when leaving sold**

An agent-load failure is otherwise terminal (the effect only runs from `idle`). In the existing `setField` helper, add the reset:

```js
  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'status' && value !== 'sold') setAgentsState('idle')
    setErrors((errs) => ({ ...errs, [field]: undefined }))
  }
```

- [ ] **Step 2: Load assignable agents when the status becomes sold**

Add this effect after the existing Escape-key effect:

```js
  useEffect(() => {
    if (form.status !== 'sold' || agentsState !== 'idle') return
    setAgentsState('loading')
    fetchAllAgents()
      .then((rows) => {
        setAgents(rows.filter((a) => a.role !== 'admin' && a.is_active))
        setAgentsState('ready')
      })
      .catch(() => setAgentsState('error'))
  }, [form.status, agentsState])
```

Note: do NOT use a `mounted` cleanup flag here — `setAgentsState('loading')` re-runs the effect, so the cleanup would set `mounted = false` before the fetch resolves and the UI would stay stuck on "Loading agents…". Setting state after unmount is a no-op in React 18+, so the flag is unnecessary.

- [ ] **Step 3: Extend validation and payload**

In `validate()`, before `return next`:

```js
    if (form.status === 'sold') {
      const price = Number(form.price)
      if (form.price === '' || Number.isNaN(price) || price <= 0) {
        next.price = 'Set a price before marking this property sold.'
      }
      if (!sellerId) next.sold_by = 'Select the selling agent.'
    }
```

In the `payload` object inside `doSave`, add after `is_pinned`:

```js
        sold_by: form.status === 'sold' ? sellerId : null,
```

- [ ] **Step 4: Route saves through the sale-aware API**

Replace the save line in `doSave`:

```js
      const saved = isEdit ? await updateProperty(property.id, payload) : await createProperty(payload)
```

with:

```js
      const needsSaleAwareSave = form.status === 'sold' || isEdit
      const saved = needsSaleAwareSave
        ? await savePropertyWithCommission({ mode, propertyId: property?.id, payload })
        : await createProperty(payload)
```

Replace the `catch` block in `doSave`:

```js
    } catch {
      setError('Could not save the property. Please try again.')
    } finally {
```

with:

```js
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors)
      else if (err?.message?.includes('Commission already paid')) setError(err.message)
      else setError('Could not save the property. Please try again.')
    } finally {
```

- [ ] **Step 5: Add the Selling Agent select**

In the form JSX, immediately after the Status select's closing `</div>` (the block that ends with the status options), insert:

```jsx
          {form.status === 'sold' && (
            <div className="sm:col-span-2">
              <label htmlFor="pf-sold-by" className="mb-1.5 block text-sm font-semibold text-brand-deep">
                Selling Agent
              </label>
              <select
                id="pf-sold-by"
                className={inputCls}
                value={sellerId}
                onChange={(e) => {
                  setSellerId(e.target.value)
                  setErrors((errs) => ({ ...errs, sold_by: undefined }))
                }}
              >
                <option value="">
                  {agentsState === 'loading' ? 'Loading agents…' : agentsState === 'error' ? 'Could not load agents' : 'Select agent…'}
                </option>
                {sellerId && !agents.some((a) => a.id === sellerId) && (
                  <option value={sellerId}>Current seller (inactive or unavailable)</option>
                )}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({ROLE_LABELS[a.role] ?? a.role})
                  </option>
                ))}
              </select>
              {errors.sold_by && (
                <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                  {errors.sold_by}
                </p>
              )}
            </div>
          )}
```

Add `{errors.price && ...}` next to the existing price input by inserting after the price input element:

```jsx
            {errors.price && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {errors.price}
              </p>
            )}
```

- [ ] **Step 6: Show the seller in the confirmation summary**

In the ConfirmModal summary list, after the Status row, add:

```jsx
          {form.status === 'sold' && (
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-brand-deep shrink-0">Selling Agent</dt>
              <dd className="text-right text-ink/70 truncate">
                {agents.find((a) => a.id === sellerId)?.name ?? (sellerId ? 'Current seller (inactive)' : '—')}
              </dd>
            </div>
          )}
```

- [ ] **Step 7: Update the test mocks**

In `src/components/admin/PropertyForm.test.jsx`, replace the `vi.mock('../../lib/api.js', ...)` block with:

```js
vi.mock('../../lib/api.js', () => ({
  createProperty: vi.fn(),
  uploadPropertyImage: vi.fn(),
}))

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn().mockResolvedValue([
    { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
    { id: 'a2', name: 'Ben Direct', role: 'direct_agent', is_active: true },
  ]),
}))

vi.mock('../../lib/sales.js', () => ({
  savePropertyWithCommission: vi.fn(),
}))
```

Replace the import line:

```js
import { createProperty, updateProperty, uploadPropertyImage } from '../../lib/api.js'
```

with:

```js
import { createProperty, uploadPropertyImage } from '../../lib/api.js'
import { savePropertyWithCommission } from '../../lib/sales.js'
```

Update the two edit-mode assertions:

```js
    expect(updateProperty).toHaveBeenCalledWith('p7', expect.objectContaining({ name: 'Andor Ridge Lot A (Reserved)', price: 2000000 }))
```

becomes:

```js
    expect(savePropertyWithCommission).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', propertyId: 'p7', payload: expect.objectContaining({ name: 'Andor Ridge Lot A (Reserved)', price: 2000000 }) }),
    )
```

and

```js
    expect(updateProperty).toHaveBeenCalledWith('p7', expect.objectContaining({ map_pins: [] }))
```

becomes:

```js
    expect(savePropertyWithCommission).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', propertyId: 'p7', payload: expect.objectContaining({ map_pins: [] }) }),
    )
```

Also set `savePropertyWithCommission.mockResolvedValue(updated)` in the name-edit test (so its `onSaved` assertion receives the updated row) and `mockResolvedValue({ id: 'p7' })` in the pins test (replacing the old `updateProperty` resolutions).

Two fixture notes:
- Add `sold_by: null` to the `payload` fixture: the component now always emits `sold_by`, and the create test uses an exact `toHaveBeenCalledWith(payload)` match.
- Leave the existing `'shows a save error and re-enables the submit button'` test unchanged: the narrowed catch still shows `'Could not save the property. Please try again.'` for non-commission errors.

- [ ] **Step 8: Add the sold-flow tests**

Append inside the existing `describe('PropertyForm', ...)` block:

```js
  it('requires a price and seller before saving as sold', async () => {
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={vi.fn()} />)

    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText('Status'), 'sold')
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    expect(await screen.findByText('Select the selling agent.')).toBeInTheDocument()
    expect(savePropertyWithCommission).not.toHaveBeenCalled()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('saves a sold property with the selling agent', async () => {
    savePropertyWithCommission.mockResolvedValue({ id: 'p1' })
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<PropertyForm mode="create" property={null} onClose={vi.fn()} onSaved={onSaved} />)

    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText('Status'), 'sold')
    await screen.findByRole('option', { name: /Ana Sub/ })
    await user.selectOptions(screen.getByLabelText('Selling Agent'), 'a1')
    await user.click(screen.getByRole('button', { name: 'Add Property' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Ana Sub')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add Property' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith({
      mode: 'create',
      propertyId: undefined,
      payload: expect.objectContaining({ status: 'sold', sold_by: 'a1' }),
    })
    expect(onSaved).toHaveBeenCalledWith({ id: 'p1' })
  })

  it('surfaces a paid-commission block from the sales API', async () => {
    savePropertyWithCommission.mockRejectedValue(new Error('Commission already paid — reverse payment first.'))
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Commission already paid — reverse payment first.')).toBeInTheDocument()
  })

  it('sends an un-sell through the sale-aware save with a null seller', async () => {
    savePropertyWithCommission.mockResolvedValue({ id: 'p7' })
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Status'), 'available')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(savePropertyWithCommission).toHaveBeenCalledWith({
      mode: 'edit',
      propertyId: 'p7',
      payload: expect.objectContaining({ status: 'available', sold_by: null }),
    })
  })

  it('shows field errors returned by the sales API', async () => {
    savePropertyWithCommission.mockRejectedValue({ fieldErrors: { sold_by: 'Select an active selling agent.' } })
    const user = userEvent.setup()
    const existing = { id: 'p7', ...payload, status: 'sold', sold_by: 'a1' }

    render(<PropertyForm mode="edit" property={existing} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Select an active selling agent.')).toBeInTheDocument()
  })
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run src/components/admin/PropertyForm.test.jsx`
Expected: PASS — all existing tests plus 5 new ones (18 total in the file).

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/PropertyForm.jsx src/components/admin/PropertyForm.test.jsx
git commit -m "feat(admin): pick a selling agent when marking a property sold"
```

---

### Task 12: Show "Sold by" in the properties table

**Files:**
- Modify: `src/components/admin/AdminProperties.jsx`
- Modify: `src/components/admin/AdminProperties.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/components/admin/AdminProperties.test.jsx`, add this mock after the `csv.js` mock:

```js
vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Ana Sub', role: 'sub_agent' }]),
}))
```

Append this test inside the existing `describe`:

```js
  it('shows the selling agent for sold properties', async () => {
    fetchProperties.mockResolvedValue({
      data: [{ ...sample[0], id: 'p9', name: 'Lot Sold', status: 'sold', sold_by: 'a1' }],
      count: 1,
    })

    render(<AdminProperties />)

    expect(await screen.findByText('Sold by Ana Sub')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/AdminProperties.test.jsx`
Expected: FAIL — `Unable to find an element with the text: Sold by Ana Sub`.

- [ ] **Step 3: Write the implementation**

In `src/components/admin/AdminProperties.jsx`, add the import:

```js
import { fetchAllAgents } from '../../lib/agents.js'
```

Add state after `const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)`:

```js
  const [agentNames, setAgentNames] = useState({})
```

Add an effect after the `useEffect(load, [load])` calls:

```js
  useEffect(() => {
    let mounted = true
    fetchAllAgents()
      .then((rows) => {
        if (mounted) setAgentNames(Object.fromEntries(rows.map((a) => [a.id, a.name])))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])
```

Replace the status cell block:

```jsx
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      property.status === 'sold'
                        ? 'bg-red-100 text-red-700'
                        : property.status === 'reserved'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : 'Available'}
                    </span>
```

with:

```jsx
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      property.status === 'sold'
                        ? 'bg-red-100 text-red-700'
                        : property.status === 'reserved'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {property.status ? property.status.charAt(0).toUpperCase() + property.status.slice(1) : 'Available'}
                    </span>
                    {property.status === 'sold' && property.sold_by && agentNames[property.sold_by] && (
                      <p className="mt-1 text-[11px] font-semibold text-ink/50">Sold by {agentNames[property.sold_by]}</p>
                    )}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/admin/AdminProperties.test.jsx`
Expected: PASS — all existing tests plus the new one.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminProperties.jsx src/components/admin/AdminProperties.test.jsx
git commit -m "feat(admin): show the selling agent on sold properties"
```

---

### Task 13: Role-gated dashboard and agent stats

**Files:**
- Create: `src/components/admin/AgentStats.jsx`
- Create: `src/components/admin/AgentStats.test.jsx`
- Modify: `src/components/admin/AdminDashboard.jsx`
- Modify: `src/components/admin/AdminDashboard.test.jsx`

- [ ] **Step 1: Write the AgentStats test**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentStats from './AgentStats.jsx'

vi.mock('../../lib/sales.js', () => ({
  fetchMySales: vi.fn(),
  fetchCommissions: vi.fn(),
}))

import { fetchCommissions, fetchMySales } from '../../lib/sales.js'

describe('AgentStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows sold lots and earned vs paid commission totals', async () => {
    fetchMySales.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    fetchCommissions.mockResolvedValue([
      { id: 'c1', status: 'earned', amount: 30000 },
      { id: 'c2', status: 'paid', amount: 15000 },
    ])

    render(<AgentStats agent={{ id: 'a1', name: 'Ana' }} downlineCount={3} />)

    expect(await screen.findByText('Sold Lots')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('₱ 45,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 15,000')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/AgentStats.test.jsx`
Expected: FAIL — cannot resolve `./AgentStats.jsx`.

- [ ] **Step 3: Write AgentStats**

```jsx
import { useEffect, useState } from 'react'
import Icon from '../shared/Icon.jsx'
import { fetchMySales, fetchCommissions } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

const statCardCls = 'rounded-lg border border-mist bg-white p-5 flex items-center gap-4'
const iconCls = 'size-10 shrink-0 grid place-items-center rounded-full'

export default function AgentStats({ agent, downlineCount = 0 }) {
  const [soldCount, setSoldCount] = useState(0)
  const [earned, setEarned] = useState(0)
  const [paid, setPaid] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchMySales(agent.id), fetchCommissions({ agentId: agent.id })])
      .then(([sales, commissions]) => {
        if (!mounted) return
        setSoldCount(sales.length)
        setEarned(commissions.reduce((sum, c) => sum + Number(c.amount), 0))
        setPaid(commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0))
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [agent.id])

  if (loading) return <p className="py-6 text-center text-ink/50 text-sm">Loading stats…</p>

  const cards = [
    { label: 'Sold Lots', value: String(soldCount), icon: 'residential', cls: 'bg-brand/10 text-brand' },
    { label: 'Downline Agents', value: String(downlineCount), icon: 'professional', cls: 'bg-blue-100 text-blue-600' },
    { label: 'Commission Earned', value: formatPrice(earned) ?? '₱ 0', icon: 'detail', cls: 'bg-gold/20 text-yellow-700' },
    { label: 'Commission Paid', value: formatPrice(paid) ?? '₱ 0', icon: 'safety', cls: 'bg-green-100 text-green-700' },
  ]

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={statCardCls}>
          <span className={`${iconCls} ${card.cls}`}>
            <Icon name={card.icon} className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">{card.value}</p>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

Note: `Icon name="professional"` already exists in `src/components/shared/Icon.jsx` (used by `whyChooseUs`). Confirm with `grep -n "professional" src/components/shared/Icon.jsx` before running tests.

- [ ] **Step 4: Run the AgentStats test**

Run: `npx vitest run src/components/admin/AgentStats.test.jsx`
Expected: PASS.

- [ ] **Step 5: Update AdminDashboard role gating**

Replace the entire contents of `src/components/admin/AdminDashboard.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'
import Logo from '../shared/Logo.jsx'
import AdminProperties from './AdminProperties.jsx'
import AdminInquiries from './AdminInquiries.jsx'
import AdminImageGallery from './AdminImageGallery.jsx'
import AdminCMS from './AdminCMS.jsx'
import AdminNotifications from './AdminNotifications.jsx'
import AdminActivityLog from './AdminActivityLog.jsx'
import AdminAgents from './AdminAgents.jsx'
import AdminCommissions from './AdminCommissions.jsx'
import DashboardStats from './DashboardStats.jsx'
import AgentStats from './AgentStats.jsx'
import AgentLots from './AgentLots.jsx'
import AgentSales from './AgentSales.jsx'
import AgentCommissions from './AgentCommissions.jsx'
import AgentDownline from './AgentDownline.jsx'

const adminTabs = [
  { id: 'properties', label: 'Properties' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'cms', label: 'CMS' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'agents', label: 'Agents' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'activity', label: 'Activity Log' },
]

const agentTabs = [
  { id: 'lots', label: 'Available Lots' },
  { id: 'sales', label: 'My Sales' },
  { id: 'commissions', label: 'My Commissions' },
  { id: 'downline', label: 'My Downline' },
]

function FullScreen({ children }) {
  return <div className="grid min-h-screen place-items-center bg-brand-deep p-6 text-center text-white">{children}</div>
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [agent, setAgent] = useState(null)
  const [agentError, setAgentError] = useState(null)
  const [downline, setDownline] = useState([])
  const [tab, setTab] = useState(null)

  useEffect(() => {
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
        setChecking(false)
      })
      .catch(() => {
        if (!mounted) return
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

  useEffect(() => {
    if (!session?.user) return
    let mounted = true
    fetchCurrentAgent()
      .then((row) => {
        if (!mounted) return
        setAgent(row)
        setTab(row.role === 'admin' ? 'properties' : 'lots')
      })
      .catch(() => {
        if (mounted) setAgentError('Your account is not linked to an agent profile. Contact the administrator.')
      })
    return () => { mounted = false }
  }, [session])

  useEffect(() => {
    if (!agent || agent.role === 'admin') return
    let mounted = true
    fetchMyDownline()
      .then((rows) => { if (mounted) setDownline(rows) })
      .catch(() => {})
    return () => { mounted = false }
  }, [agent])

  if (checking) return <FullScreen><p className="font-display text-lg">Loading…</p></FullScreen>
  if (!session) return <Navigate to="/admin/login" replace />

  if (agentError) {
    return (
      <FullScreen>
        <div className="max-w-md space-y-4">
          <p className="font-display text-lg">{agentError}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-deep"
          >
            Sign out
          </button>
        </div>
      </FullScreen>
    )
  }

  if (!agent || !tab) return <FullScreen><p className="font-display text-lg">Loading…</p></FullScreen>

  const isAdmin = agent.role === 'admin'
  const tabs = isAdmin ? adminTabs : agentTabs.filter((t) => t.id !== 'downline' || downline.length > 0)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-mist bg-white">
        <div className="container-x flex items-center justify-between py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="dark" noLink className="max-w-[180px] sm:max-w-none" />
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
        {isAdmin ? (
          <DashboardStats onJumpToInquiries={() => setTab('inquiries')} />
        ) : (
          <AgentStats agent={agent} downlineCount={downline.length} />
        )}

        <nav className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-thin" aria-label="Admin sections">
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

        {isAdmin ? (
          <>
            {tab === 'properties' && <AdminProperties />}
            {tab === 'gallery' && <AdminImageGallery />}
            {tab === 'cms' && <AdminCMS />}
            {tab === 'inquiries' && <AdminInquiries />}
            {tab === 'agents' && <AdminAgents />}
            {tab === 'commissions' && <AdminCommissions />}
            {tab === 'notifications' && <AdminNotifications />}
            {tab === 'activity' && <AdminActivityLog />}
          </>
        ) : (
          <>
            {tab === 'lots' && <AgentLots />}
            {tab === 'sales' && <AgentSales agent={agent} />}
            {tab === 'commissions' && <AgentCommissions agent={agent} />}
            {tab === 'downline' && <AgentDownline members={downline} />}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update AdminDashboard tests**

In `src/components/admin/AdminDashboard.test.jsx`, add these component mocks after the existing ones:

```js
vi.mock('./AdminAgents.jsx', () => ({ default: () => <span>AgentsPanel</span> }))
vi.mock('./AdminCommissions.jsx', () => ({ default: () => <span>AdminCommissionsPanel</span> }))
vi.mock('./AgentStats.jsx', () => ({ default: () => <span>AgentStatsPanel</span> }))
vi.mock('./AgentLots.jsx', () => ({ default: () => <span>AgentLotsPanel</span> }))
vi.mock('./AgentSales.jsx', () => ({ default: () => <span>AgentSalesPanel</span> }))
vi.mock('./AgentCommissions.jsx', () => ({ default: () => <span>AgentCommissionsPanel</span> }))
vi.mock('./AgentDownline.jsx', () => ({ default: () => <span>AgentDownlinePanel</span> }))
vi.mock('../../lib/agents.js', () => ({
  fetchCurrentAgent: vi.fn(),
  fetchMyDownline: vi.fn().mockResolvedValue([]),
}))
```

Import the mock:

```js
import { fetchCurrentAgent, fetchMyDownline } from '../../lib/agents.js'
```

Add to the existing `beforeEach`:

```js
    fetchCurrentAgent.mockResolvedValue({ id: 'admin1', name: 'Admin', role: 'admin', is_active: true })
```

Append these tests:

```js
  it('shows agent tabs for a sub agent and hides admin-only panels', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([{ id: 'a2', name: 'Downline', role: 'sub_agent' }])

    renderDashboard()

    expect(await screen.findByText('AgentLotsPanel')).toBeInTheDocument()
    expect(screen.getByText('AgentStatsPanel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Properties' })).not.toBeInTheDocument()
  })

  it('shows the downline tab only when the agent has a downline', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } })
    fetchCurrentAgent.mockResolvedValue({ id: 'a1', name: 'Ana', role: 'sub_agent', is_active: true })
    fetchMyDownline.mockResolvedValue([])

    renderDashboard()

    await screen.findByText('AgentLotsPanel')
    expect(screen.queryByRole('button', { name: 'My Downline' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/components/admin/AdminDashboard.test.jsx src/components/admin/AgentStats.test.jsx`
Expected: PASS — existing tests (admin path) plus 2 new role-gating tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/AgentStats.jsx src/components/admin/AgentStats.test.jsx src/components/admin/AdminDashboard.jsx src/components/admin/AdminDashboard.test.jsx
git commit -m "feat(admin): gate dashboard tabs by agent role"
```

---

### Task 14: Create Agent modal

**Files:**
- Create: `src/components/admin/CreateAgentModal.jsx`
- Create: `src/components/admin/CreateAgentModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateAgentModal from './CreateAgentModal.jsx'

vi.mock('../../lib/agents.js', () => ({ createAgent: vi.fn() }))

import { createAgent } from '../../lib/agents.js'

const agents = [
  { id: 'a1', name: 'Ana Sub', role: 'sub_agent', is_active: true },
  { id: 'a2', name: 'Ben Direct', role: 'direct_agent', is_active: true },
]

describe('CreateAgentModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an agent with the entered details', async () => {
    createAgent.mockResolvedValue({ id: 'a9' })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.type(screen.getByLabelText('Phone (optional)'), '0917')
    await user.selectOptions(screen.getByLabelText('Role'), 'sub_agent')
    await user.selectOptions(screen.getByLabelText('Upline (optional)'), 'a1')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(createAgent).toHaveBeenCalledWith({
      name: 'Cara New',
      email: 'cara@example.com',
      phone: '0917',
      role: 'sub_agent',
      uplineId: 'a1',
      password: 'secret123',
    })
    expect(onCreated).toHaveBeenCalled()
  })

  it('shows the error returned by the edge function', async () => {
    createAgent.mockRejectedValue(new Error('Email already registered'))
    const user = userEvent.setup()

    render(<CreateAgentModal agents={agents} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'Cara New')
    await user.type(screen.getByLabelText('Email'), 'cara@example.com')
    await user.type(screen.getByLabelText('Temporary Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/CreateAgentModal.test.jsx`
Expected: FAIL — cannot resolve `./CreateAgentModal.jsx`.

- [ ] **Step 3: Write the implementation**

```jsx
import { useState } from 'react'
import { createAgent } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'

const inputCls =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const assignableRoles = ['sub_agent', 'direct_agent', 'agent_head']

export default function CreateAgentModal({ agents, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'sub_agent', uplineId: '', password: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAgent({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        uplineId: form.uplineId,
        password: form.password,
      })
      onCreated()
    } catch (err) {
      setError(err?.message || 'Could not create the agent account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create agent"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">Create Agent</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ca-name" className="mb-1.5 block text-sm font-semibold text-brand-deep">Name</label>
            <input id="ca-name" autoFocus className={inputCls} value={form.name} onChange={setField('name')} placeholder="Juan Dela Cruz" />
          </div>
          <div>
            <label htmlFor="ca-email" className="mb-1.5 block text-sm font-semibold text-brand-deep">Email</label>
            <input id="ca-email" type="email" className={inputCls} value={form.email} onChange={setField('email')} placeholder="agent@example.com" />
          </div>
          <div>
            <label htmlFor="ca-phone" className="mb-1.5 block text-sm font-semibold text-brand-deep">Phone (optional)</label>
            <input id="ca-phone" className={inputCls} value={form.phone} onChange={setField('phone')} placeholder="0917 000 0000" />
          </div>
          <div>
            <label htmlFor="ca-role" className="mb-1.5 block text-sm font-semibold text-brand-deep">Role</label>
            <select id="ca-role" className={inputCls} value={form.role} onChange={setField('role')}>
              {assignableRoles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ca-upline" className="mb-1.5 block text-sm font-semibold text-brand-deep">Upline (optional)</label>
            <select id="ca-upline" className={inputCls} value={form.uplineId} onChange={setField('uplineId')}>
              <option value="">No upline</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name} ({ROLE_LABELS[agent.role] ?? agent.role})</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ca-password" className="mb-1.5 block text-sm font-semibold text-brand-deep">Temporary Password</label>
            <input id="ca-password" type="text" className={inputCls} value={form.password} onChange={setField('password')} placeholder="Share this with the agent" />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="btn border border-mist bg-white text-ink/70 hover:border-brand/30 hover:text-brand">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/CreateAgentModal.test.jsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CreateAgentModal.jsx src/components/admin/CreateAgentModal.test.jsx
git commit -m "feat(admin): add create agent modal"
```

---

### Task 15: Agents tab (tree, eligibility, activation, detail)

**Files:**
- Create: `src/components/admin/AdminAgents.jsx`
- Create: `src/components/admin/AdminAgents.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminAgents from './AdminAgents.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchAllAgents: vi.fn(),
  fetchSoldCounts: vi.fn(),
  setAgentActive: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn().mockResolvedValue([]),
  fetchTeamSales: vi.fn().mockResolvedValue([]),
}))
vi.mock('./CreateAgentModal.jsx', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Create agent">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { fetchAllAgents, fetchSoldCounts, setAgentActive } from '../../lib/agents.js'

const admin = { id: 'admin1', name: 'Admin', email: 'a@x.com', role: 'admin', upline_id: null, is_active: true }
const sub = { id: 'a1', name: 'Ana Sub', email: 'ana@x.com', role: 'sub_agent', upline_id: null, is_active: true }
const recruit = { id: 'a2', name: 'Rico Recruit', email: 'rico@x.com', role: 'sub_agent', upline_id: 'a1', is_active: true }

describe('AdminAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllAgents.mockResolvedValue([admin, sub, recruit])
    fetchSoldCounts.mockResolvedValue({})
    setAgentActive.mockResolvedValue({})
  })

  it('lists agents with role labels and child indentation', async () => {
    render(<AdminAgents />)

    expect(await screen.findByText('Ana Sub')).toBeInTheDocument()
    expect(screen.getByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.getAllByText('Sub Agent').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an eligible badge when promotion thresholds are met', async () => {
    const recruits = Array.from({ length: 5 }, (_, i) => ({ ...recruit, id: `r${i}`, name: `Recruit ${i}` }))
    fetchAllAgents.mockResolvedValue([admin, sub, ...recruits])
    fetchSoldCounts.mockResolvedValue({ a1: 5 })

    render(<AdminAgents />)

    expect(await screen.findByText('Eligible: Direct Agent')).toBeInTheDocument()
  })

  it('opens the create agent modal', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    await user.click(await screen.findByRole('button', { name: 'Create Agent' }))
    expect(screen.getByRole('dialog', { name: 'Create agent' })).toBeInTheDocument()
  })

  it('deactivates an agent after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminAgents />)

    const row = (await screen.findByText('Ana Sub')).closest('li')
    await user.click(within(row).getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    expect(setAgentActive).toHaveBeenCalledWith('a1', false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/AdminAgents.test.jsx`
Expected: FAIL — cannot resolve `./AdminAgents.jsx`.

- [ ] **Step 3: Write the implementation**

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROLE_LABELS, buildAgentTree } from '../../lib/agentMeta.js'
import { fetchAllAgents, fetchSoldCounts, setAgentActive } from '../../lib/agents.js'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { eligibleAgents } from '../../lib/promotions.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'
import ConfirmModal from '../shared/ConfirmModal.jsx'
import CreateAgentModal from './CreateAgentModal.jsx'

const badgeCls = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold'

function roleBadgeCls(role) {
  if (role === 'admin') return 'bg-brand text-white'
  if (role === 'agent_head') return 'bg-gold text-brand-deep'
  if (role === 'direct_agent') return 'bg-blue-100 text-blue-700'
  return 'bg-brand/10 text-brand'
}

function AgentDetail({ agent, onClose }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    Promise.all([fetchTeamSales([agent.id]), fetchCommissions({ agentId: agent.id })])
      .then(([s, c]) => {
        if (!mounted) return
        setSales(s)
        setCommissions(c)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const earned = commissions.reduce((sum, c) => sum + Number(c.amount), 0)
  const paid = commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-deep/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${agent.name} details`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-brand-deep">
            {agent.name} · {ROLE_LABELS[agent.role] ?? agent.role}
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-ink/50 hover:text-ink" aria-label="Close">✕</button>
        </div>

        {state === 'loading' && <p className="py-6 text-center text-ink/60">Loading details…</p>}
        {state === 'error' && <p className="py-6 text-center text-ink/60">Could not load agent details.</p>}

        {state === 'ready' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Sold Lots: {sales.length}</span>
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Earned: {formatPrice(earned) ?? '₱ 0'}</span>
              <span className="rounded-md bg-surface px-3 py-2 font-semibold text-brand-deep">Paid: {formatPrice(paid) ?? '₱ 0'}</span>
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Sold Lots</h3>
              {sales.length === 0 ? (
                <p className="text-sm text-ink/60">No sold lots yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {sales.map((sale) => (
                    <li key={sale.id} className="flex justify-between gap-4">
                      <span className="text-ink/70">{sale.name}</span>
                      <span className="font-semibold text-ink">{formatPrice(sale.price) ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-display text-sm font-bold text-brand-deep">Commissions</h3>
              {commissions.length === 0 ? (
                <p className="text-sm text-ink/60">No commissions yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {commissions.map((row) => (
                    <li key={row.id} className="flex justify-between gap-4">
                      <span className="text-ink/70">
                        {row.properties?.name ?? 'Property'} · {formatRate(row.rate)}
                      </span>
                      <span className="font-semibold text-ink">
                        {formatPrice(row.amount) ?? '—'} <span className="text-xs uppercase text-ink/50">{row.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentNode({ node, depth, eligibility, onView, onToggle, pending }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-mist bg-white p-3" style={{ marginLeft: depth * 20 }}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-deep">{node.name}</p>
          <p className="text-xs text-ink/50">
            {node.email}
            {node.phone ? ` · ${node.phone}` : ''}
          </p>
        </div>
        <span className={`${badgeCls} ${roleBadgeCls(node.role)}`}>{ROLE_LABELS[node.role] ?? node.role}</span>
        {!node.is_active && <span className={`${badgeCls} bg-red-100 text-red-700`}>Inactive</span>}
        {eligibility && <span className={`${badgeCls} bg-green-100 text-green-700`}>Eligible: {ROLE_LABELS[eligibility.eligibleFor]}</span>}
        <button
          onClick={() => onView(node)}
          className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
        >
          View
        </button>
        {node.role !== 'admin' && (
          <button
            onClick={() => onToggle(node)}
            disabled={Boolean(pending[node.id])}
            className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
          >
            {node.is_active ? 'Deactivate' : 'Activate'}
          </button>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((child) => (
            <AgentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              eligibility={eligibility}
              onView={onView}
              onToggle={onToggle}
              pending={pending}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function AdminAgents() {
  const [agents, setAgents] = useState([])
  const [soldCounts, setSoldCounts] = useState({})
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [pending, setPending] = useState({})

  const load = useCallback(() => {
    setState('loading')
    Promise.all([fetchAllAgents(), fetchSoldCounts()])
      .then(([rows, counts]) => {
        setAgents(rows)
        setSoldCounts(counts)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  useEffect(load, [load])

  const eligibility = useMemo(() => eligibleAgents(agents, soldCounts), [agents, soldCounts])
  const tree = useMemo(() => buildAgentTree(agents), [agents])

  const handleToggle = async () => {
    if (!confirmToggle || toggling) return
    const next = !confirmToggle.is_active
    const id = confirmToggle.id
    setToggling(true)
    setPending((p) => ({ ...p, [id]: true }))
    try {
      await setAgentActive(id, next)
      setAgents((list) => list.map((a) => (a.id === id ? { ...a, is_active: next } : a)))
      setConfirmToggle(null)
    } catch {
      setError('Could not update the agent. Please try again.')
    } finally {
      setToggling(false)
      setPending((p) => ({ ...p, [id]: false }))
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-brand-deep">Agents</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold">Create Agent</button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading agents…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load agents.</p>
          <button onClick={load} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && agents.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No agents yet. Click "Create Agent" to add the first one.
        </p>
      )}

      {state === 'ready' && agents.length > 0 && (
        <ul className="space-y-2">
          {tree.map((node) => (
            <AgentNode
              key={node.id}
              node={node}
              depth={0}
              eligibility={eligibility}
              onView={setDetail}
              onToggle={setConfirmToggle}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateAgentModal
          agents={agents.filter((a) => a.role !== 'admin' && a.is_active)}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {detail && <AgentDetail agent={detail} onClose={() => setDetail(null)} />}

      <ConfirmModal
        open={Boolean(confirmToggle)}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggle}
        title={confirmToggle?.is_active ? 'Deactivate Agent' : 'Activate Agent'}
        message={
          confirmToggle
            ? `${confirmToggle.is_active ? 'Deactivate' : 'Activate'} "${confirmToggle.name}"?`
            : ''
        }
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        destructive={Boolean(confirmToggle?.is_active)}
        loading={toggling}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/AdminAgents.test.jsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminAgents.jsx src/components/admin/AdminAgents.test.jsx
git commit -m "feat(admin): add agents tab with tree, eligibility, and activation"
```

---

### Task 16: Commissions tab (rates, list, mark paid)

**Files:**
- Create: `src/components/admin/AdminCommissions.jsx`
- Create: `src/components/admin/AdminCommissions.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCommissions from './AdminCommissions.jsx'

vi.mock('../../lib/agents.js', () => ({
  fetchCommissionRates: vi.fn(),
  updateCommissionRates: vi.fn(),
}))
vi.mock('../../lib/sales.js', () => ({
  fetchCommissions: vi.fn(),
  markCommissionPaid: vi.fn(),
}))

import { fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
import { fetchCommissions, markCommissionPaid } from '../../lib/sales.js'

const rates = [
  { role: 'sub_agent', rate: 0.03 },
  { role: 'direct_agent', rate: 0.015 },
  { role: 'agent_head', rate: 0.005 },
]

const rows = [
  { id: 'c1', agent_id: 'a1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned', properties: { name: 'Lot A' }, agents: { name: 'Ana Sub' } },
  { id: 'c2', agent_id: 'a2', role_at_sale: 'direct_agent', rate: 0.015, amount: 15000, status: 'paid', properties: { name: 'Lot A' }, agents: { name: 'Ben Direct' } },
]

describe('AdminCommissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCommissionRates.mockResolvedValue(rates)
    fetchCommissions.mockResolvedValue(rows)
    markCommissionPaid.mockResolvedValue({ ...rows[0], status: 'paid' })
    updateCommissionRates.mockResolvedValue([])
  })

  it('lists commissions with agent and property names', async () => {
    render(<AdminCommissions />)

    expect(await screen.findByText('Ana Sub')).toBeInTheDocument()
    expect(screen.getAllByText('Lot A').length).toBe(2)
    expect(screen.getByText('₱ 30,000')).toBeInTheDocument()
  })

  it('marks an earned commission paid after confirmation', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    await screen.findByText('Ana Sub')
    const row = screen.getByText('Ana Sub').closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Mark Paid' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark Paid' }))

    expect(markCommissionPaid).toHaveBeenCalledWith('c1')
  })

  it('saves edited rates as fractions', async () => {
    const user = userEvent.setup()

    render(<AdminCommissions />)

    const input = await screen.findByLabelText('Sub Agent rate (%)')
    await user.clear(input)
    await user.type(input, '4')
    await user.click(screen.getByRole('button', { name: 'Save Rates' }))

    expect(updateCommissionRates).toHaveBeenCalledWith(
      expect.objectContaining({ sub_agent: 0.04 }),
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/AdminCommissions.test.jsx`
Expected: FAIL — cannot resolve `./AdminCommissions.jsx`.

- [ ] **Step 3: Write the implementation**

```jsx
import { useCallback, useEffect, useState } from 'react'
import { fetchCommissionRates, updateCommissionRates } from '../../lib/agents.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { fetchCommissions, markCommissionPaid } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'
import { COMMISSION_ROLES, formatRate } from '../../lib/commissions.js'
import ConfirmModal from '../shared/ConfirmModal.jsx'

export default function AdminCommissions() {
  const [rateInputs, setRateInputs] = useState({})
  const [ratesState, setRatesState] = useState('loading')
  const [ratesMessage, setRatesMessage] = useState('')
  const [savingRates, setSavingRates] = useState(false)
  const [commissions, setCommissions] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [confirmPaid, setConfirmPaid] = useState(null)
  const [savingPaid, setSavingPaid] = useState(false)

  const loadRates = useCallback(() => {
    setRatesState('loading')
    fetchCommissionRates()
      .then((rows) => {
        setRateInputs(Object.fromEntries(rows.map((r) => [r.role, String(Number(r.rate) * 100)])))
        setRatesState('ready')
      })
      .catch(() => setRatesState('error'))
  }, [])

  const loadCommissions = useCallback(() => {
    setState('loading')
    fetchCommissions(statusFilter ? { status: statusFilter } : {})
      .then((rows) => {
        setCommissions(rows)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [statusFilter])

  useEffect(loadRates, [loadRates])
  useEffect(loadCommissions, [loadCommissions])

  const saveRates = async (e) => {
    e.preventDefault()
    if (savingRates) return
    setSavingRates(true)
    setRatesMessage('')
    try {
      const payload = Object.fromEntries(
        Object.entries(rateInputs).map(([role, value]) => [role, Number(value) / 100]),
      )
      await updateCommissionRates(payload)
      setRatesMessage('Rates saved.')
    } catch {
      setRatesMessage('Could not save the rates. Please try again.')
    } finally {
      setSavingRates(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!confirmPaid || savingPaid) return
    setSavingPaid(true)
    try {
      await markCommissionPaid(confirmPaid.id)
      setCommissions((list) => list.map((c) => (c.id === confirmPaid.id ? { ...c, status: 'paid' } : c)))
      setConfirmPaid(null)
    } catch {
      setError(err?.message === 'Commission is already paid.' ? err.message : 'Could not mark the commission paid. Please try again.')
    } finally {
      setSavingPaid(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">Commissions</h1>

      <form onSubmit={saveRates} className="mb-8 rounded-lg border border-mist bg-white p-5">
        <h2 className="mb-1 font-display text-sm font-bold text-brand-deep">Rates</h2>
        <p className="mb-4 text-xs text-ink/50">Percent of the lot price paid to each level. Existing commissions keep their original rate.</p>
        {ratesState === 'loading' && <p className="text-sm text-ink/60">Loading rates…</p>}
        {ratesState === 'error' && <p className="text-sm text-ink/60">Could not load rates.</p>}
        {ratesState === 'ready' && (
          <div className="flex flex-wrap items-end gap-4">
            {COMMISSION_ROLES.map((role) => (
              <div key={role}>
                <label htmlFor={`rate-${role}`} className="mb-1.5 block text-sm font-semibold text-brand-deep">
                  {ROLE_LABELS[role]} rate (%)
                </label>
                <input
                  id={`rate-${role}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-32 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                  value={rateInputs[role] ?? ''}
                  onChange={(e) => setRateInputs((inputs) => ({ ...inputs, [role]: e.target.value }))}
                />
              </div>
            ))}
            <button type="submit" disabled={savingRates} className="btn btn-gold disabled:opacity-60">
              {savingRates ? 'Saving…' : 'Save Rates'}
            </button>
          </div>
        )}
        {ratesMessage && <p className="mt-3 text-sm font-medium text-ink/70">{ratesMessage}</p>}
      </form>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="cf-status" className="text-sm font-semibold text-brand-deep">Status</label>
        <select
          id="cf-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All</option>
          <option value="earned">Earned</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading commissions…</p>}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-mist bg-white p-10 text-center">
          <p className="text-ink/70">Could not load commissions.</p>
          <button onClick={loadCommissions} className="btn btn-gold">Retry</button>
        </div>
      )}

      {state === 'ready' && commissions.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">No commissions yet.</p>
      )}

      {state === 'ready' && commissions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Property</th>
                <th className="hidden px-4 py-3 sm:table-cell">Rate</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((row) => (
                <tr key={row.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3 font-semibold text-brand-deep">{row.agents?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink/70">{row.properties?.name ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">
                    {formatRate(row.rate)} <span className="text-xs text-ink/50">({ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale})</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {row.status === 'paid' ? 'Paid' : 'Earned'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'earned' && (
                      <button
                        onClick={() => setConfirmPaid(row)}
                        className="rounded-md border border-mist px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmPaid)}
        onClose={() => setConfirmPaid(null)}
        onConfirm={handleMarkPaid}
        title="Mark Commission Paid"
        message={confirmPaid ? `Mark ${formatPrice(confirmPaid.amount)} for ${confirmPaid.agents?.name ?? 'this agent'} as paid?` : ''}
        confirmLabel="Mark Paid"
        loading={savingPaid}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/AdminCommissions.test.jsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminCommissions.jsx src/components/admin/AdminCommissions.test.jsx
git commit -m "feat(admin): add commissions tab with rates and mark-paid"
```

---

## Milestone D — Agent-facing views

### Task 17: Available lots and my sales

**Files:**
- Create: `src/components/admin/AgentLots.jsx`
- Create: `src/components/admin/AgentLots.test.jsx`
- Create: `src/components/admin/AgentSales.jsx`
- Create: `src/components/admin/AgentSales.test.jsx`

- [ ] **Step 1: Write the failing tests**

`src/components/admin/AgentLots.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentLots from './AgentLots.jsx'

vi.mock('../../lib/api.js', () => ({ fetchProperties: vi.fn() }))

import { fetchProperties } from '../../lib/api.js'

describe('AgentLots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists available lots with prices', async () => {
    fetchProperties.mockResolvedValue({
      data: [{ id: 'p1', name: 'Andor Ridge Lot A', location: 'Batangas City', price: 1500000, lot_area_sqm: 150, image_url: null }],
      count: 1,
    })

    render(<AgentLots />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(fetchProperties).toHaveBeenCalledWith({ status: 'available', sort: 'newest' })
  })

  it('shows an empty state when nothing is available', async () => {
    fetchProperties.mockResolvedValue({ data: [], count: 0 })

    render(<AgentLots />)

    expect(await screen.findByText('No available lots right now.')).toBeInTheDocument()
  })
})
```

`src/components/admin/AgentSales.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentSales from './AgentSales.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchMySales: vi.fn() }))

import { fetchMySales } from '../../lib/sales.js'

describe('AgentSales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the agent sold lots', async () => {
    fetchMySales.mockResolvedValue([
      { id: 'p1', name: 'Andor Ridge Lot A', location: 'Batangas City', price: 1500000, sold_at: '2026-09-01T00:00:00Z' },
    ])

    render(<AgentSales agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('Andor Ridge Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 1,500,000')).toBeInTheDocument()
    expect(fetchMySales).toHaveBeenCalledWith('a1')
  })

  it('shows an empty state when the agent has no sales', async () => {
    fetchMySales.mockResolvedValue([])

    render(<AgentSales agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('You have no sold lots yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/AgentLots.test.jsx src/components/admin/AgentSales.test.jsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Write AgentLots**

```jsx
import { useEffect, useState } from 'react'
import { fetchProperties } from '../../lib/api.js'
import { formatPrice } from '../../lib/format.js'

export default function AgentLots() {
  const [lots, setLots] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchProperties({ status: 'available', sort: 'newest' })
      .then((result) => {
        if (!mounted) return
        setLots(result.data ?? [])
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-extrabold text-brand-deep">Available Lots</h1>
      <p className="mb-6 text-sm text-ink/60">Lots you can sell. Coordinate with the admin to close a deal.</p>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading lots…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load lots. Please refresh.
        </p>
      )}
      {state === 'ready' && lots.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          No available lots right now.
        </p>
      )}

      {state === 'ready' && lots.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <article key={lot.id} className="overflow-hidden rounded-lg border border-mist bg-white shadow-card">
              {lot.image_url ? (
                <img src={lot.image_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 place-items-center bg-mist text-sm text-ink/40">No image</div>
              )}
              <div className="space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-brand-deep">{lot.name}</h2>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">Available</span>
                </div>
                <p className="text-sm text-ink/60">{lot.location}</p>
                <p className="text-sm font-semibold text-ink">{formatPrice(lot.price) ?? 'Price on request'}</p>
                {lot.lot_area_sqm != null && (
                  <p className="text-xs text-ink/50">{Number(lot.lot_area_sqm).toLocaleString('en-PH')} sqm</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write AgentSales**

```jsx
import { useEffect, useState } from 'react'
import { fetchMySales } from '../../lib/sales.js'
import { formatPrice } from '../../lib/format.js'

export default function AgentSales({ agent }) {
  const [sales, setSales] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchMySales(agent.id)
      .then((rows) => {
        if (!mounted) return
        setSales(rows)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Sales</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading sales…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your sales. Please refresh.
        </p>
      )}
      {state === 'ready' && sales.length === 0 && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          You have no sold lots yet.
        </p>
      )}

      {state === 'ready' && sales.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3">Lot</th>
                <th className="hidden px-4 py-3 sm:table-cell">Location</th>
                <th className="px-4 py-3">Price</th>
                <th className="hidden px-4 py-3 md:table-cell">Sold</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-mist/70 last:border-0">
                  <td className="px-4 py-3 font-semibold text-brand-deep">{sale.name}</td>
                  <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{sale.location}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(sale.price) ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-ink/60 md:table-cell">
                    {sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/AgentLots.test.jsx src/components/admin/AgentSales.test.jsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AgentLots.jsx src/components/admin/AgentLots.test.jsx src/components/admin/AgentSales.jsx src/components/admin/AgentSales.test.jsx
git commit -m "feat(agent): add available lots and my sales views"
```

---

### Task 18: My commissions and my downline

**Files:**
- Create: `src/components/admin/AgentCommissions.jsx`
- Create: `src/components/admin/AgentCommissions.test.jsx`
- Create: `src/components/admin/AgentDownline.jsx`
- Create: `src/components/admin/AgentDownline.test.jsx`

- [ ] **Step 1: Write the failing tests**

`src/components/admin/AgentCommissions.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentCommissions from './AgentCommissions.jsx'

vi.mock('../../lib/sales.js', () => ({ fetchCommissions: vi.fn() }))

import { fetchCommissions } from '../../lib/sales.js'

describe('AgentCommissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows earned and paid totals with per-lot rows', async () => {
    fetchCommissions.mockResolvedValue([
      { id: 'c1', role_at_sale: 'sub_agent', rate: 0.03, amount: 30000, status: 'earned', properties: { name: 'Lot A' } },
      { id: 'c2', role_at_sale: 'sub_agent', rate: 0.03, amount: 15000, status: 'paid', properties: { name: 'Lot B' } },
    ])

    render(<AgentCommissions agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('Lot A')).toBeInTheDocument()
    expect(screen.getByText('₱ 45,000')).toBeInTheDocument()
    expect(screen.getByText('₱ 15,000')).toBeInTheDocument()
    expect(fetchCommissions).toHaveBeenCalledWith({ agentId: 'a1' })
  })

  it('shows an empty state with no commissions', async () => {
    fetchCommissions.mockResolvedValue([])

    render(<AgentCommissions agent={{ id: 'a1', name: 'Ana' }} />)

    expect(await screen.findByText('No commissions yet.')).toBeInTheDocument()
  })
})
```

`src/components/admin/AgentDownline.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentDownline from './AgentDownline.jsx'

vi.mock('../../lib/sales.js', () => ({
  fetchTeamSales: vi.fn(),
  fetchCommissions: vi.fn(),
}))

import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'

const members = [
  { id: 'a2', name: 'Rico Recruit', role: 'sub_agent' },
  { id: 'a3', name: 'Dina Recruit', role: 'sub_agent' },
]

describe('AgentDownline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('summarizes each downline member', async () => {
    fetchTeamSales.mockResolvedValue([{ id: 'p1', sold_by: 'a2' }])
    fetchCommissions.mockResolvedValue([
      { id: 'c1', agent_id: 'a2', amount: 30000, status: 'earned' },
      { id: 'c2', agent_id: 'a3', amount: 10000, status: 'paid' },
    ])

    render(<AgentDownline members={members} />)

    expect(await screen.findByText('Rico Recruit')).toBeInTheDocument()
    expect(screen.getByText('Sold Lots: 1')).toBeInTheDocument()
    expect(screen.getByText('Earned: ₱ 30,000')).toBeInTheDocument()
    expect(screen.getByText('Earned: ₱ 10,000')).toBeInTheDocument()
    expect(screen.getByText('Paid: ₱ 10,000')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/AgentCommissions.test.jsx src/components/admin/AgentDownline.test.jsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Write AgentCommissions**

```jsx
import { useEffect, useState } from 'react'
import { fetchCommissions } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'
import { formatRate } from '../../lib/commissions.js'

export default function AgentCommissions({ agent }) {
  const [rows, setRows] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    fetchCommissions({ agentId: agent.id })
      .then((commissions) => {
        if (!mounted) return
        setRows(commissions)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [agent.id])

  const earned = rows.reduce((sum, c) => sum + Number(c.amount), 0)
  const paid = rows.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Commissions</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading commissions…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your commissions. Please refresh.
        </p>
      )}

      {state === 'ready' && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(earned) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Earned</p>
            </div>
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(paid) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Paid</p>
            </div>
            <div className="rounded-lg border border-mist bg-white p-5">
              <p className="text-2xl font-extrabold text-brand-deep">{formatPrice(earned - paid) ?? '₱ 0'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Unpaid</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-mist bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mist bg-surface text-xs font-bold uppercase tracking-wide text-ink/60">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Level</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Rate</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-mist/70 last:border-0">
                      <td className="px-4 py-3 font-semibold text-brand-deep">{row.properties?.name ?? '—'}</td>
                      <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{ROLE_LABELS[row.role_at_sale] ?? row.role_at_sale}</td>
                      <td className="hidden px-4 py-3 text-ink/70 sm:table-cell">{formatRate(row.rate)}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{formatPrice(row.amount) ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {row.status === 'paid' ? 'Paid' : 'Earned'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write AgentDownline**

```jsx
import { useEffect, useState } from 'react'
import { fetchCommissions, fetchTeamSales } from '../../lib/sales.js'
import { ROLE_LABELS } from '../../lib/agentMeta.js'
import { formatPrice } from '../../lib/format.js'

export default function AgentDownline({ members }) {
  const [sales, setSales] = useState([])
  const [commissions, setCommissions] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let mounted = true
    const ids = members.map((m) => m.id)
    Promise.all([fetchTeamSales(ids), fetchCommissions()])
      .then(([teamSales, teamCommissions]) => {
        if (!mounted) return
        setSales(teamSales)
        setCommissions(teamCommissions)
        setState('ready')
      })
      .catch(() => {
        if (mounted) setState('error')
      })
    return () => { mounted = false }
  }, [members])

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-brand-deep">My Downline</h1>

      {state === 'loading' && <p className="py-10 text-center text-ink/60">Loading downline…</p>}
      {state === 'error' && (
        <p className="rounded-lg border border-mist bg-white p-10 text-center text-ink/60">
          Could not load your downline. Please refresh.
        </p>
      )}

      {state === 'ready' && (
        <div className="space-y-4">
          {members.map((member) => {
            const memberSales = sales.filter((s) => s.sold_by === member.id)
            const memberCommissions = commissions.filter((c) => c.agent_id === member.id)
            const earned = memberCommissions.reduce((sum, c) => sum + Number(c.amount), 0)
            const paid = memberCommissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

            return (
              <div key={member.id} className="rounded-lg border border-mist bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-deep">{member.name}</p>
                    <p className="text-xs text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-ink/70">
                    <span>Sold Lots: {memberSales.length}</span>
                    <span>Earned: {formatPrice(earned) ?? '₱ 0'}</span>
                    <span>Paid: {formatPrice(paid) ?? '₱ 0'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/AgentCommissions.test.jsx src/components/admin/AgentDownline.test.jsx`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AgentCommissions.jsx src/components/admin/AgentCommissions.test.jsx src/components/admin/AgentDownline.jsx src/components/admin/AgentDownline.test.jsx
git commit -m "feat(agent): add my commissions and downline views"
```

---

### Task 19: Full verification and manual setup

**Files:**
- No source changes expected (fix-ups only if verification fails)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all test files pass (existing 18 files plus the new suites).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no unresolved imports.

- [ ] **Step 3: Confirm no stale policy code remains**

Run: `grep -rn "admin_email\|auth.jwt() ->>" supabase/schema.sql`
Expected: no matches (the bootstrap snippet uses `'admin@gmail.com'` only inside comments).

- [ ] **Step 4: Manual Supabase setup (requires the user)**

1. Supabase → SQL editor → run the updated `supabase/schema.sql`.
2. Supabase → Authentication → create the admin login (if not existing), then run the bootstrap insert from the bottom of `schema.sql` with the real admin email.
3. Deploy the function: `npx supabase link --project-ref nfikkjuuzwphswutocao && npx supabase functions deploy create-agent`.
4. `npm run dev` → sign in as admin → **Commissions** tab → verify the three placeholder rates and adjust them.
5. **Agents** tab → create one agent per role (Sub, Direct, Head) and assign uplines, forming a 3-level chain.
6. Edit a property with a price → set status **Sold** → pick the Sub Agent as seller → save.
7. Verify in the **Commissions** tab: three rows (Sub 3%, Direct 1.5%, Head 0.5% of the price), all **Earned**.
8. Mark one row **Paid**; verify the agent's **My Commissions** totals split earned vs paid.
9. Promotion checks: record 5 own sales for a Sub Agent with 5 registered recruits (create the recruits through the Agents tab) and confirm the role flips to **Direct Agent** in the tree; confirm a Direct Agent with 5 Direct Agents in the downline flips to **Agent Head**.
10. Sign in as an agent: confirm only the four agent tabs render, **Available Lots** lists available properties, and another agent's commissions are not visible.
11. Un-sale a property whose commissions are all **Earned**: confirm the commission rows disappear. Mark one **Paid**, then attempt to un-sale: expect the "Commission already paid — reverse payment first." block.
12. Legacy sold lots (sold before this feature) have no `sold_by`, so they do not appear in agent sales or commission totals. Attribute them by editing each sold lot in the admin Properties tab, selecting the selling agent, and saving — the sale-aware save stamps `sold_by`/`sold_at` and generates the commission rows. Caveats: a legacy lot with no price must have one entered first (sold saves require a price), and attribution uses the current commission rates and the edit date for `sold_at`, not the historical sale date.
13. Known limitation: the Properties tab's bulk "Set Status → Sold" action changes status only — it does not record a selling agent or generate commissions. Use the single-edit sold flow (select the Selling Agent) for real sales, and attribute any bulk-sold lots afterward by editing them as in step 12.

- [ ] **Step 5: Commit any fix-ups**

```bash
git add -A
git commit -m "fix: agent commission verification fix-ups"
```

Only create this commit if Step 1-3 surfaced fixes; otherwise skip.
