begin;

create function public.robot_manifest_schema() returns jsonb language sql immutable set search_path='' as $$
select $manifest_schema${"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://knownrobot.com/schema/robot-skill/1.0.json","title":"Known Robot skill manifest","type":"object","additionalProperties":false,"required":["schema_version","skill","policy","hardware","runtime","dataset","compatibility","evaluations"],"properties":{"artifact_path":{"type":"string","maxLength":1024,"pattern":"^(?!/)(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*//)(?!.*[/]$)[^\\s\\\\]*$"},"schema_version":{"const":"1.0"},"attribution":{"type":"array","maxItems":100,"items":{"type":"object","required":["name","role","source_url"],"properties":{"name":{"type":"string","minLength":1,"pattern":"\\S"},"role":{"enum":["policy-author","dataset-author","adapter-author","evaluation-author"]},"source_url":{"type":"string","format":"uri","pattern":"^https://[^/?#@\\s]+(?:[/?#]|$)"}},"additionalProperties":false}},"skill":{"type":"object","required":["name","version","source"],"properties":{"name":{"type":"string","minLength":1},"version":{"type":["string","null"]},"license":{"type":["string","null"]},"source":{"type":"object","required":["type","repository","revision"],"properties":{"type":{"enum":["github","huggingface","oci","local"]},"repository":{"type":["string","null"]},"revision":{"type":["string","null"]}},"additionalProperties":false}},"additionalProperties":false},"policy":{"type":"object","required":["framework","framework_version","architecture"],"properties":{"framework":{"type":["string","null"]},"framework_version":{"type":["string","null"]},"architecture":{"type":["string","null"]},"checkpoint":{"type":["string","null"]},"container_digest":{"type":["string","null"],"pattern":"^sha256:[a-f0-9]{64}$"}},"additionalProperties":false},"hardware":{"type":"object","required":["robot_family","gripper","sensors"],"properties":{"robot_family":{"type":["string","null"]},"gripper":{"type":["string","null"]},"sensors":{"type":"array","items":{"type":"object","required":["type"],"properties":{"type":{"type":"string"},"name":{"type":"string"},"calibration":{"type":["string","null"]}},"additionalProperties":true}}},"additionalProperties":false},"runtime":{"type":"object","required":["control_frequency_hz","observation_shape","action_shape","dependencies"],"properties":{"control_frequency_hz":{"type":["number","null"],"exclusiveMinimum":0},"observation_shape":{"type":["object","array","null"]},"action_shape":{"type":["object","array","null"]},"dependencies":{"type":"array","items":{"type":"string"},"uniqueItems":true},"accelerator":{"type":["string","null"]},"ros_distribution":{"type":["string","null"]}},"additionalProperties":false},"dataset":{"type":"object","required":["repository","schema"],"properties":{"repository":{"type":["string","null"]},"revision":{"type":["string","null"]},"schema":{"type":["object","array","null"]},"license":{"type":["string","null"]}},"additionalProperties":false},"compatibility":{"type":"array","items":{"type":"object","required":["robot_family","status","evidence"],"properties":{"robot_family":{"type":"string"},"status":{"enum":["compatible","incompatible","untested"]},"evidence":{"type":"string","minLength":1},"adapter":{"type":["string","null"]}},"additionalProperties":false}},"evaluations":{"type":"array","items":{"type":"object","required":["benchmark","trials","successes","evaluator","date"],"properties":{"benchmark":{"type":"string","minLength":1},"trials":{"type":"integer","minimum":1},"successes":{"type":"integer","minimum":0},"evaluator":{"type":"string","minLength":1},"date":{"type":"string","format":"date"},"environment":{"type":["string","null"]},"evidence":{"type":["string","null"]}},"additionalProperties":false}}}}$manifest_schema$::jsonb
$$;
create function public.robot_publication_rules() returns jsonb language sql immutable set search_path='' as $$
select $publication_rules${"version":"1.0","required":["skill.version","skill.license","skill.source.repository","skill.source.revision","policy.framework","policy.framework_version","policy.architecture","hardware.robot_family","hardware.gripper","runtime.control_frequency_hz","runtime.observation_shape","runtime.action_shape","runtime.dependencies","dataset.repository","dataset.revision","dataset.schema"],"patterns":{"skill.source.revision":"^(?:sha256:)?(?:[a-f0-9]{40}|[a-f0-9]{64})$","dataset.revision":"^(?:sha256:)?(?:[a-f0-9]{40}|[a-f0-9]{64})$","policy.framework_version":"^[0-9]+(?:\\.[0-9]+)+(?:[a-zA-Z0-9.+-]*)$"},"mappings":["runtime.observation_shape","runtime.action_shape","dataset.schema"],"dependency_pattern":"^(?:file:[^\\s#]+#sha256:[a-f0-9]{64}|[A-Za-z0-9][A-Za-z0-9._-]*(?:\\[[A-Za-z0-9,._-]+\\])?\\s*==\\s*[0-9]+(?:\\.[0-9]+)*(?:(?:a|b|rc|\\.post|\\.dev)[0-9]+)*(?:\\+[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*)?|[A-Za-z0-9][A-Za-z0-9._-]*(?:\\[[A-Za-z0-9,._-]+\\])?\\s+@\\s+(?:git\\+)?https://[^\\s;]+(?:@|sha256=)(?:[a-f0-9]{40}|[a-f0-9]{64})(?:[&#][^\\s;]*)?)$"}$publication_rules$::jsonb
$$;

