begin;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  title text not null check(length(title) between 2 and 160),
  description text not null default '' check(length(description)<=2000),
  owner_profile_id uuid references public.profiles(id),
  owner_organization_id uuid references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(num_nonnulls(owner_profile_id,owner_organization_id)=1)
);
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  evaluation_id uuid references public.evaluations(id) on delete cascade,
  hardware_profile_id uuid references public.hardware_profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  note text not null default '' check(length(note)<=1000),
  position integer not null check(position between 0 and 10000),
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(num_nonnulls(artifact_id,evaluation_id,hardware_profile_id,organization_id)=1),
  unique(collection_id,artifact_id),unique(collection_id,evaluation_id),unique(collection_id,hardware_profile_id),unique(collection_id,organization_id),unique(collection_id,position)
);
create table public.collection_history (
  id bigint generated always as identity primary key,
  collection_id uuid not null references public.collections(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check(action in ('created','updated','item_added','item_removed','item_moved')),
  detail jsonb not null default '{}' check(jsonb_typeof(detail)='object'),
  created_at timestamptz not null default now()
);

create table public.artifact_evaluation_attempts (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  evaluation_id uuid not null unique references public.evaluations(id) on delete restrict,
  relationship text not null check(relationship in ('direct','reproduction','derivative')),
  outcome text not null check(outcome in ('success','partial','failure','inconclusive')),
  notes text not null default '' check(length(notes)<=2000),
  attached_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.artifact_relations (
  id uuid primary key default gen_random_uuid(),
  source_artifact_id uuid not null references public.artifacts(id) on delete restrict,
  target_artifact_id uuid not null references public.artifacts(id) on delete restrict,
  relation text not null check(relation in ('derivative_of','reproduction_of')),
  evidence_url text not null check(evidence_url like 'https://%'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(source_artifact_id<>target_artifact_id),
  unique(source_artifact_id,target_artifact_id,relation)
);
create table public.evidence_positions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.artifact_evaluation_attempts(id) on delete restrict,
  evaluation_id uuid not null references public.evaluations(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id),
  position text not null check(position in ('supports','disputes','needs_information')),
  rationale text not null check(length(rationale) between 20 and 2000),
  evidence_url text not null check(evidence_url like 'https://%'),
  supersedes_id uuid references public.evidence_positions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(attempt_id,reviewer_id,supersedes_id)
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  hardware_profile_id uuid references public.hardware_profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  check(num_nonnulls(artifact_id,hardware_profile_id,organization_id,collection_id)=1),
  unique nulls not distinct(follower_id,artifact_id,hardware_profile_id,organization_id,collection_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in ('artifact_revision','artifact_correction','evaluation_attempt','evidence_position','collection_update','organization_update')),
  title text not null check(length(title) between 2 and 200),
  body text not null check(length(body) between 2 and 1000),
  href text not null check(href ~ '^/[a-z0-9/_-]+$'),
  actor_id uuid references public.profiles(id),
  resource_key text not null check(length(resource_key) between 1 and 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id,event_type,resource_key)
);
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check(length(name) between 2 and 80),
  token_prefix text not null check(length(token_prefix)=12),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index collection_items_collection_position on public.collection_items(collection_id,position);
create index attempts_artifact_time on public.artifact_evaluation_attempts(artifact_id,created_at desc);
create index positions_attempt_time on public.evidence_positions(attempt_id,created_at desc);
create unique index evidence_positions_one_initial on public.evidence_positions(attempt_id,reviewer_id) where supersedes_id is null;
create function private.bind_position_evaluation() returns trigger language plpgsql security definer set search_path='' as $$
begin new.evaluation_id=(select evaluation_id from public.artifact_evaluation_attempts where id=new.attempt_id); if new.evaluation_id is null then raise exception 'Unknown attempt' using errcode='23503'; end if; return new; end $$;
create trigger bind_position_evaluation before insert on public.evidence_positions for each row execute function private.bind_position_evaluation();
revoke all on function private.bind_position_evaluation() from public,anon,authenticated,service_role;
create index follows_follower on public.follows(follower_id);
create index notifications_recipient_time on public.notifications(recipient_id,created_at desc);
create index api_tokens_owner on public.api_tokens(owner_id,created_at desc);

alter table public.collections enable row level security; alter table public.collection_items enable row level security; alter table public.collection_history enable row level security;
alter table public.artifact_evaluation_attempts enable row level security; alter table public.artifact_relations enable row level security; alter table public.evidence_positions enable row level security;
alter table public.follows enable row level security; alter table public.notifications enable row level security; alter table public.api_tokens enable row level security;
create policy collections_public_read on public.collections for select using(published_at is not null);
create policy collection_items_public_read on public.collection_items for select using(exists(select 1 from public.collections c where c.id=collection_id and c.published_at is not null));
create policy collection_history_public_read on public.collection_history for select using(exists(select 1 from public.collections c where c.id=collection_id and c.published_at is not null));
create policy attempts_public_read on public.artifact_evaluation_attempts for select using(exists(select 1 from public.evaluations e where e.id=evaluation_id and e.published_at is not null));
create policy relations_public_read on public.artifact_relations for select using(true);
create policy positions_public_read on public.evidence_positions for select using(exists(select 1 from public.artifact_evaluation_attempts a join public.evaluations e on e.id=a.evaluation_id where a.id=attempt_id and e.published_at is not null));
create policy follows_own_read on public.follows for select using(follower_id=auth.uid());
create policy notifications_own_read on public.notifications for select using(recipient_id=auth.uid());
grant select on public.collections,public.collection_items,public.collection_history,public.artifact_evaluation_attempts,public.artifact_relations,public.evidence_positions to anon,authenticated;
grant select on public.follows,public.notifications to authenticated;
grant all on public.collections,public.collection_items,public.collection_history,public.artifact_evaluation_attempts,public.artifact_relations,public.evidence_positions,public.follows,public.notifications,public.api_tokens to service_role;
grant usage,select on sequence public.collection_history_id_seq to service_role;

create function private.prevent_collaboration_history_change() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Published collaboration history is append-only' using errcode='42501'; end $$;
create trigger collection_history_append_only before update or delete on public.collection_history for each row execute function private.prevent_collaboration_history_change();
create trigger attempts_append_only before update or delete on public.artifact_evaluation_attempts for each row execute function private.prevent_collaboration_history_change();
create trigger relations_append_only before update or delete on public.artifact_relations for each row execute function private.prevent_collaboration_history_change();
create trigger positions_append_only before update or delete on public.evidence_positions for each row execute function private.prevent_collaboration_history_change();
revoke all on function private.prevent_collaboration_history_change() from public,anon,authenticated,service_role;

create function public.mark_notification_read(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and recipient_id=auth.uid(); if not found then raise exception 'Notification not found' using errcode='42501'; end if; end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon,authenticated,service_role; grant execute on function public.mark_notification_read(uuid) to authenticated;

alter table private.account_activity_events drop constraint account_activity_events_event_type_check;
alter table private.account_activity_events add constraint account_activity_events_event_type_check check(event_type in ('account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed'));
create or replace function private.log_account_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text,p_source text default 'direct_or_unknown') returns void language plpgsql security definer set search_path='' as $$
begin if p_account is null or not exists(select 1 from auth.users where id=p_account) then return; end if;
if p_event not in ('account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated','artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed') then raise exception 'Unsupported account activity'; end if;
if p_source not in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid') then raise exception 'Unsupported source channel'; end if;
insert into private.account_activity_events(account_id,event_type,resource_id,source_channel,dedupe_key) values(p_account,p_event,p_resource,p_source,p_dedupe) on conflict(account_id,event_type,dedupe_key) do nothing; end $$;
create or replace function public.record_collaboration_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text) returns void language plpgsql security definer set search_path='' as $$
begin if p_event not in ('collection_created','artifact_followed','attempt_attached','evidence_reviewed') then raise exception 'Unsupported collaboration activity'; end if; perform private.log_account_activity(p_account,p_event,p_resource,p_dedupe,'direct_or_unknown'); end $$;
revoke all on function private.log_account_activity(uuid,text,uuid,text,text),public.record_collaboration_activity(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_collaboration_activity(uuid,text,uuid,text) to service_role;

create or replace function public.operator_account_activity_summary(p_as_of timestamptz default now()) returns jsonb language sql stable security definer set search_path='' as $$
with eligible_users as (select u.id,u.created_at from auth.users u where u.email_confirmed_at is not null and u.deleted_at is null and not exists(select 1 from private.account_measurement_exclusions x where x.account_id=u.id)),
eligible_events as (select e.* from private.account_activity_events e join eligible_users u on u.id=e.account_id),
first_value as (select account_id,min(occurred_at) at time zone 'utc' first_at from eligible_events where event_type<>'account_verified' group by account_id),
active_30d as (select distinct account_id from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of and event_type<>'account_verified'),
retained_7d as (select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id where e.event_type<>'account_verified' and e.occurred_at>=f.first_at+interval '7 days' and e.occurred_at<f.first_at+interval '14 days'),
retained_30d as (select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id where e.event_type<>'account_verified' and e.occurred_at>=f.first_at+interval '30 days' and e.occurred_at<f.first_at+interval '60 days')
select jsonb_build_object('as_of',p_as_of,'definition','real non-excluded confirmed accounts with a qualifying server-recorded workflow in the trailing 30 days','verified_accounts',(select count(*) from eligible_users),'activated_accounts',(select count(*) from first_value),'active_accounts_30d',(select count(*) from active_30d),'retained_accounts_7d',(select count(*) from retained_7d),'retained_accounts_30d',(select count(*) from retained_30d),'excluded_accounts',(select count(*) from private.account_measurement_exclusions),'qualifying_events_30d',(select count(*) from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of and event_type<>'account_verified'),'channels_30d',coalesce((select jsonb_object_agg(source_channel,total) from (select source_channel,count(distinct account_id) total from eligible_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of and event_type<>'account_verified' group by source_channel) channels),'{}'::jsonb));
$$;
revoke all on function public.operator_account_activity_summary(timestamptz) from public,anon,authenticated,service_role; grant execute on function public.operator_account_activity_summary(timestamptz) to service_role;

comment on table public.collections is 'Public, attributable groupings of canonical robotics artifacts, evaluations, hardware and organizations.';
comment on table public.evidence_positions is 'Append-only community evidence positions; these never replace appointed verification reviews.';
comment on table public.notifications is 'Private in-product updates generated from explicitly followed public resources.';
notify pgrst,'reload schema';
commit;
