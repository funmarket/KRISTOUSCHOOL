-- G6 contract: early departure request, review, pre-cycle & cycle-coupled completion,
-- board projections, G5-B live-authority replay gate, and dblink concurrency races.
create extension if not exists dblink;
begin;
select extensions.plan(79);

select extensions.ok(has_function_privilege('authenticated','public.get_pickup_early_departures(uuid)','EXECUTE'),'authenticated can call early departures read RPC');
select extensions.ok(has_function_privilege('authenticated','public.request_early_departure(uuid,uuid,text,uuid,timestamptz)','EXECUTE'),'authenticated can call request_early_departure RPC');
select extensions.ok(has_function_privilege('authenticated','public.review_early_departure(uuid,text,uuid,integer,text)','EXECUTE'),'authenticated can call review_early_departure RPC');
select extensions.ok(has_function_privilege('authenticated','public.complete_early_departure_release(uuid,uuid,uuid,integer,boolean,text)','EXECUTE'),'authenticated can call complete_early_departure_release RPC');
select extensions.ok(not has_function_privilege('anon','public.get_pickup_early_departures(uuid)','EXECUTE'),'anon cannot read early departures');
select extensions.ok(not has_function_privilege('anon','public.request_early_departure(uuid,uuid,text,uuid,timestamptz)','EXECUTE'),'anon cannot request early departure');
select extensions.ok(not has_function_privilege('anon','public.review_early_departure(uuid,text,uuid,integer,text)','EXECUTE'),'anon cannot review early departure');
select extensions.ok(not has_function_privilege('anon','public.complete_early_departure_release(uuid,uuid,uuid,integer,boolean,text)','EXECUTE'),'anon cannot complete early departure');
select extensions.ok(not has_function_privilege('authenticated','public.pickup_touch_early_departure_request()','EXECUTE'),'early departure trigger helper is not directly executable');
select extensions.ok(not has_table_privilege('authenticated','public.early_departure_requests','SELECT,INSERT,UPDATE,DELETE'),'authenticated cannot read or write early_departure_requests directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_cycles','INSERT,UPDATE,DELETE'),'authenticated cannot write pickup_cycles directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_events','INSERT,UPDATE,DELETE'),'authenticated cannot write pickup_events directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_requests','INSERT,UPDATE,DELETE'),'authenticated cannot write pickup_requests directly');
select extensions.ok(not has_table_privilege('authenticated','public.notification_outbox','INSERT,UPDATE,DELETE'),'authenticated cannot write notification_outbox directly');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-9000-000000020101','authenticated','authenticated','g6-admin@example.invalid','',now(),'{}','{"username":"g6_admin","full_name":"G6 Admin","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000020102','authenticated','authenticated','g6-admin-two@example.invalid','',now(),'{}','{"username":"g6_admin_two","full_name":"G6 Admin Two","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000020103','authenticated','authenticated','g6-manager@example.invalid','',now(),'{}','{"username":"g6_manager","full_name":"G6 Manager","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000020104','authenticated','authenticated','g6-office@example.invalid','',now(),'{}','{"username":"g6_office","full_name":"G6 Office","requested_role":"ADMINISTRATIVE_PERSONNEL"}',now(),now()),
 ('00000000-0000-4000-9000-000000020105','authenticated','authenticated','g6-teacher@example.invalid','',now(),'{}','{"username":"g6_teacher","full_name":"G6 Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000020106','authenticated','authenticated','g6-teacher-other@example.invalid','',now(),'{}','{"username":"g6_teacher_other","full_name":"G6 Other Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000020107','authenticated','authenticated','g6-school-staff@example.invalid','',now(),'{}','{"username":"g6_school_staff","full_name":"G6 School Staff","requested_role":"SCHOOL_STAFF"}',now(),now()),
 ('00000000-0000-4000-9000-000000020108','authenticated','authenticated','g6-parent@example.invalid','',now(),'{}','{"username":"g6_parent","full_name":"G6 Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000020109','authenticated','authenticated','g6-unlinked@example.invalid','',now(),'{}','{"username":"g6_unlinked","full_name":"G6 Unlinked Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000020110','authenticated','authenticated','g6-student@example.invalid','',now(),'{}','{"username":"g6_student","full_name":"G6 Student","requested_role":"STUDENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000020111','authenticated','authenticated','g6-pending@example.invalid','',now(),'{}','{"username":"g6_pending","full_name":"G6 Pending","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000020112','authenticated','authenticated','g6-suspended@example.invalid','',now(),'{}','{"username":"g6_suspended","full_name":"G6 Suspended","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000020113','authenticated','authenticated','g6-no-role@example.invalid','',now(),'{}','{"username":"g6_no_role","full_name":"G6 No Role"}',now(),now());
update public.profiles set account_status='APPROVED' where id between '00000000-0000-4000-9000-000000020101'::uuid and '00000000-0000-4000-9000-000000020110'::uuid;
update public.profiles set account_status='PENDING' where id='00000000-0000-4000-9000-000000020111';
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000020112';
update public.profiles set account_status='APPROVED' where id='00000000-0000-4000-9000-000000020113';
delete from public.role_assignments where user_id between '00000000-0000-4000-9000-000000020101'::uuid and '00000000-0000-4000-9000-000000020112'::uuid;
insert into public.role_assignments(user_id,role,active) values
 ('00000000-0000-4000-9000-000000020101','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000020102','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000020103','MANAGER',true),
 ('00000000-0000-4000-9000-000000020104','ADMINISTRATIVE_PERSONNEL',true),
 ('00000000-0000-4000-9000-000000020105','TEACHER',true),
 ('00000000-0000-4000-9000-000000020106','TEACHER',true),
 ('00000000-0000-4000-9000-000000020107','SCHOOL_STAFF',true),
 ('00000000-0000-4000-9000-000000020108','PARENT',true),
 ('00000000-0000-4000-9000-000000020109','PARENT',true),
 ('00000000-0000-4000-9000-000000020110','STUDENT',true),
 ('00000000-0000-4000-9000-000000020111','MANAGER',true),
 ('00000000-0000-4000-9000-000000020112','MANAGER',true);

insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by)
select '00000000-0000-4000-9000-000000020120',id,'CP','Pickup G6 Test Class',32,'00000000-0000-4000-9000-000000020101'
  from public.academic_years where code='2026-2027';
insert into public.students(id,student_code,full_name,birth_date,status,created_by)
select ('00000000-0000-4000-9000-'||lpad((20130+n)::text,12,'0'))::uuid,
       'PICKUP-G6-'||n,'G6 Test Pupil '||n,'2018-01-01','ACTIVE','00000000-0000-4000-9000-000000020101'
  from generate_series(0,9) as n;
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select ('00000000-0000-4000-9000-'||lpad((20150+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((20130+n)::text,12,'0'))::uuid,
       '00000000-0000-4000-9000-000000020120',y.id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date,
       '00000000-0000-4000-9000-000000020101'
  from generate_series(0,9) as n cross join public.academic_years y where y.code='2026-2027';
insert into public.teacher_class_assignments(teacher_user_id,class_id,is_homeroom,active,assigned_by)
values('00000000-0000-4000-9000-000000020105','00000000-0000-4000-9000-000000020120',true,true,'00000000-0000-4000-9000-000000020101');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
select '00000000-0000-4000-9000-000000020108',
       ('00000000-0000-4000-9000-'||lpad((20130+n)::text,12,'0'))::uuid,
       'Parent',true,'00000000-0000-4000-9000-000000020101'
  from generate_series(0,9) as n;
insert into public.dismissal_policies(id,class_id,weekday,opens_at,closes_at,effective_from,revision,active,created_by)
values('00000000-0000-4000-9000-000000020170','00000000-0000-4000-9000-000000020120',
       extract(dow from (now() at time zone 'Africa/Tunis')::date)::smallint,'00:00','23:59:59',
       (now() at time zone 'Africa/Tunis')::date,1,true,'00000000-0000-4000-9000-000000020101');
insert into public.attendance_registers(id,academic_year_id,class_id,teacher_user_id,school_date,status,version,submitted_at,submitted_by)
select '00000000-0000-4000-9000-000000020171',id,'00000000-0000-4000-9000-000000020120',
       '00000000-0000-4000-9000-000000020105',(now() at time zone 'Africa/Tunis')::date,
       'SUBMITTED',1,now(),'00000000-0000-4000-9000-000000020105'
  from public.academic_years where code='2026-2027';
insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by)
select '00000000-0000-4000-9000-000000020171',
       ('00000000-0000-4000-9000-'||lpad((20130+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((20150+n)::text,12,'0'))::uuid,
       case when n=9 then 'ABSENT' else 'PRESENT' end,
       'private g6 attendance note','00000000-0000-4000-9000-000000020105'
  from generate_series(0,9) as n;
insert into public.authorized_pickup_persons(id,student_id,display_name,relationship_label,verification_method,
    verification_reference,verified_by,verified_at,valid_from,valid_until)
select ('00000000-0000-4000-9000-'||lpad((20180+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((20130+n)::text,12,'0'))::uuid,
       'G6 Collector '||n,'Parent','ID checked','G6-REF-'||n,
       '00000000-0000-4000-9000-000000020101',now(),
       (now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date
  from generate_series(0,9) as n;

create function public.pickup_g6_test_cycle_id(p_student_id uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select c.cycle_id from public.pickup_cycles c where c.student_id=p_student_id
$$;
create function public.pickup_g6_test_ed_id(p_student_id uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select ed.id from public.early_departure_requests ed
   where ed.student_id=p_student_id order by ed.created_at desc, ed.id desc limit 1
$$;
revoke all on function public.pickup_g6_test_cycle_id(uuid) from public,anon;
revoke all on function public.pickup_g6_test_ed_id(uuid) from public,anon;
grant execute on function public.pickup_g6_test_cycle_id(uuid) to authenticated;
grant execute on function public.pickup_g6_test_ed_id(uuid) to authenticated;

-- 1. Pre-cycle request, idempotent replay, scoped read visibility, review, and pre-cycle completion (pupil 0).
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.request_early_departure(
  '00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020180',
  'Pediatric appointment at 11:30','00000000-0000-4000-9000-000000020300',now()+interval '1 hour')->>'code'),
  'early_departure_requested','verified parent can request pre-cycle early departure');
select extensions.is((public.request_early_departure(
  '00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020180',
  'Pediatric appointment at 11:30','00000000-0000-4000-9000-000000020300',null)->>'replayed'),
  'true','replaying request_early_departure with same request_id and equivalent core payload returns replayed=true');
select extensions.throws_ok($$select public.request_early_departure(
  '00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020180',
  'Changed medical reason','00000000-0000-4000-9000-000000020300',null)$$,
  'P0001','idempotency_conflict','request_early_departure rejects changed payload on same request_id');
select extensions.is((public.request_early_departure(
  '00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020180',
  'Second open request attempt','00000000-0000-4000-9000-000000020301',null)->>'code'),
  'early_departure_already_open','duplicate open early departure request for same pupil and date is rejected');
select extensions.is((select count(*)::integer from jsonb_array_elements(public.get_pickup_early_departures()) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  1,'parent sees own pre-cycle early departure via get_pickup_early_departures');
select extensions.is((select (x->>'canReview')::boolean from jsonb_array_elements(public.get_pickup_early_departures()) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  false,'parent read never grants canReview');
reset role;
select extensions.is((select count(*)::integer from public.pickup_events where student_id='00000000-0000-4000-9000-000000020130' and action='EARLY_DEPARTURE_REQUESTED'),1,'exactly one EARLY_DEPARTURE_REQUESTED audit event is recorded');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130') and event_type='pickup.early_departure_requested'),1,'exactly one outbox notification is enqueued for request');

-- Read scope checks across Teacher, unassigned Teacher, School Staff, Student, and unapproved.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020105',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020105","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select (x->>'canReview')::boolean from jsonb_array_elements(public.get_pickup_early_departures('00000000-0000-4000-9000-000000020120')) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  false,'assigned TEACHER sees class early departure without review capability');
select extensions.throws_ok($$select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'APPROVED','00000000-0000-4000-9000-000000020302',1,null)$$,
  'P0001','pickup_release_authority_required','TEACHER cannot review early departures');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020106',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020106","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_early_departures('00000000-0000-4000-9000-000000020120')$$,'P0001','insufficient_pickup_scope','unassigned TEACHER cannot query another class early departures');
select extensions.is((select count(*)::integer from jsonb_array_elements(public.get_pickup_early_departures()) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  0,'unassigned TEACHER sees zero rows for unassigned class');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020107',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020107","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_early_departures()$$,'P0001','insufficient_pickup_scope','SCHOOL_STAFF cannot read early departures');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020110',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020110","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_early_departures()$$,'P0001','insufficient_pickup_scope','STUDENT cannot read early departures');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020111',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020111","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_early_departures()$$,'P0001','insufficient_pickup_scope','PENDING account cannot read early departures');
reset role;

-- MANAGER reviews (approves) pupil 0, ADMINISTRATIVE_PERSONNEL tests attestation/collector failures then completes pre-cycle.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020103","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select (x->>'canReview')::boolean from jsonb_array_elements(public.get_pickup_early_departures('00000000-0000-4000-9000-000000020120')) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  true,'MANAGER sees canReview=true for PENDING request');
select extensions.is((public.review_early_departure(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'APPROVED',
  '00000000-0000-4000-9000-000000020303',1,'Parent verified at gate')->>'code'),
  'early_departure_approved','MANAGER approves pre-cycle early departure');
select extensions.is((public.review_early_departure(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'APPROVED',
  '00000000-0000-4000-9000-000000020303',1,'Parent verified at gate')->>'replayed'),
  'true','review_early_departure replays with same request_id and payload');
select extensions.is((select (x->>'canComplete')::boolean from jsonb_array_elements(public.get_pickup_early_departures('00000000-0000-4000-9000-000000020120')) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  true,'APPROVED early departure with valid collector and attendance exposes canComplete=true');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020104',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020104","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'00000000-0000-4000-9000-000000020180',
  '00000000-0000-4000-9000-000000020304',2,false,null)$$,
  'P0001','attestation_required','complete_early_departure_release requires physical attestation');
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'00000000-0000-4000-9000-000000020181',
  '00000000-0000-4000-9000-000000020305',2,true,null)$$,
  'P0001','collector_invalid','complete_early_departure_release rejects wrong collector');
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'00000000-0000-4000-9000-000000020180',
  '00000000-0000-4000-9000-000000020306',2,true,'Checked ID at front office')->>'code'),
  'early_departure_completed','ADMINISTRATIVE_PERSONNEL completes pre-cycle early departure');
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020130'),'00000000-0000-4000-9000-000000020180',
  '00000000-0000-4000-9000-000000020306',2,true,'Checked ID at front office')->>'replayed'),
  'true','replaying complete_early_departure_release returns replayed=true');
