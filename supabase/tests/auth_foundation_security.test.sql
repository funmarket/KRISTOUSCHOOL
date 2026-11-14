begin;

select extensions.plan(21);

-- Synthetic Auth users fire the real profile/role trigger from the migration chain.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'security-test-one@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"security_test_one","full_name":"Synthetic User One"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'security-test-two@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"security_test_two","full_name":"Synthetic User Two"}'::jsonb,
    now(), now()
  );

-- Canonical roles migration intentionally grants no role on public signup.
select extensions.is(
  (select count(*)::integer from public.role_assignments where user_id in (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  )), 0, 'Signup does not automatically approve or assign roles'
);
-- Explicit test-only assignments make the own-row / other-row RLS test meaningful.
insert into public.role_assignments(user_id, role, active) values
  ('00000000-0000-4000-8000-000000000001', 'PARENT', true),
  ('00000000-0000-4000-8000-000000000002', 'TEACHER', true);

insert into public.telegram_identities (user_id, telegram_user_id, first_name)
values
  ('00000000-0000-4000-8000-000000000001', 900000001, 'Synthetic One'),
  ('00000000-0000-4000-8000-000000000002', 900000002, 'Synthetic Two');

insert into public.account_link_challenges (user_id, verifier_hash, expires_at)
values
  ('00000000-0000-4000-8000-000000000001', repeat('a', 64), now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-000000000002', repeat('b', 64), now() + interval '5 minutes');

select extensions.ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.role_assignments'::regclass), 'role_assignments has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.telegram_identities'::regclass), 'telegram_identities has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.account_link_challenges'::regclass), 'account_link_challenges has RLS enabled');

select extensions.ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon cannot select profiles');
select extensions.ok(not has_table_privilege('anon', 'public.role_assignments', 'SELECT'), 'anon cannot select role assignments');
select extensions.ok(not has_table_privilege('anon', 'public.telegram_identities', 'SELECT'), 'anon cannot select Telegram identities');
select extensions.ok(not has_table_privilege('anon', 'public.account_link_challenges', 'SELECT'), 'anon cannot select link challenges');

select extensions.ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'), 'authenticated has the profile read grant');
select extensions.ok(has_table_privilege('authenticated', 'public.role_assignments', 'SELECT'), 'authenticated has the role read grant');
select extensions.ok(has_table_privilege('authenticated', 'public.telegram_identities', 'SELECT'), 'authenticated has the Telegram identity read grant');
select extensions.ok(not has_table_privilege('authenticated', 'public.account_link_challenges', 'SELECT'), 'authenticated cannot read link challenges');

select extensions.ok(not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon cannot directly execute the Auth trigger function');
select extensions.ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'authenticated cannot directly execute the Auth trigger function');
select extensions.ok(not has_function_privilege('anon', 'public.claim_telegram_account_link(text,bigint,text,text,text,text)', 'EXECUTE'), 'anon cannot execute the Telegram link RPC');
select extensions.ok(not has_function_privilege('authenticated', 'public.claim_telegram_account_link(text,bigint,text,text,text,text)', 'EXECUTE'), 'authenticated cannot execute the Telegram link RPC');
select extensions.ok(has_function_privilege('service_role', 'public.claim_telegram_account_link(text,bigint,text,text,text,text)', 'EXECUTE'), 'service_role can execute the Telegram link RPC');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select extensions.is((select count(*)::integer from public.profiles), 1, 'authenticated user sees only their own profile');
select extensions.is((select count(*)::integer from public.role_assignments), 1, 'authenticated user sees only their own role assignment');
select extensions.is((select count(*)::integer from public.telegram_identities), 1, 'authenticated user sees only their own Telegram identity');

reset role;
select * from extensions.finish();
rollback;
