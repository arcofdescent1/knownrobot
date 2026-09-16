\set ON_ERROR_STOP on
begin;
create schema verification_test;
grant usage on schema verification_test to anon, authenticated, service_role;
create function verification_test.assert_true(value boolean, label text) returns void
language plpgsql as $$ begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function verification_test.denied(statement text, expected_state text, label text) returns void
language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state <> expected_state then
      raise exception 'FAIL: % expected %, got % (%)', label, expected_state, actual_state, sqlerrm;
    end if;
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: % unexpectedly succeeded', label;
end $$;
grant execute on all functions in schema verification_test to anon, authenticated, service_role;

insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.profiles(id, handle) select id, 'user-' || right(id::text, 1) from auth.users
 where id::text like '00000000-0000-0000-0000-00000000000%';
insert into public.skills(id, slug, name, summary, owner_profile_id, source_url, source_revision, framework, manifest, published_at)
 values ('10000000-0000-0000-0000-000000000001', 'test-policy', 'Policy', 'Test',
 '00000000-0000-0000-0000-000000000001', 'https://example.com/policy', repeat('a',40), 'lerobot', '{}', now());
insert into public.hardware_profiles(id, slug, robot_family, configuration, created_by)
 values ('20000000-0000-0000-0000-000000000001', 'test-arm', 'SO-101', '{}', '00000000-0000-0000-0000-000000000001');
insert into public.benchmarks(id, slug, name, version, protocol, created_by, published_at)
 values ('30000000-0000-0000-0000-000000000001', 'test-task', 'Task', '1', '{}', '00000000-0000-0000-0000-000000000001', now());
insert into public.evaluations(id, skill_id, hardware_profile_id, benchmark_id, submitted_by, trial_count, runtime, evidence, result_digest, published_at)
 values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001', 10, '{}', '["https://example.com/run"]', repeat('b',64), now());
insert into public.evaluations(id, skill_id, hardware_profile_id, benchmark_id, submitted_by, trial_count, runtime, result_digest)
 select '40000000-0000-0000-0000-000000000002', skill_id, hardware_profile_id, benchmark_id, submitted_by, 1, '{}', 'draft'
 from public.evaluations where id = '40000000-0000-0000-0000-000000000001';

set local role anon;
select verification_test.assert_true((select count(*) = 1 from public.evaluations), 'Anonymous users cannot read public drafts');
select verification_test.assert_true((public.public_registry_page()->>'total')::integer=1, 'Registry counts published evaluations only');
select verification_test.assert_true((public.public_registry_page('SO-101')->>'total')::integer=1, 'Registry searches real hardware');
select verification_test.assert_true((public.public_registry_page('%')->>'total')::integer=0, 'Search wildcards are literal, not SQL operators');
select verification_test.assert_true((public.public_registry_page('','',2)->'records')='[]'::jsonb, 'Pagination does not silently repeat first page');
select verification_test.denied($q$select public.public_registry_page('','forged',1)$q$, '22023', 'Invalid trust filter rejected');
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'reproduced','Independent evidence checked','https://example.com/review')$q$, '42501', 'Anonymous review denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select verification_test.denied($q$update public.evaluations set verification_status='certified'$q$, '42501', 'Contributor cannot self-certify');
select verification_test.denied($q$update public.evaluations set reproduction_count=100$q$, '42501', 'Contributor cannot forge reproduction counts');
select verification_test.denied($q$update public.evaluations set review_version=100$q$, '42501', 'Contributor cannot forge review version');
select verification_test.denied($q$insert into public.evaluations(id,skill_id,hardware_profile_id,benchmark_id,submitted_by,trial_count,runtime,result_digest,verification_status)
 select '40000000-0000-0000-0000-000000000003',skill_id,hardware_profile_id,benchmark_id,submitted_by,1,'{}','forged','certified'
 from public.evaluations where id='40000000-0000-0000-0000-000000000001'$q$, '42501', 'Insert cannot set verified status');
insert into public.evaluations(id,skill_id,hardware_profile_id,benchmark_id,submitted_by,trial_count,runtime,result_digest)
 select '40000000-0000-0000-0000-000000000003',skill_id,hardware_profile_id,benchmark_id,submitted_by,1,'{}','self-reported'
 from public.evaluations where id='40000000-0000-0000-0000-000000000001';
