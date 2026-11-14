-- KRISTOU SCHOOL — GOV-01C: pgTAP Security & Access-Control Test Suite for Account Governance
-- STATUS: PREPARED — NOT VERIFIED (requires isolated local Docker/PostgreSQL `npm run db:reset` + `npm run db:test` after F0-R2 `canonical_account_roles` reconciliation).

begin;

select extensions.plan(26);

-- 1. RLS and least-privilege grant assertions
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.account_governance_audit_logs'::regclass),
  'account_governance_audit_logs has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.manager_capability_grants'::regclass),
  'manager_capability_grants has RLS enabled'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.account_governance_audit_logs', 'SELECT'),
  'anon cannot select account_governance_audit_logs'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.account_governance_audit_logs', 'INSERT'),
  'authenticated cannot directly insert into account_governance_audit_logs'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.account_governance_audit_logs', 'UPDATE'),
  'authenticated cannot directly update account_governance_audit_logs'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.account_governance_audit_logs', 'DELETE'),
  'authenticated cannot directly delete account_governance_audit_logs'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.governance_review_account(uuid,text,public.app_role,text,integer,text)', 'EXECUTE'),
  'anon cannot execute governance_review_account'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.governance_appoint_privileged_role(uuid,public.app_role,text,text,integer,boolean)', 'EXECUTE'),
  'anon cannot execute governance_appoint_privileged_role'
);

-- 2. Synthetic test fixtures across roles
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated',
    'gov-owner-1@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_owner_one","full_name":"Gov Owner One","requested_role":"APP_ADMIN"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated',
    'gov-admin-1@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_admin_one","full_name":"Gov Admin One","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated',
    'gov-admin-2@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_admin_two","full_name":"Gov Admin Two","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated',
    'gov-manager-plain@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_manager_plain","full_name":"Gov Manager Plain","requested_role":"MANAGER"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated',
    'gov-teacher-1@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_teacher_one","full_name":"Gov Teacher One","requested_role":"TEACHER"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000106', 'authenticated', 'authenticated',
    'gov-pending-parent@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_pending_parent","full_name":"Gov Pending Parent","requested_role":"PARENT"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000107', 'authenticated', 'authenticated',
    'gov-pending-mgr@example.invalid', '', now(), '{}'::jsonb,
    '{"username":"gov_pending_mgr","full_name":"Gov Pending Manager","requested_role":"MANAGER"}'::jsonb,
    now(), now()
  );

update public.profiles
   set account_status = 'APPROVED'
 where id in (
   '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000102',
   '00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000104',
   '00000000-0000-4000-8000-000000000105'
 );

delete from public.role_assignments
 where user_id in (
   '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000102',
   '00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000104',
   '00000000-0000-4000-8000-000000000105',
   '00000000-0000-4000-8000-000000000106',
   '00000000-0000-4000-8000-000000000107'
 );

insert into public.role_assignments (user_id, role, active) values
  ('00000000-0000-4000-8000-000000000101', 'APP_ADMIN', true),
  ('00000000-0000-4000-8000-000000000102', 'ADMINISTRATIVE_PERSONNEL', true),
  ('00000000-0000-4000-8000-000000000103', 'ADMINISTRATIVE_PERSONNEL', true),
  ('00000000-0000-4000-8000-000000000104', 'MANAGER', true),
  ('00000000-0000-4000-8000-000000000105', 'TEACHER', true);

-- 3. Teacher is denied governance_list_pending_accounts and governance_review_account
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000105","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.governance_list_pending_accounts()$$,
  'P0001',
  'insufficient_governance_authority',
  'TEACHER cannot list pending accounts'
);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000106'::uuid, 'APPROVE', 'PARENT'::public.app_role, 'Teacher attempt', 1, null)$$,
  'P0001',
  'insufficient_governance_authority',
  'TEACHER cannot approve pending accounts'
);

-- 4. Manager without ACCOUNT_APPROVAL_REVIEW grant is denied
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_list_pending_accounts()$$,
  'P0001',
  'manager_delegation_required',
  'MANAGER without explicit grant cannot list pending accounts'
);

select extensions.throws_ok(
  $$select public.governance_appoint_privileged_role('00000000-0000-4000-8000-000000000107'::uuid, 'MANAGER'::public.app_role, 'GRANT', 'Manager appointing manager', 1, true)$$,
  'P0001',
  'owner_only_operation',
  'MANAGER cannot appoint another MANAGER'
);

