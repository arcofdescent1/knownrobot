begin;

alter table public.profiles add column bio text not null default '' check (length(bio) <= 1000),
  add column affiliation text not null default '' check (length(affiliation) <= 200),
  add column github_url text not null default '' check (github_url = '' or github_url ~ '^https://[^[:space:]@]+$'),
  add column huggingface_url text not null default '' check (huggingface_url = '' or huggingface_url ~ '^https://[^[:space:]@]+$');
alter table public.profiles add constraint reserved_identity_handle check (handle is null or handle not in ('admin','knownrobot','support','system'));
grant update (bio, affiliation, github_url, huggingface_url) on public.profiles to authenticated;
create policy "Team members can read team policy drafts" on public.skills for select to authenticated using (
  exists(select 1 from public.organization_members m where m.organization_id=skills.owner_organization_id and m.profile_id=(select auth.uid()))
);
alter table public.organizations add column description text not null default '' check (length(description) <= 1000);

create function public.identity_handle_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.handle is not null and new.handle is distinct from old.handle then
    raise exception 'A claimed Known Robot handle cannot be changed';
  end if;
  return new;
end $$;
create trigger identity_handle_immutable before update on public.profiles for each row execute function public.identity_handle_immutable();

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id),
  invited_by uuid not null references public.profiles(id),
  role text not null check (role in ('admin','member')),
  expires_at timestamptz not null default now() + interval '7 days',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index team_pending_invite on public.team_invitations(organization_id,recipient_id) where resolved_at is null;
alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from public, anon, authenticated, service_role;
grant select on public.team_invitations to authenticated;
create policy "Recipients and managers see invitations" on public.team_invitations for select to authenticated using (
  recipient_id = (select auth.uid()) or exists (select 1 from public.organization_members m where m.organization_id = team_invitations.organization_id and m.profile_id = (select auth.uid()) and m.role in ('owner','admin'))
);

create function public.create_identity_team(p_slug text, p_name text, p_description text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); team uuid;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and handle is not null) then raise exception 'Create your public profile first'; end if;
  perform 1 from public.profiles where id=actor for update;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,38}$' or p_slug in ('admin','knownrobot','support','system') or length(btrim(p_name)) not between 2 and 100 or length(p_description) > 1000 or p_description is null then raise exception 'Invalid team details'; end if;
  if (select count(*) from public.organizations where created_by=actor) >= 20 then raise exception 'Team creation limit reached'; end if;
  insert into public.organizations(slug,name,description,created_by) values(p_slug,btrim(p_name),p_description,actor) returning id into team;
  insert into public.organization_members(organization_id,profile_id,role) values(team,actor,'owner');
  return team;
end $$;

