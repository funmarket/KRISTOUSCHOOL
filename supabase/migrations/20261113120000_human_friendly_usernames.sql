-- KRISTOU SCHOOL — AUTH-ID-01: Human-friendly Unicode usernames and optional-username signup support.
-- STATUS: PREPARED — NOT VERIFIED (requires isolated local PostgreSQL / Supabase CLI Docker reset + pgTAP before any remote application).
-- SAFETY BOUNDARIES:
--   1. Preserves the live seven-role public.app_role model (APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL,
--      TEACHER, SCHOOL_STAFF, PARENT, STUDENT). Does NOT reference or restore GENERAL_USER.
--   2. Does NOT replace public.handle_new_user(), preserving current account-approval rules, fallback
--      username generation ('user_' || replace(new.id::text, '-', '')), and the bootstrap Owner rule.
--   3. Preserves the existing public.profiles.username_normalized generated column and
--      public.profiles_username_normalized_key unique index in place without dropping or rebuilding them.
--   4. Uses standard PostgreSQL POSIX regex and built-in string functions with zero \p{...} escapes.

create or replace function public.normalize_username_display(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select regexp_replace(btrim(normalize(input, NFC)), '[[:space:]]+', ' ', 'g');
$$;

create or replace function public.normalize_username_key(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select lower(public.normalize_username_display(input));
$$;

create or replace function public.is_valid_username(input text)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    input = public.normalize_username_display(input)
    and char_length(input) between 3 and 50
    and position('@' in input) = 0
    and input !~ '^[+0-9[:space:]().-]+$'
    and input !~ '^[._ -]'
    and input !~ '[._ -]$'
    and input !~ '[._-]{2,}'
    and input !~ '[[:cntrl:]]'
    and translate(
      input,
      '!"#$%&''()*+,/:;<=>?@[\]^`{|}~'
        || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(127)
        || chr(160) || chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207)
        || chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238)
        || chr(8288) || chr(8294) || chr(8295) || chr(8296) || chr(8297) || chr(65279),
      ''
    ) = input;
$$;

create or replace function public.normalize_profile_username()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.username is not null then
    new.username := public.normalize_username_display(new.username);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
before insert or update of username on public.profiles
for each row execute function public.normalize_profile_username();

-- Update only the check constraint in place; keep username_normalized and profiles_username_normalized_key intact.
alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    public.is_valid_username(username)
    and username_normalized = public.normalize_username_key(username)
  );
