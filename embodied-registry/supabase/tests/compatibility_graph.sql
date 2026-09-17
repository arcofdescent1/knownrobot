begin;
select verification_test.assert_true(public.graph_canonical_json('{"b":1.00,"a":[2.0,"2",null]}'::jsonb) = public.graph_canonical_json('{"a":[2,"2",null],"b":1}'::jsonb),'JSON ordering and equivalent numeric values canonicalize');
select verification_test.assert_true(public.graph_content_key('hardware','{"a":[1,2]}'::jsonb) <> public.graph_content_key('hardware','{"a":[2,1]}'::jsonb),'Array order remains significant');
select verification_test.assert_true(public.graph_content_key('hardware','{"a":"1"}'::jsonb) <> public.graph_content_key('hardware','{"a":1}'::jsonb),'Strings and numbers remain distinct');
select verification_test.assert_true(public.graph_source_url('https://GITHUB.com/SomeOrg/Policy.git/')='https://github.com/someorg/policy','GitHub repository aliases canonicalize');
select verification_test.assert_true(public.graph_source_url('https://huggingface.co/Team/Policy/')='https://huggingface.co/Team/Policy','HF path case is preserved');
select verification_test.assert_true(public.graph_source_url('https://example.com/policy?file=a')<>public.graph_source_url('https://example.com/policy?file=b'),'Arbitrary artifact selectors never collapse');
select verification_test.assert_true(public.graph_source_url('https://user:secret@example.com/policy') is null,'Credential URLs cannot form identities');
update public.profiles set display_name='Graph tester' where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
select jsonb_build_object('name','Graph policy','summary','Disposable graph test, never production evidence','source_url','https://github.com/GraphFixture/Policy','source_revision',repeat('a',40),'framework','LeRobot','license','MIT','robot_family','SO-101','benchmark_name','Graph protocol','benchmark_version','1','manifest','{"framework":"LeRobot"}'::jsonb,'configuration','{"robot":"SO-101","frequency":30}'::jsonb,'protocol','{"timeout":10,"success":"cube placed"}'::jsonb,'runtime','{"outcome":"completed"}'::jsonb,'evidence','[{"label":"Trial evidence","url":"https://example.com/trials"}]'::jsonb,'trial_count',10,'success_count',7)::text as payload \gset
select jsonb_set(:'payload'::jsonb,'{manifest}',(select manifest from verification_test.manifest_fixture))::text as payload \gset
select jsonb_set(:'payload'::jsonb,'{manifest,skill,source,repository}',to_jsonb('https://github.com/GraphFixture/Policy'::text))::text as payload \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000001',:'payload'::jsonb,true,true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000002',:'payload'::jsonb,false,true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000003',:'payload'::jsonb || '{"source_url":"https://GITHUB.com/graphfixture/policy.git/","source_revision":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","success_count":0,"configuration":{"frequency":30.0,"robot":"SO-101"}}'::jsonb,true,true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000004',:'payload'::jsonb || '{"configuration":{"robot":"SO-101","frequency":60},"protocol":{"timeout":20,"success":"cube placed"}}'::jsonb,true,true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000005',jsonb_set(jsonb_set(:'payload'::jsonb,'{source_revision}',to_jsonb(repeat('b',40))),'{manifest,skill,source,revision}',to_jsonb(repeat('b',40))),true,true);
select public.submit_identity_evaluation('56000000-0000-0000-0000-000000000006',jsonb_set(:'payload'::jsonb,'{manifest,artifact_path}','"checkpoints/other"'::jsonb),true,true);
select verification_test.denied('update public.evaluation_graph set policy_key=repeat(''0'',64)','42501','Contributors cannot forge graph membership');
select verification_test.denied('select public.refresh_evaluation_graph(''56000000-0000-0000-0000-000000000001'')','42501','Contributors cannot invoke privileged graph refresh');
select verification_test.denied('select public.publish_identity_draft(''56000000-0000-0000-0000-000000000002'')','P0001','Graph sharing grants no draft publishing authority');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select public.public_policy_attempts('56000000-0000-0000-0000-000000000001')::text as graph \gset
select verification_test.assert_true((:'graph'::jsonb->>'total')::integer=2,'Different owned snapshots connect; drafts, other revisions and artifact paths excluded');
select verification_test.assert_true(exists(select 1 from jsonb_array_elements(:'graph'::jsonb->'records') item where item->'record'->>'id'='56000000-0000-0000-0000-000000000003' and (item->>'same_hardware')::boolean and (item->>'same_protocol')::boolean and (item->'record'->'evaluation'->>'success_rate')::numeric=0),'Failed attempts connect without losing zero-success result');
select verification_test.assert_true(exists(select 1 from jsonb_array_elements(:'graph'::jsonb->'records') item where item->'record'->>'id'='56000000-0000-0000-0000-000000000004' and not (item->>'same_hardware')::boolean and not (item->>'same_protocol')::boolean),'Changed configuration and protocol remain separate');
select verification_test.assert_true(public.public_policy_attempts('56000000-0000-0000-0000-000000000002') is null,'Private anchors disclose no graph, even when their policy is public');
select verification_test.assert_true(not exists(select 1 from public.evaluation_graph where evaluation_id='56000000-0000-0000-0000-000000000002'),'Private graph membership cannot be enumerated');
select verification_test.assert_true((public.public_policy_attempts('56000000-0000-0000-0000-000000000001',2)->'records')='[]'::jsonb,'Beyond-final pages are empty with stable total');
select verification_test.denied('select public.public_policy_attempts(''56000000-0000-0000-0000-000000000001'',0)','22023','Invalid pages rejected');
reset role;
-- Draft metadata updates refresh identity; publication preserves ownership.
update public.skills set source_revision=repeat('c',40) where id='56000000-0000-0000-0000-000000000002';
select verification_test.assert_true((select a.policy_key<>b.policy_key from public.evaluation_graph a,public.evaluation_graph b where a.evaluation_id='56000000-0000-0000-0000-000000000001' and b.evaluation_id='56000000-0000-0000-0000-000000000002'),'Draft revision edits refresh graph membership');
update public.skills set source_revision=repeat('a',40) where id='56000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.publish_identity_draft('56000000-0000-0000-0000-000000000002');
reset role;
set local role anon;
select verification_test.assert_true((public.public_policy_attempts('56000000-0000-0000-0000-000000000001')->>'total')::integer=3,'Publishing a matching private draft joins the public graph');
select verification_test.assert_true(not exists(select 1 from public.public_registry_records where id::text like '56000000-%' and effective_status<>'self_tested'),'Matching graph nodes never upgrade trust');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('graph_test.payload',:'payload',true);
do $$ begin
  for counter in 1..40 loop
    perform public.submit_identity_evaluation(gen_random_uuid(),current_setting('graph_test.payload')::jsonb || jsonb_build_object('runtime',jsonb_build_object('outcome','completed','attempt',counter)),true,true);
  end loop;
end $$;
reset role;
set local role anon;
select verification_test.assert_true((public.public_policy_attempts('56000000-0000-0000-0000-000000000001')->>'total')::integer=43,'Graph totals include all connected attempts, beyond the first page');
select verification_test.assert_true(jsonb_array_length(public.public_policy_attempts('56000000-0000-0000-0000-000000000001',1)->'records')=30 and jsonb_array_length(public.public_policy_attempts('56000000-0000-0000-0000-000000000001',2)->'records')=13,'Pagination returns complete first and final pages');
select verification_test.assert_true(not exists(select 1 from jsonb_array_elements(public.public_policy_attempts('56000000-0000-0000-0000-000000000001',1)->'records') a join jsonb_array_elements(public.public_policy_attempts('56000000-0000-0000-0000-000000000001',2)->'records') b on a->'record'->>'id'=b->'record'->>'id'),'Tied publication timestamps have deterministic, nonoverlapping pages');
rollback;
