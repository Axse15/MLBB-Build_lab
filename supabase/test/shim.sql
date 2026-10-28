-- Hanya untuk pengujian di Postgres biasa: meniru bagian Supabase yang dipakai skema.
-- JANGAN dijalankan di proyek Supabase sungguhan.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'x'; end if;
end $$;
grant anon, authenticated to authenticator;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase memberi hak penuh ke anon/authenticated pada objek baru di schema public:
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
