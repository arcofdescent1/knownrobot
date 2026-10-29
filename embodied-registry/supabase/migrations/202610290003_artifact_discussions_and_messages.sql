begin;

create table public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check(kind in ('discussion','metadata_correction','compatibility_question','reproduction_request','evidence_request','disputed_finding','maintainer_announcement')),
  title text not null check(length(title) between 8 and 180),
  body text not null check(length(body) between 40 and 5000),
  desired_outcome text not null default '' check(length(desired_outcome)<=1000),
  status text not null default 'open' check(status in ('open','in_progress','blocked','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  parent_id uuid references public.discussion_posts(id) on delete restrict,
  body text not null check(length(body) between 10 and 5000),
  created_at timestamptz not null default now()
);

create table public.discussion_history (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  from_status text,
  to_status text not null check(to_status in ('open','in_progress','blocked','resolved','closed')),
  note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default now()
);

create table public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined','closed')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(requester_id<>recipient_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(body) between 2 and 2000),
  created_at timestamptz not null default now()
);

create table public.account_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  message_id uuid references public.direct_messages(id) on delete set null,
  reason text not null check(reason in ('spam','harassment','unsafe_content','impersonation','other')),
  details text not null default '' check(length(details)<=2000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique(reporter_id,conversation_id)
);

create index discussion_threads_artifact_time on public.discussion_threads(artifact_id,updated_at desc);
create index discussion_posts_thread_time on public.discussion_posts(thread_id,created_at);
create index message_conversations_requester_time on public.message_conversations(requester_id,updated_at desc);
create index message_conversations_recipient_time on public.message_conversations(recipient_id,updated_at desc);
create index direct_messages_conversation_time on public.direct_messages(conversation_id,created_at);
create unique index one_pending_message_request on public.message_conversations(requester_id,recipient_id,artifact_id) where status='pending';

create function private.validate_discussion_parent() returns trigger language plpgsql set search_path='' as $$
begin
  if new.parent_id is not null and not exists(select 1 from public.discussion_posts p where p.id=new.parent_id and p.thread_id=new.thread_id) then
    raise exception 'Reply parent must belong to the same discussion' using errcode='23514';
  end if;
  return new;
end $$;
create trigger validate_discussion_parent before insert on public.discussion_posts for each row execute function private.validate_discussion_parent();
revoke all on function private.validate_discussion_parent() from public,anon,authenticated,service_role;

alter table public.discussion_threads enable row level security;
alter table public.discussion_posts enable row level security;
alter table public.discussion_history enable row level security;
alter table public.message_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.account_blocks enable row level security;
alter table public.message_reports enable row level security;

create policy discussion_threads_public_read on public.discussion_threads for select using(true);
create policy discussion_posts_public_read on public.discussion_posts for select using(true);
create policy discussion_history_public_read on public.discussion_history for select using(true);
grant select on public.discussion_threads,public.discussion_posts,public.discussion_history to anon,authenticated;
grant all on public.discussion_threads,public.discussion_posts,public.discussion_history,public.message_conversations,public.direct_messages,public.account_blocks,public.message_reports to service_role;
grant usage,select on sequence public.discussion_history_id_seq to service_role;

create function private.prevent_discussion_record_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Published discussion records are append-only' using errcode='42501'; end $$;
create trigger discussion_posts_append_only before update or delete on public.discussion_posts for each row execute function private.prevent_discussion_record_change();
create trigger discussion_history_append_only before update or delete on public.discussion_history for each row execute function private.prevent_discussion_record_change();
revoke all on function private.prevent_discussion_record_change() from public,anon,authenticated,service_role;

alter table public.notifications drop constraint notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check(event_type in (
  'artifact_revision','artifact_correction','evaluation_attempt','evidence_position','collection_update','organization_update',
  'discussion_reply','collaboration_request','collaboration_status','message_request','direct_message'
));

alter table private.account_activity_events drop constraint account_activity_events_event_type_check;
alter table private.account_activity_events add constraint account_activity_events_event_type_check check(event_type in (
  'account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated',
  'artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed',
  'discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed','message_request_sent','direct_message_sent'
));

create or replace function private.log_account_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text,p_source text default 'direct_or_unknown') returns void language plpgsql security definer set search_path='' as $$
begin
  if p_account is null or not exists(select 1 from auth.users where id=p_account) then return; end if;
  if p_event not in (
    'account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated',
    'artifact_imported','artifact_claimed','artifact_corrected','collection_created','artifact_followed','attempt_attached','evidence_reviewed',
    'discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed','message_request_sent','direct_message_sent'
  ) then raise exception 'Unsupported account activity'; end if;
  if p_source not in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid') then raise exception 'Unsupported source channel'; end if;
  insert into private.account_activity_events(account_id,event_type,resource_id,source_channel,dedupe_key)
  values(p_account,p_event,p_resource,p_source,p_dedupe)
  on conflict(account_id,event_type,dedupe_key) do nothing;
