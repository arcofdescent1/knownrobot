begin;

-- Fail closed rather than silently retaining historical, unaudited claims.
do $$ begin
  if exists (select 1 from public.evaluations where verification_status <> 'self_tested') then
    raise exception 'Unaudited verification claims exist. Export and reset these claims to self_tested before applying this migration.';
  end if;
end $$;

create table public.verification_reviewers (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  allowed_statuses public.verification_status[] not null,
  appointed_by text not null check (length(btrim(appointed_by)) between 3 and 200),
  appointment_reason text not null check (length(btrim(appointment_reason)) between 10 and 4000),
  appointed_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (cardinality(allowed_statuses) > 0),
  check (array_position(allowed_statuses, null) is null),
  check (not ('self_tested'::public.verification_status = any(allowed_statuses)))
);
alter table public.verification_reviewers enable row level security;
revoke all on public.verification_reviewers from public, anon, authenticated;
grant select on public.verification_reviewers to authenticated;
grant select, insert, update on public.verification_reviewers to service_role;
create policy "Reviewers read own appointment" on public.verification_reviewers
  for select to authenticated using (profile_id = (select auth.uid()));

alter table public.evaluations add column review_version integer not null default 0 check (review_version >= 0);

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_identity jsonb not null,
  previous_status public.verification_status not null,
  new_status public.verification_status not null,
  review_version integer not null check (review_version > 0),
  rationale text not null check (length(btrim(rationale)) between 20 and 4000),
  evidence_url text not null check (evidence_url ~ '^https://[^[:space:]]+$'),
  reviewed_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (evaluation_id, review_version),
  check (previous_status <> new_status)
);
alter table public.verification_reviews enable row level security;
revoke all on public.verification_reviews from public, anon, authenticated, service_role;
grant select on public.verification_reviews to anon, authenticated, service_role;
create policy "Visible evaluation review history" on public.verification_reviews
  for select to anon, authenticated using (
    exists (select 1 from public.evaluations e where e.id = evaluation_id)
  );

drop policy "Public evaluations and own evaluations readable" on public.evaluations;
create policy "Published evaluations and own drafts readable" on public.evaluations
  for select to anon, authenticated using (
    submitted_by = (select auth.uid()) or
    (visibility = 'public' and published_at is not null and exists (
      select 1 from public.skills s where s.id = skill_id and s.published_at is not null
    ))
  );
create policy "Appointed reviewers read submitted evidence" on public.evaluations
  for select to authenticated using (exists (
    select 1 from public.verification_reviewers r
    where r.profile_id = (select auth.uid()) and r.revoked_at is null
  ));

drop policy "Users submit evaluations" on public.evaluations;
create policy "Users submit self-reported evaluations" on public.evaluations
  for insert to authenticated with check (
    submitted_by = (select auth.uid()) and verification_status = 'self_tested'
    and reproduction_count = 0 and review_version = 0
  );
drop policy "Submitters update unpublished evaluations" on public.evaluations;
create policy "Submitters edit self-reported drafts" on public.evaluations
  for update to authenticated using (
    submitted_by = (select auth.uid()) and published_at is null and verification_status = 'self_tested'
  ) with check (
    submitted_by = (select auth.uid()) and verification_status = 'self_tested'
    and reproduction_count = 0 and review_version = 0
  );

-- Column grants also constrain service_role (which bypasses RLS).
revoke all on public.evaluations from public, anon, authenticated, service_role;
grant select on public.evaluations to anon, authenticated, service_role;
grant insert (id, skill_id, hardware_profile_id, benchmark_id, submitted_by,
  visibility, success_rate, trial_count, runtime, evidence, result_digest, published_at)
  on public.evaluations to authenticated, service_role;
grant update (skill_id, hardware_profile_id, benchmark_id, visibility, success_rate,
  trial_count, runtime, evidence, result_digest, published_at)
  on public.evaluations to authenticated, service_role;

-- Trigger is intentionally invoker-security: RPC executes as the table owner,
-- whereas REST users and service_role cannot alter review-derived fields.
create function public.guard_evaluation_verification() returns trigger
language plpgsql set search_path = '' as $$
declare owner_name text;
begin
  select pg_catalog.pg_get_userbyid(c.relowner) into owner_name
    from pg_catalog.pg_class c where c.oid = 'public.evaluations'::regclass;
  if tg_op = 'INSERT' then
    if new.verification_status <> 'self_tested' or new.review_version <> 0 or new.reproduction_count <> 0 then
      raise exception 'Evaluations must start self-reported' using errcode = '42501';
    end if;
  elsif current_user <> owner_name then
    if old.published_at is not null or old.review_version > 0 then
      raise exception 'Published or reviewed evaluations are immutable; submit a new evaluation' using errcode = '42501';
    end if;
    if new.verification_status is distinct from old.verification_status
      or new.review_version is distinct from old.review_version
      or new.reproduction_count is distinct from old.reproduction_count
      or new.submitted_by is distinct from old.submitted_by then
      raise exception 'Verification fields are review-controlled' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_evaluation_verification() from public, anon, authenticated, service_role;
create trigger evaluation_verification_guard before insert or update on public.evaluations
  for each row execute function public.guard_evaluation_verification();

create function public.guard_verification_history() returns trigger
language plpgsql set search_path = '' as $$ begin
  raise exception 'Verification history is append-only' using errcode = '42501';
end $$;
revoke all on function public.guard_verification_history() from public, anon, authenticated, service_role;
create trigger verification_history_immutable before update or delete on public.verification_reviews
  for each row execute function public.guard_verification_history();

