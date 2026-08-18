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

alter table public.properties enable row level security;
alter table public.inquiries enable row level security;

-- ⚠️ IMPORTANT: replace the admin email below with the real admin account email
-- before running this file. The admin dashboard only works for this account.
-- Create the user in Supabase → Authentication → Users, then set their email here.
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
  for select to authenticated using (bucket_id = 'property-images');

drop policy if exists "admin insert property-images" on storage.objects;
create policy "admin insert property-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-images');

drop policy if exists "admin update property-images" on storage.objects;
create policy "admin update property-images" on storage.objects
  for update to authenticated using (bucket_id = 'property-images') with check (bucket_id = 'property-images');

drop policy if exists "admin delete property-images" on storage.objects;
create policy "admin delete property-images" on storage.objects
  for delete to authenticated using (bucket_id = 'property-images');

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

-- Add status to properties
alter table public.properties add column if not exists status text not null default 'available';

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

-- Seed default notification settings
insert into public.notification_settings (notification_type, subject_template, body_template, recipients) values
  ('new_inquiry', 'New Inquiry: {property_name}', 'You have received a new inquiry from {customer_name}.\n\nProperty: {property_name}\nMessage: {inquiry_message}', '{}'),
  ('status_change', 'Property Status Update: {property_name}', 'The status of {property_name} has been changed to {property_status}.', '{}'),
  ('property_sold', 'Property Sold: {property_name}', 'Congratulations! {property_name} has been marked as sold on {date}.', '{}')
on conflict (notification_type) do nothing;
