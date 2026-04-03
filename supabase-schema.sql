-- Vespera CRM — Supabase schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'sales' check (role in ('admin','sales','support','client')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can read all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'sales')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Leads
create table public.leads (
  id bigint generated always as identity primary key,
  company_name text not null,
  segment text not null check (segment in ('agency','creator','studio','partner','advertiser','sugar_platform')),
  sub_segment text,
  contact_name text,
  contact_role text,
  contact_email text,
  contact_social text,
  website_url text,
  creator_count int default 0,
  est_monthly_revenue numeric default 0,
  current_platforms text,
  current_tools text,
  pain_points text,
  source text,
  source_url text,
  outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','contacted','replied','meeting_set','negotiating','closed_won','closed_lost')),
  fit_score int default 0,
  close_probability numeric default 0,
  est_deal_value numeric default 0,
  next_action text,
  next_action_date timestamptz,
  notes text,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;
create policy "Authenticated users can read leads" on public.leads for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert leads" on public.leads for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update leads" on public.leads for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete leads" on public.leads for delete using (auth.role() = 'authenticated');

-- 3. Activities
create table public.activities (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.leads(id) on delete cascade,
  type text not null,
  description text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;
create policy "Authenticated users can manage activities" on public.activities for all using (auth.role() = 'authenticated');

-- 4. Chat rooms
create table public.chat_rooms (
  id bigint generated always as identity primary key,
  name text not null,
  lead_id bigint references public.leads(id),
  is_private boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.chat_rooms enable row level security;

-- 5. Chat participants
create table public.chat_participants (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

alter table public.chat_participants enable row level security;
create policy "Users see rooms they participate in" on public.chat_rooms for select
  using (exists (select 1 from public.chat_participants where room_id = chat_rooms.id and user_id = auth.uid()));
create policy "Authenticated users can create rooms" on public.chat_rooms for insert with check (auth.role() = 'authenticated');

create policy "Participants can see participation" on public.chat_participants for select using (auth.role() = 'authenticated');
create policy "Authenticated users can join rooms" on public.chat_participants for insert with check (auth.role() = 'authenticated');

-- 6. Chat messages
create table public.chat_messages (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  is_encrypted boolean default true,
  read boolean default false,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
create policy "Participants can read messages" on public.chat_messages for select
  using (exists (select 1 from public.chat_participants where room_id = chat_messages.room_id and user_id = auth.uid()));
create policy "Participants can send messages" on public.chat_messages for insert
  with check (exists (select 1 from public.chat_participants where room_id = chat_messages.room_id and user_id = auth.uid()));

-- Enable realtime for chat
alter publication supabase_realtime add table public.chat_messages;

-- 7. Seed data (run after creating your admin user via Supabase Auth)
-- The app seeds on first login if the leads table is empty.

-- 8. Omnichannel and automation extensions
alter table public.chat_rooms add column if not exists channel text default 'internal';
alter table public.chat_rooms add column if not exists external_contact text;
alter table public.chat_rooms add column if not exists provider text default 'native';
alter table public.chat_rooms add column if not exists provider_room_id text;
alter table public.chat_rooms add column if not exists assigned_to uuid references public.profiles(id);
alter table public.chat_rooms add column if not exists priority text default 'normal';
alter table public.chat_rooms add column if not exists status text default 'open';
alter table public.chat_rooms add column if not exists last_inbound_at timestamptz;
alter table public.chat_rooms add column if not exists first_response_at timestamptz;
alter table public.chat_rooms add column if not exists sla_first_response_due_at timestamptz;
alter table public.chat_rooms add column if not exists sla_status text default 'none';

alter table public.chat_messages add column if not exists direction text default 'inbound';
alter table public.chat_messages add column if not exists original_language text;
alter table public.chat_messages add column if not exists translated_language text;
alter table public.chat_messages add column if not exists translated_content text;
alter table public.chat_messages add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.channel_connections (
  id bigint generated always as identity primary key,
  provider text not null,
  label text not null,
  webhook_url text,
  api_key text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.channel_connections add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.channel_connections enable row level security;
drop policy if exists "Authenticated users can manage channel_connections" on public.channel_connections;
create policy "Authenticated users can manage channel_connections"
  on public.channel_connections for all using (auth.role() = 'authenticated');

create table if not exists public.communication_events (
  id bigint generated always as identity primary key,
  room_id bigint references public.chat_rooms(id) on delete set null,
  lead_id bigint references public.leads(id) on delete set null,
  channel text not null,
  direction text not null default 'outbound',
  subject text,
  body text,
  status text not null default 'logged',
  external_id text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.communication_events add column if not exists status text not null default 'logged';
alter table public.communication_events add column if not exists external_id text;

alter table public.communication_events enable row level security;
drop policy if exists "Authenticated users can manage communication_events" on public.communication_events;
create policy "Authenticated users can manage communication_events"
  on public.communication_events for all using (auth.role() = 'authenticated');

create table if not exists public.canned_responses (
  id bigint generated always as identity primary key,
  title text not null,
  language text not null check (language in ('en','es')),
  channel text not null default 'all',
  body text not null,
  tags text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.canned_responses add column if not exists tags text;

alter table public.canned_responses enable row level security;
drop policy if exists "Authenticated users can manage canned_responses" on public.canned_responses;
create policy "Authenticated users can manage canned_responses"
  on public.canned_responses for all using (auth.role() = 'authenticated');

-- 9. Commerce core (Shopify/CSV-safe MVP)
create table if not exists public.products (
  id bigint generated always as identity primary key,
  source text not null default 'manual' check (source in ('shopify','manual','csv')),
  external_id text,
  handle text not null unique,
  title text not null,
  body_html text,
  vendor text,
  product_type text,
  tags text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  price numeric not null default 0,
  compare_at_price numeric,
  sku text,
  inventory_qty int not null default 0,
  featured_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_idx on public.products(status);
create index if not exists products_source_idx on public.products(source);

alter table public.products enable row level security;
drop policy if exists "Authenticated users can manage products" on public.products;
create policy "Authenticated users can manage products"
  on public.products for all using (auth.role() = 'authenticated');

create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  src text not null,
  alt text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_images enable row level security;
drop policy if exists "Authenticated users can manage product_images" on public.product_images;
create policy "Authenticated users can manage product_images"
  on public.product_images for all using (auth.role() = 'authenticated');

create table if not exists public.content_blocks (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  body text not null default '',
  type text not null default 'rich_text',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_blocks enable row level security;
drop policy if exists "Authenticated users can manage content_blocks" on public.content_blocks;
create policy "Authenticated users can manage content_blocks"
  on public.content_blocks for all using (auth.role() = 'authenticated');

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
drop policy if exists "Authenticated users can manage app_settings" on public.app_settings;
create policy "Authenticated users can manage app_settings"
  on public.app_settings for all using (auth.role() = 'authenticated');

insert into public.app_settings(key, value)
values ('storefront_mode', 'headless')
on conflict (key) do nothing;

insert into public.app_settings(key, value)
values ('checkout_provider', 'snipcart')
on conflict (key) do nothing;

insert into public.app_settings(key, value)
values ('snipcart_public_api_key', '')
on conflict (key) do nothing;

insert into public.app_settings(key, value)
values ('samcart_checkout_url', '')
on conflict (key) do nothing;

-- 10. One-page portal + forms + acknowledgment signing
create table if not exists public.portal_forms (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  fields_json text not null default '[]',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_forms enable row level security;
drop policy if exists "Authenticated users can manage portal_forms" on public.portal_forms;
create policy "Authenticated users can manage portal_forms"
  on public.portal_forms for all using (auth.role() = 'authenticated');

create table if not exists public.portal_form_submissions (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.portal_forms(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  payload_json text not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.portal_form_submissions enable row level security;
drop policy if exists "Authenticated users can manage portal_form_submissions" on public.portal_form_submissions;
create policy "Authenticated users can manage portal_form_submissions"
  on public.portal_form_submissions for all using (auth.role() = 'authenticated');

create table if not exists public.portal_ack_signatures (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  signer_name text not null,
  signer_email text,
  signed_at timestamptz not null,
  signer_ip text,
  signer_user_agent text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.portal_ack_signatures enable row level security;
drop policy if exists "Authenticated users can manage portal_ack_signatures" on public.portal_ack_signatures;
create policy "Authenticated users can manage portal_ack_signatures"
  on public.portal_ack_signatures for all using (auth.role() = 'authenticated');
