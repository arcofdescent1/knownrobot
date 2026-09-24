begin;

create table public.assessment_assessors (
  id uuid primary key,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,38}$'),
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  identity_kind text not null check (identity_kind in ('profile','organization','service')),
  created_at timestamptz not null default now()
);

insert into public.assessment_assessors(id,handle,display_name,identity_kind)
values('90000000-0000-0000-0000-000000000001','knownrobot','Known Robot','organization');

alter table public.external_policy_assessments alter column assessor_profile_id drop not null;
alter table public.external_policy_assessments add column assessor_id uuid not null default '90000000-0000-0000-0000-000000000001'
  references public.assessment_assessors(id) on delete restrict;

create function public.guard_external_assessor_identity() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if tg_op='UPDATE' and new.assessor_id is distinct from old.assessor_id then
    raise exception 'External assessment assessor identity is immutable' using errcode='22023';
  end if;
  return new;
end $$;
create trigger external_assessment_assessor_guard before update on public.external_policy_assessments
for each row execute function public.guard_external_assessor_identity();

alter table public.assessment_assessors enable row level security;
revoke all on public.assessment_assessors from public,anon,authenticated,service_role;
grant select on public.assessment_assessors to anon,authenticated,service_role;
create policy "Assessment assessor identities are public" on public.assessment_assessors
for select to anon,authenticated using (true);
revoke all on function public.guard_external_assessor_identity() from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
