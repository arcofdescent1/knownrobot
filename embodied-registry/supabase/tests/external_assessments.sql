-- Full behavior is exercised with an existing fixture profile and one stable JSON record.
begin;
set local role service_role;
do $$
declare actor uuid; item uuid; payload jsonb; update_rejected boolean := false; delete_rejected boolean := false;
begin
  select id into actor from public.profiles order by id limit 1;
  if actor is null then raise exception 'Expected verification fixture profile'; end if;
  payload := jsonb_build_object(
    'record_type','external_policy_assessment','schema_version','1.0','slug','fixture-external-policy',
    'source',jsonb_build_object('provider','huggingface','repository','fixture/policy','revision',repeat('d',40)),
    'assessment',jsonb_build_object('method','metadata_only','executed_policy_code',false,'evaluated_policy',false,
      'established_compatibility',false,'artifact_intents',jsonb_build_array('task_policy','simulation_policy'),
      'artifact_intent_notice','Descriptive classification only; it is not a compatibility, performance, safety or deployment conclusion.'),
    'evidence_classes',jsonb_build_object('knownrobot_measured_results','[]'::jsonb));
  insert into public.external_policy_assessments(slug,source_provider,source_repository,source_revision,assessor_profile_id,record)
    values('fixture-external-policy','huggingface','fixture/policy',repeat('d',40),actor,payload) returning id into item;
  update public.external_policy_assessments set lifecycle='review' where id=item;
  update public.external_policy_assessments set lifecycle='published' where id=item;
  perform verification_test.assert_true((select reviewed_at is not null and published_at is not null from public.external_policy_assessments where id=item),'Assessment lifecycle timestamps are recorded');
  begin update public.external_policy_assessments set record=record||'{"title":"rewritten"}'::jsonb where id=item;
    exception when sqlstate '22023' then update_rejected := true; end;
  perform verification_test.assert_true(update_rejected,'Published assessment mutation is rejected');
  begin delete from public.external_policy_assessments where id=item;
    exception when sqlstate '22023' then delete_rejected := true; end;
  perform verification_test.assert_true(delete_rejected,'Published assessment deletion is rejected');
end $$;
rollback;
