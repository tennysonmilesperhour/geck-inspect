-- Per-database Supabase platform stubs, run before the migration chain.
-- Shapes copied from production (auth.users columns, auth.* function bodies,
-- storage.objects/buckets columns, storage.foldername body, schema ACLs and
-- default privileges) read on 2026-10-15. Platform internals that only the
-- hosted services use (GoTrue sessions, Storage API, Realtime) are not here.

set check_function_bodies = off;

-- ---------------------------------------------------------------- schemas
create schema if not exists extensions;
create schema if not exists auth authorization supabase_admin;
create schema if not exists storage authorization supabase_admin;
create schema if not exists cron authorization supabase_admin;
create schema if not exists net authorization supabase_admin;
create schema if not exists vault authorization supabase_admin;
create schema if not exists graphql_public authorization supabase_admin;
create schema if not exists realtime authorization supabase_admin;
create schema if not exists supabase_functions authorization supabase_admin;

grant usage, create on schema extensions to postgres, dashboard_user;
grant usage on schema extensions to anon, authenticated, service_role;

grant usage on schema auth to anon, authenticated, service_role, postgres;
grant usage, create on schema auth to supabase_auth_admin, dashboard_user;

grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema storage to postgres with grant option;
grant usage, create on schema storage to supabase_storage_admin with grant option;
grant usage, create on schema storage to dashboard_user;

grant usage on schema vault to postgres with grant option;
grant usage on schema vault to service_role;

grant usage on schema net to public;
grant usage on schema net to supabase_functions_admin, postgres, anon, authenticated, service_role;

grant usage on schema cron to postgres with grant option;

-- public schema ACL in production: pg_database_owner=UC, PUBLIC=U, postgres/anon/authenticated/service_role=U
grant usage on schema public to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------- extensions
-- The dump creates these itself (WITH SCHEMA extensions). pg_cron, pg_net and
-- supabase_vault are not installed locally, so the stubs below stand in.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;   -- local 0.6.0, prod 0.8.0
create extension if not exists pg_stat_statements with schema extensions;

-- ---------------------------------------------------------------- auth
create table if not exists auth.users (
  instance_id uuid,
  id uuid not null primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text unique default null,
  phone_confirmed_at timestamptz,
  phone_change text default '',
  phone_change_token varchar(255) default '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current varchar(255) default '',
  email_change_confirm_status smallint default 0 check (email_change_confirm_status >= 0 and email_change_confirm_status <= 2),
  banned_until timestamptz,
  reauthentication_token varchar(255) default '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
);
create unique index if not exists users_email_partial_key on auth.users (email) where is_sso_user = false;
alter table auth.users owner to supabase_auth_admin;
alter table auth.users enable row level security;  -- prod: RLS on, no policies, no API grants
grant all on auth.users to postgres, dashboard_user;

-- The columns of auth.sessions the Weekly Gecko Notes activity rule reads
-- (types as in production: refreshed_at has no time zone). A saved session
-- that refreshes updates these, while last_sign_in_at stays put.
create table if not exists auth.sessions (
  id uuid not null primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet
);
create index if not exists sessions_user_id_idx on auth.sessions (user_id);
alter table auth.sessions owner to supabase_auth_admin;
alter table auth.sessions enable row level security;
grant all on auth.sessions to postgres, dashboard_user;

-- Bodies copied verbatim from production pg_get_functiondef.
create or replace function auth.uid() returns uuid language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;

create or replace function auth.role() returns text language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$;

create or replace function auth.email() returns text language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$function$;

create or replace function auth.jwt() returns jsonb language sql stable as $function$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$;

alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.email() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt()
  to public, anon, authenticated, service_role, postgres, dashboard_user;

alter default privileges for role supabase_auth_admin in schema auth grant all on tables to postgres, dashboard_user;
alter default privileges for role supabase_auth_admin in schema auth grant all on sequences to postgres, dashboard_user;
alter default privileges for role supabase_auth_admin in schema auth grant all on functions to postgres, dashboard_user;

