-- G4 arrival contract: synthetic fixtures only; run after an isolated db reset.
create extension if not exists dblink;
begin;
select extensions.plan(37);

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

-- Two additional independently eligible pupils provide two distinct cycles for
-- true two-session duplicate-request and competing-request races below.
insert into public.students(id,student_code,full_name,birth_date,status,created_by) values
 ('00000000-0000-4000-9000-000000009962','PICKUP-G4-RACE-1','G4 Race Pupil One','2018-01-01','ACTIVE','00000000-0000-4000-9000-000000009943'),
 ('00000000-0000-4000-9000-000000009965','PICKUP-G4-RACE-2','G4 Race Pupil Two','2018-01-01','ACTIVE','00000000-0000-4000-9000-000000009943');
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000009963','00000000-0000-4000-9000-000000009962','00000000-0000-4000-9000-000000009944',id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date,'00000000-0000-4000-9000-000000009943'
from public.academic_years where code='2026-2027';
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000009966','00000000-0000-4000-9000-000000009965','00000000-0000-4000-9000-000000009944',id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date,'00000000-0000-4000-9000-000000009943'
from public.academic_years where code='2026-2027';
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by) values
 ('00000000-0000-4000-9000-000000009941','00000000-0000-4000-9000-000000009962','Parent',true,'00000000-0000-4000-9000-000000009943'),
 ('00000000-0000-4000-9000-000000009941','00000000-0000-4000-9000-000000009965','Parent',true,'00000000-0000-4000-9000-000000009943');
