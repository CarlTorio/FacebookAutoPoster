-- AgentFB — initial schema.
-- Tables: brands, posts, api_keys, logs. RLS enabled on all.
-- Run via Supabase dashboard SQL editor, or `supabase db push` if using the CLI.

-- ============================================================
-- brands
-- ============================================================
create table public.brands (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  niche             text,
  tone_description  text,
  signature_phrase  text,
  banned_words      text[] default '{}',
  target_audience   text,

  fb_page_id        text,
  fb_page_name      text,

  posting_times     text[] default '{}',
  timezone          text not null default 'Asia/Manila',

  post_mix          jsonb not null default '{"text_only": 0.5, "text_with_image": 0.5, "carousel": 0}',

  mode              text not null default 'paused'
                    check (mode in ('auto', 'semi_auto', 'paused')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index brands_user_id_idx on public.brands(user_id);
create index brands_mode_idx on public.brands(mode) where mode != 'paused';

-- ============================================================
-- posts
-- ============================================================
create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brands(id) on delete cascade,

  post_type         text not null
                    check (post_type in ('text_only', 'text_with_image', 'carousel')),
  topic             text,
  hook              text,
  caption           text not null,
  cta               text,
  hashtags          text[] default '{}',
  image_prompt      text,
  image_url         text,
  image_urls        text[] default '{}',

  status            text not null default 'draft'
                    check (status in ('draft', 'pending_approval', 'approved',
                                       'posted', 'rejected', 'failed')),

  fb_post_id        text,
  fb_permalink      text,

  scheduled_for     timestamptz,
  posted_at         timestamptz,
  error_message     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index posts_brand_id_idx on public.posts(brand_id);
create index posts_status_idx on public.posts(status);
create index posts_brand_created_idx on public.posts(brand_id, created_at desc);

-- ============================================================
-- api_keys
-- ============================================================
create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  service       text not null
                check (service in ('claude', 'gemini', 'facebook', 'telegram')),

  -- Per-service shape (base64-encoded sensitive values at app layer):
  --   claude:   { "api_key": "..." }
  --   gemini:   { "api_key": "..." }
  --   facebook: { "app_id": "...", "app_secret": "...",
  --              "page_id": "...", "page_access_token": "...",
  --              "token_expires_at": "ISO8601" }
  --   telegram: { "bot_token": "...", "chat_id": "..." }
  credentials   jsonb not null,

  last_tested_at      timestamptz,
  last_test_ok        boolean,
  last_test_message   text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, service)
);

-- ============================================================
-- logs
-- ============================================================
create table public.logs (
  id         bigserial primary key,
  brand_id   uuid references public.brands(id) on delete set null,
  post_id    uuid references public.posts(id) on delete set null,

  level      text not null default 'info'
             check (level in ('debug', 'info', 'warn', 'error')),
  source     text not null,
  message    text not null,
  metadata   jsonb,

  created_at timestamptz not null default now()
);

create index logs_brand_id_idx on public.logs(brand_id);
create index logs_level_idx on public.logs(level);
create index logs_created_at_idx on public.logs(created_at desc);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.brands   enable row level security;
alter table public.posts    enable row level security;
alter table public.api_keys enable row level security;
alter table public.logs     enable row level security;

-- brands: owner only
create policy "brands_owner_all" on public.brands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- posts: accessible if you own the parent brand
create policy "posts_owner_all" on public.posts
  for all using (
    exists (select 1 from public.brands b
            where b.id = posts.brand_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.brands b
            where b.id = posts.brand_id and b.user_id = auth.uid())
  );

-- api_keys: owner only
create policy "api_keys_owner_all" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- logs: read-only for owner (writes use service_role from edge functions)
create policy "logs_owner_select" on public.logs
  for select using (
    brand_id is null
    or exists (select 1 from public.brands b
               where b.id = logs.brand_id and b.user_id = auth.uid())
  );
