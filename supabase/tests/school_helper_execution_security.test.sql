-- Run on an isolated schema, including Supabase-style direct default EXECUTE grants.
begin;
select extensions.plan(10);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-9000-000000000902'::uuid, 'authenticated', 'authenticated',
  'helper-grants-test@example.invalid', '{}'::jsonb,
  '{"username":"helper_grants_test","full_name":"Helper Grants Test","requested_role":"PARENT"}'::jsonb, now(), now());

set local role anon;
select extensions.throws_ok($$select public.is_approved_school_member()$$, '42501', null, 'anon cannot invoke internal approval helper');
select extensions.throws_ok($$select public.current_user_has_role('APP_ADMIN'::public.app_role)$$, '42501', null, 'anon cannot invoke internal role helper');
select extensions.throws_ok($$select public.current_user_has_capability('CLASSES_MANAGE')$$, '42501', null, 'anon cannot invoke internal capability helper');
select extensions.throws_ok($$select public.can_access_class('00000000-0000-4000-9000-000000000999'::uuid)$$, '42501', null, 'anon cannot invoke internal class-scope helper');
select extensions.ok(not has_function_privilege('anon', 'public.validate_school_broadcast_targets()', 'EXECUTE'), 'anon has no direct trigger-function execution grant');
select extensions.ok(not has_function_privilege('authenticated', 'public.validate_school_broadcast_targets()', 'EXECUTE'), 'authenticated has no direct trigger-function execution grant');

set local role authenticated;
select extensions.is(public.is_approved_school_member(), false, 'authenticated helper remains callable and rejects absent verified identity');
select extensions.is(public.can_access_class('00000000-0000-4000-9000-000000000999'::uuid), false, 'class helper still rejects absent verified identity');

reset role;
select extensions.throws_ok(
  $$insert into public.school_broadcasts (title, body, audience_scope, target_level_codes, created_by, author_name, author_role)
    values ('Invalid trigger target', 'Reject unknown canonical level', 'SELECTED_LEVELS', array['LYCEE'],
      '00000000-0000-4000-9000-000000000902'::uuid, 'Test office', 'Administration')$$,
  'P0001', 'invalid_target_levels', 'table validation trigger rejects invalid levels independently of RPC validation'
);
select extensions.lives_ok(
  $$insert into public.school_broadcasts (title, body, audience_scope, target_level_codes, created_by, author_name, author_role)
    values ('Valid trigger target', 'Preserve valid canonical level', 'SELECTED_LEVELS', array[' cp '],
      '00000000-0000-4000-9000-000000000902'::uuid, 'Test office', 'Administration')$$,
  'table validation trigger still permits valid targets after execute grants are revoked'
);
select * from extensions.finish();
rollback;
