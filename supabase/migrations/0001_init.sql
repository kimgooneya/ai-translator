-- 0001_init.sql — initial Supabase schema for translator app
-- Run order: Supabase Dashboard → SQL Editor → paste & run.
-- Or: `supabase db push` once the project is linked via Supabase CLI.

-- =============================================================================
-- Enums
-- =============================================================================

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- profiles — extends auth.users with app-level fields.
-- `role` is included for the deferred admin/user screen split; defaults to
-- 'user' so this migration is forward-compatible without any admin UI yet.
-- =============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are updatable by owner" on public.profiles;
create policy "profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- =============================================================================
-- translation_history — one row per translation, scoped to a user.
-- `request` stores the full TranslationRequest payload as JSONB (matches the
-- existing TranslationHistoryEntry shape from src/lib/schemas/index.ts).
-- =============================================================================

create table if not exists public.translation_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  request       jsonb not null,
  response      text not null,
  provider_name text not null,
  model_name    text not null,
  created_at    timestamptz not null default now(),
  tokens_used   integer
);

create index if not exists translation_history_user_created_idx
  on public.translation_history(user_id, created_at desc);

alter table public.translation_history enable row level security;

drop policy if exists "history: owner all" on public.translation_history;
create policy "history: owner all"
  on public.translation_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- glossaries — one row per user (1:1). Holds the per-user enabled flag.
-- =============================================================================

create table if not exists public.glossaries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique not null references auth.users(id) on delete cascade,
  enabled    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.glossaries enable row level security;

drop policy if exists "glossary: owner all" on public.glossaries;
create policy "glossary: owner all"
  on public.glossaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- glossary_entries — many per glossary. RLS walks up to glossary.user_id.
-- =============================================================================

create table if not exists public.glossary_entries (
  id          uuid primary key default gen_random_uuid(),
  glossary_id uuid not null references public.glossaries(id) on delete cascade,
  source      text not null,
  target      text not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists glossary_entries_glossary_idx
  on public.glossary_entries(glossary_id);

alter table public.glossary_entries enable row level security;

drop policy if exists "entries: owner all" on public.glossary_entries;
create policy "entries: owner all"
  on public.glossary_entries for all
  using (
    exists (
      select 1 from public.glossaries g
      where g.id = glossary_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.glossaries g
      where g.id = glossary_id and g.user_id = auth.uid()
    )
  );

-- Auto-update updated_at on glossary_entries
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists glossary_entries_touch_updated_at
  on public.glossary_entries;
create trigger glossary_entries_touch_updated_at
  before update on public.glossary_entries
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- handle_new_user — auto-provision profile + glossary on signup.
-- Pulls email/name/avatar from OAuth metadata when present.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'user_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.glossaries (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
