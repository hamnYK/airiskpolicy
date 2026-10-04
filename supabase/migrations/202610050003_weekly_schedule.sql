-- Install WEEKLY_COLLECTOR_SECRET in Edge Function secrets and a Vault secret
-- named airisk_weekly_collector_secret separately. Never put its value in Git.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create function airisk_private.collect_weekly_candidates() returns bigint language plpgsql security definer set search_path='' as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='airisk_weekly_collector_secret';
 if token is null then raise exception 'Weekly collection secret is not configured'; end if;
 select net.http_post(url:='https://jiyngdwpdmpjiwdnyanb.supabase.co/functions/v1/weekly-collect',headers:=jsonb_build_object('Content-Type','application/json','x-weekly-secret',token),body:='{}'::jsonb,timeout_milliseconds:=160000) into request_id;
 return request_id;
end $$;
revoke all on function airisk_private.collect_weekly_candidates() from public,anon,authenticated;
select cron.schedule('airisk-weekly-candidates','0 21 * * 0','select airisk_private.collect_weekly_candidates();');
commit;
