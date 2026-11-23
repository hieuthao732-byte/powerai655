-- PowerAI: narrow privileges that Supabase grants by default. Independent of the lock migration.
-- STATUS: proposed, NOT applied.
--
-- Verified before writing this (2026-11-23):
--   * auth.js only calls powerai_delete_my_account and powerai_admin_* with a signed-in session (auth:true).
--   * Nothing in the repo calls is_powerai_admin_email, assign_powerai_role or powerai_is_admin over REST.
--   * Each admin RPC already checks powerai_is_admin() internally, so this is defense in depth, not a
--     fix for a known exploit.

-- Admin / account RPCs: signed-in users only. (Re-grant to authenticated so the result does not depend on
-- whether the earlier grant came from PUBLIC or from a direct grant.)
revoke execute on function public.powerai_admin_summary()                          from public, anon;
revoke execute on function public.powerai_admin_users()                            from public, anon;
revoke execute on function public.powerai_admin_set_role(uuid, text)               from public, anon;
revoke execute on function public.powerai_admin_set_user_enabled(uuid, boolean)    from public, anon;
revoke execute on function public.powerai_delete_my_account()                      from public, anon;
revoke execute on function public.powerai_is_admin()                               from public, anon;
grant  execute on function public.powerai_admin_summary()                          to authenticated;
grant  execute on function public.powerai_admin_users()                            to authenticated;
grant  execute on function public.powerai_admin_set_role(uuid, text)               to authenticated;
grant  execute on function public.powerai_admin_set_user_enabled(uuid, boolean)    to authenticated;
grant  execute on function public.powerai_delete_my_account()                      to authenticated;
grant  execute on function public.powerai_is_admin()                               to authenticated;

-- Not meant to be callable over REST at all. assign_powerai_role() is a trigger function (firing a trigger
-- does not need EXECUTE for the invoking user); is_powerai_admin_email() lets anyone probe the admin email.
revoke execute on function public.assign_powerai_role()                            from public, anon, authenticated;
revoke execute on function public.is_powerai_admin_email(text)                     from public, anon, authenticated;

-- Table privileges. RLS already blocks row access for anon; these remove privileges RLS does not cover
-- (TRUNCATE is not subject to RLS) and everything anon never needs.
revoke all                          on table public.user_app_state from anon;
revoke truncate, trigger, references on table public.user_app_state from authenticated;
revoke all                          on table public.user_roles     from anon;
revoke truncate, trigger, references on table public.user_roles     from authenticated;
