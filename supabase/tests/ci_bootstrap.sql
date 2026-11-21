-- Bootstrap minimal للـCI: الترحيلات المجمعة لا تحتاج خدمات Supabase Auth الحقيقية.
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  )
$$;
