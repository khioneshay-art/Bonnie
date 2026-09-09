-- BONNIE ADDITIVE SCHEMA
-- Safe by design: creates only bonnie_* tables. Never modifies PITCH tables.
create extension if not exists pgcrypto;

create table if not exists public.bonnie_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid,
  business_name text,
  title text,
  mode text not null default 'chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bonnie_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bonnie_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bonnie_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid,
  memory_type text not null default 'fact',
  content text not null,
  source text,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bonnie_conversations_user_updated on public.bonnie_conversations(user_id,updated_at desc);
create index if not exists bonnie_messages_conversation_created on public.bonnie_messages(conversation_id,created_at);
create index if not exists bonnie_memory_user_updated on public.bonnie_memory(user_id,updated_at desc);

alter table public.bonnie_conversations enable row level security;
alter table public.bonnie_messages enable row level security;
alter table public.bonnie_memory enable row level security;

drop policy if exists "bonnie conversations own" on public.bonnie_conversations;
create policy "bonnie conversations own" on public.bonnie_conversations for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "bonnie messages own" on public.bonnie_messages;
create policy "bonnie messages own" on public.bonnie_messages for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "bonnie memory own" on public.bonnie_memory;
create policy "bonnie memory own" on public.bonnie_memory for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Do NOT add policies to PITCH tables here.