select extensions.is((select x->>'handoffNotes' from jsonb_array_elements(public.get_pickup_early_departures('00000000-0000-4000-9000-000000020120')) x where x->>'studentId'='00000000-0000-4000-9000-000000020130'),
  'Checked ID at front office','staff projection includes internal handoffNotes');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select extensions.ok(not ((select x from jsonb_array_elements(public.get_pickup_early_departures()) x where x->>'studentId'='00000000-0000-4000-9000-000000020130') ? 'handoffNotes'),
  'parent projection omits internal handoffNotes');
select extensions.is((public.request_early_departure(
  '00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020180',
  'Post-completion attempt','00000000-0000-4000-9000-000000020307',null)->>'code'),
  'already_released','completed pre-cycle early departure blocks new same-day request');
reset role;

-- 2. Rejection path, re-request after REJECTED, and G5-B live-authority gate on replay (pupil 1).
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select public.request_early_departure(
  '00000000-0000-4000-9000-000000020131','00000000-0000-4000-9000-000000020181',
  'Family trip','00000000-0000-4000-9000-000000020310',null);
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020103","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.review_early_departure(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'REJECTED',
  '00000000-0000-4000-9000-000000020311',1,null)$$,
  'P0001','invalid_pickup_request','REJECTED decision requires a review reason');
