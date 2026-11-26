-- Expand public.user_preferences.language CHECK constraint to support all 6 UI languages.
-- public.upsert_my_preferences(...) delegates language validation to this constraint and requires no rewrite.

do $$
declare
  v_conname text;
begin
  for v_conname in
    select c.conname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    join pg_catalog.pg_attribute a
      on a.attrelid = t.oid
     and a.attnum = any (c.conkey)
    where n.nspname = 'public'
      and t.relname = 'user_preferences'
      and c.contype = 'c'
      and a.attname = 'language'
  loop
    execute format(
      'alter table public.user_preferences drop constraint if exists %I',
      v_conname
    );
  end loop;

  alter table public.user_preferences
    add constraint user_preferences_language_check
    check (language in ('ar', 'fr', 'en', 'es', 'de', 'pt'));
end
$$;