create function public.review_evaluation(
  p_evaluation_id uuid, p_expected_version integer,
  p_new_status public.verification_status, p_rationale text, p_evidence_url text
) returns public.verification_reviews
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  appointment public.verification_reviewers;
  evaluation public.evaluations;
  skill public.skills;
  hardware public.hardware_profiles;
  benchmark public.benchmarks;
  review public.verification_reviews;
  identity jsonb;
begin
  if actor is null then
    raise exception 'An authenticated reviewer is required' using errcode = '42501';
  end if;
  -- Lock appointment to serialize revocation against in-flight decisions.
  select * into appointment from public.verification_reviewers where profile_id = actor for share;
  if not found or appointment.revoked_at is not null then
    raise exception 'An active reviewer appointment is required' using errcode = '42501';
  end if;
  if p_new_status is null or (p_new_status <> 'self_tested' and not coalesce(p_new_status = any(appointment.allowed_statuses), false)) then
    raise exception 'Reviewer is not authorized for this verification level' using errcode = '42501';
  end if;
  if p_rationale is null or length(btrim(p_rationale)) not between 20 and 4000
    or p_evidence_url is null or p_evidence_url !~ '^https://[^[:space:]]+$' then
    raise exception 'A substantive rationale and HTTPS evidence URL are required' using errcode = '22023';
  end if;
  select * into evaluation from public.evaluations where id = p_evaluation_id for update;
  if not found then raise exception 'Evaluation not found' using errcode = 'P0002'; end if;
  if p_expected_version is null or evaluation.review_version <> p_expected_version then
    raise exception 'Review version changed; reload before deciding' using errcode = '40001';
  end if;
  if evaluation.verification_status = p_new_status then
    raise exception 'Decision must change verification status' using errcode = '22023';
  end if;
  -- Retractions require the same authority as the claim being retracted.
  if evaluation.verification_status <> 'self_tested'
    and not coalesce(evaluation.verification_status = any(appointment.allowed_statuses), false) then
    raise exception 'Reviewer cannot retract this verification level' using errcode = '42501';
  end if;
  select * into skill from public.skills where id = evaluation.skill_id for share;
  if actor = evaluation.submitted_by or actor = skill.owner_profile_id or exists (
    select 1 from public.organization_members m
    where m.organization_id = skill.owner_organization_id and m.profile_id = actor
  ) then
    raise exception 'Reviewers must be independent of the submitter and artifact owner' using errcode = '42501';
  end if;
  if evaluation.published_at is null or skill.published_at is null then
    raise exception 'Publish the evaluation and artifact before review' using errcode = '22023';
  end if;
  if p_new_status <> 'self_tested' and (
    evaluation.result_digest !~ '^(sha256:)?[a-f0-9]{64}$'
    or skill.source_revision !~ '^(sha256:)?([a-f0-9]{40}|[a-f0-9]{64})$'
    or jsonb_typeof(evaluation.evidence) <> 'array' or jsonb_array_length(evaluation.evidence) = 0
  ) then
    raise exception 'Verification requires evidence, SHA-256 result digest, and immutable source revision' using errcode = '22023';
  end if;
  select * into hardware from public.hardware_profiles where id = evaluation.hardware_profile_id for share;
  select * into benchmark from public.benchmarks where id = evaluation.benchmark_id for share;
  if benchmark.published_at is null then
    raise exception 'Publish the benchmark protocol before review' using errcode = '22023';
  end if;
  select jsonb_build_object('id', p.id, 'handle', p.handle, 'display_name', p.display_name)
    into identity from public.profiles p where p.id = actor;
  insert into public.verification_reviews (
    evaluation_id, reviewer_id, reviewer_identity, previous_status, new_status,
    review_version, rationale, evidence_url, reviewed_snapshot
  ) values (
    evaluation.id, actor, identity, evaluation.verification_status, p_new_status,
    evaluation.review_version + 1, btrim(p_rationale), p_evidence_url,
    jsonb_build_object('evaluation', to_jsonb(evaluation), 'skill', to_jsonb(skill),
      'hardware', to_jsonb(hardware), 'benchmark', to_jsonb(benchmark),
      'reviewer_appointment', to_jsonb(appointment))
  ) returning * into review;
  update public.evaluations set verification_status = p_new_status,
    review_version = review.review_version where id = evaluation.id;
  return review;
end $$;
revoke all on function public.review_evaluation(uuid, integer, public.verification_status, text, text)
  from public, anon, service_role;
grant execute on function public.review_evaluation(uuid, integer, public.verification_status, text, text)
  to authenticated;

-- A verified label must never drift onto subsequently edited dependencies.
create function public.guard_reviewed_artifact() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if exists (select 1 from public.evaluations e where e.review_version > 0 and (
    (tg_table_name = 'skills' and e.skill_id = old.id) or
    (tg_table_name = 'hardware_profiles' and e.hardware_profile_id = old.id) or
    (tg_table_name = 'benchmarks' and e.benchmark_id = old.id)
  )) then
    raise exception 'Reviewed artifacts are immutable; create a new version' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_reviewed_artifact() from public, anon, authenticated, service_role;
create trigger reviewed_skill_immutable before update on public.skills
  for each row execute function public.guard_reviewed_artifact();
create trigger reviewed_hardware_immutable before update on public.hardware_profiles
  for each row execute function public.guard_reviewed_artifact();
create trigger reviewed_benchmark_immutable before update on public.benchmarks
  for each row execute function public.guard_reviewed_artifact();

notify pgrst, 'reload schema';
commit;
