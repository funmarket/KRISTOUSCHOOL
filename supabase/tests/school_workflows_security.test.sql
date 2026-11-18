-- KRISTOU SCHOOL — Behavioral Security & RLS Test Suite for Role-Home Operational Workflows
-- Coverage: Defects A-H + GOV-02 delegation/audit + Anonymous Public Content RLS +
-- People/Academics + Broadcasts/Community + Parent Notes (08:00-18:00 Africa/Tunis + 11/day quota) +
-- Short Operational Messaging.
-- Local synthetic fixtures only; requires isolated PostgreSQL / Supabase CLI Docker reset to execute.

begin;

select extensions.plan(83);

-- 1. Verify RLS is enabled on all new private & public-filtered domain tables (14 assertions: 1-14)
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.user_preferences'::regclass), '1. user_preferences RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.user_notifications'::regclass), '2. user_notifications RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.school_classes'::regclass), '3. school_classes RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.students'::regclass), '4. students RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.student_class_memberships'::regclass), '5. student_class_memberships RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.parent_child_links'::regclass), '6. parent_child_links RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.enrollment_applications'::regclass), '7. enrollment_applications RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.school_broadcasts'::regclass), '8. school_broadcasts RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.school_calendar_events'::regclass), '9. school_calendar_events RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.parent_notes'::regclass), '10. parent_notes RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.message_threads'::regclass), '11. message_threads RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.thread_messages'::regclass), '12. thread_messages RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.directory_entries'::regclass), '13. directory_entries RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.food_menu_weeks'::regclass), '14. food_menu_weeks RLS enabled');

-- 2. Verify least-privilege table/function grants (13 assertions: 15-27)
select extensions.ok(not has_table_privilege('anon', 'public.students', 'SELECT'), '15. anon cannot read students');
select extensions.ok(not has_table_privilege('anon', 'public.parent_notes', 'SELECT'), '16. anon cannot read parent_notes');
select extensions.ok(not has_table_privilege('anon', 'public.enrollment_applications', 'SELECT'), '17. anon cannot read enrollment_applications');
select extensions.ok(not has_table_privilege('anon', 'public.thread_messages', 'SELECT'), '18. anon cannot read thread_messages');
select extensions.ok(not has_function_privilege('anon', 'public.governance_set_manager_capability(uuid,text,boolean,text)', 'EXECUTE'), '19. anon cannot call governance_set_manager_capability');
select extensions.ok(not has_function_privilege('anon', 'public.send_parent_note(uuid,text,text)', 'EXECUTE'), '20. anon cannot call send_parent_note');
select extensions.ok(not has_function_privilege('anon', 'public.list_school_classes_with_rosters()', 'EXECUTE'), '21. anon cannot call list_school_classes_with_rosters');
select extensions.ok(not has_function_privilege('anon', 'public.send_operational_message(uuid,text,text)', 'EXECUTE'), '22. anon cannot call send_operational_message');
select extensions.ok(not has_function_privilege('authenticated', 'public.can_users_direct_message(uuid,uuid)', 'EXECUTE'), '23. authenticated cannot probe third-party messaging pairs via can_users_direct_message');
select extensions.ok(not has_function_privilege('anon', 'public.can_access_message_thread(uuid)', 'EXECUTE'), '24. anon cannot call can_access_message_thread');
select extensions.ok(not has_function_privilege('anon', 'public.is_approved_school_member()', 'EXECUTE'), '25. Finding H: anon cannot execute is_approved_school_member');
select extensions.ok(not has_function_privilege('anon', 'public.current_user_has_role(public.app_role)', 'EXECUTE'), '26. Finding H: anon cannot execute current_user_has_role');
select extensions.ok(not has_function_privilege('anon', 'public.current_user_has_capability(text)', 'EXECUTE'), '27. Finding H: anon cannot execute current_user_has_capability');

-- 3. Temp ref helpers (preserve real thread/audit IDs before role or RLS changes)
create temp table pg_temp.test_refs (
  ref_key text primary key,
  ref_id uuid,
  ref_int integer
) on commit drop;
grant select, insert, update on pg_temp.test_refs to authenticated;

create or replace function pg_temp.set_ref(p_key text, p_id uuid)
returns uuid
language plpgsql
as $$
begin
  if p_id is null then
    raise exception 'expected_non_null_ref:%', p_key using errcode = 'P0001';
  end if;
  insert into pg_temp.test_refs (ref_key, ref_id)
  values (p_key, p_id)
  on conflict (ref_key) do update set ref_id = excluded.ref_id;
  return p_id;
end;
$$;

create or replace function pg_temp.get_ref(p_key text)
returns uuid
language plpgsql
stable
as $$
declare
  v_id uuid;
