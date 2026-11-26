-- G3 Pickup contract: role authority, revocation, attendance projection,
-- collector validity, scheduling, audit and direct-table grants.
-- Synthetic fixtures only; run only on an isolated Supabase db reset.

begin;
select extensions.plan(68);

select extensions.ok((select relrowsecurity from pg_class where oid='public.dismissal_policies'::regclass),'dismissal policy RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.authorized_pickup_persons'::regclass),'authorized collectors RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_release_revocations'::regclass),'release revocation RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_authority_audit_logs'::regclass),'authority audit RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_cycles'::regclass),'cycles RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_requests'::regclass),'requests RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_events'::regclass),'events RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.early_departure_requests'::regclass),'early departure RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_audit_export_logs'::regclass),'export log RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pickup_person_audit_logs'::regclass),'collector audit RLS enabled');
select extensions.ok((select count(*)=11 from pg_class where relnamespace='public'::regnamespace and relname in (
  'dismissal_policies','pickup_dismissal_policy_audit_logs','authorized_pickup_persons',
  'pickup_release_revocations','pickup_authority_audit_logs','pickup_cycles','pickup_requests',
  'pickup_events','early_departure_requests','pickup_audit_export_logs','pickup_person_audit_logs'
) and relrowsecurity),'RLS is enabled on every G3 Pickup table');

