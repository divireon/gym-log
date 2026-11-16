-- Gym Log cloud sync: run this once in Supabase → SQL Editor → New query → Run.
-- One table holds every record (workouts, runs, routines, ...). Each row belongs to the
-- signed-in user, and row-level security makes sure nobody else can read or change it.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  coll       text        not null,             -- collection: workouts, runs, exercises, ...
  id         text        not null,             -- record id from the app
  data       jsonb       not null,             -- the record itself
  updated_at bigint      not null default 0,   -- when the app last changed it (ms)
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(), -- when the server stored it
  primary key (user_id, coll, id)
);

create index if not exists records_user_synced on public.records (user_id, synced_at);

alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;

create policy "own rows: select" on public.records
  for select to authenticated using (user_id = auth.uid());
create policy "own rows: insert" on public.records
  for insert to authenticated with check (user_id = auth.uid());
create policy "own rows: update" on public.records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Never let an older copy of a record overwrite a newer one (e.g. a phone that was offline
-- for a while), and stamp every stored row with the server time so devices can ask
-- "what changed since I last checked?".
create or replace function public.records_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- keep the newer version that is already stored
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records
  for each row execute function public.records_guard();
