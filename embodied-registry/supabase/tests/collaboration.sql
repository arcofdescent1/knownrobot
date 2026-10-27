begin;
set local role service_role;
insert into public.artifacts(id,slug,source_provider,source_kind,source_repository,source_url,artifact_type,title,imported_by)
values('72000000-0000-0000-0000-000000000001','collaboration-policy','github','repository','owner/collaboration','https://github.com/owner/collaboration','policy','Collaboration policy','00000000-0000-0000-0000-000000000001');
insert into public.collections(id,slug,title,description,owner_profile_id,created_by)
values('73000000-0000-0000-0000-000000000001','so101-act-policies','SO-101 ACT policies','Pinned policies and public evaluation evidence for SO-101.','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
insert into public.collection_items(collection_id,artifact_id,note,position,added_by)
values('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','Pinned example',0,'00000000-0000-0000-0000-000000000001');
insert into public.collection_history(collection_id,actor_id,action,detail)
values('73000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','created','{}');
insert into public.artifact_evaluation_attempts(id,artifact_id,evaluation_id,relationship,outcome,attached_by)
values('74000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','reproduction','partial','00000000-0000-0000-0000-000000000001');
insert into public.evidence_positions(attempt_id,evaluation_id,reviewer_id,position,rationale,evidence_url)
values('74000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','disputes','Published evidence does not establish the stated controller timing.','https://example.com/review');
select verification_test.denied('update public.evidence_positions set position=''supports''','42501','Evidence disagreements are append-only');
reset role;
set local role anon;
select verification_test.assert_true(exists(select 1 from public.collections where slug='so101-act-policies'),'Collections are publicly discoverable');
select verification_test.assert_true(exists(select 1 from public.artifact_evaluation_attempts where outcome='partial'),'Published attempts are readable');
select verification_test.assert_true(exists(select 1 from public.evidence_positions where position='disputes'),'Disagreements remain public');
select verification_test.denied('insert into public.follows(follower_id,artifact_id) values(''00000000-0000-0000-0000-000000000002'',''72000000-0000-0000-0000-000000000001'')','42501','Anonymous users cannot forge follows');
rollback;
