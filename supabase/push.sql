-- Gym Log lock-screen rest alerts.
-- Don't run this file directly: run supabase/push-setup.local.sql, which is this file with your
-- secret filled in (generated on your computer and never published).
--
-- How it works: when you log a set, the app saves "this phone's rest ends at 9:41:30" in rest_alerts.
-- Every 2 seconds a scheduled job looks for alerts that are due, removes them, and asks the
-- rest-push Edge Function to send them through Apple/Google push.

-- 1) Extensions: the scheduler (pg_cron) and outgoing HTTP calls (pg_net)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2) Where each device can be reached
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subs" on public.push_subscriptions;
create policy "own subs" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Pending rest alerts: at most one per device
create table if not exists public.rest_alerts (
  endpoint text primary key references public.push_subscriptions (endpoint) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fire_at  timestamptz not null,
  body     text not null default 'Time for your next set'
);
create index if not exists rest_alerts_fire_at on public.rest_alerts (fire_at);
alter table public.rest_alerts enable row level security;
drop policy if exists "own alerts" on public.rest_alerts;
create policy "own alerts" on public.rest_alerts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) The secret the scheduler uses to call the Edge Function (stored encrypted in Vault)
do $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'rest_push_secret';
  if sid is null then
    perform vault.create_secret('__PUSH_SECRET__', 'rest_push_secret');
  else
    perform vault.update_secret(sid, '__PUSH_SECRET__');
  end if;
end $$;

-- 5) Send whatever is due (private schema: not reachable from the app's API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.send_due_rest_alerts() returns void
language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb;
  secret  text;
begin
  with due as (
    delete from public.rest_alerts where fire_at <= now() returning *
  )
  select jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'title', 'Rest over', 'body', due.body))
    into payload
    from due
    join public.push_subscriptions s on s.endpoint = due.endpoint
   where due.fire_at > now() - interval '2 minutes';   -- skip anything badly stale

  if payload is null then return; end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'rest_push_secret';

  perform net.http_post(
    url := 'https://tvvwqyplnhorvthrpelc.supabase.co/functions/v1/rest-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := jsonb_build_object('alerts', payload),
    timeout_milliseconds := 10000
  );
end $$;
revoke all on function private.send_due_rest_alerts() from public, anon, authenticated;

-- 6) Run it every 2 seconds, and keep the scheduler's log small
select cron.schedule('gym-rest-alerts', '2 seconds', 'select private.send_due_rest_alerts()');
select cron.schedule('gym-cron-cleanup', '17 * * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 hour'$$);