select extensions.is((public.review_early_departure(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'REJECTED',
  '00000000-0000-4000-9000-000000020312',1,'Exam in progress until noon')->>'code'),
  'early_departure_rejected','MANAGER can reject early departure with reason');
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'00000000-0000-4000-9000-000000020181',
  '00000000-0000-4000-9000-000000020313',2,true,null)->>'code'),
  'early_departure_terminal','REJECTED early departure cannot be completed');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.request_early_departure(
  '00000000-0000-4000-9000-000000020131','00000000-0000-4000-9000-000000020181',
  'Urgent dental emergency after exam','00000000-0000-4000-9000-000000020314',null)->>'code'),
  'early_departure_requested','parent can submit a new request after a REJECTED request');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020103","role":"authenticated"}',true);
set local role authenticated;
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'APPROVED','00000000-0000-4000-9000-000000020315',1,null);
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'00000000-0000-4000-9000-000000020181',
  '00000000-0000-4000-9000-000000020316',2,true,'Manager verified ID')->>'code'),
  'early_departure_completed','MANAGER completes early departure before authority check');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select public.revoke_pickup_release_authority('00000000-0000-4000-9000-000000020103','G6 replay authority check');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020103","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020131'),'00000000-0000-4000-9000-000000020181',
  '00000000-0000-4000-9000-000000020316',2,true,'Manager verified ID')$$,
  'P0001','pickup_release_authority_revoked','revoked Manager is denied replay on complete_early_departure_release');
