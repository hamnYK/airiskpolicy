-- Run in Supabase SQL Editor as project owner AFTER the migration.
-- Create the account in Authentication > Users first, or use an existing account.
-- This file does not create a user, send email, or store a password.
-- A Supabase dashboard account is not automatically a project Auth user.
-- Only an existing, email-confirmed project Auth account can be granted access.
do $$
declare
  admin_email text := 'REPLACE_WITH_EXISTING_ADMIN_EMAIL';
  admin_id uuid;
begin
  if admin_email = 'REPLACE_WITH_EXISTING_ADMIN_EMAIL' then
    raise exception 'Replace admin_email with the existing Supabase Auth administrator email';
  end if;
  select id into strict admin_id from auth.users
    where lower(email) = lower(admin_email) and email_confirmed_at is not null;
  insert into airisk_private.ontology_admins(user_id) values (admin_id) on conflict do nothing;
exception
  when no_data_found then
    raise exception 'No email-confirmed project Auth user found. Check Authentication > Users; a dashboard account alone is not enough.';
  when too_many_rows then
    raise exception 'Multiple matching Auth users found; verify the intended user UUID before granting access.';
end;
$$;

-- Revoke one administrator if needed, using their actual UUID:
-- delete from airisk_private.ontology_admins where user_id = 'REPLACE_WITH_USER_UUID';
