begin;

create table public.compatibility_clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  title text not null check (length(title) between 5 and 160),
  summary text not null check (length(summary) between 20 and 1200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 50),
  status text not null default 'open' check (status in ('open','full','completed','cancelled')),
  meeting_details text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.clinic_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.compatibility_clinics(id) on delete restrict,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  artifact_url text not null check (artifact_url ~ '^https://(github\.com|huggingface\.co)/'),
  problem text not null check (length(problem) between 20 and 2000),
  desired_outcome text not null check (length(desired_outcome) between 10 and 1000),
  status text not null default 'submitted' check (status in ('submitted','accepted','waitlisted','completed','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id,applicant_id)
);

create table public.evidence_bounties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  title text not null check (length(title) between 10 and 180),
  question text not null check (length(question) between 20 and 2000),
  required_evidence jsonb not null check (jsonb_typeof(required_evidence) = 'array' and jsonb_array_length(required_evidence) > 0),
  status text not null default 'open' check (status in ('open','under_review','resolved','closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence_bounty_submissions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.evidence_bounties(id) on delete restrict,
  contributor_id uuid not null references public.profiles(id) on delete restrict,
  outcome text not null check (outcome in ('success','failure','blocked','unsafe')),
  setup text not null check (length(setup) between 20 and 2000),
  observation text not null check (length(observation) between 20 and 4000),
  evidence_url text not null check (evidence_url like 'https://%'),
  created_at timestamptz not null default now(),
  unique(bounty_id,contributor_id,evidence_url)
);

create table public.artifact_review_submissions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  contributor_id uuid not null references public.profiles(id) on delete restrict,
  field_name text not null check (field_name in ('title','summary','license','artifact_type','hardware','policy_family','calibration','evidence_status','other')),
  decision text not null check (decision in ('confirm','correct','uncertain')),
  proposed_value text not null check (length(proposed_value) between 2 and 2000),
  rationale text not null check (length(rationale) between 20 and 2000),
  source_url text not null check (source_url like 'https://%'),
  authority text not null default 'community' check (authority in ('community','maintainer')),
  created_at timestamptz not null default now()
);

create table public.artifact_distribution_placements (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  contributor_id uuid not null references public.profiles(id) on delete restrict,
  placement_type text not null check (placement_type in ('github_readme','huggingface_card','evidence_badge','compatibility_api','educator_resource','collection')),
  placement_url text not null check (placement_url like 'https://%' and placement_url not like 'https://knownrobot.com/%'),
  created_at timestamptz not null default now(),
  unique(artifact_id,placement_url)
);

create index clinic_submissions_clinic_status on public.clinic_submissions(clinic_id,status,created_at);
create index evidence_bounties_status_time on public.evidence_bounties(status,updated_at desc);
create index evidence_bounty_submissions_bounty_time on public.evidence_bounty_submissions(bounty_id,created_at desc);
create index artifact_review_submissions_artifact_time on public.artifact_review_submissions(artifact_id,created_at desc);
create index artifact_distribution_placements_artifact_time on public.artifact_distribution_placements(artifact_id,created_at desc);

alter table public.compatibility_clinics enable row level security;
alter table public.clinic_submissions enable row level security;
alter table public.evidence_bounties enable row level security;
alter table public.evidence_bounty_submissions enable row level security;
alter table public.artifact_review_submissions enable row level security;
alter table public.artifact_distribution_placements enable row level security;
create policy compatibility_clinics_public_read on public.compatibility_clinics for select using (status <> 'cancelled');
create policy evidence_bounties_public_read on public.evidence_bounties for select using (true);
create policy evidence_bounty_submissions_public_read on public.evidence_bounty_submissions for select using (true);
create policy artifact_review_submissions_public_read on public.artifact_review_submissions for select using (true);
create policy artifact_distribution_placements_public_read on public.artifact_distribution_placements for select using (true);
grant select on public.compatibility_clinics,public.evidence_bounties,public.evidence_bounty_submissions,public.artifact_review_submissions,public.artifact_distribution_placements to anon,authenticated;
grant all on public.compatibility_clinics,public.clinic_submissions,public.evidence_bounties,public.evidence_bounty_submissions,public.artifact_review_submissions,public.artifact_distribution_placements to service_role;

alter table private.account_activity_events drop constraint account_activity_events_event_type_check;
alter table private.account_activity_events add constraint account_activity_events_event_type_check check(event_type in (
  'account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated',
  'artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed','artifact_integrated',
  'discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed','message_request_sent','direct_message_sent'
));
create or replace function private.log_account_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text,p_source text default 'direct_or_unknown') returns void language plpgsql security definer set search_path='' as $$
begin
  if p_account is null or not exists(select 1 from auth.users where id=p_account) then return; end if;
  if p_event not in (
    'account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated',
    'artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed','artifact_integrated',
    'discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed','message_request_sent','direct_message_sent'
  ) then raise exception 'Unsupported account activity'; end if;
  if p_source not in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid') then raise exception 'Unsupported source channel'; end if;
  insert into private.account_activity_events(account_id,event_type,resource_id,source_channel,dedupe_key) values(p_account,p_event,p_resource,p_source,p_dedupe) on conflict(account_id,event_type,dedupe_key) do nothing;
end $$;
revoke all on function private.log_account_activity(uuid,text,uuid,text,text) from public,anon,authenticated,service_role;
create or replace function public.record_collaboration_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_event not in ('collection_created','artifact_followed','attempt_attached','evidence_reviewed','review_contributed','sprint_participated','artifact_integrated') then raise exception 'Unsupported collaboration activity'; end if;
  perform private.log_account_activity(p_account,p_event,p_resource,p_dedupe,'direct_or_unknown');
end $$;
revoke all on function public.record_collaboration_activity(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_collaboration_activity(uuid,text,uuid,text) to service_role;

alter table public.notifications drop constraint notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check(event_type in (
  'artifact_revision','artifact_correction','evaluation_attempt','evidence_position','collection_update','organization_update',
  'discussion_reply','collaboration_request','collaboration_status','message_request','direct_message','artifact_review','artifact_integration'
));

insert into public.compatibility_clinics(slug,title,summary,starts_at,ends_at,capacity)
select 'so101-compatibility-clinic-' || lpad(series::text,2,'0'),
  'SO-101 compatibility clinic · session ' || series,
  'Bring one public policy, dataset, hardware configuration, or reproduction failure. KnownRobot will pin the source revision, document what is established, preserve what remains uncertain, and publish a reusable record with your attribution.',
  '2026-11-14 10:00:00-07'::timestamptz + ((series-1) * interval '7 days'),
  '2026-11-14 10:45:00-07'::timestamptz + ((series-1) * interval '7 days'),5
from generate_series(1,8) series;

insert into public.evidence_bounties(slug,artifact_id,title,question,required_evidence,created_by)
select 'independent-evidence-' || a.slug,a.id,'Independent evidence for ' || a.title,
  'Can an independent practitioner reproduce the documented behavior for this pinned artifact? Report success, failure, a blocked attempt, or a safety stop. KnownRobot does not treat missing evidence as incompatibility.',
  '["Exact artifact revision","Hardware and calibration state","Software and controller configuration","Observed outcome with a public log, video, dataset, or report"]'::jsonb,
  a.imported_by
from public.artifacts a
where a.artifact_type in ('policy','dataset','software','repository')
order by a.updated_at desc
limit 3
on conflict (slug) do nothing;

commit;
