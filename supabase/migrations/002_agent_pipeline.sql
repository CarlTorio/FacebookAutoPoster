-- Sprint 6 — Agent pipeline plumbing.
-- 1. post-images storage bucket (public read)
-- 2. pg_cron extension + schedule to call /api/trigger every 5 minutes
-- Run this AFTER 001_initial_schema.sql.

-- ============================================================
-- Storage bucket for Gemini-generated images
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  10 * 1024 * 1024, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Allow public read of post-images (so Facebook can fetch URLs).
drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Allow service_role to write (edge functions & server routes use service key).
drop policy if exists "post_images_service_write" on storage.objects;
create policy "post_images_service_write"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'post-images');

-- Allow authenticated users to write into a folder matching a brand they own.
-- Path convention: "<brand_id>/<filename>".
drop policy if exists "post_images_owner_write" on storage.objects;
create policy "post_images_owner_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and exists (
      select 1 from public.brands b
      where b.id::text = (storage.foldername(name))[1]
        and b.user_id = auth.uid()
    )
  );

-- ============================================================
-- pg_cron — triggers the Next.js /api/trigger endpoint every 5 min.
-- Requires: pg_cron + pg_net extensions enabled in Supabase dashboard.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Settings table — stored in a private schema so PostgREST does not expose it.
-- Supabase free tier blocks `alter database ... set`, so we use a table instead.
create schema if not exists private;

create table if not exists private.agent_settings (
  id             int primary key default 1,
  app_url        text not null,
  cron_secret    text not null,
  updated_at     timestamptz not null default now(),
  constraint agent_settings_singleton check (id = 1)
);

-- Insert a placeholder row. The user will UPDATE it with real values after
-- this migration runs (see "Post-migration setup" block at the bottom).
insert into private.agent_settings (id, app_url, cron_secret)
values (1, 'https://replace-me.vercel.app', 'replace-me')
on conflict (id) do nothing;

-- Remove existing schedule if present so this migration is idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agentfb_run_agent_every_5min') then
    perform cron.unschedule('agentfb_run_agent_every_5min');
  end if;
end $$;

-- Schedule: every 5 minutes, POST to /api/trigger with the cron secret header.
-- Reads the current app_url + cron_secret from private.agent_settings at run time,
-- so you can update them later without re-scheduling.
select cron.schedule(
  'agentfb_run_agent_every_5min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select app_url from private.agent_settings where id = 1) || '/api/trigger',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select cron_secret from private.agent_settings where id = 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ============================================================
-- Post-migration setup (run ONCE after this migration, with real values):
--
--   update private.agent_settings
--   set app_url     = 'https://your-app.vercel.app',
--       cron_secret = 'your-random-cron-secret',
--       updated_at  = now()
--   where id = 1;
--
-- Verify:
--   select app_url, left(cron_secret, 4) || '...' from private.agent_settings;
--   select jobid, schedule, jobname from cron.job where jobname = 'agentfb_run_agent_every_5min';
--
-- Manually fire the cron body once (to test without waiting 5 min):
--   select net.http_post(
--     url := (select app_url from private.agent_settings where id = 1) || '/api/trigger',
--     headers := jsonb_build_object(
--       'content-type', 'application/json',
--       'x-cron-secret', (select cron_secret from private.agent_settings where id = 1)
--     ),
--     body := '{}'::jsonb
--   );
--
-- Inspect recent cron runs:
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'agentfb_run_agent_every_5min')
--   order by start_time desc limit 10;
-- ============================================================