begin
  select ref_id into v_id from pg_temp.test_refs where ref_key = p_key;
  if v_id is null then
    raise exception 'missing_test_ref:%', p_key using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

create or replace function pg_temp.set_int(p_key text, p_val integer)
returns integer
language plpgsql
as $$
begin
  insert into pg_temp.test_refs (ref_key, ref_int)
  values (p_key, p_val)
  on conflict (ref_key) do update set ref_int = excluded.ref_int;
  return p_val;
end;
$$;

create or replace function pg_temp.get_int(p_key text)
returns integer
language sql
stable
as $$
  select ref_int from pg_temp.test_refs where ref_key = p_key;
$$;

-- 4. Synthetic Multi-Role Fixtures (explicit ::uuid casts everywhere)
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-9000-000000000201'::uuid, 'authenticated', 'authenticated', 'wf-owner@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_owner","full_name":"WF Owner","requested_role":"APP_ADMIN"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000202'::uuid, 'authenticated', 'authenticated', 'wf-mgr-ro@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_mgr_ro","full_name":"WF Manager Roster","requested_role":"MANAGER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000203'::uuid, 'authenticated', 'authenticated', 'wf-mgr-mod@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_mgr_mod","full_name":"WF Manager Mod","requested_role":"MANAGER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000204'::uuid, 'authenticated', 'authenticated', 'wf-teacher-cp@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_teacher_cp","full_name":"WF Teacher CP","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000205'::uuid, 'authenticated', 'authenticated', 'wf-teacher-cm2@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_teacher_cm2","full_name":"WF Teacher CM2","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000206'::uuid, 'authenticated', 'authenticated', 'wf-staff@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_staff","full_name":"WF School Staff","requested_role":"SCHOOL_STAFF"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000207'::uuid, 'authenticated', 'authenticated', 'wf-parent-a@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_parent_a","full_name":"WF Parent A","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000208'::uuid, 'authenticated', 'authenticated', 'wf-parent-b@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_parent_b","full_name":"WF Parent B","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000209'::uuid, 'authenticated', 'authenticated', 'wf-parent-cm2@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_parent_cm2","full_name":"WF Parent CM2","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000210'::uuid, 'authenticated', 'authenticated', 'wf-student@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_student","full_name":"WF Student Self","requested_role":"STUDENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000211'::uuid, 'authenticated', 'authenticated', 'wf-admin@example.invalid', '', now(), '{}'::jsonb, '{"username":"wf_admin","full_name":"WF Office Admin","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb, now(), now());

update public.profiles
   set account_status = 'APPROVED'
 where id in (
   '00000000-0000-4000-9000-000000000201'::uuid,
   '00000000-0000-4000-9000-000000000202'::uuid,
   '00000000-0000-4000-9000-000000000203'::uuid,
   '00000000-0000-4000-9000-000000000204'::uuid,
   '00000000-0000-4000-9000-000000000205'::uuid,
   '00000000-0000-4000-9000-000000000206'::uuid,
   '00000000-0000-4000-9000-000000000207'::uuid,
   '00000000-0000-4000-9000-000000000208'::uuid,
   '00000000-0000-4000-9000-000000000209'::uuid,
   '00000000-0000-4000-9000-000000000210'::uuid,
   '00000000-0000-4000-9000-000000000211'::uuid
 );

delete from public.role_assignments
 where user_id between '00000000-0000-4000-9000-000000000201'::uuid and '00000000-0000-4000-9000-000000000211'::uuid;

insert into public.role_assignments (user_id, role, active) values
  ('00000000-0000-4000-9000-000000000201'::uuid, 'APP_ADMIN', true),
  ('00000000-0000-4000-9000-000000000202'::uuid, 'MANAGER', true),
  ('00000000-0000-4000-9000-000000000203'::uuid, 'MANAGER', true),
  ('00000000-0000-4000-9000-000000000204'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000205'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000206'::uuid, 'SCHOOL_STAFF', true),
  ('00000000-0000-4000-9000-000000000207'::uuid, 'PARENT', true),
  ('00000000-0000-4000-9000-000000000208'::uuid, 'PARENT', true),
  ('00000000-0000-4000-9000-000000000209'::uuid, 'PARENT', true),
  ('00000000-0000-4000-9000-000000000210'::uuid, 'STUDENT', true),
  ('00000000-0000-4000-9000-000000000211'::uuid, 'ADMINISTRATIVE_PERSONNEL', true);

insert into public.manager_capability_grants (manager_user_id, capability, active, granted_by) values
  ('00000000-0000-4000-9000-000000000202'::uuid, 'CLASSES_ROSTER_VIEW', true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000203'::uuid, 'COMMUNITY_MODERATE', true, '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.school_classes (id, academic_year_id, level_code, name, capacity, created_by)
select '00000000-0000-4000-9000-000000000301'::uuid, id, 'CP', 'CP-PgTAP', 24, '00000000-0000-4000-9000-000000000201'::uuid
  from public.academic_years where code = '2026-2027'
union all
select '00000000-0000-4000-9000-000000000302'::uuid, id, 'CM2', 'CM2-PgTAP', 24, '00000000-0000-4000-9000-000000000201'::uuid
  from public.academic_years where code = '2026-2027';

insert into public.students (id, student_code, full_name, birth_date, linked_profile_id, status, created_by) values
  ('00000000-0000-4000-9000-000000000401'::uuid, 'KS-TEST-A1', 'Child A1', date '2019-04-10', null, 'ACTIVE', '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000402'::uuid, 'KS-TEST-B1', 'Child B1', date '2019-06-12', null, 'ACTIVE', '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000403'::uuid, 'KS-TEST-A2', 'Student Self A2', date '2019-08-15', '00000000-0000-4000-9000-000000000210'::uuid, 'ACTIVE', '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000404'::uuid, 'KS-TEST-C1', 'Child CM2', date '2016-02-20', null, 'ACTIVE', '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.student_class_memberships (student_id, class_id, academic_year_id, status, assigned_by)
select s_id, c_id, ay.id, 'ACTIVE', '00000000-0000-4000-9000-000000000201'::uuid
from (values
  ('00000000-0000-4000-9000-000000000401'::uuid, '00000000-0000-4000-9000-000000000301'::uuid),
  ('00000000-0000-4000-9000-000000000402'::uuid, '00000000-0000-4000-9000-000000000301'::uuid),
  ('00000000-0000-4000-9000-000000000403'::uuid, '00000000-0000-4000-9000-000000000301'::uuid),
  ('00000000-0000-4000-9000-000000000404'::uuid, '00000000-0000-4000-9000-000000000302'::uuid)
) as v(s_id, c_id)
cross join (select id from public.academic_years where code = '2026-2027') ay;

insert into public.teacher_class_assignments (teacher_user_id, class_id, is_homeroom, active, assigned_by) values
  ('00000000-0000-4000-9000-000000000204'::uuid, '00000000-0000-4000-9000-000000000301'::uuid, true, true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000205'::uuid, '00000000-0000-4000-9000-000000000302'::uuid, true, true, '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.parent_child_links (parent_user_id, student_id, relationship_label, active, verified_by) values
  ('00000000-0000-4000-9000-000000000207'::uuid, '00000000-0000-4000-9000-000000000401'::uuid, 'Mother', true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000208'::uuid, '00000000-0000-4000-9000-000000000402'::uuid, 'Father', true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000209'::uuid, '00000000-0000-4000-9000-000000000404'::uuid, 'Mother', true, '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.class_questions (id, class_id, author_user_id, author_name, content) values
  ('00000000-0000-4000-9000-000000000501'::uuid, '00000000-0000-4000-9000-000000000301'::uuid, '00000000-0000-4000-9000-000000000207'::uuid, 'WF Parent A', 'Homework due tomorrow?'),
  ('00000000-0000-4000-9000-000000000502'::uuid, '00000000-0000-4000-9000-000000000302'::uuid, '00000000-0000-4000-9000-000000000209'::uuid, 'WF Parent CM2', 'Science workbook page?');

-- Public-content fixtures (published + unpublished/draft) for Finding H tests
insert into public.directory_entries (id, entry_type, display_name, title, bio, is_published, created_by) values
  ('00000000-0000-4000-9000-000000000601'::uuid, 'TEACHER', 'PgTAP Public Teacher', 'CP Teacher', 'Public bio', true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000602'::uuid, 'ADMIN', 'PgTAP Draft Admin', 'Hidden Draft Entry', 'Internal draft bio', false, '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.food_menu_weeks (id, week_range, status, created_by) values
  ('00000000-0000-4000-9000-000000000611'::uuid, 'PgTAP Published Week', 'PUBLISHED', '00000000-0000-4000-9000-000000000201'::uuid),
  ('00000000-0000-4000-9000-000000000612'::uuid, 'PgTAP Draft Week', 'DRAFT', '00000000-0000-4000-9000-000000000201'::uuid);

insert into public.food_menu_days (id, menu_week_id, day_order, day_label, main_dish) values
  ('00000000-0000-4000-9000-000000000621'::uuid, '00000000-0000-4000-9000-000000000611'::uuid, 1, 'Monday', 'Couscous Royal PgTAP'),
  ('00000000-0000-4000-9000-000000000622'::uuid, '00000000-0000-4000-9000-000000000612'::uuid, 1, 'Monday', 'Draft Hidden Dish PgTAP');

insert into public.school_public_content (slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_by) values
  ('pgtap-public-notice', 'عام', 'Public PgTAP', 'Public PgTAP', 'محتوى عام', 'Contenu public', 'Public body', true, '00000000-0000-4000-9000-000000000201'::uuid),
  ('pgtap-draft-notice', 'مسودة', 'Brouillon PgTAP', 'Draft PgTAP', 'محتوى مخفي', 'Contenu caché', 'Hidden draft body', false, '00000000-0000-4000-9000-000000000201'::uuid);

-- Seed 11 parent notes for wf_parent_a today + 1 note for wf_parent_cm2 (to test RLS & daily quota)
insert into public.parent_notes (
  parent_user_id, parent_name, student_id, student_name, class_id, recipient_teacher_id, topic, content, school_day, status
)
select
  '00000000-0000-4000-9000-000000000207'::uuid, 'WF Parent A',
  '00000000-0000-4000-9000-000000000401'::uuid, 'Child A1',
  '00000000-0000-4000-9000-000000000301'::uuid, '00000000-0000-4000-9000-000000000204'::uuid,
  'OTHER', 'Note #' || g::text, (now() at time zone 'Africa/Tunis')::date, 'SENT'
from generate_series(1, 11) as g;

insert into public.parent_notes (
  parent_user_id, parent_name, student_id, student_name, class_id, recipient_teacher_id, topic, content, school_day, status
) values (
  '00000000-0000-4000-9000-000000000209'::uuid, 'WF Parent CM2',
  '00000000-0000-4000-9000-000000000404'::uuid, 'Child CM2',
  '00000000-0000-4000-9000-000000000302'::uuid, '00000000-0000-4000-9000-000000000205'::uuid,
  'HEALTH', 'CM2 private allergy note', (now() at time zone 'Africa/Tunis')::date, 'SENT'
);

create or replace function pg_temp.try_send_parent_note(p_student_id uuid, p_topic text, p_content text)
returns text
language plpgsql
as $$
begin
  perform public.send_parent_note(p_student_id, p_topic, p_content);
  return 'OK';
exception when others then
  return sqlerrm;
end;
$$;

-- =========================================================================
-- Class creation: explicit Owner denial overrides Manager defaults without revoking roster access (3 assertions: 28-30)
-- =========================================================================
-- Owner decision: approved Managers now have a default creation right. Test the
-- independent explicit denial, rather than treating an unrelated roster grant as a denial.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000201","role":"authenticated"}', true);
set local role authenticated;
select public.governance_set_class_creation_permission(
  '00000000-0000-4000-9000-000000000202', false, 'Owner denies creation while retaining roster access', 0
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000202","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.create_school_class('2026-2027', 'CE1', 'CE1-Blocked', 25, 'R0')$$,
  'P0001',
  'insufficient_authority',
  '28. Owner-denied Manager cannot create a class despite roster authority'
);

select extensions.ok(
  jsonb_array_length(public.list_school_classes_with_rosters()) >= 2,
  '29. Defect C: Manager with CLASSES_ROSTER_VIEW can still read class rosters'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000211', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000211","role":"authenticated"}', true);

select extensions.is(
  (select public.create_school_class('2026-2027', 'CE1', 'CE1-PgTAP', 24, 'R2') ->> 'levelCode'),
  'CE1',
  '30. Defect C: ADMINISTRATIVE_PERSONNEL can create school class'
);

-- =========================================================================
-- Defect D: Per-student/child membership scoping & zero 42P17 recursion (5 assertions: 31-35)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.student_class_memberships where class_id = '00000000-0000-4000-9000-000000000301'::uuid),
  1,
  '31. Defect D: Parent A sees only own child membership in shared CP class'
);

select extensions.is(
  (select count(*)::int from public.students where id in (
    '00000000-0000-4000-9000-000000000401'::uuid,
    '00000000-0000-4000-9000-000000000402'::uuid,
    '00000000-0000-4000-9000-000000000403'::uuid,
    '00000000-0000-4000-9000-000000000404'::uuid
  )),
  1,
  '32. Defect D: Parent A sees only own linked student record without recursion'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000210', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000210","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.student_class_memberships where class_id = '00000000-0000-4000-9000-000000000301'::uuid),
  1,
  '33. Defect D: Linked student sees only own membership record in CP class'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000204', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000204","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.student_class_memberships where class_id in ('00000000-0000-4000-9000-000000000301'::uuid,'00000000-0000-4000-9000-000000000302'::uuid)),
  3,
  '34. Defect D: Teacher CP sees assigned CP memberships (3) and zero unassigned CM2 memberships'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000202","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.student_class_memberships where class_id in ('00000000-0000-4000-9000-000000000301'::uuid,'00000000-0000-4000-9000-000000000302'::uuid)),
  4,
  '35. Defect D: Manager with CLASSES_ROSTER_VIEW sees all 4 school memberships'
);

-- =========================================================================
-- Defect A & B: Non-recursive messaging RLS, recipient matrix, real threadId capture (11 assertions: 36-46)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000210', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000210","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.list_approved_message_recipients()$$,
  'P0001',
  'students_cannot_direct_message',
  '36. Defect B: STUDENT cannot list DM recipients'
);

select extensions.throws_ok(
  $$select public.send_operational_message('00000000-0000-4000-9000-000000000204'::uuid, 'Hi', 'Need help')$$,
  'P0001',
  'students_cannot_direct_message',
  '37. Defect B: STUDENT cannot initiate direct messages'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.send_operational_message('00000000-0000-4000-9000-000000000208'::uuid, 'Hi', 'Parent to parent attempt')$$,
  'P0001',
  'invalid_recipient',
  '38. Defect B: PARENT cannot message another PARENT'
);

select extensions.throws_ok(
  $$select public.send_operational_message('00000000-0000-4000-9000-000000000206'::uuid, 'Hi', 'Parent to school staff attempt')$$,
  'P0001',
  'invalid_recipient',
  '39. Defect B: PARENT cannot message SCHOOL_STAFF directly'
);

select extensions.throws_ok(
  $$select public.send_operational_message('00000000-0000-4000-9000-000000000205'::uuid, 'Hi', 'Parent to unassigned teacher')$$,
  'P0001',
  'invalid_recipient',
  '40. Defect B: PARENT cannot message teacher of unassigned class'
);

select extensions.ok(
  pg_temp.set_ref(
    'cp_thread_id',
    (public.send_operational_message('00000000-0000-4000-9000-000000000204'::uuid, 'CP Thread PgTAP', 'Bonjour maitresse') ->> 'threadId')::uuid
  ) is not null,
  '41. Defect B: PARENT can message active child class teacher and captures real non-null threadId'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000204', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000204","role":"authenticated"}', true);

select extensions.is(
  (
    select count(*)::int
    from public.thread_participants tp
    where tp.thread_id = pg_temp.get_ref('cp_thread_id')
  ),
  2,
  '42. Defect A: Non-recursive RLS on thread_participants & message_threads returns 2 participants without 42P17'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000205', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000205","role":"authenticated"}', true);

select extensions.is(
  (
    select count(*)::int
    from public.thread_messages tm
    where tm.thread_id = pg_temp.get_ref('cp_thread_id')
  ),
  0,
  '43. Defect A/B: Non-participant teacher sees zero messages in another pair thread'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000208', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000208","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.reply_operational_thread(pg_temp.get_ref('cp_thread_id'), 'Intruder reply')$$,
  'P0001',
  'insufficient_authority',
  '44. Defect B: Non-participant Parent B cannot reply to preserved real threadId'
);

-- Historical thread policy (DG-17): deactivating teacher assignment terminates active read/reply
reset role;
update public.teacher_class_assignments
   set active = false
 where teacher_user_id = '00000000-0000-4000-9000-000000000204'::uuid
   and class_id = '00000000-0000-4000-9000-000000000301'::uuid;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.reply_operational_thread(pg_temp.get_ref('cp_thread_id'), 'Reply after teacher unassigned')$$,
  'P0001',
  'insufficient_authority',
  '45. Defect B (DG-17): Preserved real threadId reply fails closed once teacher-class relationship ends'
);

reset role;
update public.teacher_class_assignments
   set active = true
 where teacher_user_id = '00000000-0000-4000-9000-000000000204'::uuid
   and class_id = '00000000-0000-4000-9000-000000000301'::uuid;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000206', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000206","role":"authenticated"}', true);
