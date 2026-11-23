-- PowerAI ONE: server-timestamped immutable portfolio locks + optimistic-concurrency version.
-- STATUS: proposed, NOT applied. Review, then run in the Supabase SQL editor or `supabase db push`.
-- Safe to re-run: every object uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- Why: today a lock lives only inside user_app_state.local_state (a client-written JSON blob) and its
-- lockedAt is the browser clock. Any device can overwrite it, and the "locked before the draw" claim used
-- by the evaluator cannot be verified. This migration moves the lock into an append-only table whose
-- timestamp and content hash are set by the database, and adds a version counter so two devices cannot
-- silently overwrite each other's snapshot.

-- ---------------------------------------------------------------------------------------------
-- 1. Optimistic concurrency for user_app_state (additive; old clients keep working)
-- ---------------------------------------------------------------------------------------------
alter table public.user_app_state
  add column if not exists version bigint not null default 0;

create or replace function public.touch_user_app_state_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  new.version = coalesce(old.version, 0) + 1;  -- client-supplied values are ignored
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Immutable portfolio locks
-- ---------------------------------------------------------------------------------------------
create table if not exists public.one_portfolio_locks (
  user_id             uuid        not null references auth.users(id) on delete cascade,
  target_draw_id      integer     not null check (target_draw_id > 0),
  cutoff_draw_id      integer     not null,
  selection_hash      text        not null check (length(selection_hash) between 1 and 128),
  model               text,
  tickets             jsonb       not null,
  tickets_sha256      text        not null,                       -- set by trigger, never by the client
  client_generated_at timestamptz,                                -- informational only
  client_locked_at    timestamptz,                                -- informational only
  locked_at           timestamptz not null default now(),         -- forced to now() by trigger
  primary key (user_id, target_draw_id),
  constraint one_lock_cutoff_before_target check (cutoff_draw_id < target_draw_id)
);

comment on table public.one_portfolio_locks is
  'ONE ticket sets locked before a draw. Immutable: no UPDATE/DELETE policy. locked_at and tickets_sha256 are server-set.';

alter table public.one_portfolio_locks enable row level security;

drop policy if exists one_locks_select_own on public.one_portfolio_locks;
create policy one_locks_select_own on public.one_portfolio_locks
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists one_locks_insert_own on public.one_portfolio_locks;
create policy one_locks_insert_own on public.one_portfolio_locks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy on purpose. Unlocking goes through powerai_unlock_one_portfolio().
revoke all on public.one_portfolio_locks from public, anon, authenticated;
grant select, insert on public.one_portfolio_locks to authenticated;

create or replace function public.one_portfolio_locks_before_insert()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  t    jsonb;
  nums int[];
begin
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'not_owner';
  end if;

  if jsonb_typeof(new.tickets) <> 'array' or jsonb_array_length(new.tickets) <> 20 then
    raise exception 'invalid_ticket_count';
  end if;

  for t in select value from jsonb_array_elements(new.tickets) loop
    select array_agg(v::int order by v::int) into nums
    from jsonb_array_elements_text(t -> 'main') as v;
    if nums is null
       or cardinality(nums) <> 6
       or nums[1] < 1
       or nums[6] > 55
       or (select count(distinct n) from unnest(nums) as n) <> 6 then
      raise exception 'invalid_ticket';
    end if;
  end loop;

  new.locked_at      := now();
  new.tickets_sha256 := encode(sha256(convert_to(new.tickets::text, 'UTF8')), 'hex');
  return new;
end;
$$;

revoke all on function public.one_portfolio_locks_before_insert() from public, anon, authenticated;

drop trigger if exists trg_one_portfolio_locks_before_insert on public.one_portfolio_locks;
create trigger trg_one_portfolio_locks_before_insert
  before insert on public.one_portfolio_locks
  for each row execute function public.one_portfolio_locks_before_insert();

-- ---------------------------------------------------------------------------------------------
-- 3. Append-only unlock log + the only way to remove a lock
-- ---------------------------------------------------------------------------------------------
create table if not exists public.one_portfolio_unlock_log (
  id              bigint generated always as identity primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  target_draw_id  integer     not null,
  selection_hash  text        not null,
  tickets_sha256  text        not null,
  locked_at       timestamptz not null,
  unlocked_at     timestamptz not null default now()
);

alter table public.one_portfolio_unlock_log enable row level security;

drop policy if exists one_unlock_log_select_own on public.one_portfolio_unlock_log;
create policy one_unlock_log_select_own on public.one_portfolio_unlock_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.one_portfolio_unlock_log from public, anon, authenticated;
grant select on public.one_portfolio_unlock_log to authenticated;

create or replace function public.powerai_unlock_one_portfolio(p_target_draw_id integer)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  r   public.one_portfolio_locks%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.one_portfolio_locks
  where user_id = uid and target_draw_id = p_target_draw_id
  returning * into r;

  if not found then
    return false;
  end if;

  insert into public.one_portfolio_unlock_log
    (user_id, target_draw_id, selection_hash, tickets_sha256, locked_at)
  values
    (uid, r.target_draw_id, r.selection_hash, r.tickets_sha256, r.locked_at);

  return true;
end;
$$;

revoke all on function public.powerai_unlock_one_portfolio(integer) from public, anon, authenticated;
grant execute on function public.powerai_unlock_one_portfolio(integer) to authenticated;
