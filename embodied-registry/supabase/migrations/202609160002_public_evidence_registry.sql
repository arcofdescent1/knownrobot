begin;

create function public.registry_review_matches(snapshot jsonb, evaluation jsonb, skill jsonb, hardware jsonb, benchmark jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(
    ((snapshot->'evaluation') - array['verification_status','review_version','visibility','created_at','published_at'])
      = (evaluation - array['verification_status','review_version','visibility','created_at','published_at'])
    and ((snapshot->'skill') - array['created_at','updated_at','published_at'])
      = (skill - array['created_at','updated_at','published_at'])
    and ((snapshot->'hardware') - 'created_at') = (hardware - 'created_at')
    and ((snapshot->'benchmark') - array['created_at','published_at']) = (benchmark - array['created_at','published_at']), false)
$$;
revoke all on function public.registry_review_matches(jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.registry_review_matches(jsonb,jsonb,jsonb,jsonb,jsonb) to anon, authenticated, service_role;

create view public.public_registry_records with (security_invoker = true) as
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
      'license', s.license, 'manifest', s.manifest),
    'hardware', jsonb_build_object('id', h.id, 'robot_family', h.robot_family, 'configuration', h.configuration),
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
left join public.verification_reviews r on r.evaluation_id = e.id and r.review_version = e.review_version
where e.visibility = 'public' and e.published_at is not null
  and s.published_at is not null and b.published_at is not null;

revoke all on public.public_registry_records from public, anon, authenticated, service_role;
grant select on public.public_registry_records to anon, authenticated, service_role;

create function public.public_registry_page(p_query text default '', p_status text default '', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_query is null or length(p_query) > 200 or p_status is null or
    p_status not in ('', 'self_tested', 'runner_verified', 'reproduced', 'lab_verified', 'certified')
    or p_page is null or p_page < 1 or p_page > 100000 then
    raise exception 'Invalid registry filters' using errcode = '22023';
  end if;
  with visible as materialized (select id, published_at, hardware_profile_id, submitted_by,
    search_text, effective_status from public.public_registry_records),
  filtered as (select * from visible where
    (p_query = '' or position(lower(btrim(p_query)) in lower(search_text)) > 0)
    and (p_status = '' or effective_status::text = p_status)),
  paged as (select * from filtered order by published_at desc, id limit 30 offset (p_page-1)*30)
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'stats', jsonb_build_object('evaluations', (select count(*) from visible),
      'hardware', (select count(distinct hardware_profile_id) from visible),
      'contributors', (select count(distinct submitted_by) from visible)),
    'records', coalesce((select jsonb_agg(v.record order by paged.published_at desc, paged.id)
      from paged join public.public_registry_records v on v.id = paged.id), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.public_registry_page(text, text, integer) from public;
grant execute on function public.public_registry_page(text, text, integer) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