insert into public.authorized_pickup_persons(id,student_id,display_name,relationship_label,verification_method,verification_reference,verified_by,verified_at,valid_from,valid_until) values
 ('00000000-0000-4000-9000-000000009968','00000000-0000-4000-9000-000000009962','Race Collector One','Family','ID checked','G4-RACE-1','00000000-0000-4000-9000-000000009943',now(),(now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date),
 ('00000000-0000-4000-9000-000000009969','00000000-0000-4000-9000-000000009965','Race Collector Two','Family','ID checked','G4-RACE-2','00000000-0000-4000-9000-000000009943',now(),(now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date);
insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by) values
 ('00000000-0000-4000-9000-000000009948','00000000-0000-4000-9000-000000009962','00000000-0000-4000-9000-000000009963','PRESENT','private','00000000-0000-4000-9000-000000009942'),
 ('00000000-0000-4000-9000-000000009948','00000000-0000-4000-9000-000000009965','00000000-0000-4000-9000-000000009966','LATE','private','00000000-0000-4000-9000-000000009942');
insert into public.pickup_cycles(cycle_id,student_id,school_date,class_id,academic_year_id,membership_id,dismissal_policy_id,policy_revision)
select '00000000-0000-4000-9000-000000009964','00000000-0000-4000-9000-000000009962',(now() at time zone 'Africa/Tunis')::date,
 '00000000-0000-4000-9000-000000009944',m.academic_year_id,m.id,'00000000-0000-4000-9000-000000009947',1
from public.student_class_memberships m where m.id='00000000-0000-4000-9000-000000009963';
insert into public.pickup_cycles(cycle_id,student_id,school_date,class_id,academic_year_id,membership_id,dismissal_policy_id,policy_revision)
select '00000000-0000-4000-9000-000000009967','00000000-0000-4000-9000-000000009965',(now() at time zone 'Africa/Tunis')::date,
 '00000000-0000-4000-9000-000000009944',m.academic_year_id,m.id,'00000000-0000-4000-9000-000000009947',1
from public.student_class_memberships m where m.id='00000000-0000-4000-9000-000000009966';
create temporary table pickup_g4_race_results(case_name text,session_name text,result jsonb) on commit preserve rows;
create temporary table pickup_g4_session_pids(pid integer) on commit preserve rows;
commit;

-- Execute through independent authenticated PostgreSQL sessions. A third
-- session holds the target cycle row so both callers are guaranteed to queue.
do $$
declare
  v_parent uuid:='00000000-0000-4000-9000-000000009941';
  v_cycle uuid; v_collector uuid; v_request uuid;
  v_waiters integer; v_sql text; v_result jsonb; v_locked_cycle uuid; i integer; v_conn text;
  v_pid integer;
begin
  -- Supabase's isolated local database uses its documented local `postgres`
  -- role/password. Connect over the address/port observed by this server so
  -- PostgreSQL applies its TCP password-auth rule (Unix socket/loopback trust
  -- is rejected for a non-superuser dblink caller even with password= present).
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('pickup_g4_blocker',v_conn);
  perform dblink_connect('pickup_g4_a',v_conn);
  perform dblink_connect('pickup_g4_b',v_conn);
  select pid into v_pid from dblink('pickup_g4_blocker','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g4_session_pids values(v_pid);
  select pid into v_pid from dblink('pickup_g4_a','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g4_session_pids values(v_pid);
  select pid into v_pid from dblink('pickup_g4_b','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g4_session_pids values(v_pid);
  perform dblink_exec('pickup_g4_a',format('set request.jwt.claim.sub=%L',v_parent::text));
  perform dblink_exec('pickup_g4_a',format('set request.jwt.claims=%L',jsonb_build_object('sub',v_parent::text,'role','authenticated')::text));
  perform dblink_exec('pickup_g4_a','set role authenticated');
  perform dblink_exec('pickup_g4_b',format('set request.jwt.claim.sub=%L',v_parent::text));
  perform dblink_exec('pickup_g4_b',format('set request.jwt.claims=%L',jsonb_build_object('sub',v_parent::text,'role','authenticated')::text));
  perform dblink_exec('pickup_g4_b','set role authenticated');

  -- Same request UUID: one durable mutation and the second caller replays it.
  v_cycle:='00000000-0000-4000-9000-000000009964';
  v_collector:='00000000-0000-4000-9000-000000009968';
  v_request:='00000000-0000-4000-9000-000000009970';
  perform dblink_exec('pickup_g4_blocker','begin');
  select cycle_id into v_locked_cycle from dblink('pickup_g4_blocker',format('select cycle_id from public.pickup_cycles where cycle_id=%L::uuid for update',v_cycle)) as lock_row(cycle_id uuid);
  v_sql:=format('/* pickup_g4_same_request */ select public.parent_arrived(%L::uuid,%L::uuid,%L::uuid,1) as result',v_cycle,v_collector,v_request);
  perform dblink_send_query('pickup_g4_a',v_sql);
  perform dblink_send_query('pickup_g4_b',v_sql);
  v_waiters:=0;
  for i in 1..100 loop
    select count(*) into v_waiters from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and query like '%pickup_g4_same_request%';
    exit when v_waiters=2;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>2 then raise exception 'pickup_g4_same_request_sessions_not_both_waiting'; end if;
  perform dblink_exec('pickup_g4_blocker','commit');
  select result into v_result from dblink_get_result('pickup_g4_a') as t(result jsonb);
  insert into pickup_g4_race_results values('same_request','a',v_result);
  select result into v_result from dblink_get_result('pickup_g4_b') as t(result jsonb);
  insert into pickup_g4_race_results values('same_request','b',v_result);
  -- libpq async-query connections must be drained through the terminal empty
  -- result before they can accept a second query.
  perform result from dblink_get_result('pickup_g4_a') as t(result jsonb);
  perform result from dblink_get_result('pickup_g4_b') as t(result jsonb);

  -- Different request UUIDs: one transition wins; the waiter receives the
  -- authoritative PARENT_ARRIVED/version conflict without another outbox event.
  v_cycle:='00000000-0000-4000-9000-000000009967';
  v_collector:='00000000-0000-4000-9000-000000009969';
  perform dblink_exec('pickup_g4_blocker','begin');
  select cycle_id into v_locked_cycle from dblink('pickup_g4_blocker',format('select cycle_id from public.pickup_cycles where cycle_id=%L::uuid for update',v_cycle)) as lock_row(cycle_id uuid);
  perform dblink_send_query('pickup_g4_a',format('/* pickup_g4_distinct_request */ select public.parent_arrived(%L::uuid,%L::uuid,%L::uuid,1) as result',v_cycle,v_collector,'00000000-0000-4000-9000-000000009971'));
  perform dblink_send_query('pickup_g4_b',format('/* pickup_g4_distinct_request */ select public.parent_arrived(%L::uuid,%L::uuid,%L::uuid,1) as result',v_cycle,v_collector,'00000000-0000-4000-9000-000000009972'));
  v_waiters:=0;
  for i in 1..100 loop
    select count(*) into v_waiters from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and query like '%pickup_g4_distinct_request%';
    exit when v_waiters=2;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>2 then raise exception 'pickup_g4_distinct_request_sessions_not_both_waiting'; end if;
  perform dblink_exec('pickup_g4_blocker','commit');
  select result into v_result from dblink_get_result('pickup_g4_a') as t(result jsonb);
  insert into pickup_g4_race_results values('distinct_request','a',v_result);
  select result into v_result from dblink_get_result('pickup_g4_b') as t(result jsonb);
  insert into pickup_g4_race_results values('distinct_request','b',v_result);
  perform result from dblink_get_result('pickup_g4_a') as t(result jsonb);
  perform result from dblink_get_result('pickup_g4_b') as t(result jsonb);

  perform dblink_disconnect('pickup_g4_a');
  perform dblink_disconnect('pickup_g4_b');
  perform dblink_disconnect('pickup_g4_blocker');
end;
$$;

select extensions.ok((select count(distinct pid)=3 from pickup_g4_session_pids),'race harness uses three distinct PostgreSQL backend sessions');
select extensions.is((select count(*)::integer from pickup_g4_race_results where case_name='same_request' and result->>'code'='parent_arrived'),2,'two independent sessions complete the same request safely');
select extensions.is((select count(*)::integer from pickup_g4_race_results where case_name='same_request' and result->>'replayed'='true'),1,'one same-request session receives durable replay');
select extensions.is((select count(*)::integer from public.pickup_events where cycle_id='00000000-0000-4000-9000-000000009964'),1,'same-request two-session race writes exactly one event');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id='00000000-0000-4000-9000-000000009964' and event_type='pickup.arrival_announced'),1,'same-request two-session race writes exactly one outbox row');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000009941',false);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000009941","role":"authenticated"}',false);
set role authenticated;
select extensions.is((public.get_pickup_operation_receipt('00000000-0000-4000-9000-000000009970','00000000-0000-4000-9000-000000009964')->>'state'),'PARENT_ARRIVED','receipt recovers committed result after simulated client timeout');
reset role;
select extensions.is((select count(*)::integer from pickup_g4_race_results where case_name='distinct_request' and result->>'code'='parent_arrived'),1,'distinct-request race has exactly one winning transition');
select extensions.is((select count(*)::integer from pickup_g4_race_results where case_name='distinct_request' and result->>'code'='version_conflict' and result->>'state'='PARENT_ARRIVED' and result->>'version'='2'),1,'distinct-request waiter receives authoritative state and version');
select extensions.is((select count(*)::integer from public.pickup_events where cycle_id='00000000-0000-4000-9000-000000009967'),1,'distinct-request two-session race writes exactly one event');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id='00000000-0000-4000-9000-000000009967' and event_type='pickup.arrival_announced'),1,'distinct-request two-session race writes exactly one outbox row');
select extensions.is((select count(*)::integer from public.pickup_requests where request_id in ('00000000-0000-4000-9000-000000009971','00000000-0000-4000-9000-000000009972')),2,'both competing requests receive durable outcomes');

select * from extensions.finish();