-- Implements exactly the keywords used by the pinned portable contract. It is
-- intentionally not exposed as a general-purpose JSON Schema extension.
create function public.robot_schema_errors(value jsonb, spec jsonb, location text default 'manifest') returns jsonb
language plpgsql immutable set search_path='' as $$
declare errors jsonb := '[]'; kind text := jsonb_typeof(value); expected jsonb; key text; child jsonb; ordinal bigint; valid boolean; declared jsonb;
begin
  if value is null then return jsonb_build_array(location || ': missing value'); end if;
  if spec ? 'type' then
    expected := spec->'type';
    if jsonb_typeof(expected)='string' then expected := jsonb_build_array(expected); end if;
    valid := expected ? kind;
    if kind='number' and expected ? 'integer' then valid := (value::text)::numeric=trunc((value::text)::numeric); end if;
    if not valid then return jsonb_build_array(location || ': invalid type'); end if;
  end if;
  if spec ? 'const' and value<>spec->'const' then errors := errors || jsonb_build_array(location || ': invalid constant'); end if;
  if spec ? 'enum' and not exists(select 1 from jsonb_array_elements(spec->'enum') items(enum_value) where enum_value=value) then errors := errors || jsonb_build_array(location || ': invalid enum'); end if;
  if kind='object' then
    for key in select jsonb_array_elements_text(coalesce(spec->'required','[]')) loop
      if not value ? key then errors := errors || jsonb_build_array(location || '.' || key || ': required'); end if;
    end loop;
    for key,child in select * from jsonb_each(value) loop
      declared := spec->'properties'->key;
      if declared is not null then errors := errors || public.robot_schema_errors(child,declared,location || '.' || key);
      elsif spec->'additionalProperties'='false' then errors := errors || jsonb_build_array(location || '.' || key || ': unknown field');
      elsif jsonb_typeof(spec->'additionalProperties')='object' then errors := errors || public.robot_schema_errors(child,spec->'additionalProperties',location || '.' || key);
      end if;
    end loop;
  elsif kind='array' then
    if spec ? 'maxItems' and jsonb_array_length(value)>(spec->>'maxItems')::integer then errors := errors || jsonb_build_array(location || ': too many items'); end if;
    if spec->'uniqueItems'='true' and (select count(*)<>count(distinct v) from jsonb_array_elements(value) v) then errors := errors || jsonb_build_array(location || ': duplicate items'); end if;
    if spec ? 'items' then
      for child,ordinal in select * from jsonb_array_elements(value) with ordinality loop
        errors := errors || public.robot_schema_errors(child,spec->'items',location || '.' || (ordinal-1)::text);
      end loop;
    end if;
  elsif kind='string' then
    key := value#>>'{}';
    if spec ? 'minLength' and length(key)<(spec->>'minLength')::integer then errors := errors || jsonb_build_array(location || ': too short'); end if;
    if spec ? 'maxLength' and length(key)>(spec->>'maxLength')::integer then errors := errors || jsonb_build_array(location || ': too long'); end if;
    if spec ? 'pattern' and key !~ (spec->>'pattern') then errors := errors || jsonb_build_array(location || ': invalid pattern'); end if;
    if spec->>'format'='date' then
      begin
        if key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(key::date,'YYYY-MM-DD')<>key then raise exception 'Invalid date'; end if;
      exception when others then errors := errors || jsonb_build_array(location || ': invalid date'); end;
    elsif spec->>'format'='uri' and (key !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:[^[:space:]]+$'
      or regexp_replace(key,'%[a-fA-F0-9]{2}','','g') like '%\%%' escape '\'
      or key ~ '[<>"{}|\\^`]' or key ~ '[^\x00-\x7F]') then errors := errors || jsonb_build_array(location || ': invalid URI');
    end if;
  elsif kind='number' then
    if spec ? 'minimum' and (value::text)::numeric<(spec->>'minimum')::numeric then errors := errors || jsonb_build_array(location || ': below minimum'); end if;
    if spec ? 'exclusiveMinimum' and (value::text)::numeric<=(spec->>'exclusiveMinimum')::numeric then errors := errors || jsonb_build_array(location || ': below exclusive minimum'); end if;
  end if;
  return errors;
