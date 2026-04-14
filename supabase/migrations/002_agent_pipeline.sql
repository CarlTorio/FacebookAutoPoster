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

-- Before running this block, set these in Supabase dashboard → SQL editor:
--   select vault.create_secret('https://your-vercel-app.vercel.app', 'app_url');
--   select vault.create_secret('your-random-cron-secret', 'cron_secret');
-- OR replace the two vault.read_secret() calls below with literal strings.

-- Remove existing schedule if present so this migration is idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agentfb_run_agent_every_5min') then
    perform cron.unschedule('agentfb_run_agent_every_5min');
  end if;
end $$;

-- Schedule: every 5 minutes, POST to /api/trigger with the cron secret header.
-- Replace the $URL$ and $SECRET$ placeholders before running, or wire up Vault.
select cron.schedule(
  'agentfb_run_agent_every_5min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := current_setting('app.settings.agentfb_url', true) || '/api/trigger',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.settings.agentfb_cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- To set the two settings used above (run once in SQL editor):
--   alter database postgres set app.settings.agentfb_url to 'https://your-app.vercel.app';
--   alter database postgres set app.settings.agentfb_cron_secret to 'your-random-secret';
-- After altering, reload: select pg_reload_conf();
