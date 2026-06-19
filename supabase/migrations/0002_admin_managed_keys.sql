-- 0002_admin_managed_keys.sql — admin/user-split Phase A
-- Adds the managed-key model tables + profiles.status, with RLS.
-- Idempotent (safe to re-run): uses `add column if not exists`,
-- `create table if not exists`, `create index if not exists`, and
-- `drop policy if exists` before each `create policy` — matching the
-- style of 0001_init.sql.
-- Run order: apply AFTER 0001_init.sql.

-- =============================================================================
-- 3.1 profiles — add `status` column for admin suspend/activate (Q4 = yes).
-- =============================================================================

alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended'));

-- =============================================================================
-- 3.2 provider_presets — admin-editable provider catalog. This is the DB
-- counterpart of PRESET_PROVIDERS in src/lib/providers/presets.ts. Seeded by
-- supabase/seed-presets.sql.
-- =============================================================================

create table if not exists public.provider_presets (
  id            text primary key,                 -- 'openai','gemini',...
  display_name  text not null,
  base_url      text not null,
  models        jsonb not null,                   -- string[] (e.g. ["gpt-5.4-mini", ...])
  default_model text not null,
  enabled       boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id)
);

create index if not exists provider_presets_enabled_sort_idx
  on public.provider_presets(enabled, sort_order);

alter table public.provider_presets enable row level security;

-- Any authenticated user can read the catalog (needed to populate the client
-- provider list). Writes are admin-only.
drop policy if exists "presets: auth read" on public.provider_presets;
create policy "presets: auth read"
  on public.provider_presets for select
  using (auth.role() = 'authenticated');

drop policy if exists "presets: admin write" on public.provider_presets;
create policy "presets: admin write"
  on public.provider_presets for all
  using (
    exists(select 1 from public.profiles p
           where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists(select 1 from public.profiles p
           where p.id = auth.uid() and p.role = 'admin')
  );

-- =============================================================================
-- 3.2 provider_keys — encrypted API keys, one-or-more per preset (rotation /
-- failover). RLS is ENABLED with NO policies, so only the service_role can
-- read/write. The admin UI surfaces only `key_hint` (masked), never the
-- plaintext or the encrypted blob.
-- =============================================================================

create table if not exists public.provider_keys (
  id            uuid primary key default gen_random_uuid(),
  provider_id   text not null references public.provider_presets(id) on delete cascade,
  encrypted_key text not null,                    -- AES-256-GCM payload (Phase B)
  key_hint      text not null,                    -- e.g. 'sk-...abcd' for display
  label         text,                             -- optional human label
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

create index if not exists provider_keys_provider_idx
  on public.provider_keys(provider_id) where enabled = true;

alter table public.provider_keys enable row level security;
-- Intentionally no policies: authenticated/anon clients are blocked by RLS.
-- Only the server-side service_role client (Phase B) bypasses RLS.

-- =============================================================================
-- 3.2 usage_logs — per-translation usage telemetry for /admin/stats.
-- =============================================================================

create table if not exists public.usage_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  provider_id  text not null,
  model        text not null,
  source_lang  text not null,
  target_lang  text not null,
  input_chars  int not null default 0,
  output_chars int not null default 0,
  duration_ms  int,
  status       text not null default 'ok' check (status in ('ok', 'error')),
  error_code   text,
  created_at   timestamptz not null default now()
);

create index if not exists usage_logs_user_idx
  on public.usage_logs(user_id, created_at desc);
create index if not exists usage_logs_created_idx
  on public.usage_logs(created_at desc);

alter table public.usage_logs enable row level security;

-- Owner can read their own rows; admin can read all. Inserts are performed by
-- the service_role (Phase B /api/translate handler), so no insert policy here.
drop policy if exists "usage: self read" on public.usage_logs;
create policy "usage: self read"
  on public.usage_logs for select
  using (auth.uid() = user_id);

drop policy if exists "usage: admin read" on public.usage_logs;
create policy "usage: admin read"
  on public.usage_logs for select
  using (
    exists(select 1 from public.profiles p
           where p.id = auth.uid() and p.role = 'admin')
  );
