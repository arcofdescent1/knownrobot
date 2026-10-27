begin;
set local role service_role;
insert into public.artifacts(id,slug,source_provider,source_kind,source_repository,source_url,artifact_type,title,imported_by)
values('70000000-0000-0000-0000-000000000001','github-owner-policy','github','repository','owner/policy','https://github.com/owner/policy','policy','Test policy','00000000-0000-0000-0000-000000000001');
insert into public.artifact_revisions(id,artifact_id,source_revision,source_revision_url,metadata,inspected_files,uncertainties,imported_by)
values('71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',repeat('a',40),'https://github.com/owner/policy/tree/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}','[]','["metadata only"]','00000000-0000-0000-0000-000000000001');
update public.artifacts set latest_revision_id='71000000-0000-0000-0000-000000000001' where id='70000000-0000-0000-0000-000000000001';
insert into public.artifact_contributions(artifact_id,revision_id,contributor_profile_id,kind,summary)
values('70000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','import','Imported pinned metadata.');
select verification_test.denied('update public.artifact_revisions set source_revision=repeat(''b'',40)','42501','Pinned revisions are append-only');
reset role;
set local role anon;
select verification_test.assert_true((select count(*)=1 from public.artifacts where slug='github-owner-policy'),'Anonymous discovery sees published canonical artifacts');
select verification_test.assert_true((select count(*)=1 from public.artifact_revisions where artifact_id='70000000-0000-0000-0000-000000000001'),'Anonymous discovery sees pinned revision boundaries');
select verification_test.denied('insert into public.artifact_contributions(artifact_id,contributor_profile_id,kind,summary) values(''70000000-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-000000000001'',''review'',''Forged review'')','42501','Public readers cannot forge contribution history');
rollback;
