begin;

create table public.acquisition_targets (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete restrict,
  recipient_name text not null check (length(recipient_name) between 2 and 160),
  recipient_url text not null check (recipient_url like 'https://%'),
  channel text not null check (channel in ('github','huggingface','email','reddit','discord','forum','community','partner')),
  evidence_gap text not null check (length(evidence_gap) between 20 and 2000),
  value_asset_summary text not null check (length(value_asset_summary) between 20 and 4000),
  action_path text not null check (action_path ~ '^/opportunities/review/[a-z0-9][a-z0-9-]{2,90}$'),
  tracking_token text not null unique check (tracking_token ~ '^[A-Za-z0-9_-]{32,80}$'),
  status text not null default 'asset_complete' check (status in ('asset_complete','contacted','replied','activated','closed')),
  contacted_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(artifact_id,recipient_url)
);

create table public.acquisition_events (
  id bigint generated always as identity primary key,
  target_id uuid not null references public.acquisition_targets(id) on delete cascade,
  event_type text not null check (event_type in ('qualified_visit','signup','reply','first_value','maintainer_action','upstream_placement')),
  account_id uuid references auth.users(id) on delete set null,
  session_key uuid,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  check (account_id is not null or session_key is not null or event_type = 'reply')
);

create table public.acquisition_tasks (
  task_key text primary key check (task_key in ('correction_flow_verified','evidence_bounty_posted')),
  proof_url text not null check (proof_url like 'https://%'),
  completed_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict
);

create unique index acquisition_visit_once on public.acquisition_events(target_id,event_type,session_key);
create unique index acquisition_account_event_once on public.acquisition_events(target_id,event_type,account_id);
create index acquisition_events_time on public.acquisition_events(occurred_at desc);
create index acquisition_targets_status on public.acquisition_targets(status,updated_at desc);

alter table public.acquisition_targets enable row level security;
alter table public.acquisition_events enable row level security;
alter table public.acquisition_tasks enable row level security;
revoke all on public.acquisition_targets,public.acquisition_events,public.acquisition_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.acquisition_targets,public.acquisition_events,public.acquisition_tasks to service_role;
grant usage,select on sequence public.acquisition_events_id_seq to service_role;

commit;