select verification_test.assert_true((select verification_status='self_tested' and review_version=0 from public.evaluations where id='40000000-0000-0000-0000-000000000003'), 'Ordinary contributor insert remains usable');
select verification_test.denied($q$insert into public.verification_reviewers values ('00000000-0000-0000-0000-000000000001', '{certified}', 'self', 'self appointment', now(), null)$q$, '42501', 'Contributor cannot appoint self');
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'reproduced','Independent evidence checked','https://example.com/review')$q$, '42501', 'Unappointed review denied');
update public.evaluations set runtime='{"rate":30}' where id='40000000-0000-0000-0000-000000000002';
select verification_test.assert_true((select runtime->>'rate'='30' from public.evaluations where id='40000000-0000-0000-0000-000000000002'), 'Owner can edit draft');
reset role;

set local role service_role;
select verification_test.denied($q$insert into public.verification_reviewers(profile_id,allowed_statuses,appointed_by,appointment_reason)
 values ('00000000-0000-0000-0000-000000000003',ARRAY['reproduced'::public.verification_status,null],'operator','Qualified independent reviewer')$q$, '23514', 'NULL permission cannot bypass allowed levels');
insert into public.verification_reviewers(profile_id, allowed_statuses, appointed_by, appointment_reason)
 values ('00000000-0000-0000-0000-000000000001', '{reproduced}', 'operator', 'Qualified reviewer appointment'),
 ('00000000-0000-0000-0000-000000000002', '{reproduced}', 'operator', 'Qualified independent reviewer');
select verification_test.denied($q$update public.evaluations set verification_status='certified'$q$, '42501', 'Service key cannot forge status');
select verification_test.denied($q$update public.evaluations set runtime='{}' where id='40000000-0000-0000-0000-000000000001'$q$, '42501', 'Service key cannot edit published result');
reset role;

