begin;
create or replace view public.public_registry_records with (security_invoker = true) as
select e.id, e.skill_id, e.published_at, e.hardware_profile_id, e.submitted_by,
  concat_ws(' ', s.name, p.display_name, p.handle, h.robot_family, s.framework) as search_text,
  case when e.review_version > 0 and r.new_status = e.verification_status
    and public.registry_review_matches(r.reviewed_snapshot, to_jsonb(e), to_jsonb(s), to_jsonb(h), to_jsonb(b))
    then e.verification_status else 'self_tested'::public.verification_status end as effective_status,
  jsonb_build_object(
    'id', e.id, 'published_at', e.published_at,
    'evaluation', jsonb_build_object('success_rate', e.success_rate, 'trial_count', e.trial_count,
      'result_digest', e.result_digest, 'runtime', e.runtime, 'evidence', e.evidence,
      'review_version', e.review_version),
    'submitter', jsonb_build_object('id', p.id, 'handle', p.handle, 'display_name', p.display_name),
    'skill', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'summary', s.summary,
      'source_url', s.source_url, 'source_revision', s.source_revision, 'framework', s.framework,
      'license', s.license, 'manifest', s.manifest, 'owner', case when op.id is not null then jsonb_build_object('id', op.id, 'kind', 'profile', 'name', op.display_name, 'handle', op.handle) when org.id is not null then jsonb_build_object('id', org.id, 'kind', 'organization', 'name', org.name, 'handle', org.slug) else null end),
    'hardware', jsonb_build_object('id', h.id, 'robot_family', h.robot_family, 'configuration', h.configuration, 'creator', jsonb_build_object('id', hp.id, 'handle', hp.handle, 'display_name', hp.display_name)),
    'benchmark', jsonb_build_object('id', b.id, 'name', b.name, 'version', b.version,
      'protocol', b.protocol, 'source_url', b.source_url),
    'verification_status', case when e.review_version > 0 and r.new_status = e.verification_status
      and public.registry_review_matches(r.reviewed_snapshot, to_jsonb(e), to_jsonb(s), to_jsonb(h), to_jsonb(b))
      then e.verification_status else 'self_tested'::public.verification_status end,
    'review_consistent', (e.review_version = 0 and e.verification_status = 'self_tested') or
      coalesce(r.new_status = e.verification_status
        and public.registry_review_matches(r.reviewed_snapshot, to_jsonb(e), to_jsonb(s), to_jsonb(h), to_jsonb(b)), false),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
      'id', history.id, 'reviewer_id', history.reviewer_id, 'reviewer_identity', history.reviewer_identity,
      'previous_status', history.previous_status, 'new_status', history.new_status,
      'review_version', history.review_version, 'rationale', history.rationale,
      'evidence_url', history.evidence_url, 'created_at', history.created_at,
      'reviewed_snapshot', history.reviewed_snapshot
    ) order by history.review_version) from public.verification_reviews history
      where history.evaluation_id = e.id), '[]'::jsonb)
  ) as record
from public.evaluations e
join public.skills s on s.id = e.skill_id
join public.hardware_profiles h on h.id = e.hardware_profile_id
join public.benchmarks b on b.id = e.benchmark_id
join public.profiles p on p.id = e.submitted_by
left join public.profiles op on op.id = s.owner_profile_id
left join public.organizations org on org.id = s.owner_organization_id
left join public.profiles hp on hp.id = h.created_by
left join public.verification_reviews r on r.evaluation_id = e.id and r.review_version = e.review_version
where e.visibility = 'public' and e.published_at is not null
  and s.published_at is not null and b.published_at is not null;
notify pgrst, 'reload schema';
commit;

