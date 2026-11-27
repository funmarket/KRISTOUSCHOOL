begin;
set local search_path=public,extensions;
select plan(42);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,'authenticated','authenticated',
  'enroll-d01-'||i||'@example.invalid','',now(),'{}',
  jsonb_build_object('username','enrolld01_'||i,'full_name','Admission fixture '||i,'requested_role','PARENT'),now(),now()
from generate_series(41001,41008) i;
update public.profiles set account_status='APPROVED' where id::text like '00000000-0000-4000-9000-00000004100%';
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000041008';
delete from public.role_assignments where user_id::text like '00000000-0000-4000-9000-00000004100%';
insert into public.role_assignments(user_id,role,active) values
('00000000-0000-4000-9000-000000041001','APP_ADMIN',true),
('00000000-0000-4000-9000-000000041002','PARENT',true),
('00000000-0000-4000-9000-000000041003','PARENT',true),
('00000000-0000-4000-9000-000000041004','TEACHER',true),
('00000000-0000-4000-9000-000000041005','SCHOOL_STAFF',true),
('00000000-0000-4000-9000-000000041006','MANAGER',true),
('00000000-0000-4000-9000-000000041007','ADMINISTRATIVE_PERSONNEL',true),
('00000000-0000-4000-9000-000000041008','APP_ADMIN',true);
insert into public.enrollment_applications(id,reference_code,student_full_name,birth_date,desired_level_code,parent_full_name,phone,submitted_by_user_id,status)
select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,'D01-'||i,'Admission pupil '||i,'2018-01-01','CE1','Fixture guardian','000000000',
 '00000000-0000-4000-9000-000000041002',case when i=61001 then 'SUBMITTED' when i=61008 then 'ENROLLED' else 'ACCEPTED' end
from generate_series(61001,61010) i;
insert into public.students(id,student_code,full_name,birth_date,created_by) values
('00000000-0000-4000-9000-000000071001','D01-EXISTING','Existing canonical pupil','2018-01-01','00000000-0000-4000-9000-000000041001'),
('00000000-0000-4000-9000-000000071002','D01-OTHER-FAMILY','Other family pupil','2018-01-01','00000000-0000-4000-9000-000000041001');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,verified_by) values
('00000000-0000-4000-9000-000000041002','00000000-0000-4000-9000-000000071001','Existing guardian label','00000000-0000-4000-9000-000000041007'),
('00000000-0000-4000-9000-000000041003','00000000-0000-4000-9000-000000071002','Parent','00000000-0000-4000-9000-000000041001');

