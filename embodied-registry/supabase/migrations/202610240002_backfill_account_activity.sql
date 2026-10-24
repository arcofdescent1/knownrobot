begin;

insert into private.account_activity_events(account_id,event_type,occurred_on,occurred_at,dedupe_key)
select id,'account_verified',email_confirmed_at::date,email_confirmed_at,id::text
from auth.users where email_confirmed_at is not null
on conflict(account_id,event_type,dedupe_key) do nothing;

insert into private.account_activity_events(account_id,event_type,resource_id,occurred_on,occurred_at,dedupe_key)
select id,'profile_completed',id,created_at::date,created_at,id::text
from public.profiles where handle is not null and length(btrim(display_name)) >= 2
on conflict(account_id,event_type,dedupe_key) do nothing;

insert into private.account_activity_events(account_id,event_type,resource_id,occurred_on,occurred_at,dedupe_key)
select profile_id,case when role='owner' then 'team_created' else 'team_joined' end,organization_id,created_at::date,created_at,organization_id::text
from public.organization_members
on conflict(account_id,event_type,dedupe_key) do nothing;

insert into private.account_activity_events(account_id,event_type,resource_id,occurred_on,occurred_at,dedupe_key)
select submitted_by,'evaluation_draft_saved',id,created_at::date,created_at,id::text
from public.evaluations
on conflict(account_id,event_type,dedupe_key) do nothing;

insert into private.account_activity_events(account_id,event_type,resource_id,occurred_on,occurred_at,dedupe_key)
select submitted_by,'evaluation_published',id,published_at::date,published_at,id::text
from public.evaluations where published_at is not null
on conflict(account_id,event_type,dedupe_key) do nothing;

commit;
