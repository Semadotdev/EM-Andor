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
  map_pins jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.properties add column if not exists map_pins jsonb not null default '[]';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'map_x'
  ) then
    update public.properties
    set map_pins = jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'name', name,
      'price', price,
      'lot_area_sqm', lot_area_sqm,
      'x', map_x,
      'y', map_y
    ))
    where map_x is not null and map_y is not null;
  end if;
end $$;

alter table public.properties drop column if exists map_x;
alter table public.properties drop column if exists map_y;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  project_type text,
  message text not null,
  property_id uuid references public.properties(id) on delete set null,
  property_name text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists property_id uuid;
alter table public.inquiries add column if not exists property_name text;

alter table public.inquiries drop constraint if exists inquiries_property_id_fkey;
alter table public.inquiries add constraint inquiries_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete set null;

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

-- Add status to properties
alter table public.properties add column if not exists status text not null default 'available';

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'farm_lot' check (type in ('farm_lot', 'housing', 'commercial', 'development')),
  address text not null,
  price_per_sqm numeric not null default 0 check (price_per_sqm >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_commission_rates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('sub_agent', 'direct_agent', 'agent_head')),
  rate numeric(6,4) not null default 0 check (rate >= 0 and rate <= 1),
  updated_at timestamptz not null default now(),
  unique (project_id, role)
);

create index if not exists project_commission_rates_project_id_idx
  on public.project_commission_rates(project_id);

alter table public.properties add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.properties add column if not exists block_no text;
alter table public.properties add column if not exists lot_no text;

create unique index if not exists properties_project_block_lot_idx
  on public.properties (project_id, block_no, lot_no)
  where project_id is not null;

alter table public.projects enable row level security;
alter table public.project_commission_rates enable row level security;

drop policy if exists "admin all on projects" on public.projects;
create policy "admin all on projects" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read projects" on public.projects;
create policy "public read projects" on public.projects
  for select to anon, authenticated using (true);

drop policy if exists "admin all on project_commission_rates" on public.project_commission_rates;
create policy "admin all on project_commission_rates" on public.project_commission_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read project_commission_rates" on public.project_commission_rates;
create policy "authenticated read project_commission_rates" on public.project_commission_rates
  for select to authenticated using (true);

-- Buyer sales (one per sold lot)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  property_id uuid unique not null references public.properties(id) on delete cascade,
  buyer_name text not null,
  buyer_address text,
  tcp numeric not null default 0 check (tcp >= 0),
  downpayment numeric not null default 0 check (downpayment >= 0),
  monthly_amortization numeric not null default 0 check (monthly_amortization >= 0),
  terms_of_payment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Buyer payment ledger (DATE / OR# / AMOUNT / SURCHARGE / INTEREST / PRINCIPAL(derived) / BALANCE(derived) / REMARKS)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  entry_date date not null,
  or_number text,
  amount numeric not null default 0 check (amount >= 0),
  surcharge numeric not null default 0 check (surcharge >= 0),
  interest numeric not null default 0 check (interest >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_property_date_idx on public.payments(property_id, entry_date);

alter table public.sales enable row level security;
alter table public.payments enable row level security;

drop policy if exists "admin all on sales" on public.sales;
create policy "admin all on sales" on public.sales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all on payments" on public.payments;
create policy "admin all on payments" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.properties enable row level security;
alter table public.inquiries enable row level security;

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

drop policy if exists "public read pinned properties" on public.properties;
create policy "public read pinned properties" on public.properties
  for select to anon using (is_pinned = true);

drop policy if exists "public insert inquiries" on public.inquiries;
create policy "public insert inquiries" on public.inquiries
  for insert to anon with check (is_read = false);

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

drop policy if exists "public read property-images" on storage.objects;
create policy "public read property-images" on storage.objects
  for select to anon using (bucket_id = 'property-images');

drop policy if exists "admin read property-images" on storage.objects;
create policy "admin read property-images" on storage.objects
  for select to authenticated using (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admin insert property-images" on storage.objects;
create policy "admin insert property-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admin update property-images" on storage.objects;
create policy "admin update property-images" on storage.objects
  for update to authenticated using (bucket_id = 'property-images' and public.is_admin())
  with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admin delete property-images" on storage.objects;
create policy "admin delete property-images" on storage.objects
  for delete to authenticated using (bucket_id = 'property-images' and public.is_admin());

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.sales;
create trigger set_updated_at before update on public.sales
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.project_commission_rates;
create trigger set_updated_at before update on public.project_commission_rates
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.agents;
create trigger set_updated_at before update on public.agents
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.commission_settings;
create trigger set_updated_at before update on public.commission_settings
  for each row execute function public.set_updated_at();

-- Add updated_at to properties
alter table public.properties add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_updated_at on public.properties;
create trigger set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Add updated_at to inquiries
alter table public.inquiries add column if not exists updated_at timestamptz not null default now();
drop trigger if exists set_updated_at on public.inquiries;
create trigger set_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();

-- Activity log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "admin all on activity_log" on public.activity_log;
create policy "admin all on activity_log" on public.activity_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- CMS Content table
create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  page_id text unique not null,
  title text,
  subtitle text,
  content text,
  image_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_content enable row level security;

drop policy if exists "admin all on cms_content" on public.cms_content;
create policy "admin all on cms_content" on public.cms_content
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "public read published cms_content" on public.cms_content;
create policy "public read published cms_content" on public.cms_content
  for select to anon using (status = 'published');

drop trigger if exists set_updated_at on public.cms_content;
create trigger set_updated_at before update on public.cms_content
  for each row execute function public.set_updated_at();

-- Seed default CMS pages
insert into public.cms_content (page_id, title, status) values
  ('home-hero', 'Home Hero Section', 'draft'),
  ('about', 'About Us', 'draft'),
  ('contact', 'Contact Information', 'draft')
on conflict (page_id) do nothing;

-- Notification Settings table
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  notification_type text unique not null,
  enabled boolean not null default true,
  subject_template text,
  body_template text,
  recipients text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "admin all on notification_settings" on public.notification_settings;
create policy "admin all on notification_settings" on public.notification_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists set_updated_at on public.notification_settings;
create trigger set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- Notification History table
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  recipient text not null,
  subject text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.notification_history enable row level security;

drop policy if exists "admin all on notification_history" on public.notification_history;
create policy "admin all on notification_history" on public.notification_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed default notification settings
insert into public.notification_settings (notification_type, subject_template, body_template, recipients) values
  ('new_inquiry', 'New Inquiry: {property_name}', 'You have received a new inquiry from {customer_name}.\n\nProperty: {property_name}\nMessage: {inquiry_message}', '{}'),
  ('status_change', 'Property Status Update: {property_name}', 'The status of {property_name} has been changed to {property_status}.', '{}'),
  ('property_sold', 'Property Sold: {property_name}', 'Congratulations! {property_name} has been marked as sold on {date}.', '{}')
on conflict (notification_type) do nothing;

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

-- Lot-level per-m² price: lots are priced per unit from the excel upload or the
-- Edit Lot modal; the total price stays in sync with area × price_per_sqm.
alter table public.properties add column if not exists price_per_sqm numeric;

-- Backfill existing lots from their current total price and area.
update public.properties
   set price_per_sqm = round((price / nullif(lot_area_sqm, 0))::numeric, 2)
 where price_per_sqm is null
   and price is not null
   and lot_area_sqm is not null
   and lot_area_sqm > 0;