-- 5. ADMINISTRATIVE_PERSONNEL self-governance denial and privileged target denial
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000102'::uuid, 'SUSPEND', null, 'Admin self suspend attempt', 1, null)$$,
  'P0001',
  'self_governance_denied',
  'ADMINISTRATIVE_PERSONNEL cannot govern own account'
);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000107'::uuid, 'APPROVE', 'MANAGER'::public.app_role, 'Admin approving manager', 1, null)$$,
  'P0001',
  'privileged_target_requires_owner',
  'ADMINISTRATIVE_PERSONNEL cannot approve MANAGER request'
);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000101'::uuid, 'SUSPEND', null, 'Admin suspending owner', 1, null)$$,
  'P0001',
  'privileged_target_requires_owner',
  'ADMINISTRATIVE_PERSONNEL cannot suspend APP_ADMIN'
);

-- 6. ADMINISTRATIVE_PERSONNEL can approve an ordinary PARENT account and suspend another ADMINISTRATIVE_PERSONNEL
select extensions.is(
  (
    select (public.governance_review_account(
      '00000000-0000-4000-8000-000000000106'::uuid,
      'APPROVE',
      'PARENT'::public.app_role,
      'Verified guardian dossier',
      1,
      'idem-pgtap-parent-001'
    ) ->> 'accountStatus')
  ),
  'APPROVED',
  'ADMINISTRATIVE_PERSONNEL can approve ordinary PARENT account'
);

select extensions.is(
  (
    select (public.governance_review_account(
      '00000000-0000-4000-8000-000000000103'::uuid,
      'SUSPEND',
      null,
      'Temporary office suspension',
      1,
      null
    ) ->> 'accountStatus')
  ),
  'SUSPENDED',
  'ADMINISTRATIVE_PERSONNEL can suspend another ADMINISTRATIVE_PERSONNEL account'
);

-- 7. Suspended ADMINISTRATIVE_PERSONNEL loses governance authority immediately
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_list_pending_accounts()$$,
  'P0001',
  'actor_not_approved',
  'Suspended ADMINISTRATIVE_PERSONNEL cannot execute governance queries'
);

-- 8. APP_ADMIN Owner-only appointment and Last-Owner protection
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000107'::uuid, 'APPROVE', 'MANAGER'::public.app_role, 'Owner attempting general APPROVE of MANAGER without explicit confirmation', 1, null)$$,
  'P0001',
  'explicit_confirmation_required',
  'APP_ADMIN cannot approve a privileged role via governance_review_account without explicit confirmation'
);

select extensions.throws_ok(
  $$select public.governance_appoint_privileged_role('00000000-0000-4000-8000-000000000107'::uuid, 'MANAGER'::public.app_role, 'GRANT', 'Owner appointing manager without confirmation flag', 1, false)$$,
  'P0001',
  'explicit_confirmation_required',
  'APP_ADMIN appointment requires explicit p_confirmed = true'
);

select extensions.is(
  (
    select (public.governance_appoint_privileged_role(
      '00000000-0000-4000-8000-000000000107'::uuid,
      'MANAGER'::public.app_role,
      'GRANT',
      'Owner appointing verified Manager',
      1,
      true
    ) ->> 'accountStatus')
  ),
  'APPROVED',
  'APP_ADMIN can appoint verified account to MANAGER'
);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000106'::uuid, 'REJECT', null, 'Stale version attempt', 1, null)$$,
  'P0001',
  'version_conflict',
  'Stale expected_version fails closed with version_conflict'
);

-- Ensure only 1 active APP_ADMIN exists for the last-owner protection test
reset role;
delete from public.role_assignments
 where role::text = 'APP_ADMIN'
   and user_id <> '00000000-0000-4000-8000-000000000101';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.governance_appoint_privileged_role('00000000-0000-4000-8000-000000000101'::uuid, 'APP_ADMIN'::public.app_role, 'REVOKE', 'Attempt to remove last owner', 1, true)$$,
  'P0001',
  'last_owner_protection',
  'Cannot revoke APP_ADMIN from the last active School Owner'
);

select extensions.throws_ok(
  $$select public.governance_appoint_privileged_role('00000000-0000-4000-8000-000000000101'::uuid, 'MANAGER'::public.app_role, 'GRANT', 'Attempt to replace last owner with MANAGER', 1, true)$$,
  'P0001',
  'last_owner_protection',
  'Cannot replace APP_ADMIN with MANAGER on the last active School Owner'
);

select extensions.throws_ok(
  $$select public.governance_review_account('00000000-0000-4000-8000-000000000101'::uuid, 'SUSPEND', null, 'Attempt to suspend last owner', 1, null)$$,
  'P0001',
  'last_owner_protection',
  'Cannot suspend the last active School Owner'
);

select extensions.ok(
  (select count(*) >= 3 from public.account_governance_audit_logs),
  'Audit log records every accepted governance mutation'
);

reset role;
select * from extensions.finish();
rollback;