select extensions.is((public.get_pickup_operation_receipt('00000000-0000-4000-9000-000000020316')->>'status'),
  'COMPLETED','historical early departure receipt remains readable after pickup-specific revocation');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select public.reinstate_pickup_release_authority('00000000-0000-4000-9000-000000020103','G6 reinstate after check');
reset role;

-- 3. PENDING completion conflict, collector/attendance/closure fail-closed gates, and parent-request deny matrix (pupils 2, 3, 4, 9).
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select public.request_early_departure('00000000-0000-4000-9000-000000020132','00000000-0000-4000-9000-000000020182','Doctor checkup','00000000-0000-4000-9000-000000020320',null);
select public.request_early_departure('00000000-0000-4000-9000-000000020133','00000000-0000-4000-9000-000000020183','Passport appointment','00000000-0000-4000-9000-000000020321',null);
select extensions.throws_ok($$select public.request_early_departure(
  '00000000-0000-4000-9000-000000020139','00000000-0000-4000-9000-000000020189',
  'Absent pupil request','00000000-0000-4000-9000-000000020322',null)$$,
  'P0001','attendance_absent','parent cannot request early departure for ABSENT pupil');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020109',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020109","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.request_early_departure(
  '00000000-0000-4000-9000-000000020134','00000000-0000-4000-9000-000000020184',
  'Unlinked parent attempt','00000000-0000-4000-9000-000000020323',null)$$,
  'P0001','pickup_parent_child_link_required','unlinked parent cannot request early departure');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020132'),'00000000-0000-4000-9000-000000020182',
  '00000000-0000-4000-9000-000000020324',1,true,null)->>'code'),
  'early_departure_not_approved','PENDING early departure cannot be completed before approval');
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020133'),'APPROVED','00000000-0000-4000-9000-000000020325',1,null);
select public.revoke_authorized_pickup_person('00000000-0000-4000-9000-000000020183','collector revoked after approval');
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020133'),'00000000-0000-4000-9000-000000020183',
  '00000000-0000-4000-9000-000000020326',2,true,null)$$,
  'P0001','collector_invalid','collector revoked after early departure approval fails completion');
