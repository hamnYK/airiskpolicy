begin;
alter table airisk_private.ontology_state add constraint ontology_draft_name_valid check (
  not (draft ? 'name') or (jsonb_typeof(draft->'name') = 'string' and length(trim(draft->>'name')) between 1 and 120)
);
create or replace function public.airisk_ontology_publish(expected_revision uuid) returns jsonb
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
  if state.draft ? 'name' then document := document || jsonb_build_object('name', state.draft->'name'); end if;
  perform airisk_private.validate_ontology(document);
  insert into airisk_private.ontology_history(ontology, replaced_by) values (state.published, auth.uid());
  delete from airisk_private.ontology_history where id not in (select id from airisk_private.ontology_history order by id desc limit 50);
  update airisk_private.ontology_state set published = document, revision = gen_random_uuid(), updated_by = auth.uid(), updated_at = now() where id;
  return public.airisk_ontology_state();
end;
$$;


notify pgrst, 'reload schema';
commit;