set local role authenticated;

select extensions.ok(
  (public.send_operational_message('00000000-0000-4000-9000-000000000211'::uuid, 'Staff Gate Report', 'Bus arrived') ->> 'threadId') is not null,
  '46. Defect B: SCHOOL_STAFF can message ADMINISTRATIVE_PERSONNEL'
);

-- =========================================================================
-- Defect E: Moderation approval & role revalidation (5 assertions: 47-51)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000205', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000205","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.moderate_class_question('00000000-0000-4000-9000-000000000501'::uuid, true)$$,
  'P0001',
  'insufficient_authority',
  '47. Defect E: Unassigned teacher cannot moderate CP question'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000204', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000204","role":"authenticated"}', true);

select extensions.is(
  (public.moderate_class_question('00000000-0000-4000-9000-000000000501'::uuid, true)).is_hidden,
  true,
  '48. Defect E: Assigned active CP teacher can hide CP question'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000208', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000208","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.reply_class_question('00000000-0000-4000-9000-000000000501'::uuid, 'Replying to hidden question')$$,
  'P0001',
  'insufficient_authority',
  '49. Defect E: Non-moderator parent cannot reply to hidden question'
);

reset role;
update public.profiles
   set account_status = 'SUSPENDED'
 where id = '00000000-0000-4000-9000-000000000203'::uuid;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000203', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000203","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.moderate_class_question('00000000-0000-4000-9000-000000000502'::uuid, true)$$,
  'P0001',
  'actor_not_approved',
  '50. Defect E: Suspended COMMUNITY_MODERATE manager is denied moderation'
);

