-- Isolated pgTAP verification that public.user_preferences and public.upsert_my_preferences
-- accept all 6 languages (ar, fr, en, es, de, pt) and reject unsupported codes.
-- Fixtures are synthetic. Never run this suite against the hosted project.
begin;

select extensions.plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000291', 'authenticated', 'authenticated',
  'prefs-six-lang@example.invalid', '', now(), '{}'::jsonb,
  '{"username":"prefs_six_lang","full_name":"Six Lang Tester","requested_role":"PARENT"}'::jsonb,
  now(), now()
);

update public.profiles set account_status = 'APPROVED'
 where id = '00000000-0000-4000-8000-000000000291';

insert into public.role_assignments (user_id, role, active)
values ('00000000-0000-4000-8000-000000000291', 'PARENT', true);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'user_preferences'
      and c.conname = 'user_preferences_language_check'
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid, true) like '%''es''%''de''%''pt''%'
  ),
  'user_preferences_language_check includes ar, fr, en, es, de, pt'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000291', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000291","role":"authenticated","aud":"authenticated"}', true);
set local role authenticated;

select extensions.is((public.upsert_my_preferences('ar', null, null, null, null)).language, 'ar', 'upsert_my_preferences accepts ar');
select extensions.is((public.upsert_my_preferences('fr', null, null, null, null)).language, 'fr', 'upsert_my_preferences accepts fr');
select extensions.is((public.upsert_my_preferences('en', null, null, null, null)).language, 'en', 'upsert_my_preferences accepts en');
select extensions.is((public.upsert_my_preferences('es', null, null, null, null)).language, 'es', 'upsert_my_preferences accepts es');
select extensions.is((public.upsert_my_preferences('de', null, null, null, null)).language, 'de', 'upsert_my_preferences accepts de');
select extensions.is((public.upsert_my_preferences('pt', null, null, null, null)).language, 'pt', 'upsert_my_preferences accepts pt');

select extensions.throws_ok(
  $$select public.upsert_my_preferences('it', null, null, null, null)$$,
  '23514',
  null,
  'upsert_my_preferences rejects unsupported language code it'
);

select extensions.throws_ok(
  $$select public.upsert_my_preferences('ES', null, null, null, null)$$,
  '23514',
  null,
  'upsert_my_preferences rejects unsupported language code ES'
);

select * from extensions.finish();
rollback;
