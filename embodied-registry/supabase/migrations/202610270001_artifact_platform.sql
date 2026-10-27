begin;

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  source_provider text not null check (source_provider in ('github','huggingface')),
  source_kind text not null check (source_kind in ('repository','model','dataset','space')),
  source_repository text not null check (source_repository ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'),
  source_url text not null check (source_url ~ '^https://(github\.com|huggingface\.co)/'),
  artifact_type text not null check (artifact_type in ('policy','dataset','hardware','software','benchmark','repository')),
  title text not null check (length(title) between 2 and 160),
  summary text not null default '' check (length(summary) <= 2000),
  license text not null default '' check (length(license) <= 100),
  latest_revision_id uuid,
  owner_profile_id uuid references public.profiles(id),
  owner_organization_id uuid references public.organizations(id),
  imported_by uuid not null references public.profiles(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_provider,source_kind,source_repository),
  check (num_nonnulls(owner_profile_id,owner_organization_id) <= 1)
);

create table public.artifact_revisions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  source_revision text not null check (source_revision ~ '^[a-f0-9]{40,64}$'),
  source_revision_url text not null check (source_revision_url like 'https://%'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  inspected_files jsonb not null default '[]'::jsonb check (jsonb_typeof(inspected_files)='array'),
  uncertainties jsonb not null default '[]'::jsonb check (jsonb_typeof(uncertainties)='array'),
  imported_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(artifact_id,source_revision)
);
alter table public.artifacts add constraint artifacts_latest_revision_fk foreign key(latest_revision_id) references public.artifact_revisions(id);

create table public.artifact_claim_challenges (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  claimant_profile_id uuid references public.profiles(id),
  claimant_organization_id uuid references public.organizations(id),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(claimant_profile_id,claimant_organization_id)=1)
);

create table public.artifact_claims (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null unique references public.artifacts(id) on delete restrict,
  claimant_profile_id uuid references public.profiles(id),
  claimant_organization_id uuid references public.organizations(id),
  verified_by uuid not null references public.profiles(id),
  proof_provider text not null check (proof_provider in ('github','huggingface')),
  proof_path text not null default '.knownrobot/claim.json',
  proof_url text not null check (proof_url like 'https://%'),
  proof_revision text not null check (proof_revision ~ '^[a-f0-9]{40,64}$'),
  proof_digest text not null check (proof_digest ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz not null default now(),
  check (num_nonnulls(claimant_profile_id,claimant_organization_id)=1)
);

create table public.artifact_contributions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  revision_id uuid references public.artifact_revisions(id) on delete restrict,
  contributor_profile_id uuid not null references public.profiles(id),
  contributor_organization_id uuid references public.organizations(id),
  kind text not null check (kind in ('import','claim','correction','review')),
  summary text not null check (length(summary) between 2 and 2000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  evidence_url text check (evidence_url is null or evidence_url like 'https://%'),
  created_at timestamptz not null default now()
);

create index artifacts_type_updated on public.artifacts(artifact_type,updated_at desc);
create index artifact_contributions_artifact_time on public.artifact_contributions(artifact_id,created_at desc);
create index artifact_contributions_profile_time on public.artifact_contributions(contributor_profile_id,created_at desc);

alter table public.artifacts enable row level security;
alter table public.artifact_revisions enable row level security;
alter table public.artifact_claims enable row level security;
alter table public.artifact_contributions enable row level security;
create policy artifacts_public_read on public.artifacts for select using (published_at is not null);
create policy artifact_revisions_public_read on public.artifact_revisions for select using (exists(select 1 from public.artifacts a where a.id=artifact_id and a.published_at is not null));
create policy artifact_claims_public_read on public.artifact_claims for select using (true);
create policy artifact_contributions_public_read on public.artifact_contributions for select using (true);
grant select on public.artifacts,public.artifact_revisions,public.artifact_claims,public.artifact_contributions to anon,authenticated;
grant all on public.artifacts,public.artifact_revisions,public.artifact_claims,public.artifact_contributions to service_role;
alter table public.artifact_claim_challenges enable row level security;
grant select,insert,update on public.artifact_claim_challenges to service_role;

create function private.prevent_artifact_history_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Published artifact history is append-only' using errcode='42501'; end $$;
create trigger artifact_revisions_append_only before update or delete on public.artifact_revisions for each row execute function private.prevent_artifact_history_change();
create trigger artifact_claims_append_only before update or delete on public.artifact_claims for each row execute function private.prevent_artifact_history_change();
create trigger artifact_contributions_append_only before update or delete on public.artifact_contributions for each row execute function private.prevent_artifact_history_change();
revoke all on function private.prevent_artifact_history_change() from public,anon,authenticated,service_role;

alter table private.account_activity_events drop constraint account_activity_events_event_type_check;
alter table private.account_activity_events add constraint account_activity_events_event_type_check check(event_type in (
  'account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected'
));
create or replace function private.log_account_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text,p_source text default 'direct_or_unknown') returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_account is null or not exists(select 1 from auth.users where id=p_account) then return; end if;
  if p_event not in ('account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected') then raise exception 'Unsupported account activity'; end if;
  if p_source not in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid') then raise exception 'Unsupported source channel'; end if;
  insert into private.account_activity_events(account_id,event_type,resource_id,source_channel,dedupe_key) values(p_account,p_event,p_resource,p_source,p_dedupe) on conflict(account_id,event_type,dedupe_key) do nothing;