reset role;
update public.profiles
   set account_status = 'APPROVED'
 where id = '00000000-0000-4000-9000-000000000203'::uuid;

set local role authenticated;
select extensions.is(
  (public.moderate_class_question('00000000-0000-4000-9000-000000000502'::uuid, true)).is_hidden,
  true,
  '51. Defect E: Approved COMMUNITY_MODERATE manager can moderate class question'
);

-- =========================================================================
-- Defect F: SELECTED_LEVELS validation & RLS scoping (6 assertions: 52-57)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000211', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000211","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.publish_school_broadcast('Empty Levels', 'Need levels', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], '{}'::text[])$$,
  'P0001',
  'target_levels_required',
  '52. Defect F: SELECTED_LEVELS rejects empty p_target_level_codes'
);

select extensions.throws_ok(
  $$select public.publish_school_broadcast('Invalid Level', 'Unknown code', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array['LYCEE'])$$,
  'P0001',
  'invalid_target_levels',
  '53. Defect F: SELECTED_LEVELS rejects non-canonical level code'
);

select extensions.throws_ok(
  $$select public.publish_school_broadcast('Leak Public', 'Public conflict', 'NORMAL', 'SELECTED_LEVELS', true, '{}'::uuid[], array['CP'])$$,
  'P0001',
  'targeted_broadcast_cannot_be_public',
  '54. Defect F: SELECTED_LEVELS cannot be marked is_public = true'
);