-- ---------------------------------------------------------------- storage
do $$ begin
  create type storage.buckettype as enum ('STANDARD', 'ANALYTICS', 'VECTOR');
exception when duplicate_object then null; end $$;

create table if not exists storage.buckets (
  id text not null primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text,
  type storage.buckettype not null default 'STANDARD',
  versioning_status text default 'DISABLED',
  lifecycle_configuration jsonb,
  lifecycle_configuration_generation uuid
);
create unique index if not exists bname on storage.buckets (name);

create table if not exists storage.objects (
  id uuid not null default gen_random_uuid() primary key,
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb,
  archived_at timestamptz,
  is_delete_marker boolean default false,
  is_versioned boolean default false
);
create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);

alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role, postgres;

create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $function$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$function$;

create or replace function storage.filename(name text) returns text language plpgsql immutable as $function$
DECLARE _parts text[];
BEGIN
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts,1)];
END
$function$;

create or replace function storage.extension(name text) returns text language plpgsql immutable as $function$
DECLARE _parts text[]; _filename text;
BEGIN
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts,1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
END
$function$;

create or replace function storage.update_updated_at_column() returns trigger language plpgsql as $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
drop trigger if exists update_objects_updated_at on storage.objects;
create trigger update_objects_updated_at before update on storage.objects
  for each row execute function storage.update_updated_at_column();

alter function storage.foldername(text) owner to supabase_storage_admin;
alter function storage.filename(text) owner to supabase_storage_admin;
alter function storage.extension(text) owner to supabase_storage_admin;

alter default privileges for role postgres in schema storage grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage grant all on sequences to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------- pg_cron stub
create table if not exists cron.job (
  jobid bigserial primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport integer not null default 5432,
  database text not null default current_database(),
  username text not null default current_user,
  active boolean not null default true,
  jobname text
);
create unique index if not exists jobname_username_uniq on cron.job (jobname, username);

create table if not exists cron.job_run_details (
  jobid bigint,
  runid bigserial primary key,
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);

create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language plpgsql security definer set search_path = cron, pg_catalog as $function$
declare v bigint;
begin
  insert into cron.job (schedule, command, jobname)
  values (schedule, command, job_name)
  on conflict (jobname, username) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v;
  return v;
end $function$;

create or replace function cron.schedule(schedule text, command text)
returns bigint language plpgsql security definer set search_path = cron, pg_catalog as $function$
declare v bigint;
begin
  insert into cron.job (schedule, command) values (schedule, command) returning jobid into v;
  return v;
end $function$;

create or replace function cron.schedule_in_database(job_name text, schedule text, command text, database text, username text default null, active boolean default true)
returns bigint language plpgsql security definer set search_path = cron, pg_catalog as $function$
declare v bigint;
begin
  insert into cron.job (schedule, command, jobname, database, active)
  values (schedule, command, job_name, database, active) returning jobid into v;
  return v;
end $function$;

create or replace function cron.unschedule(job_name text)
returns boolean language plpgsql security definer set search_path = cron, pg_catalog as $function$
begin
  delete from cron.job where jobname = job_name;
  if not found then raise exception 'could not find valid entry for job ''%''', job_name; end if;
  return true;
end $function$;

create or replace function cron.unschedule(job_id bigint)
returns boolean language plpgsql security definer set search_path = cron, pg_catalog as $function$
begin
  delete from cron.job where jobid = job_id;
  if not found then raise exception 'could not find valid entry for job %', job_id; end if;
  return true;
end $function$;

create or replace function cron.alter_job(job_id bigint, schedule text default null, command text default null,
  database text default null, username text default null, active boolean default null)
returns void language plpgsql security definer set search_path = cron, pg_catalog as $function$
begin
  update cron.job j set
    schedule = coalesce(alter_job.schedule, j.schedule),
    command  = coalesce(alter_job.command, j.command),
    database = coalesce(alter_job.database, j.database),
    username = coalesce(alter_job.username, j.username),
    active   = coalesce(alter_job.active, j.active)
  where j.jobid = job_id;
