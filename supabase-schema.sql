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
