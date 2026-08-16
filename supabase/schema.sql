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
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

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
