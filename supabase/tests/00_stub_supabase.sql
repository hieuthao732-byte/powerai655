create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase default privileges for new objects in public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
-- existing prod objects (shape copied from the live project)
create table public.user_roles(user_id uuid primary key references auth.users(id), role text not null default 'user' check (role in ('user','admin')), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.user_app_state(user_id uuid primary key references auth.users(id), active_draw_id int, locked_draw_id int, abc_locked boolean not null default false, l_locked boolean not null default false, abc_lock_snapshot jsonb, l_lock_snapshot jsonb, results jsonb not null default '{}', logs jsonb not null default '[]', learning_state jsonb not null default '{}', preferences jsonb not null default '{}', updated_at timestamptz not null default now(), local_state jsonb not null default '{}');
alter table public.user_roles enable row level security;
alter table public.user_app_state enable row level security;
create policy users_select_own_role on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy users_delete_own_state on public.user_app_state for delete to public using (auth.uid() = user_id);
create policy users_insert_own_state on public.user_app_state for insert to public with check (auth.uid() = user_id);
create policy users_select_own_state on public.user_app_state for select to public using (auth.uid() = user_id);
create policy users_update_own_state on public.user_app_state for update to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.user_roles, public.user_app_state from anon, authenticated;
grant references, select, trigger, truncate on public.user_roles to anon, authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_app_state to anon, authenticated;
create function public.touch_user_app_state_updated_at() returns trigger language plpgsql set search_path to 'public' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger trg_touch_user_app_state before update on public.user_app_state for each row execute function public.touch_user_app_state_updated_at();
-- stubs with the same signatures as the live admin/account functions
create function public.powerai_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select false $$;
create function public.powerai_admin_summary() returns jsonb language sql stable security definer set search_path='' as $$ select '{}'::jsonb $$;
create function public.powerai_admin_users() returns table(user_id uuid) language sql stable security definer set search_path='' as $$ select null::uuid where false $$;
create function public.powerai_admin_set_role(p_user_id uuid, p_role text) returns boolean language sql security definer set search_path='' as $$ select false $$;
create function public.powerai_admin_set_user_enabled(p_user_id uuid, p_enabled boolean) returns boolean language sql security definer set search_path='' as $$ select false $$;
create function public.powerai_delete_my_account() returns boolean language sql security definer set search_path='' as $$ select false $$;
create function public.is_powerai_admin_email(p_email text) returns boolean language sql stable security definer set search_path='' as $$ select false $$;
create function public.assign_powerai_role() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end; $$;
insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','a@test'),('bbbbbbbb-0000-0000-0000-000000000002','b@test');
