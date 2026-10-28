begin;

alter table public.artifacts add column imported_by_publisher_id uuid references public.assessment_assessors(id);
alter table public.artifacts alter column imported_by drop not null;
alter table public.artifacts add constraint artifacts_importer_identity check(num_nonnulls(imported_by,imported_by_publisher_id)=1);
alter table public.artifact_revisions add column imported_by_publisher_id uuid references public.assessment_assessors(id);
alter table public.artifact_revisions alter column imported_by drop not null;
alter table public.artifact_revisions add constraint artifact_revisions_importer_identity check(num_nonnulls(imported_by,imported_by_publisher_id)=1);
alter table public.artifact_contributions add column contributor_publisher_id uuid references public.assessment_assessors(id);
alter table public.artifact_contributions alter column contributor_profile_id drop not null;
alter table public.artifact_contributions add constraint artifact_contributions_actor_identity check(num_nonnulls(contributor_profile_id,contributor_publisher_id)=1);

do $constraints$
declare item record;
begin
  for item in
    select conname from pg_constraint
    where conrelid='public.collections'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) like '%num_nonnulls(owner_profile_id, owner_organization_id)%'
  loop execute format('alter table public.collections drop constraint %I',item.conname); end loop;
end $constraints$;

alter table public.collections add column owner_publisher_id uuid references public.assessment_assessors(id);
alter table public.collections add column created_by_publisher_id uuid references public.assessment_assessors(id);
alter table public.collections alter column created_by drop not null;
alter table public.collections add constraint collections_owner_identity check(num_nonnulls(owner_profile_id,owner_organization_id,owner_publisher_id)=1);
alter table public.collections add constraint collections_creator_identity check(num_nonnulls(created_by,created_by_publisher_id)=1);
alter table public.collection_items add column added_by_publisher_id uuid references public.assessment_assessors(id);
alter table public.collection_items alter column added_by drop not null;
alter table public.collection_items add constraint collection_items_actor_identity check(num_nonnulls(added_by,added_by_publisher_id)=1);
alter table public.collection_history add column actor_publisher_id uuid references public.assessment_assessors(id);
alter table public.collection_history alter column actor_id drop not null;
alter table public.collection_history add constraint collection_history_actor_identity check(num_nonnulls(actor_id,actor_publisher_id)=1);

do $$
declare
  publisher constant uuid := '90000000-0000-0000-0000-000000000001';
  push_artifact uuid;
  so101_artifact uuid;
  smolvla_artifact uuid;
  push_revision uuid;
  so101_revision uuid;
  smolvla_revision uuid;
  assessment_collection uuid;
  task_collection uuid;
  base_collection uuid;