end $function$;

alter table cron.job owner to supabase_admin;
alter table cron.job_run_details owner to supabase_admin;
grant all on cron.job, cron.job_run_details to postgres with grant option;
grant all on all sequences in schema cron to postgres with grant option;
grant execute on all functions in schema cron to postgres with grant option;

-- ---------------------------------------------------------------- pg_net stub
-- Requests are recorded, never sent.
create table if not exists net.http_request_queue (
  id bigserial primary key,
  method text not null,
  url text not null,
  headers jsonb,
  body bytea,
  timeout_milliseconds integer not null,
  created timestamptz not null default now()
);
create unlogged table if not exists net._http_response (
  id bigint,
  status_code integer,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz not null default now()
);

create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql security definer set search_path = net, pg_catalog as $function$
declare v bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds) returning id into v;
  return v;
end $function$;

create or replace function net.http_get(url text, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql security definer set search_path = net, pg_catalog as $function$
declare v bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('GET', url, headers, null, timeout_milliseconds) returning id into v;
  return v;
end $function$;

create or replace function net.http_delete(url text, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql security definer set search_path = net, pg_catalog as $function$
declare v bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('DELETE', url, headers, null, timeout_milliseconds) returning id into v;
  return v;
end $function$;

alter table net.http_request_queue owner to supabase_admin;
alter table net._http_response owner to supabase_admin;
alter function net.http_post(text, jsonb, jsonb, jsonb, integer) owner to supabase_admin;
alter function net.http_get(text, jsonb, jsonb, integer) owner to supabase_admin;
alter function net.http_delete(text, jsonb, jsonb, integer) owner to supabase_admin;
-- pg_net in Supabase: execute revoked from public, granted to the API roles and postgres.
revoke execute on all functions in schema net from public;
grant execute on all functions in schema net to supabase_functions_admin, postgres, anon, authenticated, service_role;
grant select on net._http_response, net.http_request_queue to postgres, service_role;

-- ---------------------------------------------------------------- supabase_vault stub
create table if not exists vault.secrets (
  id uuid not null default gen_random_uuid() primary key,
  name text,
  description text not null default '',
  secret text not null,
  key_id uuid,
  nonce bytea default extensions.gen_random_bytes(24),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index if not exists secrets_name_idx on vault.secrets (name) where name is not null;

-- Real vault decrypts with pgsodium; here the secret is stored in clear text.
create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at
  from vault.secrets;

create or replace function vault.create_secret(new_secret text, new_name text default null,
  new_description text default '', new_key_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare rec record;
begin
  insert into vault.secrets (secret, name, description, key_id)
  values (new_secret, new_name, new_description, new_key_id) returning * into rec;
  return rec.id;
end $function$;

create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null, new_key_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  update vault.secrets s set
    secret = coalesce(new_secret, s.secret),
    name = coalesce(new_name, s.name),
    description = coalesce(new_description, s.description),
    key_id = coalesce(new_key_id, s.key_id),
    updated_at = now()
  where s.id = secret_id;
end $function$;

alter table vault.secrets owner to supabase_admin;
alter view vault.decrypted_secrets owner to supabase_admin;
alter function vault.create_secret(text, text, text, uuid) owner to supabase_admin;
alter function vault.update_secret(uuid, text, text, text, uuid) owner to supabase_admin;
revoke all on vault.secrets, vault.decrypted_secrets from public;
grant select, delete on vault.secrets, vault.decrypted_secrets to postgres with grant option;
revoke execute on function vault.create_secret(text, text, text, uuid), vault.update_secret(uuid, text, text, text, uuid) from public;
grant execute on function vault.create_secret(text, text, text, uuid), vault.update_secret(uuid, text, text, text, uuid) to postgres with grant option;

-- ---------------------------------------------------------------- realtime publication
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ---------------------------------------------------------------- public default privileges
-- Production pg_default_acl for supabase_admin in public (postgres's entries come from the dump).
alter default privileges for role supabase_admin in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
