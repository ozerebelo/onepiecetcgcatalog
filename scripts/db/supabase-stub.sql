-- Minimal stand-in for the parts of a Supabase database our migrations rely on.
-- ONLY used by scripts/db/test-local.sh to test migrations on a plain Postgres
-- when Docker (and therefore `supabase start`) is unavailable. Never apply this
-- to a real Supabase project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create schema auth;
grant usage on schema public, extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

-- Same contract as Supabase's auth.uid(): the JWT "sub" claim of the current request.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create extension if not exists pgtap with schema extensions;
