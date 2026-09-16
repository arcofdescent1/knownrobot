begin;

-- New Supabase projects do not implicitly expose SQL-created tables. Keep the
-- API contract identical under both the old and new platform defaults.
grant usage on schema public to anon, authenticated, service_role;
revoke all on public.profiles, public.organizations, public.organization_members,
  public.skills, public.hardware_profiles, public.benchmarks
  from public, anon, authenticated, service_role;
grant select on public.profiles, public.organizations, public.organization_members,
  public.skills, public.hardware_profiles, public.benchmarks
  to anon, authenticated, service_role;
grant insert on public.profiles, public.organizations, public.skills,
  public.hardware_profiles, public.benchmarks to authenticated, service_role;
grant update (handle, display_name, avatar_url) on public.profiles
  to authenticated, service_role;
grant update (slug, name, summary, source_url, source_revision, framework, license,
  manifest, published_at, updated_at) on public.skills to authenticated, service_role;
-- Membership writes are operator-only; no client may grant itself a role.
grant insert, update on public.organization_members to service_role;

-- Do not grant any additional evaluation, reviewer, history or RPC privileges.
-- Their explicit column grants and appointment-bound authority remain unchanged.
notify pgrst, 'reload schema';
commit;
