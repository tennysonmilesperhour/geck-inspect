-- Cluster-wide roles, mirroring production pg_roles (read 2026-10-15).
-- Run once per cluster. Idempotent.
do $$
declare r record;
begin
  for r in select * from (values
    ('anon',                       'NOLOGIN NOINHERIT'),
    ('authenticated',              'NOLOGIN NOINHERIT'),
    ('service_role',               'NOLOGIN NOINHERIT BYPASSRLS'),
    ('authenticator',              'LOGIN NOINHERIT'),
    ('supabase_admin',             'LOGIN SUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS'),
    ('supabase_auth_admin',        'LOGIN NOINHERIT CREATEROLE'),
    ('supabase_storage_admin',     'LOGIN NOINHERIT CREATEROLE'),
    ('supabase_functions_admin',   'LOGIN NOINHERIT CREATEROLE'),
    ('supabase_realtime_admin',    'NOLOGIN NOINHERIT'),
    ('supabase_replication_admin', 'LOGIN REPLICATION'),
    ('supabase_read_only_user',    'LOGIN BYPASSRLS'),
    ('supabase_etl_admin',         'LOGIN REPLICATION BYPASSRLS'),
    ('supabase_privileged_role',   'NOLOGIN'),
    ('dashboard_user',             'NOLOGIN CREATEROLE CREATEDB REPLICATION'),
    ('pgbouncer',                  'LOGIN'),
    ('cli_login_postgres',         'LOGIN NOINHERIT')
  ) v(name, opts) loop
    if not exists (select 1 from pg_roles where rolname = r.name) then
      execute format('create role %I %s', r.name, r.opts);
    end if;
  end loop;
end $$;

-- Production pg_roles shows anon/authenticated/service_role with rolinherit = true.
alter role anon inherit;
alter role authenticated inherit;
alter role service_role inherit;

-- PostgREST connects as authenticator and switches into these roles.
grant anon, authenticated, service_role to authenticator;
-- In Supabase, postgres can SET ROLE to the API roles.
grant anon, authenticated, service_role to postgres;
grant supabase_read_only_user to postgres;
grant pg_read_all_data to supabase_read_only_user;

-- Supabase API roles have short statement timeouts; keep tests realistic but generous.
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';