end $$;
revoke all on function private.log_account_activity(uuid,text,uuid,text,text) from public,anon,authenticated,service_role;

create function public.record_artifact_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_event not in ('artifact_imported','artifact_claimed','artifact_corrected') then raise exception 'Unsupported artifact activity'; end if;
  perform private.log_account_activity(p_account,p_event,p_resource,p_dedupe,'direct_or_unknown');
end $$;
revoke all on function public.record_artifact_activity(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_artifact_activity(uuid,text,uuid,text) to service_role;

create or replace function public.operator_account_activity_summary(p_as_of timestamptz default now()) returns jsonb
language sql stable security definer set search_path='' as $$
with eligible_users as (
  select u.id,u.created_at from auth.users u where u.email_confirmed_at is not null and u.deleted_at is null
    and not exists(select 1 from private.account_measurement_exclusions x where x.account_id=u.id)
), eligible_events as (
  select e.* from private.account_activity_events e join eligible_users u on u.id=e.account_id
), first_value as (
  select account_id,min(occurred_at) at time zone 'utc' first_at from eligible_events
  where event_type in ('profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected') group by account_id
), active_30d as (
  select distinct account_id from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
    and event_type in ('profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected')
), retained_7d as (
  select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id where e.occurred_at>=f.first_at+interval '7 days' and e.occurred_at<f.first_at+interval '14 days'
), retained_30d as (
  select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id where e.occurred_at>=f.first_at+interval '30 days' and e.occurred_at<f.first_at+interval '60 days'
)
select jsonb_build_object('as_of',p_as_of,'definition','real non-excluded confirmed accounts with a qualifying server-recorded workflow in the trailing 30 days','verified_accounts',(select count(*) from eligible_users),'activated_accounts',(select count(*) from first_value),'active_accounts_30d',(select count(*) from active_30d),'retained_accounts_7d',(select count(*) from retained_7d),'retained_accounts_30d',(select count(*) from retained_30d),'excluded_accounts',(select count(*) from private.account_measurement_exclusions),'qualifying_events_30d',(select count(*) from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of and event_type<>'account_verified'),'channels_30d',coalesce((select jsonb_object_agg(source_channel,total) from (select source_channel,count(distinct account_id) total from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of and event_type<>'account_verified' group by source_channel) channels),'{}'::jsonb));
$$;
revoke all on function public.operator_account_activity_summary(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.operator_account_activity_summary(timestamptz) to service_role;

comment on table public.artifacts is 'Canonical identities for externally hosted robotics artifacts; source repositories remain authoritative.';
comment on table public.artifact_revisions is 'Append-only metadata inspections pinned to immutable upstream revisions.';
comment on table public.artifact_claims is 'Repository-backed ownership proofs; claims do not verify artifact quality or compatibility.';
notify pgrst,'reload schema';
commit;
