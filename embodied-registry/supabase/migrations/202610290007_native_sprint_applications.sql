begin;

create table public.sprint_applications (
  id uuid primary key default gen_random_uuid(),
  sprint_id text not null check(sprint_id ~ '^sprint-[a-z0-9-]+$'),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check(role in ('team','reviewer','event_lead')),
  team_name text not null default '' check(length(team_name)<=120),
  environment text not null check(environment in ('physical','simulation','both')),
  configuration text not null check(length(configuration) between 20 and 1500),
  evidence_url text check(evidence_url is null or evidence_url ~ '^https://'),
  availability text not null check(length(availability) between 10 and 1000),
  attribution_consent boolean not null check(attribution_consent),
  status text not null default 'submitted' check(status in ('submitted','reviewing','accepted','waitlisted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sprint_id,applicant_id),
  check(role <> 'team' or length(team_name)>=2)
);

create index sprint_applications_status_time on public.sprint_applications(sprint_id,status,created_at);
alter table public.sprint_applications enable row level security;
grant all on public.sprint_applications to service_role;
revoke all on public.sprint_applications from public,anon,authenticated;

notify pgrst,'reload schema';
commit;

