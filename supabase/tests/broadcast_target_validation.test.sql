-- Isolated synthetic fixtures only. Exercise the public RPC with ordinary roles.
begin;
select extensions.plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-9000-000000000901'::uuid, 'authenticated', 'authenticated',
  'broadcast-fix-owner@example.invalid', '', now(), '{}'::jsonb,
  '{"username":"broadcast_fix_owner","full_name":"Broadcast Test Owner","requested_role":"APP_ADMIN"}'::jsonb,
  now(), now()
);
update public.profiles set account_status = 'APPROVED'
where id = '00000000-0000-4000-9000-000000000901'::uuid;
insert into public.role_assignments (user_id, role, active)
values ('00000000-0000-4000-9000-000000000901'::uuid, 'APP_ADMIN', true)
on conflict (user_id, role) do update set active = true;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000901","role":"authenticated"}', true);
set local role authenticated;
select extensions.ok(row_security_active('public.school_broadcasts'), 'ordinary authenticated caller has RLS active');

select extensions.throws_ok(
  $$select public.publish_school_broadcast('Fix invalid only', 'Unknown school level', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array['LYCEE'])$$,
  'P0001', 'invalid_target_levels', 'unknown level is rejected by direct RPC'
);
select extensions.throws_ok(
  $$select public.publish_school_broadcast('Fix invalid mixed', 'Mixed school levels', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array['CP', 'LYCEE'])$$,
  'P0001', 'invalid_target_levels', 'one valid level cannot hide an invalid level'
);
select extensions.is(
  (select count(*)::int from public.school_broadcasts where title in ('Fix invalid only', 'Fix invalid mixed')),
  0, 'invalid target requests persist no broadcast'
);
select extensions.throws_ok(
  $$select public.publish_school_broadcast('Fix empty levels', 'No effective level', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array[' ', null])$$,
  'P0001', 'target_levels_required', 'empty normalized targets remain rejected'
);
select extensions.is(
  (to_jsonb(public.publish_school_broadcast('Fix valid levels', 'Canonical targeted notice', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array[' cp ', 'CP', 'cm2'])) -> 'target_level_codes'),
  '["CM2", "CP"]'::jsonb, 'canonical levels are normalized, deduplicated and persisted'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select extensions.throws_ok(
  $$select public.publish_school_broadcast('Anonymous publish', 'Must be denied', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array['CP'])$$,
  '42501', null, 'anonymous caller still cannot publish'
);
select extensions.is(
  (select count(*)::int from public.school_broadcasts where title = 'Fix valid levels'),
  0, 'targeted internal broadcast remains invisible to anonymous visitors'
);
select * from extensions.finish();
rollback;
