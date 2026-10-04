-- GitHub Pages + Supabase Auth. No signup endpoint, server key, or separate server.
-- Apply as the project database owner. Only airisk-specific objects are created.
begin;
create schema if not exists airisk_private;
revoke all on schema airisk_private from public, anon, authenticated;

create table airisk_private.ontology_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table airisk_private.ontology_state (
  id boolean primary key default true check(id),
  revision uuid not null default gen_random_uuid(),
  draft jsonb not null,
  published jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table airisk_private.ontology_history (
  id bigint generated always as identity primary key,
  ontology jsonb not null,
  replaced_at timestamptz not null default now(),
  replaced_by uuid references auth.users(id) on delete set null
);
alter table airisk_private.ontology_admins enable row level security;
alter table airisk_private.ontology_state enable row level security;
alter table airisk_private.ontology_history enable row level security;
-- No table policy grants browser access; guarded SECURITY DEFINER RPCs are the only path.
revoke all on all tables in schema airisk_private from public, anon, authenticated;
revoke all on all sequences in schema airisk_private from public, anon, authenticated;

insert into airisk_private.ontology_state(id, draft, published) values (
  true,
  '{"schemaVersion":1,"version":"seed-1","concepts":[],"relations":[],"bindings":[]}',
  '{"schemaVersion":1,"version":"seed-1","concepts":[],"relations":[],"bindings":[]}'
);

create function airisk_private.require_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from airisk_private.ontology_admins where user_id = auth.uid()) then
    raise exception 'Ontology administrator access required' using errcode = '42501';
  end if;
end;
$$;

create function airisk_private.validate_ontology(doc jsonb) returns void
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
    if item->>'type' is distinct from 'requires'
      or not exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id' = item->>'from' and c->>'kind' <> 'control')
      or not exists(select 1 from jsonb_array_elements(doc->'concepts') c where c->>'id' = item->>'to' and c->>'kind' = 'control') then
      raise exception 'Invalid requires relation: %', item->>'id' using errcode = '22023';
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

create function public.airisk_ontology_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform airisk_private.require_admin();
  select jsonb_build_object('revision', revision, 'draft', draft, 'published', published,
    'history', coalesce((select jsonb_agg(jsonb_build_object('version', h.ontology->>'version', 'publishedAt', h.ontology->>'publishedAt', 'ontology', h.ontology) order by h.id desc) from airisk_private.ontology_history h), '[]'::jsonb))
    into result from airisk_private.ontology_state where id;
  return result;
end;
$$;

create function public.airisk_ontology_save(expected_revision uuid, document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform airisk_private.require_admin();
  perform airisk_private.validate_ontology(document);
  update airisk_private.ontology_state set draft = document, revision = gen_random_uuid(), updated_by = auth.uid(), updated_at = now()
    where id and revision = expected_revision;
  if not found then raise exception 'Draft changed in another session' using errcode = '40001'; end if;
  return public.airisk_ontology_state();
end;
$$;

create function public.airisk_ontology_publish(expected_revision uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare state airisk_private.ontology_state; document jsonb;
begin
  perform airisk_private.require_admin();
  select * into state from airisk_private.ontology_state where id for update;
  if expected_revision is null or state.revision <> expected_revision then raise exception 'Draft changed in another session' using errcode = '40001'; end if;
  perform airisk_private.validate_ontology(state.draft);
  document := jsonb_build_object('schemaVersion', 1, 'version', gen_random_uuid(), 'publishedAt', now(),
    'concepts', coalesce((select jsonb_agg(jsonb_build_object('id', c->'id', 'kind', c->'kind', 'label', c->'label', 'aliases', c->'aliases', 'review', c->'review', 'source', c->'source', 'note', c->'note')) from jsonb_array_elements(state.draft->'concepts') c where c->>'review' = 'reviewed'), '[]'::jsonb),
    'relations', coalesce((select jsonb_agg(jsonb_build_object('id', r->'id', 'type', r->'type', 'from', r->'from', 'to', r->'to', 'review', r->'review', 'source', r->'source', 'note', r->'note')) from jsonb_array_elements(state.draft->'relations') r where r->>'review' = 'reviewed'), '[]'::jsonb),
    'bindings', coalesce((select jsonb_agg(jsonb_build_object('id', b->'id', 'country', b->'country', 'policyId', b->'policyId', 'control', b->'control', 'validFrom', b->'validFrom', 'validTo', b->'validTo', 'review', b->'review', 'source', b->'source', 'note', b->'note')) from jsonb_array_elements(state.draft->'bindings') b where b->>'review' = 'reviewed'), '[]'::jsonb));
  perform airisk_private.validate_ontology(document);
  insert into airisk_private.ontology_history(ontology, replaced_by) values (state.published, auth.uid());
  delete from airisk_private.ontology_history where id not in (select id from airisk_private.ontology_history order by id desc limit 50);
  update airisk_private.ontology_state set published = document, revision = gen_random_uuid(), updated_by = auth.uid(), updated_at = now() where id;
  return public.airisk_ontology_state();
end;
$$;

create function public.airisk_ontology_published() returns jsonb
language sql stable security definer set search_path = '' as $$
  select published from airisk_private.ontology_state where id;
$$;

revoke all on all functions in schema airisk_private from public, anon, authenticated;
revoke all on function public.airisk_ontology_state() from public, anon, authenticated;
revoke all on function public.airisk_ontology_save(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.airisk_ontology_publish(uuid) from public, anon, authenticated;
revoke all on function public.airisk_ontology_published() from public, anon, authenticated;
grant execute on function public.airisk_ontology_state() to authenticated;
grant execute on function public.airisk_ontology_save(uuid, jsonb) to authenticated;
grant execute on function public.airisk_ontology_publish(uuid) to authenticated;
grant execute on function public.airisk_ontology_published() to anon, authenticated;
notify pgrst, 'reload schema';
commit;
