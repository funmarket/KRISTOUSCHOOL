-- Isolated RLS proof for the exact role/claim context used by telegram-private-ops.
-- Fixtures are synthetic. Never run this suite against the hosted project.
begin;

select extensions.plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'tg-private-owner@example.invalid', '', now(), '{}'::jsonb, '{"username":"tg_private_owner","full_name":"TG Private Owner","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000202', 'authenticated', 'authenticated', 'tg-private-other@example.invalid', '', now(), '{}'::jsonb, '{"username":"tg_private_other","full_name":"TG Private Other","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000203', 'authenticated', 'authenticated', 'tg-private-pending@example.invalid', '', now(), '{}'::jsonb, '{"username":"tg_private_pending","full_name":"TG Private Pending","requested_role":"PARENT"}'::jsonb, now(), now());

update public.profiles set account_status = 'APPROVED'
 where id in ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202');

insert into public.role_assignments (user_id, role, active) values
  ('00000000-0000-4000-8000-000000000201', 'PARENT', true),
  ('00000000-0000-4000-8000-000000000202', 'PARENT', true);

insert into public.user_notifications (id, recipient_user_id, category, title, body)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 'system', 'Own notification', 'Owner row'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', 'system', 'Other notification', 'Other row');

insert into public.user_preferences (user_id, language, theme)
values
  ('00000000-0000-4000-8000-000000000201', 'fr', 'light'),
  ('00000000-0000-4000-8000-000000000202', 'en', 'light');

-- Mirrors gateway ordering: resolve link before role switch, then set local JWT
-- claims, switch to authenticated, and keep all work in this transaction.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","aud":"authenticated"}', true);
set local role authenticated;

select extensions.is(auth.uid()::text, '00000000-0000-4000-8000-000000000201', 'transaction-local Telegram claims resolve to the linked account');
select extensions.is(current_user, 'authenticated', 'database work runs as authenticated');
select extensions.is((select count(*)::integer from public.user_notifications), 1, 'notification RLS reveals only the linked account rows');
select extensions.is((select count(*)::integer from public.user_preferences), 1, 'preference RLS reveals only the linked account row');
select extensions.is((select language from public.user_preferences where user_id = auth.uid()), 'fr', 'own preferences remain readable');
select extensions.is(public.mark_user_notification_read('00000000-0000-4000-8000-000000000301'::uuid), true, 'existing mark-own RPC succeeds');
select extensions.is(public.mark_user_notification_read('00000000-0000-4000-8000-000000000302'::uuid), false, 'existing mark RPC cannot change another account notification');
select extensions.is((public.upsert_my_preferences('ar', null, null, null, null)).language, 'ar', 'existing preference RPC writes for authenticated Telegram actor');
select extensions.throws_ok(
  $$select public.governance_list_pending_accounts()$$,
  'P0001', 'insufficient_governance_authority',
  'ordinary PARENT role cannot access governance operations'
);

reset role;
select extensions.is((select is_read from public.user_notifications where id = '00000000-0000-4000-8000-000000000302'::uuid), false, 'other account notification remains unchanged');

-- Pending account status is checked from live canonical rows in the authenticated context.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000203', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000203","role":"authenticated","aud":"authenticated"}', true);
set local role authenticated;
select extensions.is((select count(*)::integer from public.user_notifications), 0, 'unapproved account sees no notification rows');

select * from extensions.finish();
rollback;
