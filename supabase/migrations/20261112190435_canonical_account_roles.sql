-- KRISTOU SCHOOL — recovered exact installed SQL, 2026-11-14.
-- Provenance: ofppapwofhovhroyjtkc, supabase_migrations.schema_migrations.
-- Historical source reconciliation only; do not rerun against the hosted project.
-- Canonicalize account roles without changing identities or Telegram links.
-- Pending accounts have a profile/requested signup category but no active authority.

delete from public.role_assignments
 where role::text in ('GENERAL_USER', 'PRINCIPAL', 'EMPLOYEE');

alter table public.profiles
  alter column requested_role drop default,
  alter column requested_role drop not null;
update public.profiles
   set requested_role = null
 where requested_role::text in ('GENERAL_USER', 'PRINCIPAL', 'EMPLOYEE');

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create type public.account_role_canonical as enum (
  'APP_ADMIN', 'MANAGER', 'PARENT', 'STUDENT', 'TEACHER',
  'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL'
);

alter table public.profiles
  alter column requested_role type public.account_role_canonical
  using (
    case
      when requested_role is null then null
      else requested_role::text::public.account_role_canonical
    end
  );
alter table public.role_assignments
  alter column role type public.account_role_canonical
  using (role::text::public.account_role_canonical);

drop type public.app_role;
alter type public.account_role_canonical rename to app_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.app_role;
  supplied_username text;
begin
  supplied_username := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  if supplied_username is null then
    supplied_username := 'user_' || replace(new.id::text, '-', '');
  end if;
  begin
    requested := nullif(new.raw_user_meta_data ->> 'requested_role', '')::public.app_role;
  exception when invalid_text_representation then
    requested := null;
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
  if lower(coalesce(new.email, '')) = 'funmarketmn@gmail.com' then
    insert into public.role_assignments (user_id, role)
    values (new.id, 'APP_ADMIN')
    on conflict (user_id, role) do update set active = true;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
comment on column public.profiles.requested_role is 'Signup declaration only; it never grants authority. Pending accounts have no role assignment.';
comment on table public.role_assignments is 'Server-authoritative canonical account roles; pending accounts have no assignment.';
