begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.account_activity_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'account_verified', 'profile_completed', 'account_workspace_return',
    'team_created', 'team_joined', 'evaluation_draft_saved',
    'evaluation_published', 'review_contributed', 'sprint_participated'
  )),
  resource_id uuid,
  occurred_on date not null default current_date,
  occurred_at timestamptz not null default now(),
  source_channel text not null default 'direct_or_unknown' check (
    source_channel in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid')
  ),
  dedupe_key text not null check (length(dedupe_key) between 1 and 200),
  unique (account_id, event_type, dedupe_key)
);

create index account_activity_events_time on private.account_activity_events (occurred_at desc);
create index account_activity_events_account_time on private.account_activity_events (account_id, occurred_at desc);

create table private.account_measurement_exclusions (
  account_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (reason in ('founder','test','bot','blocked','deleted')),
  note text not null default '' check (length(note) <= 500),
  excluded_at timestamptz not null default now()
);

revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on private.account_activity_events to service_role;
grant select, insert, update, delete on private.account_measurement_exclusions to service_role;
grant usage, select on sequence private.account_activity_events_id_seq to service_role;

create function private.log_account_activity(
  p_account uuid,
  p_event text,
  p_resource uuid,
  p_dedupe text,
  p_source text default 'direct_or_unknown'
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_account is null or not exists (select 1 from auth.users where id=p_account) then return; end if;
  if p_event not in ('account_verified','profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated') then raise exception 'Unsupported account activity'; end if;
  if p_source not in ('direct_or_unknown','organic_search','community','partner','email','referral','event','paid') then raise exception 'Unsupported source channel'; end if;
  insert into private.account_activity_events(account_id,event_type,resource_id,source_channel,dedupe_key)
    values(p_account,p_event,p_resource,p_source,p_dedupe)
    on conflict(account_id,event_type,dedupe_key) do nothing;
end $$;

create function private.capture_verified_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and (tg_op='INSERT' or old.email_confirmed_at is null) then
    perform private.log_account_activity(new.id,'account_verified',null,new.id::text);
  end if;
  return new;
end $$;

create trigger capture_verified_account after insert or update of email_confirmed_at on auth.users
for each row execute function private.capture_verified_account();

create function private.capture_profile_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.handle is not null and length(btrim(new.display_name)) >= 2 then
    perform private.log_account_activity(new.id,'profile_completed',new.id,new.id::text);
  end if;
  return new;
end $$;
create trigger capture_profile_completion after insert or update of handle,display_name on public.profiles
for each row execute function private.capture_profile_completion();

create function private.capture_evaluation_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform private.log_account_activity(new.submitted_by,'evaluation_draft_saved',new.id,new.id::text);
    if new.published_at is not null then
      perform private.log_account_activity(new.submitted_by,'evaluation_published',new.id,new.id::text);
    end if;
  elsif old.published_at is null and new.published_at is not null then
    perform private.log_account_activity(new.submitted_by,'evaluation_published',new.id,new.id::text);
  end if;
  return new;
end $$;
create trigger capture_evaluation_activity after insert or update of published_at on public.evaluations
for each row execute function private.capture_evaluation_activity();

create function private.capture_membership_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_account_activity(new.profile_id,case when new.role='owner' then 'team_created' else 'team_joined' end,new.organization_id,new.organization_id::text);
  return new;
end $$;
create trigger capture_membership_activity after insert on public.organization_members
for each row execute function private.capture_membership_activity();

create function public.record_account_workspace_activity() returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  perform private.log_account_activity(actor,'account_workspace_return',null,current_date::text);
end $$;
revoke all on function public.record_account_workspace_activity() from public,anon,authenticated,service_role;
grant execute on function public.record_account_workspace_activity() to authenticated;

create function public.operator_account_activity_summary(p_as_of timestamptz default now()) returns jsonb
language sql stable security definer set search_path = '' as $$
with eligible_users as (
  select u.id,u.created_at
  from auth.users u
  where u.email_confirmed_at is not null
    and u.deleted_at is null
    and not exists(select 1 from private.account_measurement_exclusions x where x.account_id=u.id)
), eligible_events as (
  select e.* from private.account_activity_events e join eligible_users u on u.id=e.account_id
), first_value as (
  select account_id,min(occurred_at) at time zone 'utc' as first_at
  from eligible_events
  where event_type in ('profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated')
  group by account_id
), active_30d as (
  select distinct account_id from eligible_events
  where occurred_at > p_as_of - interval '30 days' and occurred_at <= p_as_of
    and event_type in ('profile_completed','account_workspace_return','team_created','team_joined','evaluation_draft_saved','evaluation_published','review_contributed','sprint_participated')
), retained_7d as (
  select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id
  where e.occurred_at >= f.first_at + interval '7 days' and e.occurred_at < f.first_at + interval '14 days'
), retained_30d as (
  select distinct f.account_id from first_value f join eligible_events e on e.account_id=f.account_id
  where e.occurred_at >= f.first_at + interval '30 days' and e.occurred_at < f.first_at + interval '60 days'
)
select jsonb_build_object(
  'as_of',p_as_of,
  'definition','real non-excluded confirmed accounts with a qualifying server-recorded workflow in the trailing 30 days',
  'verified_accounts',(select count(*) from eligible_users),
  'activated_accounts',(select count(*) from first_value),
  'active_accounts_30d',(select count(*) from active_30d),
  'retained_accounts_7d',(select count(*) from retained_7d),
  'retained_accounts_30d',(select count(*) from retained_30d),
  'excluded_accounts',(select count(*) from private.account_measurement_exclusions),
  'qualifying_events_30d',(select count(*) from eligible_events where occurred_at > p_as_of-interval '30 days' and occurred_at <= p_as_of and event_type<>'account_verified'),
  'channels_30d',coalesce((select jsonb_object_agg(source_channel,total) from (select source_channel,count(distinct account_id) total from eligible_events where occurred_at > p_as_of-interval '30 days' and occurred_at <= p_as_of and event_type<>'account_verified' group by source_channel) channels),'{}'::jsonb)
);
$$;
revoke all on function public.operator_account_activity_summary(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.operator_account_activity_summary(timestamptz) to service_role;

revoke all on function private.log_account_activity(uuid,text,uuid,text,text), private.capture_verified_account(), private.capture_profile_completion(), private.capture_evaluation_activity(), private.capture_membership_activity() from public,anon,authenticated,service_role;

comment on table private.account_activity_events is 'Private, server-derived lifecycle events. Never stores email addresses, form bodies, evidence payloads, or analytics identifiers.';
comment on function public.operator_account_activity_summary(timestamptz) is 'Service-role-only aggregate. Raw account event rows remain private.';

notify pgrst, 'reload schema';
commit;
