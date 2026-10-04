begin;
create or replace function airisk_private.validate_ontology(doc jsonb) returns void
language plpgsql set search_path = '' as $$
declare item jsonb; concept jsonb; alias_value jsonb; key text; seen text[] := '{}'; aliases jsonb := '{}'; alias_key text; other_id text;
begin
  if doc is null or jsonb_typeof(doc) is distinct from 'object' or doc->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(doc->'concepts') is distinct from 'array'
    or jsonb_typeof(doc->'relations') is distinct from 'array'
    or jsonb_typeof(doc->'bindings') is distinct from 'array' then
    raise exception 'Invalid ontology schema' using errcode = '22023';
  end if;
  if octet_length(doc::text) > 1048576 or jsonb_array_length(doc->'concepts') > 500
    or jsonb_array_length(doc->'relations') > 2000 or jsonb_array_length(doc->'bindings') > 5000 then
    raise exception 'Ontology exceeds size limits' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements((doc->'concepts') || (doc->'relations') || (doc->'bindings')) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string'
      or (item->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$' or (item->>'id') = any(seen) then
      raise exception 'Invalid or duplicate ontology ID' using errcode = '22023';
    end if;
    seen := array_append(seen, item->>'id');
    if item->>'review' is null or item->>'review' not in ('draft','reviewed')
      or jsonb_typeof(item->'note') is distinct from 'string' or char_length(item->>'note') > 2000 then
      raise exception 'Invalid review status or note: %', item->>'id' using errcode = '22023';
    end if;
    if coalesce(item->>'source','') <> '' and (item->>'source') !~* '^https?://[^[:space:]/]+' then
      raise exception 'Invalid evidence URL: %', item->>'id' using errcode = '22023';
    end if;
    if item->>'review' = 'reviewed' and (coalesce(item->>'source','') !~* '^https?://[^[:space:]/]+' or length(trim(item->>'note')) = 0) then
      raise exception 'Reviewed entries need a source and evidence note: %', item->>'id' using errcode = '22023';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(doc->'concepts') loop
    if item->>'kind' is null or item->>'kind' not in ('principle','harm','entity','control')
      or jsonb_typeof(item->'label') is distinct from 'string' or length(trim(item->>'label')) = 0 or char_length(item->>'label') > 300
      or jsonb_typeof(item->'aliases') is distinct from 'array' then
      raise exception 'Invalid concept: %', item->>'id' using errcode = '22023';
    end if;
    if jsonb_array_length(item->'aliases') > 30 then raise exception 'Too many aliases' using errcode = '22023'; end if;
    for alias_value in select value from jsonb_array_elements((item->'aliases') || jsonb_build_array(item->'label')) loop
      if jsonb_typeof(alias_value) is distinct from 'string' or char_length(alias_value #>> '{}') > 300 then
        raise exception 'Invalid alias' using errcode = '22023';
      end if;
      key := regexp_replace(lower(alias_value #>> '{}'), '[^[:alnum:]]', '', 'g');
      if key = '' then raise exception 'Empty normalized alias' using errcode = '22023'; end if;
      alias_key := (item->>'kind') || ':' || key;
      other_id := aliases->>alias_key;
      if other_id is not null and other_id <> item->>'id' then raise exception 'Ambiguous alias: %', alias_value using errcode = '22023'; end if;
      aliases := aliases || jsonb_build_object(alias_key, item->>'id');
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(doc->'relations') loop
    if not (
      (item->>'type' = 'requires'
       and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id'=item->>'from' and c->>'kind'<>'control')
       and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id'=item->>'to' and c->>'kind'='control'))
      or (item->>'type' = 'broader' and item->>'from' <> item->>'to'
       and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id'=item->>'from' and c->>'kind'='principle')
       and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id'=item->>'to' and c->>'kind'='principle'))
    ) or item->>'type' is null then
      raise exception 'Invalid ontology relation: %', item->>'id' using errcode = '22023';
    end if;
    if item->>'review' = 'reviewed' and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id' in (item->>'from', item->>'to') and c->>'review' <> 'reviewed') then
      raise exception 'Reviewed relations need reviewed concepts' using errcode = '22023';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(doc->'bindings') loop
    if jsonb_typeof(item->'policyId') is distinct from 'number' or (item->>'policyId') !~ '^[1-9][0-9]*$'
      or (item->>'policyId')::numeric > 9007199254740991 or coalesce(item->>'country','') !~ '^[A-Z]{3}$'
      or not exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id' = item->>'control' and c->>'kind' = 'control') then
      raise exception 'Invalid policy binding: %', item->>'id' using errcode = '22023';
    end if;
    if item->>'review' = 'reviewed' and exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id' = item->>'control' and c->>'review' <> 'reviewed') then
      raise exception 'Reviewed bindings need reviewed controls' using errcode = '22023';
    end if;
    foreach key in array array['validFrom','validTo'] loop
      if coalesce(item->>key,'') <> '' then
        if (item->>key) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (item->>key)::date::text <> item->>key then
          raise exception 'Invalid binding date' using errcode = '22023';
        end if;
      end if;
    end loop;
    if coalesce(item->>'validFrom','') <> '' and coalesce(item->>'validTo','') <> '' and item->>'validFrom' > item->>'validTo' then
      raise exception 'Invalid binding date range' using errcode = '22023';
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