create function public.manage_identity_team(p_operation text, p_team uuid, p_handle text default null, p_role text default 'member') returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role text; target uuid; target_role text; invitation public.team_invitations;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  -- Serialize ownership changes, invitation acceptance and removals on one row.
  perform 1 from public.organizations where id=p_team for update;
  if not found then raise exception 'Team not available'; end if;
  select role into actor_role from public.organization_members where organization_id=p_team and profile_id=actor;
  if p_operation in ('accept','decline') then
    select * into invitation from public.team_invitations where organization_id=p_team and recipient_id=actor and resolved_at is null for update;
    if not found or invitation.expires_at <= now() then raise exception 'Invitation is missing or expired'; end if;
    if p_operation='accept' then
      if not exists(select 1 from public.organization_members where organization_id=p_team and profile_id=invitation.invited_by and (role='owner' or (role='admin' and invitation.role='member'))) then raise exception 'Inviter no longer has authority for this invitation'; end if;
      insert into public.organization_members(organization_id,profile_id,role) values(p_team,actor,invitation.role) on conflict do nothing;
    end if;
    update public.team_invitations set resolved_at=now() where id=invitation.id;
    return;
  end if;
  if p_operation='leave' then
    if actor_role='owner' then raise exception 'Transfer ownership before leaving'; end if;
    delete from public.organization_members where organization_id=p_team and profile_id=actor;
    return;
  end if;
  if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Team manager required'; end if;
  select id into target from public.profiles where handle=p_handle;
  if target is null then raise exception 'Recipient must first claim a Known Robot profile'; end if;
  select role into target_role from public.organization_members where organization_id=p_team and profile_id=target;
  if p_operation='invite' then
    if p_role is null or p_role not in ('admin','member') or (actor_role='admin' and p_role<>'member') then raise exception 'Invalid invitation role'; end if;
    if target_role is not null then raise exception 'Already a member'; end if;
    update public.team_invitations set resolved_at=now() where organization_id=p_team and recipient_id=target and resolved_at is null and expires_at <= now();
    if (select count(*) from public.team_invitations where organization_id=p_team and resolved_at is null) >= 100 then raise exception 'Pending invitation limit reached'; end if;
    insert into public.team_invitations(organization_id,recipient_id,invited_by,role) values(p_team,target,actor,p_role);
  elsif p_operation='cancel' then
    update public.team_invitations set resolved_at=now() where organization_id=p_team and recipient_id=target and resolved_at is null;
  elsif p_operation='remove' then
    if target_role is null or target_role='owner' or (actor_role='admin' and target_role<>'member') then raise exception 'Cannot remove this member'; end if;
    delete from public.organization_members where organization_id=p_team and profile_id=target;
  elsif p_operation='transfer' then
    if actor_role<>'owner' or target_role is null or target=actor then raise exception 'Transfer requires another existing member and current owner'; end if;
    update public.organization_members set role='admin' where organization_id=p_team and profile_id=actor;
    update public.organization_members set role='owner' where organization_id=p_team and profile_id=target;
  else raise exception 'Unknown team operation';
  end if;
end $$;