select extensions.is(
  (public.publish_school_broadcast('CP Only Notice', 'Bring art kit', 'NORMAL', 'SELECTED_LEVELS', false, '{}'::uuid[], array['cp'])).target_level_codes,
  array['CP']::text[],
  '55. Defect F: publish_school_broadcast persists normalized target_level_codes'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.school_broadcasts where title = 'CP Only Notice'),
  1,
  '56. Defect F: Parent of CP student sees SELECTED_LEVELS CP broadcast'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000209', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000209","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.school_broadcasts where title = 'CP Only Notice'),
  0,
  '57. Defect F: Parent of CM2-only student does NOT see SELECTED_LEVELS CP broadcast'
);

-- =========================================================================
-- Finding G: Manager delegation audit compatibility, Owner grant/revoke, denial & atomic rollback (15 assertions: 58-72)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000211', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000211","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_set_manager_capability('00000000-0000-4000-9000-000000000202'::uuid, 'BROADCAST_MANAGE', true, 'Admin cannot delegate manager')$$,
  'P0001',
  'owner_only_operation',
  '58. Finding G: Non-Owner ADMINISTRATIVE_PERSONNEL cannot grant manager capabilities'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000202","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.governance_set_manager_capability('00000000-0000-4000-9000-000000000202'::uuid, 'BROADCAST_MANAGE', true, 'Manager cannot self-grant')$$,
  'P0001',
  'owner_only_operation',
  '59. Finding G: MANAGER cannot self-grant capabilities'
);

