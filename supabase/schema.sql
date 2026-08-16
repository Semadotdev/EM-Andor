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
