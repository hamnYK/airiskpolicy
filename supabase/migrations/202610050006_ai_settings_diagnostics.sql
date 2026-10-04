-- Report only a fixed operation label; never raw SQL context or secret data.
begin;
create or replace function public.airisk_weekly_ai_server(p_actor uuid,p_action text,p_revision uuid default null,p_provider text default null,p_model text default null,p_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row airisk_private.weekly_ai_settings; secret uuid; value text; diagnostic_stage text := 'authorize';
begin
 if coalesce(auth.role(),'')<>'service_role' or p_actor is null or not exists(select 1 from airisk_private.ontology_admins where user_id=p_actor) then raise exception 'Administrator server only' using errcode='42501'; end if;
 diagnostic_stage:='lock';
 perform pg_advisory_xact_lock(52819401);
 diagnostic_stage:='state';
 select * into current_row from airisk_private.weekly_ai_settings for update;
 diagnostic_stage:='revision';
 if current_row.revision is distinct from p_revision then raise exception 'Settings changed; reload before retrying' using errcode='40001'; end if;
 diagnostic_stage:='dispatch';
 if p_action='save' then
  diagnostic_stage:='save';
  if p_provider is null or p_provider not in ('gemini','openai','anthropic') or p_model is null or p_model !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$' then raise exception 'Invalid settings' using errcode='22023'; end if;
  secret:=current_row.secret_id;
  if coalesce(p_key,'')<>'' then
   if length(p_key)<8 or length(p_key)>4096 or p_key ~ '[[:space:]]' then raise exception 'Invalid key format' using errcode='22023'; end if;
   if secret is null then select vault.create_secret(p_key) into secret; else perform vault.update_secret(secret,p_key); end if;
  elsif secret is null or current_row.provider<>p_provider then raise exception 'New provider requires a key' using errcode='22023'; end if;
  insert into airisk_private.weekly_ai_settings(singleton,provider,model,secret_id,updated_by) values(true,p_provider,p_model,secret,p_actor)
  on conflict(singleton) do update set provider=excluded.provider,model=excluded.model,secret_id=excluded.secret_id,updated_by=p_actor,updated_at=now(),revision=gen_random_uuid();
  return jsonb_build_object('saved',true);
 elsif p_action='delete' then
  diagnostic_stage:='delete';
  delete from airisk_private.weekly_ai_settings;
  delete from vault.secrets where id=current_row.secret_id;
  return jsonb_build_object('deleted',true);
 elsif p_action='credentials' then
  diagnostic_stage:='credentials';
  if current_row.secret_id is null then raise exception 'Save settings first' using errcode='22023'; end if;
  if current_row.last_request_at>clock_timestamp()-interval '5 seconds' then raise exception 'Wait before retrying' using errcode='P0001'; end if;
  update airisk_private.weekly_ai_settings set last_request_at=clock_timestamp();
  diagnostic_stage:='vault_read';
  select decrypted_secret into value from vault.decrypted_secrets where id=current_row.secret_id;
  if value is null then raise exception 'Key unavailable'; end if;
  return jsonb_build_object('provider',current_row.provider,'model',current_row.model,'key',value);
 end if;
 raise exception 'Unknown action' using errcode='22023';
exception when cardinality_violation then
 raise exception 'AI_SETTINGS_CARDINALITY:%',diagnostic_stage using errcode='21000';
end $$;
notify pgrst, 'reload schema';
commit;