-- Switch to verified Owner (wf_owner)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000201","role":"authenticated"}', true);

select pg_temp.set_int(
  'mgr_ver_before',
  (public.governance_get_account_detail('00000000-0000-4000-9000-000000000202'::uuid) -> 'account' ->> 'governanceVersion')::int
);

select extensions.ok(
  pg_temp.set_ref(
    'grant_audit_id',
    (public.governance_set_manager_capability(
      '00000000-0000-4000-9000-000000000202'::uuid,
      'BROADCAST_MANAGE',
      true,
      'Owner delegates broadcast management to Fall manager'
    ) ->> 'auditLogId')::uuid
  ) is not null,
  '60. Finding G: Owner grants BROADCAST_MANAGE cleanly via governance_set_manager_capability (no 23514)'
);

select extensions.is(
  (select active from public.manager_capability_grants where manager_user_id = '00000000-0000-4000-9000-000000000202'::uuid and capability = 'BROADCAST_MANAGE'),
  true,
  '61. Finding G: manager_capability_grants records active = true after Owner grant'
);

select extensions.is(
  (public.governance_get_account_detail('00000000-0000-4000-9000-000000000202'::uuid) -> 'account' ->> 'governanceVersion')::int,
  pg_temp.get_int('mgr_ver_before') + 1,
  '62. Finding G: target governance_version increments on grant'
);