reset role;
update public.authorized_pickup_persons set revoked_at=null,revoked_by=null,revocation_reason=null where id='00000000-0000-4000-9000-000000020183';
update public.attendance_entries set mark='ABSENT' where register_id='00000000-0000-4000-9000-000000020171' and student_id='00000000-0000-4000-9000-000000020133';
set local role authenticated;
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020133'),'00000000-0000-4000-9000-000000020183',
  '00000000-0000-4000-9000-000000020327',2,true,null)$$,
  'P0001','attendance_ineligible','attendance corrected to ABSENT after approval blocks completion');
reset role;
update public.attendance_entries set mark='PRESENT' where register_id='00000000-0000-4000-9000-000000020171' and student_id='00000000-0000-4000-9000-000000020133';
insert into public.school_calendar_events(id,class_id,title,category,start_date,end_date,audience_mode,created_by)
values('00000000-0000-4000-9000-000000020179',null,'G6 closure check','CLOSURE',(now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date,'WHOLE_SCHOOL','00000000-0000-4000-9000-000000020101');
set local role authenticated;
select extensions.throws_ok($$select public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020133'),'00000000-0000-4000-9000-000000020183',
  '00000000-0000-4000-9000-000000020328',2,true,null)$$,
  'P0001','schedule_unavailable','active closure blocks early departure completion');
reset role;
delete from public.school_calendar_events where id='00000000-0000-4000-9000-000000020179';

-- 4. Provisioning skips already-COMPLETED pupils (0 & 1) and creates cycles for remaining pupils (5..8).
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select public.provision_pickup_cycles();
reset role;
select extensions.is((select count(*)::integer from public.pickup_cycles where student_id in ('00000000-0000-4000-9000-000000020130','00000000-0000-4000-9000-000000020131')),0,'provision_pickup_cycles skips students with COMPLETED early departures');
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000020135'),'WAITING','provision_pickup_cycles creates WAITING cycle for uncompleted G6 pupil');

-- 5. Cycle-coupled completion on WAITING cycle (pupil 5) and PARENT_ARRIVED cycle (pupil 6) + board projection checks.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.parent_arrived(public.pickup_g6_test_cycle_id('00000000-0000-4000-9000-000000020136'),'00000000-0000-4000-9000-000000020186','00000000-0000-4000-9000-000000020330',1)->>'code'),
  'parent_arrived','parent announces arrival for pupil 6');
select extensions.is((public.request_early_departure('00000000-0000-4000-9000-000000020135','00000000-0000-4000-9000-000000020185','Orthodontist visit','00000000-0000-4000-9000-000000020331',null)->>'code'),
  'early_departure_requested','parent requests early departure on WAITING cycle');
select extensions.is((public.request_early_departure('00000000-0000-4000-9000-000000020136','00000000-0000-4000-9000-000000020186','Urgent family pickup','00000000-0000-4000-9000-000000020332',null)->>'code'),
  'early_departure_requested','parent requests early departure on PARENT_ARRIVED cycle');
select extensions.is((select early_departure->>'status' from public.get_pickup_parent_board() where student_id='00000000-0000-4000-9000-000000020135'),
  'PENDING','parent board exposes early_departure JSON column');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020135'),'APPROVED','00000000-0000-4000-9000-000000020333',1,null);
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020136'),'APPROVED','00000000-0000-4000-9000-000000020334',1,null);
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020135'),'00000000-0000-4000-9000-000000020185',
  '00000000-0000-4000-9000-000000020335',2,true,'Released from nurse office')->>'cycleState'),
  'RELEASED','completing early departure supersedes WAITING cycle to RELEASED');
select extensions.is((public.complete_early_departure_release(
  public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020136'),'00000000-0000-4000-9000-000000020186',
  '00000000-0000-4000-9000-000000020336',2,true,'Released after arrival')->>'cycleState'),
  'RELEASED','completing early departure supersedes PARENT_ARRIVED cycle to RELEASED while preserving arrival evidence');
select extensions.is((select early_departure->>'handoffNotes' from public.get_pickup_staff_board('00000000-0000-4000-9000-000000020120') where student_id='00000000-0000-4000-9000-000000020135'),
  'Released from nurse office','staff board exposes completed early_departure handoffNotes');