select extensions.ok(not has_table_privilege('anon','public.pickup_cycles','SELECT,INSERT,UPDATE,DELETE'),'anon has no cycle access');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_cycles','SELECT,INSERT,UPDATE,DELETE'),'authenticated has no direct cycle access');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_events','SELECT,INSERT,UPDATE,DELETE'),'authenticated has no direct event access');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_release_revocations','SELECT,INSERT,UPDATE,DELETE'),'authenticated has no direct revocation access');
select extensions.ok(not has_table_privilege('authenticated','public.notification_outbox','INSERT,UPDATE,DELETE'),'authenticated cannot write notification_outbox');
select extensions.ok(not has_table_privilege('authenticated','public.authorized_pickup_persons','SELECT,INSERT,UPDATE,DELETE'),'collector details are only exposed by the safe scoped RPC');
select extensions.ok(not has_function_privilege('anon','public.get_pickup_student_eligibility(uuid,date)','EXECUTE'),'anon cannot query Pickup eligibility');
select extensions.ok(has_function_privilege('authenticated','public.get_pickup_student_eligibility(uuid,date)','EXECUTE'),'authenticated can call the scoped eligibility projection');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-9000-000000009901','authenticated','authenticated','pickup-admin@example.invalid','',now(),'{}','{"username":"pickup_admin","full_name":"Pickup Admin","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000009902','authenticated','authenticated','pickup-manager@example.invalid','',now(),'{}','{"username":"pickup_manager","full_name":"Pickup Manager","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000009903','authenticated','authenticated','pickup-office@example.invalid','',now(),'{}','{"username":"pickup_office","full_name":"Pickup Office","requested_role":"ADMINISTRATIVE_PERSONNEL"}',now(),now()),
 ('00000000-0000-4000-9000-000000009904','authenticated','authenticated','pickup-teacher@example.invalid','',now(),'{}','{"username":"pickup_teacher","full_name":"Pickup Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000009905','authenticated','authenticated','pickup-staff@example.invalid','',now(),'{}','{"username":"pickup_staff","full_name":"Pickup Staff","requested_role":"SCHOOL_STAFF"}',now(),now()),
 ('00000000-0000-4000-9000-000000009906','authenticated','authenticated','pickup-parent@example.invalid','',now(),'{}','{"username":"pickup_parent","full_name":"Pickup Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000009907','authenticated','authenticated','pickup-student@example.invalid','',now(),'{}','{"username":"pickup_student","full_name":"Pickup Student","requested_role":"STUDENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000009908','authenticated','authenticated','pickup-no-role@example.invalid','',now(),'{}','{"username":"pickup_no_role","full_name":"No Assigned Role"}',now(),now()),
 ('00000000-0000-4000-9000-000000009909','authenticated','authenticated','pickup-pending@example.invalid','',now(),'{}','{"username":"pickup_pending","full_name":"Pending Manager","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000009910','authenticated','authenticated','pickup-teacher-two@example.invalid','',now(),'{}','{"username":"pickup_teacher_two","full_name":"Pickup Teacher Two","requested_role":"TEACHER"}',now(),now());

update public.profiles set account_status='APPROVED'
where id between '00000000-0000-4000-9000-000000009901'::uuid and '00000000-0000-4000-9000-000000009908'::uuid
   or id='00000000-0000-4000-9000-000000009910'::uuid;
delete from public.role_assignments where user_id between '00000000-0000-4000-9000-000000009901'::uuid and '00000000-0000-4000-9000-000000009910'::uuid;
insert into public.role_assignments(user_id,role,active) values
 ('00000000-0000-4000-9000-000000009901','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000009902','MANAGER',true),
 ('00000000-0000-4000-9000-000000009903','ADMINISTRATIVE_PERSONNEL',true),
 ('00000000-0000-4000-9000-000000009904','TEACHER',true),
 ('00000000-0000-4000-9000-000000009905','SCHOOL_STAFF',true),
 ('00000000-0000-4000-9000-000000009906','PARENT',true),
 ('00000000-0000-4000-9000-000000009907','STUDENT',true),
 ('00000000-0000-4000-9000-000000009909','MANAGER',true),
 ('00000000-0000-4000-9000-000000009910','TEACHER',true);
insert into public.manager_capability_grants(manager_user_id,capability,active,granted_by)
values('00000000-0000-4000-9000-000000009902','UNRELATED_TEST_CAPABILITY',true,'00000000-0000-4000-9000-000000009901');

insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by)
select '00000000-0000-4000-9000-000000009921',id,'CP','Pickup G3 Test Class',28,'00000000-0000-4000-9000-000000009901'
from public.academic_years where code='2026-2027';
insert into public.students(id,student_code,full_name,birth_date,status,created_by) values
 ('00000000-0000-4000-9000-000000009922','PICKUP-G3-1','Pickup Test Student','2018-01-01','ACTIVE','00000000-0000-4000-9000-000000009901'),
 ('00000000-0000-4000-9000-000000009923','PICKUP-G3-2','Pickup Other Student','2018-02-01','ACTIVE','00000000-0000-4000-9000-000000009901');
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000009924','00000000-0000-4000-9000-000000009922','00000000-0000-4000-9000-000000009921',id,'ACTIVE','2026-09-15','00000000-0000-4000-9000-000000009901'
from public.academic_years where code='2026-2027';
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000009925','00000000-0000-4000-9000-000000009923','00000000-0000-4000-9000-000000009921',id,'ACTIVE','2026-09-15','00000000-0000-4000-9000-000000009901'
from public.academic_years where code='2026-2027';
insert into public.teacher_class_assignments(teacher_user_id,class_id,is_homeroom,active,assigned_by)
values('00000000-0000-4000-9000-000000009904','00000000-0000-4000-9000-000000009921',true,true,'00000000-0000-4000-9000-000000009901');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
values('00000000-0000-4000-9000-000000009906','00000000-0000-4000-9000-000000009922','Parent',true,'00000000-0000-4000-9000-000000009901');
insert into public.attendance_registers(id,academic_year_id,class_id,teacher_user_id,school_date,status,version,submitted_at,submitted_by)
select '00000000-0000-4000-9000-000000009926',id,'00000000-0000-4000-9000-000000009921','00000000-0000-4000-9000-000000009904','2026-11-26','SUBMITTED',1,now(),'00000000-0000-4000-9000-000000009904'
from public.academic_years where code='2026-2027';
insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by) values
 ('00000000-0000-4000-9000-000000009926','00000000-0000-4000-9000-000000009922','00000000-0000-4000-9000-000000009924','PRESENT','private staff comment','00000000-0000-4000-9000-000000009904'),
 ('00000000-0000-4000-9000-000000009926','00000000-0000-4000-9000-000000009923','00000000-0000-4000-9000-000000009925','PRESENT','private staff comment','00000000-0000-4000-9000-000000009904');

