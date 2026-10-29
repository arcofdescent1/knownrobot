begin;

create or replace function public.operator_account_activity_summary(p_as_of timestamptz default now()) returns jsonb
language sql stable security definer set search_path='' as $$
with eligible_users as (
  select u.id,u.created_at
  from auth.users u
  where u.email_confirmed_at is not null
    and u.deleted_at is null
    and not exists(select 1 from private.account_measurement_exclusions x where x.account_id=u.id)
), eligible_events as (
  select e.* from private.account_activity_events e join eligible_users u on u.id=e.account_id
), account_value_events as (
  select * from eligible_events where event_type<>'account_verified'
), contribution_events as (
  select * from eligible_events where event_type in (
    'artifact_imported','artifact_claimed','artifact_corrected','evaluation_published',
    'review_contributed','sprint_participated','collection_created','attempt_attached','evidence_reviewed'
  )
), first_value as (
  select account_id,min(occurred_at) first_at from account_value_events group by account_id
), first_contribution as (
  select account_id,min(occurred_at) first_at from contribution_events group by account_id
), active_accounts_30d as (
  select distinct account_id from account_value_events
  where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
), active_contributors_30d as (
  select distinct account_id from contribution_events
  where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
), new_contributors_30d as (
  select account_id from first_contribution
  where first_at>p_as_of-interval '30 days' and first_at<=p_as_of
), repeat_contributors_30d as (
  select account_id from contribution_events
  where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of
  group by account_id having count(*)>=2
), retained_7d as (
  select distinct f.account_id from first_contribution f join contribution_events e on e.account_id=f.account_id
  where e.occurred_at>=f.first_at+interval '7 days' and e.occurred_at<f.first_at+interval '14 days'
), retained_30d as (
  select distinct f.account_id from first_contribution f join contribution_events e on e.account_id=f.account_id
  where e.occurred_at>=f.first_at+interval '30 days' and e.occurred_at<f.first_at+interval '60 days'
)
select jsonb_build_object(
  'as_of',p_as_of,
  'definition','active contributor = real non-excluded confirmed account completing an artifact-changing or evidence-producing action in the trailing 30 days',
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
  'median_minutes_to_first_contribution',coalesce((
    select percentile_cont(0.5) within group(order by extract(epoch from (f.first_at-u.created_at))/60)
    from first_contribution f join eligible_users u on u.id=f.account_id
  ),0),
  'channels_30d',coalesce((
    select jsonb_object_agg(source_channel,total) from (
      select source_channel,count(distinct account_id) total from contribution_events
      where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of group by source_channel
    ) channels
  ),'{}'::jsonb),
  'contribution_events_by_type_30d',coalesce((
    select jsonb_object_agg(event_type,total) from (
      select event_type,count(*) total from contribution_events
      where occurred_at>p_as_of-interval '30 days' and occurred_at<=p_as_of group by event_type
    ) events
  ),'{}'::jsonb)
);
$$;

revoke all on function public.operator_account_activity_summary(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.operator_account_activity_summary(timestamptz) to service_role;

comment on function public.operator_account_activity_summary(timestamptz) is
  'Service-role-only contributor funnel. Passive workspace visits, profile completion and follows never count as active contribution.';

notify pgrst,'reload schema';
commit;
