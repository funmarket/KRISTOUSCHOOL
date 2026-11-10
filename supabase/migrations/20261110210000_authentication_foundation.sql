-- KRISTOU SCHOOL authentication foundation.
-- Additive, reviewable migration. It does not create school enrollment or class-domain tables.
-- Web credentials are managed by Supabase Auth; application identity/roles live here.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'GENERAL_USER', 'PARENT', 'STUDENT', 'TEACHER',
    'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL', 'MANAGER',
    'PRINCIPAL', 'EMPLOYEE', 'APP_ADMIN'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text generated always as (lower(btrim(username))) stored,
  full_name text,
  email text,
  phone text,
  requested_role public.app_role not null default 'GENERAL_USER',
  staff_id text,
  admission_id text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username_normalized ~ '^[a-z0-9][a-z0-9._-]{2,49}$')
);

create unique index if not exists profiles_username_normalized_key
  on public.profiles (username_normalized);
create unique index if not exists profiles_phone_key
  on public.profiles (phone) where phone is not null;
create index if not exists profiles_email_key on public.profiles (lower(email)) where email is not null;
create unique index if not exists profiles_staff_id_key on public.profiles (lower(staff_id)) where staff_id is not null;
create unique index if not exists profiles_admission_id_key on public.profiles (lower(admission_id)) where admission_id is not null;

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists role_assignments_user_active_key
  on public.role_assignments (user_id, active);

create table if not exists public.telegram_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_username text,
  first_name text,
  last_name text,
  language_code text,
  last_authenticated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_link_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  verifier_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists account_link_challenges_user_expiry_key
  on public.account_link_challenges (user_id, expires_at, consumed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

 drop trigger if exists profiles_set_updated_at on public.profiles;
 create trigger profiles_set_updated_at before update on public.profiles
   for each row execute function public.set_updated_at();
 drop trigger if exists role_assignments_set_updated_at on public.role_assignments;
 create trigger role_assignments_set_updated_at before update on public.role_assignments
   for each row execute function public.set_updated_at();
 drop trigger if exists telegram_identities_set_updated_at on public.telegram_identities;
 create trigger telegram_identities_set_updated_at before update on public.telegram_identities
   for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.app_role;
  supplied_username text;
  initial_role public.app_role := 'GENERAL_USER';
begin
  supplied_username := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  if supplied_username is null then
    supplied_username := 'user_' || replace(new.id::text, '-', '');
  end if;

  begin
    requested := coalesce((new.raw_user_meta_data ->> 'requested_role')::public.app_role, 'GENERAL_USER');
  exception when invalid_text_representation then
    requested := 'GENERAL_USER';
  end;

  insert into public.profiles (id, username, full_name, email, phone, requested_role, staff_id, admission_id)
  values (
    new.id,
    supplied_username,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''),
    nullif(lower(btrim(new.email)), ''),
    nullif(btrim(new.phone), ''),
    requested,
    nullif(btrim(new.raw_user_meta_data ->> 'staff_id'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'admission_id'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    requested_role = excluded.requested_role,
    staff_id = coalesce(public.profiles.staff_id, excluded.staff_id),
    admission_id = coalesce(public.profiles.admission_id, excluded.admission_id);

  insert into public.role_assignments (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;

  -- The bootstrap address is granted only after Supabase Auth has accepted the identity.
  if lower(coalesce(new.email, '')) = 'funmarketmn@gmail.com' then
    insert into public.role_assignments (user_id, role)
    values (new.id, 'APP_ADMIN')
    on conflict (user_id, role) do update set active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.telegram_identities enable row level security;
alter table public.account_link_challenges enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.role_assignments from anon, authenticated;
revoke all on public.telegram_identities from anon, authenticated;
revoke all on public.account_link_challenges from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select on public.role_assignments to authenticated;
grant select on public.telegram_identities to authenticated;
grant select on public.account_link_challenges to authenticated;

 drop policy if exists profiles_select_self on public.profiles;
 create policy profiles_select_self on public.profiles for select to authenticated
   using (id = auth.uid());
 drop policy if exists profiles_update_self on public.profiles;
 create policy profiles_update_self on public.profiles for update to authenticated
   using (id = auth.uid()) with check (id = auth.uid());
 drop policy if exists roles_select_self on public.role_assignments;
 create policy roles_select_self on public.role_assignments for select to authenticated
   using (user_id = auth.uid());
 drop policy if exists telegram_select_self on public.telegram_identities;
 create policy telegram_select_self on public.telegram_identities for select to authenticated
   using (user_id = auth.uid());
 drop policy if exists challenges_select_self on public.account_link_challenges;
 create policy challenges_select_self on public.account_link_challenges for select to authenticated
   using (user_id = auth.uid() and consumed_at is null and expires_at > now());

comment on table public.profiles is 'Canonical KRISTOU user profile linked one-to-one to auth.users. Enrollment is a separate domain.';
comment on column public.profiles.requested_role is 'Signup declaration only; it never grants authority.';
comment on table public.role_assignments is 'Server-authoritative role/capability foundation; class scope is added by domain migrations.';