reset role;
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000020135'),'RELEASED','pupil 5 cycle is terminal RELEASED');
select extensions.is((select version from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000020136'),3,'pupil 6 cycle incremented cleanly from PARENT_ARRIVED');
select extensions.is((select count(*)::integer from public.pickup_events where student_id='00000000-0000-4000-9000-000000020136' and action='EARLY_DEPARTURE_COMPLETED'),1,'pupil 6 recorded EARLY_DEPARTURE_COMPLETED audit event');

-- 6. Prepare approved early departures for real PostgreSQL multi-session dblink concurrency races (pupils 4, 7, 8).
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020108","role":"authenticated"}',true);
set local role authenticated;
select public.request_early_departure('00000000-0000-4000-9000-000000020134','00000000-0000-4000-9000-000000020184','Early race auth','00000000-0000-4000-9000-000000020340',null);
select public.request_early_departure('00000000-0000-4000-9000-000000020137','00000000-0000-4000-9000-000000020187','Competing complete','00000000-0000-4000-9000-000000020341',null);
select public.parent_arrived(public.pickup_g6_test_cycle_id('00000000-0000-4000-9000-000000020138'),'00000000-0000-4000-9000-000000020188','00000000-0000-4000-9000-000000020342',1);
select public.request_early_departure('00000000-0000-4000-9000-000000020138','00000000-0000-4000-9000-000000020188','Race vs release_pupil','00000000-0000-4000-9000-000000020343',null);
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000020101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}',true);
set local role authenticated;
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020134'),'APPROVED','00000000-0000-4000-9000-000000020344',1,null);
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020137'),'APPROVED','00000000-0000-4000-9000-000000020345',1,null);
select public.review_early_departure(public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020138'),'APPROVED','00000000-0000-4000-9000-000000020346',1,null);
reset role;

create function public.pickup_g6_test_capture_complete(
  p_ed_id uuid,p_collector_id uuid,p_request_id uuid,p_expected_version integer,
  p_in_person_verified boolean,p_handoff_notes text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_message text;
begin
  return public.complete_early_departure_release(p_ed_id,p_collector_id,p_request_id,p_expected_version,p_in_person_verified,p_handoff_notes);
exception when others then
  get stacked diagnostics v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_message);
end;
$$;
create function public.pickup_g6_test_capture_release(
  p_cycle_id uuid,p_collector_id uuid,p_request_id uuid,p_expected_version integer,
  p_in_person_verified boolean,p_handoff_notes text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_message text;
begin
  return public.release_pupil(p_cycle_id,p_collector_id,p_request_id,p_expected_version,p_in_person_verified,p_handoff_notes);
exception when others then
  get stacked diagnostics v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_message);
end;
$$;
revoke all on function public.pickup_g6_test_capture_complete(uuid,uuid,uuid,integer,boolean,text) from public,anon;
revoke all on function public.pickup_g6_test_capture_release(uuid,uuid,uuid,integer,boolean,text) from public,anon;
grant execute on function public.pickup_g6_test_capture_complete(uuid,uuid,uuid,integer,boolean,text) to authenticated;
grant execute on function public.pickup_g6_test_capture_release(uuid,uuid,uuid,integer,boolean,text) to authenticated;
create temp table pickup_g6_race_results(case_name text,session_name text,result jsonb) on commit preserve rows;
create temp table pickup_g6_session_pids(pid integer) on commit preserve rows;
create temp table pickup_g6_barriers(barrier_name text primary key,observed boolean) on commit preserve rows;
commit;

-- Race A: two authorized staff compete on complete_early_departure_release for pupil 7.
do $$
declare
  v_conn text; v_ed uuid; v_collector uuid; v_waiters integer; v_result jsonb;
  v_blocker_pid integer; v_a_pid integer; v_b_pid integer; i integer;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g6_obs',v_conn);
  perform dblink_connect('g6_blocker',v_conn);
  perform dblink_connect('g6_staff_a',v_conn);
  perform dblink_connect('g6_staff_b',v_conn);
  select pid into v_blocker_pid from dblink('g6_blocker','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_blocker_pid);
  select pid into v_a_pid from dblink('g6_staff_a','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_a_pid);
  select pid into v_b_pid from dblink('g6_staff_b','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_b_pid);
  perform dblink_exec('g6_staff_a','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020101''');
  perform dblink_exec('g6_staff_a','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}''');
  perform dblink_exec('g6_staff_a','set role authenticated');
  perform dblink_exec('g6_staff_b','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020102''');
  perform dblink_exec('g6_staff_b','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020102","role":"authenticated"}''');
  perform dblink_exec('g6_staff_b','set role authenticated');
  v_ed:=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020137');
  v_collector:='00000000-0000-4000-9000-000000020187';
  perform dblink_exec('g6_blocker','begin');
  perform 1 from dblink('g6_blocker',format('select id from public.early_departure_requests where id=%L::uuid for update',v_ed)) as t(id uuid);
  if dblink_send_query('g6_staff_a',format('select public.pickup_g6_test_capture_complete(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_ed,v_collector,'00000000-0000-4000-9000-000000020350'))<>1
     or dblink_send_query('g6_staff_b',format('select public.pickup_g6_test_capture_complete(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_ed,v_collector,'00000000-0000-4000-9000-000000020351'))<>1 then
    raise exception 'g6_dual_complete_queries_not_accepted';
  end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g6_obs',format($obs$
        select count(*)::integer from pg_stat_activity a
         where a.pid in (%s,%s) and %s = any(pg_blocking_pids(a.pid))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_a_pid, v_b_pid, v_blocker_pid)) as t(blocked_count integer);
    exit when v_waiters=2;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>2 then raise exception 'g6_dual_complete_not_both_blocked'; end if;
  insert into pickup_g6_barriers values('two_staff_early_complete_lock_wait',true);
  perform dblink_exec('g6_blocker','commit');
  select result into v_result from dblink_get_result('g6_staff_a') as t(result jsonb); insert into pickup_g6_race_results values('two_staff_complete','a',v_result);
  select result into v_result from dblink_get_result('g6_staff_b') as t(result jsonb); insert into pickup_g6_race_results values('two_staff_complete','b',v_result);
  perform result from dblink_get_result('g6_staff_a') as t(result jsonb);
  perform result from dblink_get_result('g6_staff_b') as t(result jsonb);
  perform dblink_disconnect('g6_staff_a'); perform dblink_disconnect('g6_staff_b'); perform dblink_disconnect('g6_blocker'); perform dblink_disconnect('g6_obs');
end;
$$;
select extensions.ok((select count(distinct pid)>=3 from pickup_g6_session_pids),'early departure race used distinct PostgreSQL sessions');
select extensions.ok((select observed from pickup_g6_barriers where barrier_name='two_staff_early_complete_lock_wait'),'observer verified both early completion sessions queued on row lock');
select extensions.is((select count(*)::integer from pickup_g6_race_results where case_name='two_staff_complete' and result->>'code'='early_departure_completed'),1,'exactly one simultaneous early completion wins');
select extensions.is((select count(*)::integer from pickup_g6_race_results where case_name='two_staff_complete' and result->>'code' in ('already_released','version_conflict')),1,'losing early completion gets already_released/version_conflict');
select extensions.is((select count(*)::integer from public.pickup_events where student_id='00000000-0000-4000-9000-000000020137' and action='EARLY_DEPARTURE_COMPLETED'),1,'competing early completions write exactly one completion event');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020137') and event_type='pickup.early_departure_completed'),1,'competing early completions enqueue exactly one outbox row');

-- Race B: complete_early_departure_release vs release_pupil on same PARENT_ARRIVED cycle (pupil 8).
do $$
declare
  v_conn text; v_ed uuid; v_cycle uuid; v_collector uuid; v_waiters integer; v_result jsonb;
  v_blocker_pid integer; v_ed_pid integer; v_rel_pid integer; i integer;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g6_obs',v_conn);
  perform dblink_connect('g6_blocker',v_conn);
  perform dblink_connect('g6_ed_actor',v_conn);
  perform dblink_connect('g6_rel_actor',v_conn);
  select pid into v_blocker_pid from dblink('g6_blocker','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_blocker_pid);
  select pid into v_ed_pid from dblink('g6_ed_actor','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_ed_pid);
  select pid into v_rel_pid from dblink('g6_rel_actor','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_rel_pid);
  perform dblink_exec('g6_ed_actor','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020101''');
  perform dblink_exec('g6_ed_actor','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}''');
  perform dblink_exec('g6_ed_actor','set role authenticated');
  perform dblink_exec('g6_rel_actor','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020102''');
  perform dblink_exec('g6_rel_actor','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020102","role":"authenticated"}''');
  perform dblink_exec('g6_rel_actor','set role authenticated');
  v_ed:=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020138');
  v_cycle:=public.pickup_g6_test_cycle_id('00000000-0000-4000-9000-000000020138');
  v_collector:='00000000-0000-4000-9000-000000020188';
  perform dblink_exec('g6_blocker','begin');
  perform 1 from dblink('g6_blocker',format('select cycle_id from public.pickup_cycles where cycle_id=%L::uuid for update',v_cycle)) as t(cycle_id uuid);
  if dblink_send_query('g6_ed_actor',format('select public.pickup_g6_test_capture_complete(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_ed,v_collector,'00000000-0000-4000-9000-000000020352'))<>1
     or dblink_send_query('g6_rel_actor',format('select public.pickup_g6_test_capture_release(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_cycle,v_collector,'00000000-0000-4000-9000-000000020353'))<>1 then
    raise exception 'g6_ed_vs_release_queries_not_accepted';
  end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g6_obs',format($obs$
        select count(*)::integer from pg_stat_activity a
         where a.pid in (%s,%s) and %s = any(pg_blocking_pids(a.pid))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_ed_pid, v_rel_pid, v_blocker_pid)) as t(blocked_count integer);
    exit when v_waiters=2;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>2 then raise exception 'g6_ed_vs_release_not_both_blocked'; end if;
  insert into pickup_g6_barriers values('early_complete_vs_release_lock_wait',true);
  perform dblink_exec('g6_blocker','commit');
  select result into v_result from dblink_get_result('g6_ed_actor') as t(result jsonb); insert into pickup_g6_race_results values('early_vs_release','early',v_result);
  select result into v_result from dblink_get_result('g6_rel_actor') as t(result jsonb); insert into pickup_g6_race_results values('early_vs_release','release',v_result);
  perform result from dblink_get_result('g6_ed_actor') as t(result jsonb);
  perform result from dblink_get_result('g6_rel_actor') as t(result jsonb);
  perform dblink_disconnect('g6_ed_actor'); perform dblink_disconnect('g6_rel_actor'); perform dblink_disconnect('g6_blocker'); perform dblink_disconnect('g6_obs');
end;
$$;
select extensions.ok((select observed from pickup_g6_barriers where barrier_name='early_complete_vs_release_lock_wait'),'observer verified early completion and normal release queued on cycle lock');
select extensions.is((select count(*)::integer from pickup_g6_race_results where case_name='early_vs_release' and result->>'code' in ('early_departure_completed','pupil_released')),1,'exactly one release path wins when early departure races normal release');
select extensions.is((select count(*)::integer from pickup_g6_race_results where case_name='early_vs_release' and result->>'code' in ('already_released','version_conflict')),1,'losing path receives already_released/version_conflict');
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000020138'),'RELEASED','pupil 8 cycle ends in RELEASED');
select extensions.is((select count(*)::integer from public.pickup_events where student_id='00000000-0000-4000-9000-000000020138' and action in ('CHILD_RELEASED','EARLY_DEPARTURE_COMPLETED')),1,'only one terminal release audit event is recorded for pupil 8');

-- Race C: revoke_pickup_release_authority vs complete_early_departure_release on target profile lock (pupil 4).
do $$
declare
  v_conn text; v_ed uuid; v_blocker_pid integer; v_revoker_pid integer; v_comp_pid integer;
  v_waiters integer; v_result jsonb; i integer;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g6_obs',v_conn);
  perform dblink_connect('g6_rev_blocker',v_conn);
  perform dblink_connect('g6_revoker',v_conn);
  perform dblink_connect('g6_rev_comp',v_conn);
  select pid into v_blocker_pid from dblink('g6_rev_blocker','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_blocker_pid);
  select pid into v_revoker_pid from dblink('g6_revoker','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_revoker_pid);
  select pid into v_comp_pid from dblink('g6_rev_comp','select pg_backend_pid()') as t(pid integer); insert into pickup_g6_session_pids values(v_comp_pid);
  perform dblink_exec('g6_revoker','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020101''');
  perform dblink_exec('g6_revoker','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020101","role":"authenticated"}''');
  perform dblink_exec('g6_revoker','set role authenticated');
  perform dblink_exec('g6_rev_comp','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000020103''');
  perform dblink_exec('g6_rev_comp','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000020103","role":"authenticated"}''');
  perform dblink_exec('g6_rev_comp','set role authenticated');
  perform dblink_exec('g6_rev_blocker','begin');
  perform 1 from dblink('g6_rev_blocker','select id from public.profiles where id=''00000000-0000-4000-9000-000000020103'' for update') as t(id uuid);
  if dblink_send_query('g6_revoker',$q$select public.revoke_pickup_release_authority('00000000-0000-4000-9000-000000020103','Concurrent G6 revoke')$q$)<>1 then raise exception 'g6_revoke_query_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g6_obs',format($obs$
        select count(*)::integer from pg_stat_activity a
         where a.pid=%s and %s = any(pg_blocking_pids(a.pid))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_revoker_pid, v_blocker_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g6_revoke_session_not_blocked_on_lock'; end if;
  v_ed:=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020134');
  if dblink_send_query('g6_rev_comp',format('select public.pickup_g6_test_capture_complete(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_ed,'00000000-0000-4000-9000-000000020184','00000000-0000-4000-9000-000000020354'))<>1 then raise exception 'g6_rev_race_complete_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g6_obs',format($obs$
        select count(*)::integer from pg_stat_activity a
         where a.pid=%s and (%s = any(pg_blocking_pids(a.pid)) or %s = any(pg_blocking_pids(a.pid)))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_comp_pid, v_blocker_pid, v_revoker_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g6_complete_not_blocked_behind_revocation'; end if;
  insert into pickup_g6_barriers values('revoke_vs_early_complete_lock_wait',true);
  perform dblink_exec('g6_rev_blocker','commit');
  perform result from dblink_get_result('g6_revoker') as t(result jsonb);
  select result into v_result from dblink_get_result('g6_rev_comp') as t(result jsonb);
  insert into pickup_g6_race_results values('revoke_vs_complete','complete',v_result);
  perform result from dblink_get_result('g6_rev_comp') as t(result jsonb);
  perform dblink_disconnect('g6_rev_comp'); perform dblink_disconnect('g6_revoker'); perform dblink_disconnect('g6_rev_blocker'); perform dblink_disconnect('g6_obs');
end;
$$;
select extensions.ok((select observed from pickup_g6_barriers where barrier_name='revoke_vs_early_complete_lock_wait'),'observer verified revocation and early completion queued on profile lock');
select extensions.is((select result->>'code' from pickup_g6_race_results where case_name='revoke_vs_complete'),'pickup_release_authority_revoked','early completion queued behind revocation is denied');
select extensions.is((select status from public.early_departure_requests where id=public.pickup_g6_test_ed_id('00000000-0000-4000-9000-000000020134')),'APPROVED','revocation race leaves early departure APPROVED without completing');

drop function public.pickup_g6_test_capture_complete(uuid,uuid,uuid,integer,boolean,text);
drop function public.pickup_g6_test_capture_release(uuid,uuid,uuid,integer,boolean,text);
drop function public.pickup_g6_test_ed_id(uuid);
drop function public.pickup_g6_test_cycle_id(uuid);
select * from extensions.finish();
