begin;

-- Content identities are separate from owned artifact snapshots. Backfilling this
-- table never changes a reviewed artifact, its digest, or its attribution.
create function public.graph_canonical_json(value jsonb) returns text
language plpgsql immutable strict set search_path = '' as $$
declare result text;
begin
  case jsonb_typeof(value)
    when 'object' then
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.graph_canonical_json(val), ',' order by key collate "C"), '') || '}'
        into result from jsonb_each(value) as item(key,val);
    when 'array' then
      select '[' || coalesce(string_agg(public.graph_canonical_json(val), ',' order by ordinal), '') || ']'
        into result from jsonb_array_elements(value) with ordinality as item(val,ordinal);
    when 'number' then
      result := value::text;
      if position('.' in result)>0 then result := rtrim(rtrim(result,'0'),'.'); end if;
      if result='-0' then result := '0'; end if;
    else result := value::text;
  end case;
  return result;
end $$;

create function public.graph_source_url(value text) returns text
language plpgsql immutable strict set search_path = '' as $$
declare parts text[]; host text; path text;
begin
  parts := regexp_match(btrim(value), '^https://([^/?#]+)([^?#]*)(.*)$');
  if parts is null or parts[1] like '%@%' then return null; end if;
  host := lower(parts[1]);
  path := rtrim(parts[2], '/');
  -- Only strip known repository aliases. Other hosts keep path/query/fragment:
  -- different checkpoints or subdirectories must not accidentally coalesce.
  if host='github.com' and path ~ '^/[^/]+/[^/]+(\.git)?$' and parts[3]='' then
    path := lower(regexp_replace(path, '\.git$', ''));
  elsif host='huggingface.co' and path ~ '^/[^/]+/[^/]+$' and parts[3]='' then
    null;
  else
    path := path || parts[3];
  end if;
  return 'https://' || host || path;
end $$;

create function public.graph_content_key(kind text, value jsonb) returns text
language sql immutable strict set search_path = '' as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(kind || ':v1:' || public.graph_canonical_json(value),'UTF8')),'hex')
$$;

create table public.evaluation_graph (
  evaluation_id uuid primary key references public.evaluations(id) on delete cascade,
  policy_key text check (policy_key ~ '^[a-f0-9]{64}$'),
  hardware_key text check (hardware_key ~ '^[a-f0-9]{64}$'),
  protocol_key text check (protocol_key ~ '^[a-f0-9]{64}$')
);
create index evaluation_graph_policy on public.evaluation_graph(policy_key, evaluation_id);
create index evaluation_graph_hardware on public.evaluation_graph(hardware_key);
create index evaluation_graph_protocol on public.evaluation_graph(protocol_key);
alter table public.evaluation_graph enable row level security;
revoke all on public.evaluation_graph from public, anon, authenticated, service_role;
grant select on public.evaluation_graph to anon, authenticated, service_role;
create policy "Only published graph memberships are visible" on public.evaluation_graph for select
  using (exists(select 1 from public.public_registry_records r where r.id=evaluation_id));