end $$;

create function public.record_community_activity(p_account uuid,p_event text,p_resource uuid,p_dedupe text) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_event not in ('discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed','message_request_sent','direct_message_sent') then raise exception 'Unsupported community activity'; end if;
  perform private.log_account_activity(p_account,p_event,p_resource,p_dedupe,'direct_or_unknown');
end $$;
revoke all on function private.log_account_activity(uuid,text,uuid,text,text),public.record_community_activity(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_community_activity(uuid,text,uuid,text) to service_role;

create or replace function public.operator_account_activity_summary(p_as_of timestamptz default now()) returns jsonb
language sql stable security definer set search_path='' as $$
with eligible_users as (
  select u.id,u.created_at from auth.users u
  where u.email_confirmed_at is not null and u.deleted_at is null
    and not exists(select 1 from private.account_measurement_exclusions x where x.account_id=u.id)
), eligible_events as (
  select e.* from private.account_activity_events e join eligible_users u on u.id=e.account_id
), account_value_events as (
  select * from eligible_events where event_type not in ('account_verified','message_request_sent','direct_message_sent')
), contribution_events as (
  select * from eligible_events where event_type in (
    'artifact_imported','artifact_claimed','artifact_corrected','evaluation_published','review_contributed','sprint_participated','collection_created','attempt_attached','evidence_reviewed',
    'discussion_started','discussion_replied','collaboration_request_started','collaboration_request_completed'
  )
), first_value as (
  select account_id,min(occurred_at) first_at from account_value_events group by account_id
), first_contribution as (
  select account_id,min(occurred_at) first_at from contribution_events group by account_id
), active_accounts_30d as (
  select distinct account_id from account_value_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
), active_contributors_30d as (
  select distinct account_id from contribution_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
), new_contributors_30d as (
  select account_id from first_contribution where first_at>p_as_of-interval '30 days' and first_at<=p_as_of
), repeat_contributors_30d as (
  select account_id from contribution_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of group by account_id having count(*)>=2
), retained_7d as (
  select distinct f.account_id from first_contribution f join contribution_events e on e.account_id=f.account_id where e.occurred_at>=f.first_at+interval '7 days' and e.occurred_at<f.first_at+interval '14 days'
), retained_30d as (
  select distinct f.account_id from first_contribution f join contribution_events e on e.account_id=f.account_id where e.occurred_at>=f.first_at+interval '30 days' and e.occurred_at<f.first_at+interval '60 days'
)
select jsonb_build_object(
  'as_of',p_as_of,
  'definition','active contributor = real non-excluded confirmed account completing an artifact-changing, evidence-producing, or substantive public artifact-discussion action in the trailing 30 days; private messages never qualify',
  'verified_accounts',(select count(*) from eligible_users),
  'activated_accounts',(select count(*) from first_value),
  'active_accounts_30d',(select count(*) from active_accounts_30d),
  'active_contributors_30d',(select count(*) from active_contributors_30d),
  'new_contributors_30d',(select count(*) from new_contributors_30d),
  'repeat_contributors_30d',(select count(*) from repeat_contributors_30d),
  'retained_accounts_7d',(select count(*) from retained_7d),
  'retained_accounts_30d',(select count(*) from retained_30d),
  'excluded_accounts',(select count(*) from private.account_measurement_exclusions),
  'qualifying_events_30d',(select count(*) from account_value_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of),
  'contribution_events_30d',(select count(*) from contribution_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of),
  'median_minutes_to_first_contribution',coalesce((select percentile_cont(0.5) within group(order by extract(epoch from (f.first_at-u.created_at))/60) from first_contribution f join eligible_users u on u.id=f.account_id),0),
  'channels_30d',coalesce((select jsonb_object_agg(source_channel,total) from (select source_channel,count(distinct account_id) total from contribution_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of group by source_channel) channels),'{}'::jsonb),
  'contribution_events_by_type_30d',coalesce((select jsonb_object_agg(event_type,total) from (select event_type,count(*) total from contribution_events where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of group by event_type) events),'{}'::jsonb)
);
$$;
revoke all on function public.operator_account_activity_summary(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.operator_account_activity_summary(timestamptz) to service_role;

notify pgrst,'reload schema';
commit;
