-- Phase 1 security hardening for production readiness
-- Apply this migration in Supabase before enabling production traffic.

begin;

-- 1) Remove permissive signup/profile policies.
drop policy if exists "Allow analyst signup" on public.analysts;
drop policy if exists "Allow analyst update during signup" on public.analysts;
drop policy if exists "Allow profile creation during signup" on public.profiles;
drop policy if exists "Allow profile update during signup" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Analysts can insert own data" on public.analysts;
drop policy if exists "Analysts can update own data" on public.analysts;
drop policy if exists "Analysts can view own data" on public.analysts;

-- 2) Recreate least-privilege policies for authenticated users only.
create policy "Profiles can be inserted by owner"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Profiles can be updated by owner"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Profiles can be selected by owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Analysts can insert own data"
  on public.analysts
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Analysts can update own data"
  on public.analysts
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Analysts can view own data"
  on public.analysts
  for select
  to authenticated
  using (auth.uid() = id);

-- 3) Restrict function execution grants to avoid anon abuse paths.
revoke all on function public.cleanup_old_data() from anon, authenticated;
grant execute on function public.cleanup_old_data() to service_role;

revoke all on function public.create_activity_feed_entry(uuid, uuid, text, text, text, text, uuid, jsonb, integer) from anon, authenticated;
grant execute on function public.create_activity_feed_entry(uuid, uuid, text, text, text, text, uuid, jsonb, integer) to service_role;

revoke all on function public.create_analyst_profile(uuid, text, text, text) from anon, authenticated;
grant execute on function public.create_analyst_profile(uuid, text, text, text) to service_role;

revoke all on function public.create_conversation_on_approval() from anon;

commit;