set local role authenticated;
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'reproduced','Independent evidence checked','https://example.com/review')$q$, '42501', 'Appointed owner cannot self-review');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'certified','Independent evidence checked','https://example.com/review')$q$, '42501', 'Reviewer cannot exceed appointment');
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'reproduced','short','http://example.com/review')$q$, '22023', 'Invalid rationale and evidence rejected');
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000002',0,'reproduced','Independent evidence checked','https://example.com/review')$q$, '22023', 'Draft cannot be verified');
select (public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'reproduced','Independent evidence checked against frozen protocol','https://example.com/review')).id;
select verification_test.assert_true((select verification_status='reproduced' and review_version=1 from public.evaluations where id='40000000-0000-0000-0000-000000000001'), 'Authorized independent review succeeds');
select verification_test.assert_true((select reviewer_id='00000000-0000-0000-0000-000000000002' and reviewed_snapshot->'skill'->>'source_revision'=repeat('a',40) from public.verification_reviews), 'Review binds actor and artifact snapshot');
select verification_test.assert_true((select record->>'verification_status'='reproduced' from public.public_registry_records where id='40000000-0000-0000-0000-000000000001'), 'Registry exposes genuinely reviewed status');
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',0,'self_tested','Evidence withdrawn after independent review','https://example.com/correction')$q$, '40001', 'Stale decision rejected');
select verification_test.denied($q$update public.verification_reviews set rationale='forged'$q$, '42501', 'Review history cannot be edited');
select verification_test.denied($q$delete from public.verification_reviews$q$, '42501', 'Review history cannot be deleted');
select verification_test.denied($q$insert into public.verification_reviews select * from public.verification_reviews$q$, '42501', 'Reviewer cannot forge audit records');
select (public.review_evaluation('40000000-0000-0000-0000-000000000001',1,'self_tested','Evidence withdrawn after independent review','https://example.com/correction')).id;
select verification_test.assert_true((select count(*)=2 from public.verification_reviews), 'Retraction preserves both decisions');
reset role;
set local role anon;
select verification_test.assert_true((select count(*)=2 from public.verification_reviews), 'Public decisions are publicly attributable');
select verification_test.assert_true((select record->>'verification_status'='self_tested' from public.public_registry_records where id='40000000-0000-0000-0000-000000000001'), 'Registry reflects claim retraction');
select verification_test.assert_true((select record#>>'{skill,owner,id}'='00000000-0000-0000-0000-000000000001' and record#>>'{skill,owner,kind}'='profile' and record#>>'{hardware,creator,id}'='00000000-0000-0000-0000-000000000001' from public.public_registry_records where id='40000000-0000-0000-0000-000000000001'), 'Public contribution credits identify actual publisher and hardware creator');
reset role;
update public.evaluations set visibility='private' where id='40000000-0000-0000-0000-000000000001';
set local role anon;
select verification_test.assert_true((select count(*)=0 from public.verification_reviews), 'Private evidence history does not leak publicly');
select verification_test.assert_true((select count(*)=0 from public.public_registry_records), 'Private records disappear from public evidence view');
reset role;
update public.evaluations set visibility='public' where id='40000000-0000-0000-0000-000000000001';
insert into public.organizations(id,slug,name,created_by) values
 ('50000000-0000-0000-0000-000000000001','test-org','Owner org','00000000-0000-0000-0000-000000000001');
insert into public.organization_members(organization_id,profile_id,role) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','member');
insert into public.skills(id,slug,name,summary,owner_organization_id,source_url,source_revision,framework,manifest,published_at)
 values ('10000000-0000-0000-0000-000000000002','org-policy','Org Policy','Test','50000000-0000-0000-0000-000000000001','https://example.com/org',repeat('c',40),'lerobot','{}',now());
insert into public.evaluations(id,skill_id,hardware_profile_id,benchmark_id,submitted_by,trial_count,runtime,evidence,result_digest,published_at)
 select '40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002',hardware_profile_id,benchmark_id,submitted_by,1,'{}',evidence,'org-result',now()
 from public.evaluations where id='40000000-0000-0000-0000-000000000001';
set local role anon;
select verification_test.assert_true((select record#>>'{skill,owner,id}'='50000000-0000-0000-0000-000000000001' and record#>>'{skill,owner,kind}'='organization' from public.public_registry_records where id='40000000-0000-0000-0000-000000000004'), 'Organization publisher credit is public without claiming individual authorship');
reset role;
set local role authenticated;
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000004',0,'reproduced','Independent evidence checked','https://example.com/review')$q$, '42501', 'Artifact organization member cannot review');
reset role;
update public.evaluations set trial_count=11 where id='40000000-0000-0000-0000-000000000001';
select verification_test.assert_true((select record->>'verification_status'='self_tested' and record->>'review_consistent'='false' from public.public_registry_records where id='40000000-0000-0000-0000-000000000001'), 'Edited trial counts cannot inherit a reviewed claim');
update public.evaluations set trial_count=10 where id='40000000-0000-0000-0000-000000000001';
select verification_test.denied($q$update public.verification_reviews set rationale='administrator overwrite'$q$, '42501', 'Append-only trigger also blocks owner overwrite');
select verification_test.denied($q$update public.skills set source_revision='changed'$q$, '42501', 'Reviewed policy cannot drift');
select verification_test.denied($q$update public.hardware_profiles set configuration='{"changed":true}'$q$, '42501', 'Reviewed hardware cannot drift');
select verification_test.denied($q$update public.benchmarks set protocol='{"changed":true}'$q$, '42501', 'Reviewed protocol cannot drift');
update public.verification_reviewers set revoked_at=now() where profile_id='00000000-0000-0000-0000-000000000002';
set local role authenticated;
select verification_test.denied($q$select public.review_evaluation('40000000-0000-0000-0000-000000000001',2,'reproduced','Independent evidence checked','https://example.com/review')$q$, '42501', 'Revoked reviewer cannot act');
reset role;
insert into public.evaluations(id,skill_id,hardware_profile_id,benchmark_id,submitted_by,trial_count,runtime,result_digest,published_at)
 select gen_random_uuid(),skill_id,hardware_profile_id,benchmark_id,submitted_by,1,'{}','pagination-'||n,now()
 from public.evaluations cross join generate_series(1,35) n where id='40000000-0000-0000-0000-000000000001';
set local role anon;
select verification_test.assert_true(jsonb_array_length(public.public_registry_page()->'records')=30, 'First results page contains exactly 30 published records');
select verification_test.assert_true(jsonb_array_length(public.public_registry_page('','',2)->'records')=7, 'Second page contains remaining published records');
select verification_test.assert_true((public.public_registry_page()->'stats'->>'hardware')::int=1, 'Hardware statistics count profiles, not records');
select verification_test.assert_true(not exists (
 select 1 from jsonb_array_elements(public.public_registry_page()->'records') a
 join jsonb_array_elements(public.public_registry_page('','',2)->'records') b on a->>'id'=b->>'id'
), 'Published pages do not duplicate records');
reset role;
\if :{?keep_fixture}
update public.verification_reviewers set revoked_at=null where profile_id='00000000-0000-0000-0000-000000000002';
commit;
\else
rollback;
\endif
