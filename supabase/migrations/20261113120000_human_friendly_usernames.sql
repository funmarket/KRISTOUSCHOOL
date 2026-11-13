-- KRISTOU SCHOOL — AUTH-ID-01: Human-friendly Unicode usernames and optional-username signup support.
-- STATUS: PREPARED — NOT VERIFIED (requires isolated local PostgreSQL / Supabase CLI Docker reset + pgTAP before any remote application).
-- SAFETY BOUNDARIES:
--   1. Preserves the live seven-role public.app_role model (APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL,
--      TEACHER, SCHOOL_STAFF, PARENT, STUDENT). Does NOT reference or restore GENERAL_USER.
--   2. Does NOT replace public.handle_new_user(), preserving current account-approval rules, fallback
--      username generation ('user_' || replace(new.id::text, '-', '')), and the bootstrap Owner rule.
--   3. Preserves the existing public.profiles.username_normalized generated column and
--      public.profiles_username_normalized_key unique index in place without dropping or rebuilding them.
--   4. Uses an explicit, deterministic UTF-8 Unicode code-point whitelist with zero \p{...} escapes
--      and zero locale-dependent POSIX character classes, matching src/lib/username.ts and
--      supabase/functions/auth-username-signin/index.ts.

create or replace function public.normalize_username_display(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(normalize(input, NFC), '^ +| +$', '', 'g'),
    ' {2,}',
    ' ',
    'g'
  );
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

create or replace function public.is_username_letter_or_digit_codepoint(cp integer)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    (cp between 48 and 57)        -- U+0030..U+0039 ASCII digits (0-9)
    or (cp between 65 and 90)     -- U+0041..U+005A ASCII uppercase (A-Z)
    or (cp between 97 and 122)    -- U+0061..U+007A ASCII lowercase (a-z)
    or (cp between 192 and 214)   -- U+00C0..U+00D6 Latin-1 letters (excludes U+00A7 § and U+00D7 ×)
    or (cp between 216 and 246)   -- U+00D8..U+00F6 Latin-1 letters (excludes U+00F7 ÷)
    or (cp between 248 and 255)   -- U+00F8..U+00FF Latin-1 letters
    or (cp between 256 and 591)   -- U+0100..U+024F Latin Extended-A and Extended-B
    or (cp between 7680 and 7935) -- U+1E00..U+1EFF Latin Extended Additional
    or (cp between 1569 and 1594) -- U+0621..U+063A Arabic letters (Hamza..Ghain)
    or (cp between 1601 and 1610) -- U+0641..U+064A Arabic letters (Feh..Yeh)
    or (cp between 1632 and 1641) -- U+0660..U+0669 Arabic-Indic digits
    or (cp between 1646 and 1647) -- U+066E..U+066F Arabic Dotless Beh/Qaf
    or (cp between 1649 and 1747) -- U+0671..U+06D3 Extended Arabic letters
    or cp = 1749                  -- U+06D5 Arabic letter Ae
    or (cp between 1776 and 1785) -- U+06F0..U+06F9 Extended Arabic-Indic digits
    or (cp between 1786 and 1788) -- U+06FA..U+06FC Extended Arabic letters
    or cp = 1791;                 -- U+06FF Arabic letter Heh with inverted V
$$;

create or replace function public.is_username_mark_codepoint(cp integer)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    (cp between 768 and 879)      -- U+0300..U+036F Combining Diacritical Marks
    or (cp between 1611 and 1631) -- U+064B..U+065F Arabic Harakat / Tashkeel
    or cp = 1648;                 -- U+0670 Arabic Superscript Alef
$$;

create or replace function public.is_username_separator_codepoint(cp integer)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select cp in (32, 45, 46, 95);  -- U+0020 space, U+002D '-', U+002E '.', U+005F '_'
$$;

create or replace function public.is_allowed_username_codepoint(cp integer)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    public.is_username_letter_or_digit_codepoint(cp)
    or public.is_username_mark_codepoint(cp)
    or public.is_username_separator_codepoint(cp);
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
    and position('  ' in input) = 0
    and input !~ '^[+0-9 ().-]+$'
    and input !~ '[._-]{2,}'
    and public.is_username_letter_or_digit_codepoint(ascii(substr(input, 1, 1)))
    and (
      public.is_username_letter_or_digit_codepoint(ascii(substr(input, char_length(input), 1)))
      or public.is_username_mark_codepoint(ascii(substr(input, char_length(input), 1)))
    )
    and not exists (
      select 1
      from unnest(string_to_array(input, null)) with ordinality as chars(ch, idx)
      where not public.is_allowed_username_codepoint(ascii(chars.ch))
         or (
           public.is_username_mark_codepoint(ascii(chars.ch))
           and (
             chars.idx = 1
             or public.is_username_separator_codepoint(ascii(substr(input, (chars.idx - 1)::integer, 1)))
           )
         )
    );
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