select extensions.is(
  (
    select action || ':' || coalesce(capability, '') || ':' || array_to_string(previous_roles, ',') || '->' || array_to_string(resulting_roles, ',')
      from public.account_governance_audit_logs
     where id = pg_temp.get_ref('grant_audit_id')
  ),
  'GRANT_MANAGER_CAPABILITY:BROADCAST_MANAGE:MANAGER->MANAGER',
  '63. Finding G: audit log records structured GRANT_MANAGER_CAPABILITY, capability, and real text[] roles'
);

select extensions.ok(
  pg_temp.set_ref(
    'revoke_audit_id',
    (public.governance_set_manager_capability(
      '00000000-0000-4000-9000-000000000202'::uuid,
      'BROADCAST_MANAGE',
      false,
      'Owner revokes broadcast management after Fall campaign'
    ) ->> 'auditLogId')::uuid
  ) is not null,
  '64. Finding G: Owner revokes BROADCAST_MANAGE cleanly via governance_set_manager_capability'
);

select extensions.is(
  (select active from public.manager_capability_grants where manager_user_id = '00000000-0000-4000-9000-000000000202'::uuid and capability = 'BROADCAST_MANAGE'),
  false,
  '65. Finding G: manager_capability_grants records active = false after Owner revoke'
);

select extensions.is(
  (select action || ':' || coalesce(capability, '') from public.account_governance_audit_logs where id = pg_temp.get_ref('revoke_audit_id')),
  'REVOKE_MANAGER_CAPABILITY:BROADCAST_MANAGE',
  '66. Finding G: audit log records REVOKE_MANAGER_CAPABILITY and capability cleanly'
);

-- Atomic rollback & strict audit check constraint verification
select pg_temp.set_int(
  'mgr_ver_pre_rollback',
  (public.governance_get_account_detail('00000000-0000-4000-9000-000000000202'::uuid) -> 'account' ->> 'governanceVersion')::int
);
select pg_temp.set_int(
  'mgr_audit_cnt_pre_rollback',
  (select count(*)::int from public.account_governance_audit_logs where target_user_id = '00000000-0000-4000-9000-000000000202'::uuid)
);

-- Simulate failure during final audit insert step (after grant upsert and governance_version update)
reset role;
create or replace function pg_temp.fail_audit_sentinel()
returns trigger
language plpgsql
as $$
begin
  if new.reason = '__SIMULATE_AUDIT_FAILURE_ROLLBACK__' then
    raise exception 'simulated_audit_constraint_failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pgtap_fail_audit_sentinel
  before insert on public.account_governance_audit_logs
  for each row execute function pg_temp.fail_audit_sentinel();

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000201","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.governance_set_manager_capability('00000000-0000-4000-9000-000000000202'::uuid, 'BROADCAST_MANAGE', true, '__SIMULATE_AUDIT_FAILURE_ROLLBACK__')$$,
  '23514',
  'simulated_audit_constraint_failure',
  '67. Finding G: Mid-RPC audit failure aborts governance_set_manager_capability'
);

reset role;
drop trigger if exists pgtap_fail_audit_sentinel on public.account_governance_audit_logs;

-- Verify strict audit check constraints remain enforced (cannot insert bogus actions or un-paired capabilities)
select extensions.throws_ok(
  $$insert into public.account_governance_audit_logs (actor_user_id, actor_role, target_user_id, action, previous_status, resulting_status, reason) values ('00000000-0000-4000-9000-000000000201'::uuid, 'APP_ADMIN', '00000000-0000-4000-9000-000000000202'::uuid, 'UNLISTED_ACTION', 'APPROVED', 'APPROVED', 'Should reject bogus action')$$,
  '23514',
  null,
  '68. Finding G: Strict audit action check constraint still rejects non-allowlisted actions (23514)'
);