begin
  insert into public.artifacts(slug,source_provider,source_kind,source_repository,source_url,artifact_type,title,summary,license,imported_by_publisher_id,published_at)
  values
    ('huggingface-aadarshram-act-pusht','huggingface','model','aadarshram/act_pusht','https://huggingface.co/aadarshram/act_pusht','policy','ACT PushT','A revision-pinned LeRobot ACT policy trained on the PushT dataset. KnownRobot has inspected metadata only; no policy execution or compatibility conclusion is included.','Apache-2.0',publisher,now()),
    ('huggingface-abdul004-so101-act-policy-v5','huggingface','model','abdul004/so101_act_policy_v5','https://huggingface.co/abdul004/so101_act_policy_v5','policy','SO-101 Ball-in-Cup ACT','A revision-pinned ACT policy documented upstream for a physical SO-101 ball-in-cup task. Upstream performance statements remain attributed claims; KnownRobot has not reproduced them.','Apache-2.0',publisher,now()),
    ('huggingface-lerobot-smolvla-base','huggingface','model','lerobot/smolvla_base','https://huggingface.co/lerobot/smolvla_base','policy','SmolVLA base','A revision-pinned base VLA checkpoint that requires task-specific adaptation and measured evidence before deployment conclusions can be drawn.','Apache-2.0',publisher,now())
  on conflict(source_provider,source_kind,source_repository) do nothing;

  select id into push_artifact from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='aadarshram/act_pusht';
  select id into so101_artifact from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='abdul004/so101_act_policy_v5';
  select id into smolvla_artifact from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='lerobot/smolvla_base';

  insert into public.artifact_revisions(artifact_id,source_revision,source_revision_url,metadata,inspected_files,uncertainties,imported_by_publisher_id)
  values(
    push_artifact,
    '6d403b142934aaef61fc07f5eec1515c4325751f',
    'https://huggingface.co/aadarshram/act_pusht/tree/6d403b142934aaef61fc07f5eec1515c4325751f',
    '{"assessment_url":"https://knownrobot.com/assessments/aadarshram-act-pusht-6d403b1","assessment_slug":"aadarshram-act-pusht-6d403b1","assessment_status":"incomplete","assessment_method":"metadata_only","assessor":"Known Robot","validator_version":"1.6.0","artifact_intents":["simulation_policy","task_policy"],"upstream_author":"aadarshram","execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed.","compatibility_established":false}'::jsonb,
    '[{"path":"README.md","bytes":1953,"sha256":"33142fae10336df5c9137f3da809476ecb821c871636b814086f3a23df9bef89"},{"path":"config.json","bytes":1478,"sha256":"541ce265150b3f45ee7c8d43d308facfc31a8e07f8d8bcb95fc3df86bb981"},{"path":"policy_postprocessor.json","bytes":660,"sha256":"9ca3b5a1986e8b6d4f41238446eb7b3637776853102ae7f9e8ba29700e6a2e66"},{"path":"policy_preprocessor.json","bytes":1145,"sha256":"39af97ab0d52b54f441fce4925a27b97fd2c20c67f17099d0c63c4746d5169f5"},{"path":"train_config.json","bytes":4599,"sha256":"eab635d09399d34cdcd668942f3de5c31a7103eea0fbe6d296902e03cabbd4a6"}]'::jsonb,
    '[{"kind":"missing_information","count":10,"detail":"Required portable metadata remains absent; inspect the linked assessment for field-level findings."},{"kind":"caution","count":2,"detail":"No evaluation or compatibility record is present."}]'::jsonb,
    publisher
  ) on conflict(artifact_id,source_revision) do nothing;

  insert into public.artifact_revisions(artifact_id,source_revision,source_revision_url,metadata,inspected_files,uncertainties,imported_by_publisher_id)
  values(
    so101_artifact,
    'c14c7f4108c07c0c04ec90b7f110213130c14a9f',
    'https://huggingface.co/abdul004/so101_act_policy_v5/tree/c14c7f4108c07c0c04ec90b7f110213130c14a9f',
    '{"assessment_url":"https://knownrobot.com/assessments/abdul004-so101-act-policy-v5-c14c7f4","assessment_slug":"abdul004-so101-act-policy-v5-c14c7f4","assessment_status":"incomplete","assessment_method":"metadata_only","assessor":"Known Robot","validator_version":"1.6.0","artifact_intents":["hardware_policy","task_policy"],"upstream_author":"abdul004","execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed. Model-card results remain upstream claims.","compatibility_established":false}'::jsonb,
    '[{"path":"README.md","bytes":3670,"sha256":"a2cd03e862f53315278c6b7dceb45a0fb9232f3e898e56e9450d8fc821938a26"},{"path":"config.json","bytes":1715,"sha256":"98c5f453f9ede1d31597206b16745077cbc28ac1aaf939b1407872831063fd34"},{"path":"policy_postprocessor.json","bytes":660,"sha256":"648b415125a183dfd6cbc47c1dc04ab3f2d912654ef22a12ca5e8b93d7d85cdd"},{"path":"policy_preprocessor.json","bytes":1331,"sha256":"94f0567207c15ed824a173f69b0026b834246f608be8e48e76b8de9b019f2e80"},{"path":"train_config.json","bytes":5394,"sha256":"532f0f412cf2fb3a132689eff2225999eb83cadee5750688aea51dbfd3ce4798"}]'::jsonb,
    '[{"kind":"missing_information","count":10,"detail":"Required portable metadata remains absent; inspect the linked assessment for field-level findings."},{"kind":"caution","count":2,"detail":"No KnownRobot-measured evaluation or compatibility record is present."}]'::jsonb,
    publisher
  ) on conflict(artifact_id,source_revision) do nothing;

  insert into public.artifact_revisions(artifact_id,source_revision,source_revision_url,metadata,inspected_files,uncertainties,imported_by_publisher_id)
  values(
    smolvla_artifact,
    'd9f33c94a60fb382c90dea2164c96845bd955e28',
    'https://huggingface.co/lerobot/smolvla_base/tree/d9f33c94a60fb382c90dea2164c96845bd955e28',
    '{"assessment_url":"https://knownrobot.com/assessments/lerobot-smolvla-base-d9f33c9","assessment_slug":"lerobot-smolvla-base-d9f33c9","assessment_status":"incomplete","assessment_method":"metadata_only","assessor":"Known Robot","validator_version":"1.6.0","artifact_intents":["base_policy","training_checkpoint"],"upstream_author":"LeRobot","execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed.","compatibility_established":false}'::jsonb,
    '[{"path":"README.md","bytes":4625,"sha256":"a484071b8d7d0591452f795813fb54af9199fc1c48ef1ee995358d5ba07ee070"},{"path":"config.json","bytes":2299,"sha256":"650584b56c104720f7a3c91d1ec6bec9e8de8ac11e60c92ba2fa82d93eda147d"},{"path":"policy_postprocessor.json","bytes":660,"sha256":"2b78bb742065288df2ec63b0ee35f97a1f6950171cf2272f7e34b1fe3873b17b"},{"path":"policy_preprocessor.json","bytes":1872,"sha256":"7683d648280a72f0d51e869fb8dd1596beed90b7f84849330cf1bc26634a4bd6"}]'::jsonb,
    '[{"kind":"missing_information","count":11,"detail":"A base checkpoint is not a task-ready deployment artifact; inspect the linked assessment for field-level findings."},{"kind":"caution","count":2,"detail":"No task-specific evaluation or compatibility record is present."}]'::jsonb,
    publisher
  ) on conflict(artifact_id,source_revision) do nothing;

  select id into push_revision from public.artifact_revisions where artifact_id=push_artifact and source_revision='6d403b142934aaef61fc07f5eec1515c4325751f';
  select id into so101_revision from public.artifact_revisions where artifact_id=so101_artifact and source_revision='c14c7f4108c07c0c04ec90b7f110213130c14a9f';
  select id into smolvla_revision from public.artifact_revisions where artifact_id=smolvla_artifact and source_revision='d9f33c94a60fb382c90dea2164c96845bd955e28';
  update public.artifacts set latest_revision_id=push_revision,updated_at=now() where id=push_artifact and latest_revision_id is null;
  update public.artifacts set latest_revision_id=so101_revision,updated_at=now() where id=so101_artifact and latest_revision_id is null;
  update public.artifacts set latest_revision_id=smolvla_revision,updated_at=now() where id=smolvla_artifact and latest_revision_id is null;

  insert into public.artifact_contributions(artifact_id,revision_id,contributor_publisher_id,kind,summary,payload,evidence_url)
  select push_artifact,push_revision,publisher,'import','Published the revision-pinned canonical record from the existing non-executing assessment.','{"source":"existing_external_assessment","inspection_boundary":"approved metadata files only"}'::jsonb,'https://knownrobot.com/assessments/aadarshram-act-pusht-6d403b1'
  where not exists(select 1 from public.artifact_contributions where artifact_id=push_artifact and revision_id=push_revision and kind='import');
  insert into public.artifact_contributions(artifact_id,revision_id,contributor_publisher_id,kind,summary,payload,evidence_url)
  select so101_artifact,so101_revision,publisher,'import','Published the revision-pinned canonical record from the existing non-executing assessment.','{"source":"existing_external_assessment","inspection_boundary":"approved metadata files only"}'::jsonb,'https://knownrobot.com/assessments/abdul004-so101-act-policy-v5-c14c7f4'
  where not exists(select 1 from public.artifact_contributions where artifact_id=so101_artifact and revision_id=so101_revision and kind='import');
  insert into public.artifact_contributions(artifact_id,revision_id,contributor_publisher_id,kind,summary,payload,evidence_url)
  select smolvla_artifact,smolvla_revision,publisher,'import','Published the revision-pinned canonical record from the existing non-executing assessment.','{"source":"existing_external_assessment","inspection_boundary":"approved metadata files only"}'::jsonb,'https://knownrobot.com/assessments/lerobot-smolvla-base-d9f33c9'
  where not exists(select 1 from public.artifact_contributions where artifact_id=smolvla_artifact and revision_id=smolvla_revision and kind='import');

  insert into public.collections(slug,title,description,owner_publisher_id,created_by_publisher_id)
  values
    ('external-policy-assessments','External policy assessments','Revision-pinned robot policies whose approved metadata KnownRobot inspected without executing policy code, simulation, or robot commands. Incomplete records are included to expose uncertainty, not imply compatibility.',publisher,publisher),
    ('task-specific-act-policies','Task-specific ACT policies','Pinned ACT policies associated with a specific task. Classification is descriptive; inspect each record for missing runtime, hardware, evaluation, and compatibility evidence.',publisher,publisher),
    ('base-policies-needing-evidence','Base policies needing task evidence','Base checkpoints that still require task-specific adaptation, runtime declarations, and measured evaluation before deployment or compatibility conclusions.',publisher,publisher)
  on conflict(slug) do nothing;

  select id into assessment_collection from public.collections where slug='external-policy-assessments';
  select id into task_collection from public.collections where slug='task-specific-act-policies';
  select id into base_collection from public.collections where slug='base-policies-needing-evidence';

  insert into public.collection_items(collection_id,artifact_id,note,position,added_by_publisher_id) values
    (assessment_collection,push_artifact,'Simulation-policy and task-policy metadata assessment; no execution or compatibility conclusion.',0,publisher),
    (assessment_collection,so101_artifact,'Hardware-policy and task-policy metadata assessment; upstream physical results are not KnownRobot measurements.',1,publisher),
    (assessment_collection,smolvla_artifact,'Base-policy and training-checkpoint assessment showing missing deployment evidence.',2,publisher),
    (task_collection,push_artifact,'Task-specific PushT ACT policy; simulation execution was not performed by KnownRobot.',0,publisher),
    (task_collection,so101_artifact,'Task-specific ball-in-cup ACT policy; upstream physical claims remain attributed.',1,publisher),
    (base_collection,smolvla_artifact,'Base checkpoint requiring task-specific adaptation and measured evidence.',0,publisher)
  on conflict do nothing;

  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select assessment_collection,publisher,'created','{"source":"foundation_publication","item_count":3}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=assessment_collection and action='created');
  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select task_collection,publisher,'created','{"source":"foundation_publication","item_count":2}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=task_collection and action='created');
  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select base_collection,publisher,'created','{"source":"foundation_publication","item_count":1}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=base_collection and action='created');
end $$;

notify pgrst,'reload schema';
commit;