end $$;

create function public.robot_dimensions_valid(shape jsonb, allow_empty boolean default false) returns boolean
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(shape)='array' then (allow_empty or jsonb_array_length(shape)>0) and
   not exists(select 1 from jsonb_array_elements(shape) d where not (case when jsonb_typeof(d)='number' then (d::text)::numeric>0 and (d::text)::numeric=trunc((d::text)::numeric) else false end)) else false end
$$;
revoke all on function public.robot_dimensions_valid(jsonb,boolean) from public;

create function public.robot_manifest_errors(manifest jsonb, complete boolean default false) returns jsonb
language plpgsql immutable security definer set search_path='' as $$
declare errors jsonb; rules jsonb := public.robot_publication_rules(); field text; pattern text; value jsonb; shape jsonb; feature jsonb; item jsonb; dep text; pins jsonb := '{}'; name text; version text; pin text[];
begin
  if octet_length(manifest::text)>1000000 then return jsonb_build_array('manifest: exceeds 1 MB'); end if;
  errors := public.robot_schema_errors(manifest,public.robot_manifest_schema());
  if errors<>'[]'::jsonb then return errors; end if;
  for item in select * from jsonb_array_elements(manifest->'evaluations') loop
    if (item->>'successes')::numeric>(item->>'trials')::numeric then errors := errors || jsonb_build_array('manifest.evaluations: successes exceed trials'); end if;
  end loop;
  for field in select unnest(array['observation_shape','action_shape']) loop
    value := manifest->'runtime'->field;
    if value='null'::jsonb then continue; end if;
    if jsonb_typeof(value)='object' then
      for feature in select v from jsonb_each(value) f(k,v) loop
        shape := case when jsonb_typeof(feature)='object' then feature->'shape' else feature end;
        if not public.robot_dimensions_valid(shape) then errors := errors || jsonb_build_array('manifest.runtime.' || field || ': invalid feature dimensions'); end if;
      end loop;
    elsif jsonb_typeof(value)='array' then
      if not public.robot_dimensions_valid(value) then errors := errors || jsonb_build_array('manifest.runtime.' || field || ': invalid dimensions'); end if;
    end if;
  end loop;
  if jsonb_typeof(manifest->'dataset'->'schema')='object' then
    for feature in select v from jsonb_each(manifest->'dataset'->'schema') f(k,v) loop
      if jsonb_typeof(feature)='object' and feature ? 'shape' and feature->'shape'<>'null'::jsonb then
        shape := feature->'shape';
        if not public.robot_dimensions_valid(shape,true) then errors := errors || jsonb_build_array('manifest.dataset.schema: invalid dimensions'); end if;
      elsif jsonb_typeof(feature) not in ('object','string','array') then errors := errors || jsonb_build_array('manifest.dataset.schema: invalid feature'); end if;
    end loop;
  end if;
  for dep in select jsonb_array_elements_text(manifest->'runtime'->'dependencies') loop
    pin := regexp_match(dep,'^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[A-Za-z0-9,._-]+\])?\s*==\s*([^*;\s]+)(?:\s*;\s*(.*))?$');
    if pin is not null then
      name := regexp_replace(lower(pin[1]),'[-_.]+','-','g') || ';' || replace(regexp_replace(coalesce(pin[3],''),'\s+','','g'),'''','"'); version := pin[2];
      if pins ? name and pins->>name<>version then errors := errors || jsonb_build_array('manifest.runtime.dependencies: conflicting pins'); end if;
      pins := pins || jsonb_build_object(name,version);
    end if;
  end loop;
  if not complete then return errors; end if;
  for field in select jsonb_array_elements_text(rules->'required') loop
    value := manifest#>string_to_array(field,'.');
    if value is null or value in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) or (jsonb_typeof(value)='string' and btrim(value#>>'{}')='') then errors := errors || jsonb_build_array('manifest.' || field || ': incomplete'); end if;
  end loop;
  for field,pattern in select * from jsonb_each_text(rules->'patterns') loop
    value := manifest#>string_to_array(field,'.');
    if jsonb_typeof(value) is distinct from 'string' or coalesce(value#>>'{}','') !~ pattern then errors := errors || jsonb_build_array('manifest.' || field || ': unpinned'); end if;
  end loop;
  for field in select jsonb_array_elements_text(rules->'mappings') loop
    if jsonb_typeof(manifest#>string_to_array(field,'.')) is distinct from 'object' then errors := errors || jsonb_build_array('manifest.' || field || ': use named mapping'); end if;
  end loop;
  for dep in select jsonb_array_elements_text(manifest->'runtime'->'dependencies') loop
    if dep !~ (rules->>'dependency_pattern') then errors := errors || jsonb_build_array('manifest.runtime.dependencies: unpinned'); end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements_text(manifest->'runtime'->'dependencies') d where d not like 'file:%' and d ~ (rules->>'dependency_pattern')) then errors := errors || jsonb_build_array('manifest.runtime.dependencies: unresolved environment'); end if;
  return errors;
end $$;

create function public.robot_manifest_source_url(manifest jsonb) returns text language sql immutable set search_path='' as $$
  select public.graph_source_url(case
    when manifest->'skill'->'source'->>'type'='huggingface' and position('://' in manifest->'skill'->'source'->>'repository')=0
      then 'https://huggingface.co/' || (manifest->'skill'->'source'->>'repository')
    when manifest->'skill'->'source'->>'type'='github' and position('://' in manifest->'skill'->'source'->>'repository')=0
      then 'https://github.com/' || (manifest->'skill'->'source'->>'repository')
    else manifest->'skill'->'source'->>'repository' end)
$$;
revoke all on function public.robot_manifest_source_url(jsonb) from public;

create function public.guard_manifest_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare errors jsonb; policy public.skills;
begin
  if tg_table_name='skills' then
    -- Legacy publication timestamps changing only from null are gated; existing
    -- published historical artifacts and reviewed snapshots are never rewritten.
    if tg_op='INSERT' or new.manifest is distinct from old.manifest or (old.published_at is null and new.published_at is not null)
      or (new.published_at is not null and (new.source_url,new.source_revision,new.framework,new.license) is distinct from (old.source_url,old.source_revision,old.framework,old.license)) then
      errors := public.robot_manifest_errors(new.manifest,new.published_at is not null);
      if errors<>'[]'::jsonb then raise exception 'Invalid robot manifest: %',errors using errcode='22023'; end if;
      if new.published_at is not null and (
        lower(new.manifest->'policy'->>'framework') is distinct from lower(new.framework)
        or replace(new.manifest->'skill'->'source'->>'revision','sha256:','') is distinct from lower(new.source_revision)
        or new.manifest->'skill'->>'license' is distinct from new.license
        or public.robot_manifest_source_url(new.manifest) is null
        or public.robot_manifest_source_url(new.manifest) is distinct from public.graph_source_url(new.source_url)
      ) then raise exception 'Manifest and policy metadata disagree' using errcode='22023'; end if;
    end if;
  elsif new.published_at is not null and (tg_op='INSERT' or old.published_at is null) then
    select * into policy from public.skills where id=new.skill_id;
    errors := public.robot_manifest_errors(policy.manifest,true);
    if errors<>'[]'::jsonb then raise exception 'Incomplete robot evidence: %',errors using errcode='22023'; end if;
    if lower(policy.manifest->'policy'->>'framework')<>lower(policy.framework)
      or lower(policy.manifest->'hardware'->>'robot_family')<>(select lower(robot_family) from public.hardware_profiles where id=new.hardware_profile_id)
      or replace(policy.manifest->'skill'->'source'->>'revision','sha256:','')<>lower(policy.source_revision)
      or policy.manifest->'skill'->>'license' is distinct from policy.license then
      raise exception 'Manifest and evaluation metadata disagree' using errcode='22023';
    end if;
    if public.robot_manifest_source_url(policy.manifest) is distinct from public.graph_source_url(policy.source_url) then
      raise exception 'Manifest and evaluation repositories disagree' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
create trigger manifest_skill_contract before insert or update on public.skills for each row execute function public.guard_manifest_publication();
create trigger manifest_evaluation_contract before insert or update on public.evaluations for each row execute function public.guard_manifest_publication();
revoke all on function public.guard_manifest_publication() from public,anon,authenticated,service_role;
revoke all on function public.robot_manifest_schema(),public.robot_publication_rules(),public.robot_schema_errors(jsonb,jsonb,text) from public;
revoke all on function public.robot_manifest_errors(jsonb,boolean) from public;
grant execute on function public.robot_manifest_errors(jsonb,boolean) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
