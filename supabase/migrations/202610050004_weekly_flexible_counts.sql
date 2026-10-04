begin;
create or replace function airisk_private.validate_weekly(doc jsonb, publishing boolean) returns void language plpgsql set search_path='' as $$
declare item jsonb; field text; ids text[]:='{}';
begin
 if doc is null or jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'items') is distinct from 'array' or jsonb_typeof(doc->'question') is distinct from 'string' or length(doc->>'question')>1000 or octet_length(doc::text)>150000 then raise exception 'Invalid briefing document'; end if;
 if jsonb_array_length(doc->'items')>30 or (publishing and (length(trim(doc->>'question'))=0 or jsonb_array_length(doc->'items')=0 or (select count(*) from jsonb_array_elements(doc->'items') x where x->>'kind'='risk')>10 or (select count(*) from jsonb_array_elements(doc->'items') x where x->>'kind'='policy')>10)) then raise exception 'A question and at least one reviewed issue are required; maximum 10 per tab'; end if;
 for item in select value from jsonb_array_elements(doc->'items') loop
  if coalesce(item->>'id','')!~'^[a-zA-Z0-9_-]{1,100}$' or (item->>'id')=any(ids) then raise exception 'Invalid or duplicate issue ID'; end if;
  ids:=array_append(ids,item->>'id');
  if coalesce(item->>'kind','') not in ('risk','policy') then raise exception 'Choose RISK or POLICY'; end if;
  foreach field in array array['title','change','risk','policy','signal','reason','source'] loop
   if jsonb_typeof(item->field) is distinct from 'string' or length(item->>field)>(case when field='title' then 500 else 4000 end) or (publishing and length(trim(item->>field))=0) then raise exception 'Missing or invalid field: %',field; end if;
  end loop;
  if item->>'source'<>'' and (item->>'source')!~'^https://[^[:space:]/]+' then raise exception 'HTTPS source required'; end if;
  if publishing and item->'reviewed' is distinct from 'true'::jsonb then raise exception 'Editorial review required'; end if;
 end loop;
end $$;

commit;
