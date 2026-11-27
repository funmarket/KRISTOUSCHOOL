begin;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,'authenticated','authenticated',
  'enroll-d02-'||i||'@example.invalid','',now(),'{}',
  jsonb_build_object('username','enrolld02_'||i,'full_name','Directory fixture '||i,'requested_role','PARENT'),now(),now()
from generate_series(42001,42008) i;
update public.profiles set account_status='APPROVED' where id::text like '00000000-0000-4000-9000-00000004200%';
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000042008';
delete from public.role_assignments where user_id::text like '00000000-0000-4000-9000-00000004200%';
insert into public.role_assignments(user_id,role,active) values
('00000000-0000-4000-9000-000000042001','APP_ADMIN',true),
('00000000-0000-4000-9000-000000042002','PARENT',true),
('00000000-0000-4000-9000-000000042003','PARENT',true),
('00000000-0000-4000-9000-000000042004','TEACHER',true),
('00000000-0000-4000-9000-000000042005','SCHOOL_STAFF',true),
('00000000-0000-4000-9000-000000042006','MANAGER',true),
('00000000-0000-4000-9000-000000042007','ADMINISTRATIVE_PERSONNEL',true),
('00000000-0000-4000-9000-000000042008','APP_ADMIN',true);
insert into public.school_classes(id,academic_year_id,level_code,name,capacity)
select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,ay.id,'CE1','D02 class '||i,1
from generate_series(82001,82003) i cross join public.academic_years ay where ay.code='2026-2027';
update public.school_classes set is_archived=true where id='00000000-0000-4000-9000-000000082003';
insert into public.students(id,student_code,full_name,birth_date) values
('00000000-0000-4000-9000-000000072001','D02-UNASSIGNED','Directory pupil','2018-01-01'),
('00000000-0000-4000-9000-000000072002','D02-OTHER','Another directory pupil','2018-01-01');
insert into public.parent_child_links(id,parent_user_id,student_id,active,updated_at) values
('00000000-0000-4000-9000-000000092001','00000000-0000-4000-9000-000000042002','00000000-0000-4000-9000-000000072001',false,'2026-01-01');
insert into public.enrollment_applications(reference_code,student_full_name,birth_date,desired_level_code,parent_full_name,phone,submitted_by_user_id)
values ('D02-PRIVATE','Directory application','2018-01-01','CE1','Fixture parent','000000000','00000000-0000-4000-9000-000000042002');
select ok(not has_function_privilege('anon','public.assign_existing_student_to_class(uuid,uuid,uuid)','EXECUTE'),'anon placement grant denied');
select ok(not has_function_privilege('anon','public.review_student_guardian(uuid,uuid,text,timestamptz,text)','EXECUTE'),'anon guardian grant denied');
select ok(not has_table_privilege('authenticated','public.family_guardian_audit_logs','SELECT,INSERT,UPDATE,DELETE'),'audit inaccessible directly');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.list_enrollment_applications()$$,'P0001','actor_unauthenticated','missing identity denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042002',true);
select is(jsonb_array_length(public.list_enrollment_applications()),1,'Parent sees own application');
select is(public.get_enrollment_review_access(),false,'Parent cannot review');
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')$$,'P0001','insufficient_authority','Parent cannot place own child');
select throws_ok($$select public.list_student_guardians('00000000-0000-4000-9000-000000072001')$$,'P0001','insufficient_authority','Parent cannot read administrative guardian projection');
select throws_ok($$select public.review_student_guardian('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000092001','VERIFY','2026-01-01','Self verify')$$,'P0001','insufficient_authority','Parent cannot self verify');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042003',true);
select is(jsonb_array_length(public.list_enrollment_applications()),0,'other family cannot read application');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042004',true);
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')$$,'P0001','insufficient_authority','Teacher cannot place pupils');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042005',true);
select is(public.get_enrollment_review_access(),false,'ordinary staff cannot review');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042006',true);
select is(public.get_enrollment_review_access(),true,'Manager may review admission');
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')$$,'P0001','insufficient_authority','admission authority does not imply placement');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042008',true);
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')$$,'P0001','actor_not_approved','suspended administrator denied');
reset role;
insert into public.manager_capability_grants(manager_user_id,capability,active,granted_by) values
('00000000-0000-4000-9000-000000042005','ENROLLMENT_REVIEW',true,'00000000-0000-4000-9000-000000042001'),
('00000000-0000-4000-9000-000000042006','CLASSES_MANAGE',true,'00000000-0000-4000-9000-000000042001');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042005',true);
select is(public.get_enrollment_review_access(),true,'delegated staff review capability');
select ok(public.list_enrollment_applications() @> '[{"reference_code":"D02-PRIVATE"}]'::jsonb,'delegated staff queue reads authorized');
select throws_ok($$select public.review_student_guardian('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000092001','VERIFY','2026-01-01','Check documents')$$,'P0001','insufficient_authority','review delegation does not grant guardian mutation');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042006',true);
select is(public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')->>'replayed','false','delegated Manager assigns unassigned student');
select is(public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')->>'replayed','true','placement retry safe');
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072002','00000000-0000-4000-9000-000000082001')$$,'P0001','class_capacity_reached','capacity enforced');
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082002')$$,'P0001','version_conflict','stale placement denied');
select is(public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082002',
  (select id from public.student_class_memberships where student_id='00000000-0000-4000-9000-000000072001' and status='ACTIVE'))->>'replayed','false','transfer retains identity');
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082003')$$,'P0001','class_not_found','archived class denied');
reset role;
select is((select count(*)::integer from public.students where student_code='D02-UNASSIGNED'),1,'no duplicate pupil');
select is((select count(*)::integer from public.student_class_memberships where student_id='00000000-0000-4000-9000-000000072001' and status='TRANSFERRED'),1,'previous membership retained');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042007',true);
select is(jsonb_array_length(public.list_student_guardians('00000000-0000-4000-9000-000000072001')),1,'Office sees explicit guardian link');
select throws_ok($$select public.review_student_guardian('00000000-0000-4000-9000-000000072002','00000000-0000-4000-9000-000000092001','VERIFY','2026-01-01','Check documents')$$,'P0001','target_not_found','cannot reuse link against another child');
select throws_ok($$select public.review_student_guardian('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000092001','VERIFY','2025-01-01','Check documents')$$,'P0001','version_conflict','stale guardian record denied');
select is(public.review_student_guardian('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000092001','VERIFY','2026-01-01','Verified evidence')->>'replayed','false','Office verifies link');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042002',true);
select ok(public.get_my_school_context()->'linkedChildrenIds' @> '["00000000-0000-4000-9000-000000072001"]'::jsonb,'verified Parent context includes pupil');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042007',true);
select is(public.review_student_guardian('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000092001','REVOKE',
  (select updated_at from public.parent_child_links where id='00000000-0000-4000-9000-000000092001'),'Authority revoked')->>'replayed','false','Office revokes link');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042002',true);
select is(jsonb_array_length(public.get_my_school_context()->'children'),0,'revocation removes child from Parent context');
reset role;
select is((select count(*)::integer from public.family_guardian_audit_logs where link_id='00000000-0000-4000-9000-000000092001'),2,'both guardian decisions audited');
select throws_ok($$delete from public.family_guardian_audit_logs$$,'P0001','family_audit_immutable','guardian audit immutable');
update public.manager_capability_grants set active=false where manager_user_id in ('00000000-0000-4000-9000-000000042005','00000000-0000-4000-9000-000000042006');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042005',true);
select is(public.get_enrollment_review_access(),false,'revoked staff review capability denied');
select is(jsonb_array_length(public.list_enrollment_applications()),0,'revoked staff loses private queue');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000042006',true);
select throws_ok($$select public.assign_existing_student_to_class('00000000-0000-4000-9000-000000072001','00000000-0000-4000-9000-000000082001')$$,'P0001','insufficient_authority','revoked Manager loses placement authority');
reset role;
select * from finish();
rollback;