select extensions.throws_ok(
  $$insert into public.account_governance_audit_logs (actor_user_id, actor_role, target_user_id, action, capability, previous_status, resulting_status, reason) values ('00000000-0000-4000-9000-000000000201'::uuid, 'APP_ADMIN', '00000000-0000-4000-9000-000000000202'::uuid, 'GRANT_MANAGER_CAPABILITY', 'FULL_ACCESS', 'APPROVED', 'APPROVED', 'Should reject FULL_ACCESS capability')$$,
  '23514',
  null,
  '69. Finding G: Strict audit capability check constraint rejects non-delegable capability (23514)'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000201","role":"authenticated"}', true);
set local role authenticated;

select extensions.is(
  (select active from public.manager_capability_grants where manager_user_id = '00000000-0000-4000-9000-000000000202'::uuid and capability = 'BROADCAST_MANAGE'),
  false,
  '70. Finding G: Atomic rollback preserved manager_capability_grants.active = false after failed audit write'
);

select extensions.is(
  (public.governance_get_account_detail('00000000-0000-4000-9000-000000000202'::uuid) -> 'account' ->> 'governanceVersion')::int,
  pg_temp.get_int('mgr_ver_pre_rollback'),
  '71. Finding G: Atomic rollback preserved profiles.governance_version after failed audit write'
);

select extensions.is(
  (select count(*)::int from public.account_governance_audit_logs where target_user_id = '00000000-0000-4000-9000-000000000202'::uuid),
  pg_temp.get_int('mgr_audit_cnt_pre_rollback'),
  '72. Finding G: Atomic rollback left audit log count unchanged after failure'
);

-- =========================================================================
-- Finding H: Anonymous public reads & ordinary-role draft/private denial under RLS (9 assertions: 73-81)
-- =========================================================================
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select extensions.is(
  (select count(*)::int from public.directory_entries where id in ('00000000-0000-4000-9000-000000000601'::uuid, '00000000-0000-4000-9000-000000000602'::uuid)),
  1,
  '73. Finding H: anon reads published directory_entries only without 42501'
);

select extensions.is(
  (select count(*)::int from public.food_menu_weeks where id in ('00000000-0000-4000-9000-000000000611'::uuid, '00000000-0000-4000-9000-000000000612'::uuid)),
  1,
  '74. Finding H: anon reads PUBLISHED food_menu_weeks only without 42501'
);

select extensions.is(
  (select count(*)::int from public.food_menu_days where id in ('00000000-0000-4000-9000-000000000621'::uuid, '00000000-0000-4000-9000-000000000622'::uuid)),
  1,
  '75. Finding H: anon reads food_menu_days for PUBLISHED week only without 42501'
);

select extensions.is(
  (select count(*)::int from public.school_public_content where slug in ('pgtap-public-notice', 'pgtap-draft-notice')),
  1,
  '76. Finding H: anon reads published school_public_content only without 42501'
);

select extensions.throws_ok(
  $$select count(*) from public.students$$,
  '42501',
  null,
  '77. Finding H: anon direct SELECT on private students fails with 42501'
);

-- Ordinary authenticated PARENT (no public-content management role) sees published only, zero drafts
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);
set local role authenticated;

select extensions.is(
  (select count(*)::int from public.directory_entries where id in ('00000000-0000-4000-9000-000000000601'::uuid, '00000000-0000-4000-9000-000000000602'::uuid)),
  1,
  '78. Finding H: ordinary PARENT sees published directory_entries only, zero drafts'
);

select extensions.is(
  (select count(*)::int from public.food_menu_weeks where id in ('00000000-0000-4000-9000-000000000611'::uuid, '00000000-0000-4000-9000-000000000612'::uuid)),
  1,
  '79. Finding H: ordinary PARENT sees PUBLISHED food_menu_weeks only, zero drafts'
);

select extensions.is(
  (select count(*)::int from public.school_public_content where slug in ('pgtap-public-notice', 'pgtap-draft-notice')),
  1,
  '80. Finding H: ordinary PARENT sees published school_public_content only, zero drafts'
);

-- Authorized ADMINISTRATIVE_PERSONNEL sees both published & draft public-content rows
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000211', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000211","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.directory_entries where id in ('00000000-0000-4000-9000-000000000601'::uuid, '00000000-0000-4000-9000-000000000602'::uuid))
  + (select count(*)::int from public.food_menu_weeks where id in ('00000000-0000-4000-9000-000000000611'::uuid, '00000000-0000-4000-9000-000000000612'::uuid))
  + (select count(*)::int from public.school_public_content where slug in ('pgtap-public-notice', 'pgtap-draft-notice')),
  6,
  '81. Finding H: authorized ADMINISTRATIVE_PERSONNEL sees both published and draft public-content rows'
);

-- =========================================================================
-- Parent Notes: Cross-family RLS isolation + 11/day quota / Tunis window (2 assertions: 82-83)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000207', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000207","role":"authenticated"}', true);

select extensions.is(
  (select count(*)::int from public.parent_notes where student_id in ('00000000-0000-4000-9000-000000000401'::uuid, '00000000-0000-4000-9000-000000000404'::uuid)),
  11,
  '82. Parent A sees own 11 notes and zero notes belonging to CM2 family'
);

select extensions.is(
  pg_temp.try_send_parent_note('00000000-0000-4000-9000-000000000401'::uuid, 'OTHER', 'Note 12 test'),
  case
    when ((now() at time zone 'Africa/Tunis')::time >= time '08:00:00' and (now() at time zone 'Africa/Tunis')::time < time '18:00:00')
    then 'parent_notes_daily_quota_exceeded'
    else 'parent_notes_outside_window'
  end,
  '83. Parent Note enforces 11/day quota during open window and Tunis 08:00-18:00 window outside hours'
);

rollback;
