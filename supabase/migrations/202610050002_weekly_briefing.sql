begin;
create table airisk_private.weekly_briefings(
 week_start date primary key check(extract(isodow from week_start)=1),
 revision uuid not null default gen_random_uuid(),
 candidates jsonb not null default '[]', collection jsonb not null default '{}',
 draft jsonb not null default '{"question":"","items":[]}', published jsonb,
 published_at timestamptz, updated_by uuid references auth.users(id) on delete set null
);
create table airisk_private.weekly_history(id bigint generated always as identity primary key,week_start date not null,document jsonb,actor uuid,created_at timestamptz not null default now());
alter table airisk_private.weekly_briefings enable row level security;
alter table airisk_private.weekly_history enable row level security;
revoke all on airisk_private.weekly_briefings,airisk_private.weekly_history from public,anon,authenticated;
revoke all on sequence airisk_private.weekly_history_id_seq from public,anon,authenticated;

create function airisk_private.validate_weekly(doc jsonb, publishing boolean) returns void language plpgsql set search_path='' as $$
declare item jsonb; field text; ids text[]:='{}';
begin
 if doc is null or jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'items') is distinct from 'array' or jsonb_typeof(doc->'question') is distinct from 'string' or length(doc->>'question')>1000 or octet_length(doc::text)>150000 then raise exception 'Invalid briefing document'; end if;
 if jsonb_array_length(doc->'items')>30 or (publishing and (length(trim(doc->>'question'))=0 or (select count(*) from jsonb_array_elements(doc->'items') x where x->>'kind'='risk')<>10 or (select count(*) from jsonb_array_elements(doc->'items') x where x->>'kind'='policy')<>10)) then raise exception 'A question and exactly 10 issues per tab are required'; end if;
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

create function public.airisk_weekly_state(p_week date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen date; result jsonb;
begin
 perform airisk_private.require_admin();
 chosen:=coalesce(p_week,(select max(week_start) from airisk_private.weekly_briefings),(date_trunc('week',now() at time zone 'Asia/Seoul')::date-7));
 if extract(isodow from chosen)<>1 or chosen>date_trunc('week',now() at time zone 'Asia/Seoul')::date then raise exception 'Choose a Monday'; end if;
 insert into airisk_private.weekly_briefings(week_start) values(chosen) on conflict do nothing;
 select to_jsonb(w) into result from airisk_private.weekly_briefings w where week_start=chosen;
 return result||jsonb_build_object('weeks',(select coalesce(jsonb_agg(week_start order by week_start desc),'[]') from airisk_private.weekly_briefings));
end $$;

create function public.airisk_weekly_save(p_week date,expected_revision uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform airisk_private.require_admin();perform airisk_private.validate_weekly(document,false);
 update airisk_private.weekly_briefings set draft=document,revision=gen_random_uuid(),updated_by=auth.uid() where week_start=p_week and revision=expected_revision;
 if not found then raise exception 'Another editor changed this issue' using errcode='40001'; end if;
 return public.airisk_weekly_state(p_week);
end $$;

create function public.airisk_weekly_publish(p_week date,expected_revision uuid,withdraw boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare row airisk_private.weekly_briefings;
begin
 perform airisk_private.require_admin();select * into row from airisk_private.weekly_briefings where week_start=p_week for update;
 if not found or row.revision is distinct from expected_revision then raise exception 'Another editor changed this issue' using errcode='40001'; end if;
 if not withdraw then
  if p_week+6>=(now() at time zone 'Asia/Seoul')::date then raise exception 'The review week has not ended'; end if;
  perform airisk_private.validate_weekly(row.draft,true);
 end if;
 insert into airisk_private.weekly_history(week_start,document,actor) values(p_week,row.published,auth.uid());
 update airisk_private.weekly_briefings set published=case when withdraw then null else row.draft end,published_at=case when withdraw then null else now() end,revision=gen_random_uuid(),updated_by=auth.uid() where week_start=p_week;
 return public.airisk_weekly_state(p_week);
end $$;

create function public.airisk_weekly_public() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('week_start',week_start,'week_end',week_start+6,'published_at',published_at,'document',published) from airisk_private.weekly_briefings where published is not null order by week_start desc limit 1
$$;

create function public.airisk_weekly_ingest(p_week date,p_candidates jsonb,p_collection jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server collection only' using errcode='42501'; end if;
 if extract(isodow from p_week)<>1 or p_week+6>=(now() at time zone 'Asia/Seoul')::date or jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>200 or octet_length(p_candidates::text)>2000000 or jsonb_typeof(p_collection) is distinct from 'object' then raise exception 'Invalid candidate batch'; end if;
 insert into airisk_private.weekly_briefings(week_start,candidates,collection) values(p_week,p_candidates,p_collection) on conflict(week_start) do update set candidates=excluded.candidates,collection=excluded.collection;
end $$;
revoke all on function airisk_private.validate_weekly(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.airisk_weekly_state(date),public.airisk_weekly_save(date,uuid,jsonb),public.airisk_weekly_publish(date,uuid,boolean),public.airisk_weekly_public(),public.airisk_weekly_ingest(date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.airisk_weekly_state(date),public.airisk_weekly_save(date,uuid,jsonb),public.airisk_weekly_publish(date,uuid,boolean) to authenticated;
grant execute on function public.airisk_weekly_public() to anon,authenticated;
grant execute on function public.airisk_weekly_ingest(date,jsonb,jsonb) to service_role;
commit;