-- Only this atomic operation grants the initial owner membership.
revoke insert on public.organizations from authenticated;
revoke all on function public.create_identity_team(text,text,text), public.manage_identity_team(text,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.create_identity_team(text,text,text), public.manage_identity_team(text,uuid,text,text) to authenticated;

create function public.submit_identity_evaluation(p_id uuid, p_payload jsonb, p_publish boolean, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); team uuid; digest text; trials integer; successes integer; published timestamptz; slug text; prior public.evaluations;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and handle is not null and length(btrim(display_name)) >= 2) then raise exception 'Create your public contributor profile first'; end if;
  if p_consent is distinct from true then raise exception 'Confirm attribution and publication consent'; end if;
  if p_id is null or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>100000 then raise exception 'Invalid submission'; end if;
  team := nullif(p_payload->>'team_id','')::uuid;
  if team is not null and not exists(select 1 from public.organization_members where organization_id=team and profile_id=actor) then raise exception 'Team membership required'; end if;
  if length(btrim(p_payload->>'name')) not between 2 and 150 or length(btrim(p_payload->>'summary')) not between 20 and 2000
    or (p_payload->>'source_url') !~ '^https://[^[:space:]@]+$' or (p_payload->>'source_revision') !~ '^[a-fA-F0-9]{40,64}$'
    or length(btrim(p_payload->>'framework')) not between 1 and 100 or length(btrim(p_payload->>'license')) not between 1 and 100
    or length(btrim(p_payload->>'robot_family')) not between 2 and 100 or length(btrim(p_payload->>'benchmark_name')) not between 2 and 150
    or length(btrim(p_payload->>'benchmark_version')) not between 1 and 100 then raise exception 'Invalid policy or hardware details'; end if;
  if not (p_payload ?& array['name','summary','source_url','source_revision','framework','license','robot_family','benchmark_name','benchmark_version','manifest','configuration','protocol','runtime','evidence','trial_count','success_count']) then raise exception 'Missing submission fields'; end if;
  if exists(select 1 from unnest(array['manifest','configuration','protocol','runtime']) field where jsonb_typeof(p_payload->field) is distinct from 'object' or p_payload->field='{}'::jsonb) then raise exception 'Supply non-empty metadata objects'; end if;
  if jsonb_typeof(p_payload->'evidence') is distinct from 'array' then raise exception 'Supply evidence links'; end if;
  if jsonb_array_length(p_payload->'evidence') not between 1 and 20 or exists(select 1 from jsonb_array_elements(p_payload->'evidence') item where jsonb_typeof(item) is distinct from 'object' or (item->>'url') is null or (item->>'url') !~ '^https://[^[:space:]@]+$' or length(btrim(item->>'label')) not between 2 and 100 or (item->>'label') is null) then raise exception 'Invalid evidence links'; end if;
  if (p_payload->>'trial_count') !~ '^[0-9]+$' or (p_payload->>'success_count') !~ '^[0-9]+$' then raise exception 'Trial counts must be integers'; end if;
  trials := (p_payload->>'trial_count')::integer; successes := (p_payload->>'success_count')::integer;
  if trials not between 1 and 1000000 or successes not between 0 and trials then raise exception 'Invalid trial counts'; end if;
  digest := encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text,'UTF8')),'hex');
  -- Serialize retries before creating associated rows. No user may claim another's ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into prior from public.evaluations where id=p_id;
  if found then
    if prior.submitted_by=actor and prior.result_digest=digest then return p_id; end if;
    raise exception 'Submission ID already used';
  end if;
  if p_publish is true then published := now(); end if;
  slug := 'submission-' || replace(p_id::text,'-','');
  insert into public.skills(id,slug,name,summary,owner_profile_id,owner_organization_id,source_url,source_revision,framework,license,manifest,published_at)
    values(p_id,slug,p_payload->>'name',p_payload->>'summary',case when team is null then actor else null end,team,p_payload->>'source_url',p_payload->>'source_revision',p_payload->>'framework',p_payload->>'license',p_payload->'manifest',published);
  insert into public.hardware_profiles(id,slug,robot_family,configuration,created_by) values(p_id,slug,p_payload->>'robot_family',p_payload->'configuration',actor);
  insert into public.benchmarks(id,slug,name,version,protocol,created_by,published_at) values(p_id,slug,p_payload->>'benchmark_name',p_payload->>'benchmark_version',p_payload->'protocol',actor,published);
  insert into public.evaluations(id,skill_id,hardware_profile_id,benchmark_id,submitted_by,trial_count,success_rate,runtime,evidence,result_digest,published_at)
    values(p_id,p_id,p_id,p_id,actor,trials,round(100.0*successes/trials,2),p_payload->'runtime',p_payload->'evidence',digest,published);
  return p_id;
end $$;

create function public.publish_identity_draft(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); draft public.evaluations; policy public.skills;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select * into draft from public.evaluations where id=p_id and submitted_by=actor for update;
  if not found or draft.verification_status<>'self_tested' then raise exception 'Self-reported draft not available'; end if;
  if draft.published_at is not null then return; end if;
  select * into policy from public.skills where id=draft.skill_id for update;
  if (policy.owner_profile_id is distinct from actor and not exists(select 1 from public.organization_members where organization_id=policy.owner_organization_id and profile_id=actor))
    or not exists(select 1 from public.hardware_profiles where id=draft.hardware_profile_id and created_by=actor)
    or not exists(select 1 from public.benchmarks where id=draft.benchmark_id and created_by=actor) then raise exception 'Artifact ownership required'; end if;
  update public.skills set published_at=now() where id=policy.id;
  update public.benchmarks set published_at=now() where id=draft.benchmark_id;
  update public.evaluations set published_at=now() where id=p_id;
end $$;
revoke all on function public.submit_identity_evaluation(uuid,jsonb,boolean,boolean), public.publish_identity_draft(uuid) from public, anon, authenticated, service_role;
grant execute on function public.submit_identity_evaluation(uuid,jsonb,boolean,boolean), public.publish_identity_draft(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
