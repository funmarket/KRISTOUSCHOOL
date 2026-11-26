-- G4 arrival contract: synthetic fixtures only; run after an isolated db reset.
begin;
select extensions.plan(26);

select extensions.ok(has_function_privilege('authenticated','public.get_pickup_parent_board()','EXECUTE'),'authenticated can call parent board');
select extensions.ok(has_function_privilege('authenticated','public.get_pickup_staff_board(uuid)','EXECUTE'),'authenticated can call staff board');
select extensions.ok(has_function_privilege('authenticated','public.parent_arrived(uuid,uuid,uuid,integer)','EXECUTE'),'authenticated can call parent arrival');
select extensions.ok(has_function_privilege('authenticated','public.get_pickup_operation_receipt(uuid,uuid)','EXECUTE'),'authenticated can read own operation receipt');
select extensions.ok(not has_function_privilege('anon','public.parent_arrived(uuid,uuid,uuid,integer)','EXECUTE'),'anon cannot announce arrival');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_cycles','INSERT,UPDATE,DELETE'),'clients cannot write cycles directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_requests','INSERT,UPDATE,DELETE'),'clients cannot write requests directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_events','INSERT,UPDATE,DELETE'),'clients cannot write events directly');
select extensions.ok(not has_table_privilege('authenticated','public.notification_outbox','INSERT,UPDATE,DELETE'),'clients cannot write notification outbox directly');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-9000-000000009941','authenticated','authenticated','pickup-g4-parent@example.invalid','',now(),'{}','{"username":"pickup_g4_parent","full_name":"G4 Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000009942','authenticated','authenticated','pickup-g4-teacher@example.invalid','',now(),'{}','{"username":"pickup_g4_teacher","full_name":"G4 Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000009943','authenticated','authenticated','pickup-g4-admin@example.invalid','',now(),'{}','{"username":"pickup_g4_admin","full_name":"G4 Admin","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000009961','authenticated','authenticated','pickup-g4-unlinked@example.invalid','',now(),'{}','{"username":"pickup_g4_unlinked","full_name":"G4 Unlinked","requested_role":"PARENT"}',now(),now());
update public.profiles set account_status='APPROVED' where id in (
 '00000000-0000-4000-9000-000000009941','00000000-0000-4000-9000-000000009942','00000000-0000-4000-9000-000000009943','00000000-0000-4000-9000-000000009961');
delete from public.role_assignments where user_id in (
 '00000000-0000-4000-9000-000000009941','00000000-0000-4000-9000-000000009942','00000000-0000-4000-9000-000000009943','00000000-0000-4000-9000-000000009961');
insert into public.role_assignments(user_id,role,active) values
 ('00000000-0000-4000-9000-000000009941','PARENT',true),
 ('00000000-0000-4000-9000-000000009942','TEACHER',true),
 ('00000000-0000-4000-9000-000000009943','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000009961','PARENT',true);

insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by)
select '00000000-0000-4000-9000-000000009944',id,'CP','Pickup G4 Test Class',28,'00000000-0000-4000-9000-000000009943'
from public.academic_years where code='2026-2027';
insert into public.students(id,student_code,full_name,birth_date,status,created_by)
values('00000000-0000-4000-9000-000000009945','PICKUP-G4-1','G4 Test Pupil','2018-01-01','ACTIVE','00000000-0000-4000-9000-000000009943');
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000009946','00000000-0000-4000-9000-000000009945','00000000-0000-4000-9000-000000009944',id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date,'00000000-0000-4000-9000-000000009943'
from public.academic_years where code='2026-2027';
insert into public.teacher_class_assignments(teacher_user_id,class_id,is_homeroom,active,assigned_by)
values('00000000-0000-4000-9000-000000009942','00000000-0000-4000-9000-000000009944',true,true,'00000000-0000-4000-9000-000000009943');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
values('00000000-0000-4000-9000-000000009941','00000000-0000-4000-9000-000000009945','Parent',true,'00000000-0000-4000-9000-000000009943');
insert into public.dismissal_policies(id,class_id,weekday,opens_at,closes_at,effective_from,revision,active,created_by)
values('00000000-0000-4000-9000-000000009947','00000000-0000-4000-9000-000000009944',extract(dow from (now() at time zone 'Africa/Tunis')::date)::smallint,
 '00:00','23:59:59',(now() at time zone 'Africa/Tunis')::date,1,true,'00000000-0000-4000-9000-000000009943');
insert into public.attendance_registers(id,academic_year_id,class_id,teacher_user_id,school_date,status,version,submitted_at,submitted_by)
select '00000000-0000-4000-9000-000000009948',id,'00000000-0000-4000-9000-000000009944','00000000-0000-4000-9000-000000009942',
 (now() at time zone 'Africa/Tunis')::date,'SUBMITTED',1,now(),'00000000-0000-4000-9000-000000009942'
from public.academic_years where code='2026-2027';
insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by)
values('00000000-0000-4000-9000-000000009948','00000000-0000-4000-9000-000000009945','00000000-0000-4000-9000-000000009946','PRESENT','must never be exposed','00000000-0000-4000-9000-000000009942');
insert into public.authorized_pickup_persons(id,student_id,display_name,relationship_label,verification_method,verification_reference,verified_by,verified_at,valid_from,valid_until)
values('00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009945','Verified Collector','Family','ID checked','G4-REFERENCE','00000000-0000-4000-9000-000000009943',now(),
 (now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date);
insert into public.pickup_cycles(cycle_id,student_id,school_date,class_id,academic_year_id,membership_id,dismissal_policy_id,policy_revision)
select '00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009945',
 (now() at time zone 'Africa/Tunis')::date,'00000000-0000-4000-9000-000000009944',m.academic_year_id,m.id,
 '00000000-0000-4000-9000-000000009947',1 from public.student_class_memberships m where m.id='00000000-0000-4000-9000-000000009946';

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000009941',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000009941","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select count(*)::integer from public.get_pickup_parent_board()),1,'parent board includes only own child active cycle');
select extensions.is((select can_confirm_release from public.get_pickup_parent_board() limit 1),false,'G4 board never grants a client release action');
select extensions.is((select eligible from public.get_pickup_parent_board() limit 1),true,'board eligibility comes from Attendance projection');
select extensions.is((select (collectors->0->>'displayName') from public.get_pickup_parent_board() limit 1),'Verified Collector','parent sees minimal verified collector label');
select extensions.is((public.parent_arrived('00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009951',1)->>'state'),'PARENT_ARRIVED','eligible parent arrival advances the cycle');
select extensions.is((public.parent_arrived('00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009951',1)->>'replayed'),'true','same request replays durable result');
select extensions.throws_ok($$select public.parent_arrived('00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009951',2)$$,'P0001','idempotency_conflict','same request UUID with different payload is rejected');
select extensions.is((public.get_pickup_operation_receipt('00000000-0000-4000-9000-000000009951','00000000-0000-4000-9000-000000009950')->>'state'),'PARENT_ARRIVED','receipt readback returns authoritative current cycle state');
reset role;
select extensions.is((select count(*)::integer from public.pickup_events where request_id='00000000-0000-4000-9000-000000009951'),1,'one append-only arrival event is recorded');
select extensions.is((select count(*)::integer from public.pickup_requests where request_id='00000000-0000-4000-9000-000000009951'),1,'one durable request result is recorded');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id='00000000-0000-4000-9000-000000009950' and event_type='pickup.arrival_announced'),1,'one outbox event is committed with arrival');
select extensions.is((select version from public.pickup_cycles where cycle_id='00000000-0000-4000-9000-000000009950'),2,'arrival increments cycle version once');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000009942',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000009942","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select count(*)::integer from public.get_pickup_staff_board('00000000-0000-4000-9000-000000009944')),1,'assigned Teacher can see assigned-class board');
select extensions.is((select can_confirm_release from public.get_pickup_staff_board('00000000-0000-4000-9000-000000009944') limit 1),false,'assigned Teacher cannot release in G4');
select extensions.throws_ok($$select * from public.get_pickup_staff_board('00000000-0000-4000-9000-000000009999')$$,'P0001','insufficient_pickup_scope','Teacher cannot request an unassigned class board');
select extensions.throws_ok($$select public.parent_arrived('00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009952',1)$$,'P0001','pickup_parent_required','Teacher cannot call the parent arrival command');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000009961',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000009961","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.parent_arrived('00000000-0000-4000-9000-000000009950','00000000-0000-4000-9000-000000009949','00000000-0000-4000-9000-000000009953',1)$$,'P0001','pickup_parent_child_link_required','unlinked parent cannot announce arrival for another family');
reset role;

select * from extensions.finish();
rollback;