create function public.refresh_evaluation_graph(target uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.evaluation_graph(evaluation_id,policy_key,hardware_key,protocol_key)
  select e.id,
    case when s.source_revision ~ '^[a-fA-F0-9]{40,64}$' and public.graph_source_url(s.source_url) is not null
      and (not (s.manifest ? 'artifact_path') or (jsonb_typeof(s.manifest->'artifact_path')='string'
        and length(s.manifest->>'artifact_path')<=1024
        and ((s.manifest->>'artifact_path')='' or ((s.manifest->>'artifact_path') !~ '[[:space:]\\]'
          and (s.manifest->>'artifact_path') !~ '(^|/)(\.{1,2})($|/)' and (s.manifest->>'artifact_path') !~ '(^/|/$|//)'))))
      then public.graph_content_key('policy',jsonb_build_array(public.graph_source_url(s.source_url), lower(s.source_revision), coalesce(s.manifest->>'artifact_path',''))) end,
    case when h.configuration<>'{}'::jsonb then public.graph_content_key('hardware',jsonb_build_array(lower(btrim(h.robot_family)), h.configuration)) end,
    case when b.protocol<>'{}'::jsonb then public.graph_content_key('protocol',jsonb_build_array(lower(btrim(b.name)), b.version, b.protocol)) end
  from public.evaluations e join public.skills s on s.id=e.skill_id
    join public.hardware_profiles h on h.id=e.hardware_profile_id join public.benchmarks b on b.id=e.benchmark_id
  where e.id=target
  on conflict(evaluation_id) do update set policy_key=excluded.policy_key, hardware_key=excluded.hardware_key, protocol_key=excluded.protocol_key
$$;

create function public.sync_evaluation_graph() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name='evaluations' then
    perform public.refresh_evaluation_graph(new.id);
  else
    for target in select e.id from public.evaluations e where
      (tg_table_name='skills' and e.skill_id=new.id) or
      (tg_table_name='hardware_profiles' and e.hardware_profile_id=new.id) or
      (tg_table_name='benchmarks' and e.benchmark_id=new.id)
    loop perform public.refresh_evaluation_graph(target); end loop;
  end if;
  return new;
end $$;
create trigger evaluation_graph_sync after insert or update of skill_id,hardware_profile_id,benchmark_id on public.evaluations for each row execute function public.sync_evaluation_graph();
create trigger policy_graph_sync after update of source_url,source_revision,manifest on public.skills for each row execute function public.sync_evaluation_graph();
create trigger hardware_graph_sync after update of robot_family,configuration on public.hardware_profiles for each row execute function public.sync_evaluation_graph();
create trigger protocol_graph_sync after update of name,version,protocol on public.benchmarks for each row execute function public.sync_evaluation_graph();
do $$ declare target uuid; begin
  for target in select id from public.evaluations loop perform public.refresh_evaluation_graph(target); end loop;
end $$;
revoke all on function public.refresh_evaluation_graph(uuid),public.sync_evaluation_graph() from public,anon,authenticated,service_role;
revoke all on function public.graph_canonical_json(jsonb),public.graph_source_url(text),public.graph_content_key(text,jsonb) from public;

-- Invoker security and the publication view apply to both the anchor and every
-- returned attempt. Counts, pagination and identities never include drafts.
create function public.public_policy_attempts(p_id uuid, p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_id is null or p_page is null or p_page not between 1 and 100000 then
    raise exception 'Invalid graph request' using errcode='22023';
  end if;
  with anchor as materialized (select g.* from public.evaluation_graph g
    join public.public_registry_records r on r.id=g.evaluation_id where g.evaluation_id=p_id),
  attempts as materialized (select r.id,r.published_at,g.hardware_key,g.protocol_key
    from anchor a join public.evaluation_graph g on a.policy_key=g.policy_key
    join public.public_registry_records r on r.id=g.evaluation_id where r.id<>p_id),
  paged as (select * from attempts order by published_at desc,id limit 30 offset (p_page-1)*30)
  select jsonb_build_object('identity',jsonb_build_object('policy',a.policy_key,'hardware',a.hardware_key,'protocol',a.protocol_key),
    'page',p_page,'total',(select count(*) from attempts),
    'records',coalesce((select jsonb_agg(jsonb_build_object('record',r.record,
      'same_hardware',coalesce(p.hardware_key=a.hardware_key,false),
      'same_protocol',coalesce(p.protocol_key=a.protocol_key,false)) order by p.published_at desc,p.id)
      from paged p join public.public_registry_records r on r.id=p.id),'[]'::jsonb))
  into result from anchor a;
  return result;
end $$;
revoke all on function public.public_policy_attempts(uuid,integer) from public;
grant execute on function public.public_policy_attempts(uuid,integer) to anon,authenticated,service_role;
notify pgrst, 'reload schema';
commit;
