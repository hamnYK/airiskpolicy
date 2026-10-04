begin;
-- Existing editorial work concerned Korea; preserve it without republishing.
alter table airisk_private.weekly_briefings add column country_code text not null default 'KR' check(country_code ~ '^[A-Z]{2}$');
alter table airisk_private.weekly_briefings drop constraint weekly_briefings_pkey;
alter table airisk_private.weekly_briefings add primary key(country_code,week_start);
alter table airisk_private.weekly_history add column country_code text not null default 'KR' check(country_code ~ '^[A-Z]{2}$');
-- Worldwide evidence can support multiple national briefings; collection never edits them.
create table airisk_private.weekly_candidate_batches(week_start date primary key,candidates jsonb not null,collection jsonb not null);
insert into airisk_private.weekly_candidate_batches select week_start,candidates,collection from airisk_private.weekly_briefings;
alter table airisk_private.weekly_candidate_batches enable row level security;
revoke all on airisk_private.weekly_candidate_batches from public,anon,authenticated;
drop function public.airisk_weekly_save(date,uuid,jsonb);
drop function public.airisk_weekly_publish(date,uuid,boolean);
drop function public.airisk_weekly_state(date);
drop function public.airisk_weekly_public();
create function public.airisk_weekly_state(p_week date default null,p_country text default 'KR') returns jsonb language plpgsql security definer set search_path='' as $$
declare chosen date; result jsonb; batch airisk_private.weekly_candidate_batches;
begin
 perform airisk_private.require_admin();
 if p_country is null or p_country !~ '^[A-Z]{2}$' then raise exception 'Choose a country'; end if;
 chosen:=coalesce(p_week,(select max(week_start) from airisk_private.weekly_briefings where country_code=p_country),(select max(week_start) from airisk_private.weekly_candidate_batches),(date_trunc('week',now() at time zone 'Asia/Seoul')::date-7));
 if extract(isodow from chosen)<>1 or chosen>date_trunc('week',now() at time zone 'Asia/Seoul')::date then raise exception 'Choose a Monday'; end if;
 insert into airisk_private.weekly_briefings(week_start,country_code) values(chosen,p_country) on conflict do nothing;
 select to_jsonb(w) into result from airisk_private.weekly_briefings w where week_start=chosen and country_code=p_country;
 select * into batch from airisk_private.weekly_candidate_batches where week_start=chosen;
 return result||jsonb_build_object('candidates',coalesce(batch.candidates,'[]'::jsonb),'collection',coalesce(batch.collection,'{}'::jsonb),'weeks',(select coalesce(jsonb_agg(week_start order by week_start desc),'[]') from airisk_private.weekly_briefings where country_code=p_country));
end $$;
create function public.airisk_weekly_save(p_week date,expected_revision uuid,document jsonb,p_country text default 'KR') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform airisk_private.require_admin();perform airisk_private.validate_weekly(document,false);
 update airisk_private.weekly_briefings set draft=document,revision=gen_random_uuid(),updated_by=auth.uid() where week_start=p_week and country_code=p_country and revision=expected_revision;
 if not found then raise exception 'Another editor changed this issue' using errcode='40001'; end if;
 return public.airisk_weekly_state(p_week,p_country);
end $$;
create function public.airisk_weekly_publish(p_week date,expected_revision uuid,withdraw boolean default false,p_country text default 'KR') returns jsonb language plpgsql security definer set search_path='' as $$
declare row airisk_private.weekly_briefings;
begin
 perform airisk_private.require_admin();select * into row from airisk_private.weekly_briefings where week_start=p_week and country_code=p_country for update;
 if not found or row.revision is distinct from expected_revision then raise exception 'Another editor changed this issue' using errcode='40001'; end if;
 if not withdraw then
  if p_week+6>=(now() at time zone 'Asia/Seoul')::date then raise exception 'The review week has not ended'; end if;
  perform airisk_private.validate_weekly(row.draft,true);
 end if;
 insert into airisk_private.weekly_history(week_start,country_code,document,actor) values(p_week,p_country,row.published,auth.uid());
 update airisk_private.weekly_briefings set published=case when withdraw then null else row.draft end,published_at=case when withdraw then null else now() end,revision=gen_random_uuid(),updated_by=auth.uid() where week_start=p_week and country_code=p_country;
 return public.airisk_weekly_state(p_week,p_country);
end $$;
-- No country means no edition, including for older cached clients.
create function public.airisk_weekly_public(p_country text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('country_code',country_code,'week_start',week_start,'week_end',week_start+6,'published_at',published_at,'document',published) from airisk_private.weekly_briefings where country_code=p_country and p_country ~ '^[A-Z]{2}$' and published is not null order by week_start desc limit 1
$$;
create or replace function public.airisk_weekly_ingest(p_week date,p_candidates jsonb,p_collection jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server collection only' using errcode='42501'; end if;
 if extract(isodow from p_week)<>1 or p_week+6>=(now() at time zone 'Asia/Seoul')::date or jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>200 or octet_length(p_candidates::text)>2000000 or jsonb_typeof(p_collection) is distinct from 'object' then raise exception 'Invalid candidate batch'; end if;
 insert into airisk_private.weekly_candidate_batches(week_start,candidates,collection) values(p_week,p_candidates,p_collection) on conflict(week_start) do update set candidates=excluded.candidates,collection=excluded.collection;
end $$;
revoke all on function public.airisk_weekly_state(date,text),public.airisk_weekly_save(date,uuid,jsonb,text),public.airisk_weekly_publish(date,uuid,boolean,text),public.airisk_weekly_public(text) from public,anon,authenticated;
grant execute on function public.airisk_weekly_state(date,text),public.airisk_weekly_save(date,uuid,jsonb,text),public.airisk_weekly_publish(date,uuid,boolean,text) to authenticated;
grant execute on function public.airisk_weekly_public(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;