create temp table pg_temp.pickup_refs(ref_key text primary key,ref_id uuid) on commit drop;
grant select,insert,update on pg_temp.pickup_refs to authenticated;
create function pg_temp.save_pickup_ref(p_key text,p_id uuid) returns uuid language plpgsql as $$
begin insert into pg_temp.pickup_refs(ref_key,ref_id) values(p_key,p_id) on conflict(ref_key) do update set ref_id=excluded.ref_id; return p_id; end;
$$;
create function pg_temp.set_pickup_actor(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',p_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_id::text,'role','authenticated')::text,true);
end;
$$;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009901');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','true','APP_ADMIN has default release authority');
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canManagePickupPolicy','true','APP_ADMIN alone manages Pickup configuration');
select extensions.ok(pg_temp.save_pickup_ref('collector',(public.create_authorized_pickup_person('00000000-0000-4000-9000-000000009922','Approved Collector','Aunt','Photo ID checked','G3-VERIFY-001','2026-11-26','2026-11-26','Identity and relationship verified') ->> 'id')::uuid) is not null,'APP_ADMIN can register a verified collector');
select extensions.is(public.get_pickup_schedule('00000000-0000-4000-9000-000000009922','2026-11-26') ->> 'status','UNAVAILABLE','missing schedule blocks Pickup by default');
select extensions.is(public.create_pickup_dismissal_policy(null,extract(dow from date '2026-11-26')::smallint,'14:00','16:00','2026-11-26',null,'Initial approved dismissal window') ->> 'timezone','Africa/Tunis','APP_ADMIN can create an Africa/Tunis dismissal policy');
reset role;
select extensions.is((select count(*)::integer from public.pickup_dismissal_policy_audit_logs where actor_user_id='00000000-0000-4000-9000-000000009901' and action='CREATED'),1,'dismissal schedule creation is audited');

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','true','MANAGER has default release authority without a manager capability gate');
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canManagePickupPolicy','false','MANAGER cannot edit initial Pickup policy');
select extensions.throws_ok($$select public.revoke_user_pickup_release_authority('00000000-0000-4000-9000-000000009903','test forbidden')$$,'P0001','pickup_app_admin_required','MANAGER cannot revoke account authority');
select extensions.throws_ok($$select public.create_authorized_pickup_person('00000000-0000-4000-9000-000000009922','Unauthorized Collector','Aunt','Photo ID','G3-NO-AUTH-001','2026-11-26','2026-11-26','Must be APP_ADMIN')$$,'P0001','pickup_app_admin_required','MANAGER cannot register a collector');
select extensions.throws_ok($$select * from public.export_pickup_events('2026-11-26 00:00:00+00','2026-11-27 00:00:00+00',null,'unauthorized export')$$,'P0001','pickup_app_admin_required','MANAGER cannot export audit history');
select extensions.is((select eligibility from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'ELIGIBLE_CANDIDATE','MANAGER receives only the narrow student eligibility projection');
select extensions.is((public.get_pickup_schedule('00000000-0000-4000-9000-000000009922','2026-11-26') ->> 'status'),'AVAILABLE','configured schedule is available');
reset role;
insert into public.school_calendar_events(id,class_id,title,description,category,start_date,end_date,is_all_day,timezone,is_public,status,created_by,audience_mode) values('00000000-0000-4000-9000-000000009929',null,'Pickup closure','School closed','CLOSURE','2026-11-26','2026-11-26',true,'Africa/Tunis',false,'SCHEDULED','00000000-0000-4000-9000-000000009901','WHOLE_SCHOOL');
set local role authenticated;
select extensions.is((public.get_pickup_schedule('00000000-0000-4000-9000-000000009922','2026-11-26') ->> 'reasonCode'),'schedule_unavailable','active whole-school CLOSURE blocks Pickup schedule');
select extensions.is((select count(*)::integer from public.list_authorized_pickup_persons('00000000-0000-4000-9000-000000009922','2026-11-26')),1,'MANAGER can see only safe current collector display fields');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009903');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','true','ADMINISTRATIVE_PERSONNEL has default release authority');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009904');
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922')$$,'P0001','insufficient_pickup_scope','TEACHER has no Pickup board or release authority');
select extensions.throws_ok($$select * from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')$$,'P0001','insufficient_pickup_scope','TEACHER has no Pickup eligibility projection scope');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009905');
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922')$$,'P0001','insufficient_pickup_scope','SCHOOL_STAFF has no Pickup board or release authority');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009906');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922',(select ref_id from pg_temp.pickup_refs where ref_key='collector'),'2026-11-26') ->> 'canAnnounceArrival','true','PARENT can announce for own linked child with a valid collector');
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922',(select ref_id from pg_temp.pickup_refs where ref_key='collector'),'2026-11-26') ->> 'canConfirmRelease','false','PARENT cannot confirm physical release');
select extensions.is((select count(*)::integer from public.list_authorized_pickup_persons('00000000-0000-4000-9000-000000009922','2026-11-26')),1,'PARENT sees approved minimal collector display fields');
select extensions.throws_ok($$select * from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009923','2026-11-26')$$,'P0001','insufficient_pickup_scope','PARENT cannot query an unrelated pupil');
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922',(select ref_id from pg_temp.pickup_refs where ref_key='collector'),'2026-11-27') ->> 'canAnnounceArrival','false','expired collector is not eligible for the next school date');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009907');
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922')$$,'P0001','insufficient_pickup_scope','STUDENT has no Pickup board authority');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009908');
set local role authenticated;
select extensions.throws_ok($$select public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922')$$,'P0001','insufficient_pickup_scope','account with no active school role is denied');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009909');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','false','unapproved MANAGER account is denied');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009901');
set local role authenticated;
select extensions.is(public.revoke_user_pickup_release_authority('00000000-0000-4000-9000-000000009902','Owner safety revocation') ->> 'version','1','APP_ADMIN revokes a Manager account with version 1');
reset role;
select extensions.is((select count(*)::integer from public.pickup_authority_audit_logs where target_user_id='00000000-0000-4000-9000-000000009902' and action='REVOKE_RELEASE' and version=1),1,'revocation creates immutable audit evidence');
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','false','revoked Manager loses release authority');
select extensions.is((select eligibility from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'ELIGIBLE_CANDIDATE','release revocation does not remove Manager board visibility');
reset role;
insert into public.pickup_events(actor_user_id,actor_role,student_id,action,request_id,reason)
values('00000000-0000-4000-9000-000000009902','MANAGER','00000000-0000-4000-9000-000000009922',
  'OUTAGE_RECONCILED','00000000-0000-4000-9000-000000009930','G3 append-only test fixture');
select extensions.throws_ok($$update public.pickup_events set reason='changed' where request_id='00000000-0000-4000-9000-000000009930'$$,'P0001','pickup_audit_immutable','pickup event update is blocked');
select extensions.throws_ok($$delete from public.pickup_events where request_id='00000000-0000-4000-9000-000000009930'$$,'P0001','pickup_audit_immutable','pickup event deletion is blocked');

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009901');
set local role authenticated;
select extensions.is(public.reinstate_user_pickup_release_authority('00000000-0000-4000-9000-000000009902','Owner reinstated authority') ->> 'version','2','APP_ADMIN reinstatement increments account version');
reset role;
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922') ->> 'canConfirmRelease','true','reinstated Manager regains default release authority');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009904');
set local role authenticated;
select extensions.is((select eligibility from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'UNAVAILABLE','null mark fails closed');
reset role;
update public.attendance_entries set mark='LATE' where register_id='00000000-0000-4000-9000-000000009926' and student_id='00000000-0000-4000-9000-000000009922';
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is((select eligibility from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'ELIGIBLE_CANDIDATE','LATE mark is eligible candidate');
reset role;
update public.attendance_entries set mark='ABSENT' where register_id='00000000-0000-4000-9000-000000009926' and student_id='00000000-0000-4000-9000-000000009922';
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is((select eligibility from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'INELIGIBLE','ABSENT mark is ineligible');
reset role;
update public.attendance_entries set mark='EXCUSED' where register_id='00000000-0000-4000-9000-000000009926' and student_id='00000000-0000-4000-9000-000000009922';
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is((select reason_code from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'attendance_excused','EXCUSED is ineligible by default');
reset role;
update public.attendance_registers set status='DRAFT',submitted_at=null,submitted_by=null where id='00000000-0000-4000-9000-000000009926';
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is((select reason_code from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'register_not_submitted','persisted DRAFT is unavailable');
select extensions.is((select reason_code from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-27')),'register_missing','missing register is unavailable');
select extensions.is(pg_get_function_result('public.get_pickup_student_eligibility(uuid,date)'::regprocedure) !~* 'internal_comment','Attendance internal_comment is not exposed');
reset role;

insert into public.attendance_registers(id,academic_year_id,class_id,teacher_user_id,school_date,status,version,submitted_at,submitted_by)
select '00000000-0000-4000-9000-000000009928',id,'00000000-0000-4000-9000-000000009921','00000000-0000-4000-9000-000000009910','2026-11-26','SUBMITTED',1,now(),'00000000-0000-4000-9000-000000009910'
from public.academic_years where code='2026-2027';
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009902');
set local role authenticated;
select extensions.is((select reason_code from public.get_pickup_student_eligibility('00000000-0000-4000-9000-000000009922','2026-11-26')),'conflicting_registers','multiple class/date registers fail closed');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009901');
set local role authenticated;
select extensions.is(public.revoke_authorized_pickup_person((select ref_id from pg_temp.pickup_refs where ref_key='collector'),'Verification no longer valid') ->> 'id',(select ref_id from pg_temp.pickup_refs where ref_key='collector'),'APP_ADMIN can revoke a collector');
reset role;
select extensions.is((select count(*)::integer from public.pickup_person_audit_logs where authorized_person_id=(select ref_id from pg_temp.pickup_refs where ref_key='collector') and action='REVOKED'),1,'collector revocation is audited');
select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009906');
set local role authenticated;
select extensions.is(public.get_pickup_actor_authority('00000000-0000-4000-9000-000000009922',(select ref_id from pg_temp.pickup_refs where ref_key='collector'),'2026-11-26') ->> 'canAnnounceArrival','false','revoked collector cannot support parent arrival');
reset role;

select pg_temp.set_pickup_actor('00000000-0000-4000-9000-000000009901');
set local role authenticated;
select extensions.is((select count(*)::integer from public.export_pickup_events('2026-11-26 00:00:00+00','2026-11-27 00:00:00+00',null,'Owner audit export')),1,'APP_ADMIN export returns scoped audit rows');
reset role;
select extensions.is((select count(*)::integer from public.pickup_audit_export_logs where actor_user_id='00000000-0000-4000-9000-000000009901' and reason='Owner audit export'),1,'every audit export is logged');
select extensions.ok(not has_function_privilege('anon','public.export_pickup_events(timestamptz,timestamptz,uuid,text)','EXECUTE'),'anon cannot export Pickup history');

select * from extensions.finish();
rollback;
