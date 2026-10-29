begin;

do $$
declare
  publisher constant uuid := '90000000-0000-0000-0000-000000000001';
  pi0 uuid; pi05 uuid; libero uuid; pusht_dataset uuid; lerobot_repo uuid;
  pi0_revision uuid; pi05_revision uuid; libero_revision uuid; pusht_revision uuid; repo_revision uuid;
  foundations uuid; pusht_collection uuid; base_collection uuid;
begin
  insert into public.artifacts(slug,source_provider,source_kind,source_repository,source_url,artifact_type,title,summary,license,imported_by_publisher_id,published_at)
  values
    ('huggingface-lerobot-pi0-base','huggingface','model','lerobot/pi0_base','https://huggingface.co/lerobot/pi0_base','policy','pi0 (Pi0) LeRobot base','An official LeRobot base checkpoint for pi0. This canonical record is a metadata inspection, not an execution, evaluation, safety review, or hardware-compatibility conclusion.','gemma',publisher,now()),
    ('huggingface-lerobot-pi05-base','huggingface','model','lerobot/pi05_base','https://huggingface.co/lerobot/pi05_base','policy','pi0.5 (Pi05) LeRobot base','An official LeRobot base checkpoint for pi0.5. This canonical record is a metadata inspection, not an execution, evaluation, safety review, or hardware-compatibility conclusion.','gemma',publisher,now()),
    ('huggingface-lerobot-smolvla-libero','huggingface','model','lerobot/smolvla_libero','https://huggingface.co/lerobot/smolvla_libero','policy','SmolVLA LIBERO','An official LeRobot SmolVLA checkpoint associated upstream with LIBERO. Upstream results remain attributed claims; KnownRobot has not reproduced them.','Apache-2.0',publisher,now()),
    ('huggingface-lerobot-pusht-image','huggingface','dataset','lerobot/pusht_image','https://huggingface.co/datasets/lerobot/pusht_image','dataset','LeRobot PushT image dataset','An official LeRobot PushT dataset record pinned to an immutable revision. KnownRobot inspected approved metadata only and did not inspect or execute dataset payloads.','MIT',publisher,now()),
    ('github-huggingface-lerobot','github','repository','huggingface/lerobot','https://github.com/huggingface/lerobot','software','LeRobot','The official open-source LeRobot library, pinned to an immutable commit for provenance. Inclusion does not imply upstream endorsement of KnownRobot.','Apache-2.0',publisher,now())
  on conflict(source_provider,source_kind,source_repository) do nothing;

  select id into pi0 from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='lerobot/pi0_base';
  select id into pi05 from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='lerobot/pi05_base';
  select id into libero from public.artifacts where source_provider='huggingface' and source_kind='model' and source_repository='lerobot/smolvla_libero';
  select id into pusht_dataset from public.artifacts where source_provider='huggingface' and source_kind='dataset' and source_repository='lerobot/pusht_image';
  select id into lerobot_repo from public.artifacts where source_provider='github' and source_kind='repository' and source_repository='huggingface/lerobot';

  insert into public.artifact_revisions(artifact_id,source_revision,source_revision_url,metadata,inspected_files,uncertainties,imported_by_publisher_id)
  values
    (pi0,'6e245399ad403ccf02b8112b73cfdc2633068f38','https://huggingface.co/lerobot/pi0_base/tree/6e245399ad403ccf02b8112b73cfdc2633068f38',
      '{"inspection_boundary":"approved metadata files only","upstream_author":"LeRobot","artifact_intents":["base_policy","training_checkpoint"],"compatibility_established":false,"execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed."}'::jsonb,
      '[{"path":"README.md","size":4732,"sha256":"f96a87778493441984eb5cf5f1ec4ca26f8eaf9d5c54817a1bc99882ec5ab036"},{"path":"config.json","size":1895,"sha256":"700c59d206885faff307d63272558fb9ad9a6b9feecdae55626ed9e3f594feb9"}]'::jsonb,
      '["KnownRobot inspected metadata only; no code, weights or policy were executed.","Import does not establish hardware compatibility, reproducibility, safety or measured performance.","The upstream Gemma license designation requires the practitioner to review applicable terms."]'::jsonb,publisher),
    (pi05,'22c30e5b34f9e7ab738b1b34fc2fc5ecfe2d28f0','https://huggingface.co/lerobot/pi05_base/tree/22c30e5b34f9e7ab738b1b34fc2fc5ecfe2d28f0',
      '{"inspection_boundary":"approved metadata files only","upstream_author":"LeRobot","artifact_intents":["base_policy","training_checkpoint"],"compatibility_established":false,"execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed."}'::jsonb,
      '[{"path":"README.md","size":5139,"sha256":"5660a59c4bc742dbab3b0f8a109442436b8378200cdbdf6ed35045efe16cdfdc"},{"path":"config.json","size":1896,"sha256":"367869712a2847c27e95c431ecb03f17bec4eee01a63995e2fb2d91940752b53"}]'::jsonb,
      '["KnownRobot inspected metadata only; no code, weights or policy were executed.","Import does not establish hardware compatibility, reproducibility, safety or measured performance.","The upstream Gemma license designation requires the practitioner to review applicable terms."]'::jsonb,publisher),
    (libero,'a24f1f380461b665158d52acd140152c79e8b36d','https://huggingface.co/lerobot/smolvla_libero/tree/a24f1f380461b665158d52acd140152c79e8b36d',
      '{"inspection_boundary":"approved metadata files only","upstream_author":"LeRobot","artifact_intents":["simulation_policy","benchmark_checkpoint"],"compatibility_established":false,"execution_boundary":"No policy code, checkpoint, simulation, or robot command was executed."}'::jsonb,
      '[{"path":"README.md","size":1686,"sha256":"a20b9db396342b7c37a07125c619266289831ac9fa7b3c759ff7239d2b4362a6"},{"path":"config.json","size":2241,"sha256":"3ed3ed80ee077d94ff22942130642bb60e255443ee65da676bc88ab1684a7efe"}]'::jsonb,
      '["KnownRobot inspected metadata only; no code, weights or policy were executed.","Upstream LIBERO results have not been reproduced by KnownRobot.","Import does not establish hardware compatibility, reproducibility, safety or measured performance."]'::jsonb,publisher),
    (pusht_dataset,'1b84c4882e2ab57ccfa3135e4becec6448a32f22','https://huggingface.co/datasets/lerobot/pusht_image/tree/1b84c4882e2ab57ccfa3135e4becec6448a32f22',
      '{"inspection_boundary":"approved metadata files only","upstream_author":"LeRobot","artifact_intents":["training_dataset","simulation_dataset"],"compatibility_established":false,"execution_boundary":"No dataset payload, policy code, simulation, or robot command was executed."}'::jsonb,
      '[{"path":"README.md","size":3222,"sha256":"c53d42ad7fd363e54d800bf29c0137f4dcbb88ed4bde008b8ba6d0e2dc680d3c"}]'::jsonb,
      '["KnownRobot inspected approved metadata only; dataset payloads were not downloaded or executed.","Import does not establish dataset quality, reproducibility, safety or policy compatibility."]'::jsonb,publisher),
    (lerobot_repo,'af4220275187af4af98410b599f606201b6e7618','https://github.com/huggingface/lerobot/tree/af4220275187af4af98410b599f606201b6e7618',
      '{"inspection_boundary":"approved metadata files only","upstream_author":"Hugging Face LeRobot","artifact_intents":["robotics_software","policy_training_library"],"compatibility_established":false,"execution_boundary":"No repository code, dependency, policy, simulation, or robot command was executed."}'::jsonb,
      '[{"path":"README.md","size":14778,"sha256":"5f4e8c5a628ededdc3204cf126e8398f5761fe166e0b28cc910cd7e6eeea4239"},{"path":"LICENSE","size":29977,"sha256":"9e108af26a7ae92a6d2cb0273856a4a0a84da8819c2cffee8b2657cc4f905718"},{"path":"pyproject.toml","size":26047,"sha256":"b2f0ecae84b594d49f2a373bb0343880cc648b75bb829b3b510cf71098f93f9d"}]'::jsonb,
      '["KnownRobot inspected metadata and text manifests only; repository code and dependencies were not executed.","Import does not establish compatibility with any specific robot, policy, dataset, operating system or runtime."]'::jsonb,publisher)
  on conflict(artifact_id,source_revision) do nothing;

  select id into pi0_revision from public.artifact_revisions where artifact_id=pi0 and source_revision='6e245399ad403ccf02b8112b73cfdc2633068f38';
  select id into pi05_revision from public.artifact_revisions where artifact_id=pi05 and source_revision='22c30e5b34f9e7ab738b1b34fc2fc5ecfe2d28f0';
  select id into libero_revision from public.artifact_revisions where artifact_id=libero and source_revision='a24f1f380461b665158d52acd140152c79e8b36d';
  select id into pusht_revision from public.artifact_revisions where artifact_id=pusht_dataset and source_revision='1b84c4882e2ab57ccfa3135e4becec6448a32f22';
  select id into repo_revision from public.artifact_revisions where artifact_id=lerobot_repo and source_revision='af4220275187af4af98410b599f606201b6e7618';
  update public.artifacts set latest_revision_id=pi0_revision,updated_at=now() where id=pi0 and latest_revision_id is null;
  update public.artifacts set latest_revision_id=pi05_revision,updated_at=now() where id=pi05 and latest_revision_id is null;
  update public.artifacts set latest_revision_id=libero_revision,updated_at=now() where id=libero and latest_revision_id is null;
  update public.artifacts set latest_revision_id=pusht_revision,updated_at=now() where id=pusht_dataset and latest_revision_id is null;
  update public.artifacts set latest_revision_id=repo_revision,updated_at=now() where id=lerobot_repo and latest_revision_id is null;

  insert into public.artifact_contributions(artifact_id,revision_id,contributor_publisher_id,kind,summary,payload,evidence_url)
  select artifact_id,revision_id,publisher,'import','Published a revision-pinned canonical record from approved public metadata. No upstream endorsement or compatibility conclusion is implied.','{"source":"public_upstream_metadata","inspection_boundary":"approved metadata files only"}'::jsonb,evidence_url
  from (values
    (pi0,pi0_revision,'https://huggingface.co/lerobot/pi0_base'::text),
    (pi05,pi05_revision,'https://huggingface.co/lerobot/pi05_base'),
    (libero,libero_revision,'https://huggingface.co/lerobot/smolvla_libero'),
    (pusht_dataset,pusht_revision,'https://huggingface.co/datasets/lerobot/pusht_image'),
    (lerobot_repo,repo_revision,'https://github.com/huggingface/lerobot')
  ) as seeds(artifact_id,revision_id,evidence_url)
  where not exists(select 1 from public.artifact_contributions c where c.artifact_id=seeds.artifact_id and c.revision_id=seeds.revision_id and c.kind='import');

  insert into public.collections(slug,title,description,owner_publisher_id,created_by_publisher_id)
  values
    ('official-lerobot-foundations','Official LeRobot foundations','Revision-pinned official LeRobot policies, datasets, and software. Inclusion records provenance and discovery context only; it does not imply upstream endorsement, KnownRobot execution, or compatibility. ',publisher,publisher),
    ('pusht-policy-and-dataset','PushT policy and dataset','Canonical records that connect a PushT policy with its related dataset context. Review each pinned record and its uncertainty before drawing reproducibility or compatibility conclusions.',publisher,publisher)
  on conflict(slug) do nothing;

  select id into foundations from public.collections where slug='official-lerobot-foundations';
  select id into pusht_collection from public.collections where slug='pusht-policy-and-dataset';
  select id into base_collection from public.collections where slug='base-policies-needing-evidence';

  insert into public.collection_items(collection_id,artifact_id,note,position,added_by_publisher_id) values
    (foundations,pi0,'Official base checkpoint; task adaptation and measured evidence are still required.',0,publisher),
    (foundations,pi05,'Official base checkpoint; task adaptation and measured evidence are still required.',1,publisher),
    (foundations,libero,'Official simulation-policy checkpoint; upstream LIBERO claims are not KnownRobot reproductions.',2,publisher),
    (foundations,pusht_dataset,'Official PushT dataset metadata record; payload quality was not assessed.',3,publisher),
    (foundations,lerobot_repo,'Official library repository pinned for software provenance.',4,publisher),
    (pusht_collection,(select id from public.artifacts where source_repository='aadarshram/act_pusht' and source_kind='model'),'ACT policy metadata; KnownRobot did not execute the policy.',0,publisher),
    (pusht_collection,pusht_dataset,'Related official PushT dataset metadata; payloads were not inspected.',1,publisher),
    (base_collection,pi0,'Base checkpoint requiring task-specific adaptation and measured evidence.',1,publisher),
    (base_collection,pi05,'Base checkpoint requiring task-specific adaptation and measured evidence.',2,publisher)
  on conflict do nothing;

  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select foundations,publisher,'created','{"source":"canonical_supply_expansion","item_count":5}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=foundations and action='created');
  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select pusht_collection,publisher,'created','{"source":"canonical_supply_expansion","item_count":2}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=pusht_collection and action='created');
  insert into public.collection_history(collection_id,actor_publisher_id,action,detail)
  select base_collection,publisher,'updated','{"source":"canonical_supply_expansion","added_items":2}'::jsonb
  where not exists(select 1 from public.collection_history where collection_id=base_collection and action='updated' and detail->>'source'='canonical_supply_expansion');
end $$;

notify pgrst,'reload schema';
commit;
