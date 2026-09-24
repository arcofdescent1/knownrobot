begin;

create table public.external_policy_assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  source_provider text not null check (source_provider = 'huggingface'),
  source_repository text not null check (source_repository ~ '^[^/[:space:]]+/[^/[:space:]]+$'),
  source_revision text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  assessor_profile_id uuid not null references public.profiles(id),
  lifecycle text not null default 'draft' check (lifecycle in ('draft','review','published')),
  record jsonb not null,
  record_digest text not null check (record_digest ~ '^[a-f0-9]{64}$'),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_provider, source_repository, source_revision)
);

create index external_policy_assessments_publication on public.external_policy_assessments(published_at desc, slug) where lifecycle='published';

create function public.guard_external_policy_assessment() returns trigger
language plpgsql security definer set search_path='' as $$
declare intent jsonb;
begin
  new.record_digest := encode(pg_catalog.sha256(pg_catalog.convert_to(new.record::text,'UTF8')),'hex');
  if octet_length(new.record::text)>1000000
    or new.record->>'record_type'<>'external_policy_assessment'
    or new.record->>'schema_version'<>'1.0'
    or new.record->>'slug' is distinct from new.slug
    or new.record->'source'->>'provider' is distinct from new.source_provider
    or new.record->'source'->>'repository' is distinct from new.source_repository
    or new.record->'source'->>'revision' is distinct from new.source_revision
    or new.record->'assessment'->>'method'<>'metadata_only'
    or new.record->'assessment'->>'executed_policy_code'<>'false'
    or new.record->'assessment'->>'evaluated_policy'<>'false'
    or new.record->'assessment'->>'established_compatibility'<>'false'
    or new.record->'assessment'->>'artifact_intent_notice'<>'Descriptive classification only; it is not a compatibility, performance, safety or deployment conclusion.' then
    raise exception 'Invalid external policy assessment record' using errcode='22023';
  end if;
  if jsonb_typeof(new.record->'assessment'->'artifact_intents') is distinct from 'array'
    or jsonb_array_length(new.record->'assessment'->'artifact_intents') not between 1 and 5 then
    raise exception 'External policy assessment requires one to five artifact intents' using errcode='22023';
  end if;
  if new.record ? 'evidence_classes' then
    if jsonb_typeof(new.record->'evidence_classes'->'knownrobot_measured_results') is distinct from 'array'
      or jsonb_array_length(new.record->'evidence_classes'->'knownrobot_measured_results')<>0 then
      raise exception 'Metadata assessments cannot contain Known Robot measured results' using errcode='22023';
    end if;
  end if;
  for intent in select * from jsonb_array_elements(new.record->'assessment'->'artifact_intents') loop
    if jsonb_typeof(intent)<>'string' or (intent#>>'{}') not in ('task_policy','base_policy','training_checkpoint','simulation_policy','hardware_policy') then
      raise exception 'Invalid external policy assessment artifact intent' using errcode='22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(new.record->'assessment'->'artifact_intents'))
    <> (select count(distinct value) from jsonb_array_elements(new.record->'assessment'->'artifact_intents')) then
    raise exception 'Duplicate external policy assessment artifact intent' using errcode='22023';
  end if;
  if tg_op='INSERT' then
    if new.lifecycle<>'draft' or new.reviewed_at is not null or new.published_at is not null then
      raise exception 'New external policy assessments must enter as drafts' using errcode='22023';
    end if;
  else
    if old.lifecycle='published' then raise exception 'Published external policy assessments are immutable' using errcode='22023'; end if;
    if (old.source_provider,old.source_repository,old.source_revision,old.slug,old.assessor_profile_id,old.created_at)
      is distinct from (new.source_provider,new.source_repository,new.source_revision,new.slug,new.assessor_profile_id,new.created_at) then
      raise exception 'External assessment identity is immutable' using errcode='22023';
    end if;
    if old.lifecycle='draft' and new.lifecycle='review' then
      new.reviewed_at := now();
    elsif old.lifecycle='review' and new.lifecycle='published' then
      if new.record is distinct from old.record then raise exception 'Reviewed assessment content cannot change during publication' using errcode='22023'; end if;
      new.reviewed_at := old.reviewed_at;
      new.published_at := now();
    elsif new.lifecycle is distinct from old.lifecycle then
      raise exception 'Invalid external assessment lifecycle transition' using errcode='22023';
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;

create function public.prevent_external_policy_assessment_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'External policy assessment history is append-only' using errcode='22023';
end; $$;

create trigger external_policy_assessment_guard before insert or update on public.external_policy_assessments
for each row execute function public.guard_external_policy_assessment();
create trigger external_policy_assessment_no_delete before delete on public.external_policy_assessments
for each row execute function public.prevent_external_policy_assessment_delete();

alter table public.external_policy_assessments enable row level security;
revoke all on public.external_policy_assessments from public,anon,authenticated,service_role;
grant select on public.external_policy_assessments to anon,authenticated,service_role;
grant insert,update,delete on public.external_policy_assessments to service_role;
create policy "Published external assessments are public" on public.external_policy_assessments
for select to anon,authenticated using (lifecycle='published' and published_at is not null);

revoke all on function public.guard_external_policy_assessment(),public.prevent_external_policy_assessment_delete() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