select has_function('public','complete_enrollment_admission',array['uuid','uuid','boolean','integer']);
select ok(not has_function_privilege('anon','public.complete_enrollment_admission(uuid,uuid,boolean,integer)','EXECUTE'),'anon execute denied');
select ok(has_function_privilege('authenticated','public.complete_enrollment_admission(uuid,uuid,boolean,integer)','EXECUTE'),'authenticated transport granted');
select ok(not has_table_privilege('authenticated','public.enrollment_admission_completions','SELECT,INSERT,UPDATE,DELETE'),'completion records RPC-only');
select ok(not has_table_privilege('authenticated','public.enrollment_admission_audit_logs','SELECT,INSERT,UPDATE,DELETE'),'audit RPC-only');
select ok((select relrowsecurity from pg_class where oid='public.enrollment_admission_completions'::regclass),'completion RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.enrollment_admission_audit_logs'::regclass),'audit RLS enabled');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','actor_unauthenticated','missing identity denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041002',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','insufficient_authority','own applicant Parent denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041003',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','insufficient_authority','cross-family Parent denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041004',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','insufficient_authority','Teacher denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041005',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','insufficient_authority','unprivileged staff denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041008',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')$$,'P0001','insufficient_authority','suspended admin denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041001',true);
select throws_ok($$select public.review_enrollment_application('00000000-0000-4000-9000-000000061001','ENROLLED')$$,'P0001','admission_completion_required','status-only enrollment denied');
select throws_ok($$select public.review_enrollment_application('00000000-0000-4000-9000-000000061001','ACCEPTED')$$,'P0001','invalid_transition','cannot skip review');
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061001')$$,'P0001','application_not_accepted','unaccepted completion denied');
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002',null,true,2)$$,'P0001','version_conflict','stale version denied');
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')->>'status','ENROLLED','atomic completion succeeds');
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002')->>'replayed','true','stale-version identical retry replays');
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061002','00000000-0000-4000-9000-000000071001')$$,'P0001','admission_completion_conflict','retry cannot relink');
reset role;
select is((select count(*)::integer from public.students where full_name='Admission pupil 61002'),1,'one canonical student');
select is((select count(*)::integer from public.parent_child_links l join public.enrollment_applications a on a.student_id=l.student_id where a.reference_code='D01-61002' and l.parent_user_id=a.submitted_by_user_id and l.active and l.verified_by is not null),1,'explicit guardian verified');
select is((select count(*)::integer from public.student_class_memberships m join public.enrollment_applications a on a.student_id=m.student_id where a.reference_code='D01-61002'),0,'student remains unassigned');
select is((select count(*)::integer from public.enrollment_admission_audit_logs where application_id='00000000-0000-4000-9000-000000061002'),1,'retry does not duplicate audit');
select is((select count(*)::integer from public.user_notifications where recipient_user_id='00000000-0000-4000-9000-000000041002' and target_ref_id='00000000-0000-4000-9000-000000061002' and title='Admission Completed'),1,'retry does not duplicate notification');
set local role authenticated;
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061003','00000000-0000-4000-9000-000000071001')->>'studentId','00000000-0000-4000-9000-000000071001','existing student reused');
reset role;
select is((select relationship_label from public.parent_child_links where student_id='00000000-0000-4000-9000-000000071001'),'Existing guardian label','existing guardian metadata preserved');
set local role authenticated;
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061004','00000000-0000-4000-9000-000000071002')$$,'P0001','guardian_student_conflict','wrong family existing student fails closed');
reset role;
select is((select student_id from public.enrollment_applications where reference_code='D01-61004'),null::uuid,'failed completion leaves application untouched');
select is((select count(*)::integer from public.enrollment_admission_completions where application_id='00000000-0000-4000-9000-000000061004'),0,'failed completion leaves no receipt');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041006',true);
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061005',null,false)->>'guardianVerified','false','approved Manager may complete without guardian verification');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041007',true);
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061006')->>'status','ENROLLED','approved Office may complete');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041001',true);
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061008')->>'status','ENROLLED','legacy status-only enrolled row reconciles');
select throws_ok($$select public.review_enrollment_application('00000000-0000-4000-9000-000000061008','REJECTED',null,2)$$,'P0001','invalid_transition','completed application cannot regress');
reset role;
insert into public.manager_capability_grants(manager_user_id,capability,active,granted_by)
values('00000000-0000-4000-9000-000000041005','ENROLLMENT_REVIEW',true,'00000000-0000-4000-9000-000000041001');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041005',true);
select is(public.complete_enrollment_admission('00000000-0000-4000-9000-000000061007')->>'status','ENROLLED','explicitly delegated Staff may complete');
reset role;
update public.manager_capability_grants set active=false where manager_user_id='00000000-0000-4000-9000-000000041005';
set local role authenticated;
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061007')$$,'P0001','insufficient_authority','revocation also blocks replay');
reset role;
select throws_ok($$update public.enrollment_admission_audit_logs set action='ADMISSION_COMPLETED'$$,'P0001','admission_audit_immutable','audit cannot be changed');
create function pg_temp.reject_admission_notification() returns trigger language plpgsql as $$
begin
  if new.target_ref_id='00000000-0000-4000-9000-000000061009' then raise exception 'fixture_notification_failure'; end if;
  return new;
end;
$$;
create trigger d01_notification_failure before insert on public.user_notifications for each row execute function pg_temp.reject_admission_notification();
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000041001',true);
select throws_ok($$select public.complete_enrollment_admission('00000000-0000-4000-9000-000000061009')$$,'P0001','fixture_notification_failure','notification failure rolls back completion');
reset role;
select is((select count(*)::integer from public.students where full_name='Admission pupil 61009'),0,'atomic failure leaves no student');
select is((select student_id from public.enrollment_applications where reference_code='D01-61009'),null::uuid,'atomic failure leaves no link');
select is((select count(*)::integer from public.enrollment_admission_audit_logs where application_id='00000000-0000-4000-9000-000000061009'),0,'atomic failure leaves no audit');
drop trigger d01_notification_failure on public.user_notifications;
set local role anon;
select throws_ok($$select public.complete_enrollment_admission(null)$$,'42501','permission denied for function complete_enrollment_admission','anon direct call denied');
reset role;
select * from finish();
rollback;
