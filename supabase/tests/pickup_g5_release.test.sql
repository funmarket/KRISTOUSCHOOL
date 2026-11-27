-- G5 contract: explicit cycle provisioning, physical release, authority revocation,
-- real PostgreSQL lock races, and durable release receipt recovery.
create extension if not exists dblink;
begin;
select extensions.plan(84);

select extensions.ok(has_function_privilege('authenticated','public.provision_pickup_cycles(date)','EXECUTE'),'authenticated can invoke cycle provisioning RPC');
select extensions.ok(has_function_privilege('authenticated','public.release_pupil(uuid,uuid,uuid,integer,boolean,text)','EXECUTE'),'authenticated can invoke physical release RPC');
select extensions.ok(has_function_privilege('authenticated','public.revoke_pickup_release_authority(uuid,text)','EXECUTE'),'authenticated can invoke App Admin revoke RPC');
select extensions.ok(has_function_privilege('authenticated','public.reinstate_pickup_release_authority(uuid,text)','EXECUTE'),'authenticated can invoke App Admin reinstate RPC');
select extensions.ok(not has_function_privilege('anon','public.release_pupil(uuid,uuid,uuid,integer,boolean,text)','EXECUTE'),'anon cannot execute physical release');
select extensions.ok(not has_function_privilege('authenticated','public.pickup_actor_can_confirm_release()','EXECUTE'),'release authority resolver is not directly exposed');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_cycles','INSERT,UPDATE,DELETE'),'authenticated cannot write cycles directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_events','INSERT,UPDATE,DELETE'),'authenticated cannot write Pickup audit events directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_requests','INSERT,UPDATE,DELETE'),'authenticated cannot write Pickup idempotency receipts directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_release_revocations','INSERT,UPDATE,DELETE'),'authenticated cannot write release revocations directly');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_authority_audit_logs','INSERT,UPDATE,DELETE'),'authenticated cannot write immutable authority audit history directly');
select extensions.ok(not has_table_privilege('authenticated','public.notification_outbox','INSERT,UPDATE,DELETE'),'authenticated cannot write notification outbox directly');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-9000-000000010101','authenticated','authenticated','g5-admin@example.invalid','',now(),'{}','{"username":"g5_admin","full_name":"G5 Admin","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000010102','authenticated','authenticated','g5-admin-two@example.invalid','',now(),'{}','{"username":"g5_admin_two","full_name":"G5 Admin Two","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000010103','authenticated','authenticated','g5-manager@example.invalid','',now(),'{}','{"username":"g5_manager","full_name":"G5 Manager","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000010104','authenticated','authenticated','g5-office@example.invalid','',now(),'{}','{"username":"g5_office","full_name":"G5 Office","requested_role":"ADMINISTRATIVE_PERSONNEL"}',now(),now()),
 ('00000000-0000-4000-9000-000000010105','authenticated','authenticated','g5-teacher@example.invalid','',now(),'{}','{"username":"g5_teacher","full_name":"G5 Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000010106','authenticated','authenticated','g5-school-staff@example.invalid','',now(),'{}','{"username":"g5_school_staff","full_name":"G5 School Staff","requested_role":"SCHOOL_STAFF"}',now(),now()),
 ('00000000-0000-4000-9000-000000010107','authenticated','authenticated','g5-parent@example.invalid','',now(),'{}','{"username":"g5_parent","full_name":"G5 Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000010108','authenticated','authenticated','g5-student@example.invalid','',now(),'{}','{"username":"g5_student","full_name":"G5 Student","requested_role":"STUDENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000010109','authenticated','authenticated','g5-pending@example.invalid','',now(),'{}','{"username":"g5_pending","full_name":"G5 Pending","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000010110','authenticated','authenticated','g5-suspended@example.invalid','',now(),'{}','{"username":"g5_suspended","full_name":"G5 Suspended","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000010111','authenticated','authenticated','g5-no-role@example.invalid','',now(),'{}','{"username":"g5_no_role","full_name":"G5 Account Without Role"}',now(),now());
update public.profiles set account_status='APPROVED' where id between '00000000-0000-4000-9000-000000010101'::uuid and '00000000-0000-4000-9000-000000010108'::uuid;
update public.profiles set account_status='PENDING' where id='00000000-0000-4000-9000-000000010109';
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000010110';
update public.profiles set account_status='APPROVED' where id='00000000-0000-4000-9000-000000010111';
delete from public.role_assignments where user_id between '00000000-0000-4000-9000-000000010101'::uuid and '00000000-0000-4000-9000-000000010110'::uuid;
insert into public.role_assignments(user_id,role,active) values
 ('00000000-0000-4000-9000-000000010101','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000010102','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000010103','MANAGER',true),
 ('00000000-0000-4000-9000-000000010104','ADMINISTRATIVE_PERSONNEL',true),
 ('00000000-0000-4000-9000-000000010105','TEACHER',true),
 ('00000000-0000-4000-9000-000000010106','SCHOOL_STAFF',true),
 ('00000000-0000-4000-9000-000000010107','PARENT',true),
 ('00000000-0000-4000-9000-000000010108','STUDENT',true),
 ('00000000-0000-4000-9000-000000010109','MANAGER',true),
 ('00000000-0000-4000-9000-000000010110','MANAGER',true);
insert into public.manager_capability_grants(manager_user_id,capability,active,granted_by)
values('00000000-0000-4000-9000-000000010103','G5_UNRELATED_CAPABILITY',true,'00000000-0000-4000-9000-000000010101');

insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by)
select '00000000-0000-4000-9000-000000010120',id,'CP','Pickup G5 Test Class',32,'00000000-0000-4000-9000-000000010101'
  from public.academic_years where code='2026-2027';
insert into public.students(id,student_code,full_name,birth_date,status,created_by)
select ('00000000-0000-4000-9000-'||lpad((10130+n)::text,12,'0'))::uuid,
       'PICKUP-G5-'||n,'G5 Test Pupil '||n,'2018-01-01','ACTIVE','00000000-0000-4000-9000-000000010101'
  from generate_series(0,14) as n;
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select ('00000000-0000-4000-9000-'||lpad((10150+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((10130+n)::text,12,'0'))::uuid,
       '00000000-0000-4000-9000-000000010120',y.id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date,
       '00000000-0000-4000-9000-000000010101'
  from generate_series(0,14) as n cross join public.academic_years y where y.code='2026-2027';
insert into public.teacher_class_assignments(teacher_user_id,class_id,is_homeroom,active,assigned_by)
values('00000000-0000-4000-9000-000000010105','00000000-0000-4000-9000-000000010120',true,true,'00000000-0000-4000-9000-000000010101');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
select '00000000-0000-4000-9000-000000010107',
       ('00000000-0000-4000-9000-'||lpad((10130+n)::text,12,'0'))::uuid,
       'Parent',true,'00000000-0000-4000-9000-000000010101'
  from generate_series(0,14) as n;
insert into public.dismissal_policies(id,class_id,weekday,opens_at,closes_at,effective_from,revision,active,created_by)
values('00000000-0000-4000-9000-000000010170','00000000-0000-4000-9000-000000010120',
       extract(dow from (now() at time zone 'Africa/Tunis')::date)::smallint,'00:00','23:59:59',
       (now() at time zone 'Africa/Tunis')::date,1,true,'00000000-0000-4000-9000-000000010101');
insert into public.attendance_registers(id,academic_year_id,class_id,teacher_user_id,school_date,status,version,submitted_at,submitted_by)
select '00000000-0000-4000-9000-000000010171',id,'00000000-0000-4000-9000-000000010120',
       '00000000-0000-4000-9000-000000010105',(now() at time zone 'Africa/Tunis')::date,
       'SUBMITTED',1,now(),'00000000-0000-4000-9000-000000010105'
  from public.academic_years where code='2026-2027';
insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by)
select '00000000-0000-4000-9000-000000010171',
       ('00000000-0000-4000-9000-'||lpad((10130+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((10150+n)::text,12,'0'))::uuid,
       'PRESENT','private test comment','00000000-0000-4000-9000-000000010105'
  from generate_series(0,14) as n;
insert into public.authorized_pickup_persons(id,student_id,display_name,relationship_label,verification_method,
    verification_reference,verified_by,verified_at,valid_from,valid_until)
select ('00000000-0000-4000-9000-'||lpad((10180+n)::text,12,'0'))::uuid,
       ('00000000-0000-4000-9000-'||lpad((10130+n)::text,12,'0'))::uuid,
       'G5 Verified Collector '||n,'Family','ID checked','G5-REF-'||n,
       '00000000-0000-4000-9000-000000010101',now(),
       (now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date
  from generate_series(0,14) as n;

-- Narrow test helper reads the opaque cycle UUID for fixture pupils without
-- granting clients direct access to pickup_cycles.
create function public.pickup_g5_test_cycle_id(p_student_id uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select c.cycle_id from public.pickup_cycles c where c.student_id=p_student_id
$$;
revoke all on function public.pickup_g5_test_cycle_id(uuid) from public,anon;
grant execute on function public.pickup_g5_test_cycle_id(uuid) to authenticated;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.ok((public.provision_pickup_cycles()->>'provisionedCount')::integer>=15,'APP_ADMIN provisions cycles for all test pupils with effective memberships and active windows');
reset role;
select extensions.ok((select count(*)::integer=15 from public.pickup_cycles where student_id between '00000000-0000-4000-9000-000000010130'::uuid and '00000000-0000-4000-9000-000000010144'::uuid),'provisioning creates exactly one cycle per test pupil');
select extensions.ok((select count(*)::integer=15 from public.pickup_events where action='CYCLE_PROVISIONED' and student_id between '00000000-0000-4000-9000-000000010130'::uuid and '00000000-0000-4000-9000-000000010144'::uuid),'every provisioned cycle has an append-only audit event');
set local role authenticated;
select extensions.is((public.provision_pickup_cycles()->>'provisionedCount')::integer,0,'repeated provisioning is idempotent and does not create cycles');
select extensions.throws_ok($$select public.provision_pickup_cycles((now() at time zone 'Africa/Tunis')::date+1)$$,
  'P0001','schedule_unavailable','provisioning fails closed when no active target-date schedule exists');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.provision_pickup_cycles()->>'provisionedCount')::integer,0,'MANAGER may idempotently provision cycles without a specific capability grant');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010104',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010104","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.provision_pickup_cycles()->>'provisionedCount')::integer,0,'ADMINISTRATIVE_PERSONNEL may idempotently provision cycles');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010105',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010105","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.provision_pickup_cycles()$$,'P0001','pickup_provision_authority_required','assigned TEACHER cannot provision cycles');
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010140'),'00000000-0000-4000-9000-000000010190','00000000-0000-4000-9000-000000010401',2,true,null)$$,'P0001','pickup_release_authority_required','assigned TEACHER cannot release');
reset role;

-- Activate the actual G4 arrival transition for all but one cycle, which remains WAITING.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010107',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010107","role":"authenticated"}',true);
set local role authenticated;
select extensions.ok((
  select count(*)::integer=14
    from (select n from generate_series(0,14) as n where n<>3) filtered_n
    cross join lateral (
       select public.parent_arrived(public.pickup_g5_test_cycle_id(('00000000-0000-4000-9000-'||lpad((10130+filtered_n.n)::text,12,'0'))::uuid),
        ('00000000-0000-4000-9000-'||lpad((10180+filtered_n.n)::text,12,'0'))::uuid,
        ('00000000-0000-4000-9000-'||lpad((10200+filtered_n.n)::text,12,'0'))::uuid,1) as result
    ) arrived
   where arrived.result->>'code'='parent_arrived'
),'G4 parent-arrival command creates realistic PARENT_ARRIVED release fixtures');
reset role;

-- Default live release authority for all three approved roles; Manager's grant is unrelated.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130'),
  '00000000-0000-4000-9000-000000010180','00000000-0000-4000-9000-000000010300',2,true,'Handed to verified collector')->>'code'),
  'pupil_released','APP_ADMIN confirms physical handoff');
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130'),
  '00000000-0000-4000-9000-000000010180','00000000-0000-4000-9000-000000010300',2,true,'Handed to verified collector')->>'replayed'),
  'true','same actor and request payload replays the durable release result');
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130'),'00000000-0000-4000-9000-000000010180','00000000-0000-4000-9000-000000010300',2,true,'Different handoff')$$,
  'P0001','idempotency_conflict','same request UUID with a different payload is rejected');
select extensions.is((public.get_pickup_operation_receipt('00000000-0000-4000-9000-000000010300',
  public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130'))->>'state'),
  'RELEASED','timeout recovery returns authoritative release state');
reset role;
select extensions.is((select count(*)::integer from public.pickup_events where cycle_id=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130') and action='CHILD_RELEASED'),1,'release replay appends no duplicate event');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130') and event_type='pickup.child_released'),1,'release replay enqueues exactly one outbox row');
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010130'),'RELEASED','physical release commits terminal RELEASED state');
select extensions.is((select version from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010130'),3,'release increments cycle version exactly once');
select extensions.is((select release_actor_user_id from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010130'),'00000000-0000-4000-9000-000000010101','release records actual actor');
select extensions.is((select collector_id from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010130'),'00000000-0000-4000-9000-000000010180','release retains verified collector attribution');
select extensions.is((select reason from public.pickup_events where cycle_id=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130') and action='CHILD_RELEASED'),'Handed to verified collector','handoff notes are recorded in restricted audit history');
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010130'),
  '00000000-0000-4000-9000-000000010180','00000000-0000-4000-9000-000000010402',3,true,null)->>'code'),
  'already_released','a new request cannot release an already terminal cycle');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010131'),
  '00000000-0000-4000-9000-000000010181','00000000-0000-4000-9000-000000010301',2,true,null)->>'code'),
  'pupil_released','MANAGER releases without relying on unrelated manager capabilities');
select extensions.is((select can_confirm_release from public.get_pickup_staff_board() where student_id='00000000-0000-4000-9000-000000010132'),true,'unrevoked MANAGER board exposes release capability only for arrived eligible cycle');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010104',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010104","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010132'),
  '00000000-0000-4000-9000-000000010182','00000000-0000-4000-9000-000000010302',2,true,null)->>'code'),
  'pupil_released','ADMINISTRATIVE_PERSONNEL releases under default authority');
reset role;

-- WAITING, stale version, invalid attestation, and release-role deny matrix.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010133'),
  '00000000-0000-4000-9000-000000010183','00000000-0000-4000-9000-000000010403',1,true,null)->>'code'),
  'arrival_required','WAITING cycle cannot be physically released');
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010134'),
  '00000000-0000-4000-9000-000000010184','00000000-0000-4000-9000-000000010404',1,true,null)->>'code'),
  'version_conflict','stale expected version returns version_conflict');
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010134'),
  '00000000-0000-4000-9000-000000010184','00000000-0000-4000-9000-000000010405',1,true,null)->>'version'),
  '2','version conflict contains authoritative current cycle version');
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),null,null,null,false,null)$$,
  'P0001','attestation_required','false physical attestation is rejected before other argument checks');
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),null,null,null,null,null)$$,
  'P0001','attestation_required','null physical attestation is rejected before other argument checks');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010106',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010106","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010410',2,true,null)$$,'P0001','pickup_release_authority_required','SCHOOL_STAFF cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010107',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010107","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010411',2,true,null)$$,'P0001','pickup_release_authority_required','PARENT cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010108","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010412',2,true,null)$$,'P0001','pickup_release_authority_required','STUDENT cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010109',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010109","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010413',2,true,null)$$,'P0001','pickup_release_authority_required','unapproved account cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010110',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010110","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010414',2,true,null)$$,'P0001','pickup_release_authority_required','suspended account cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010111',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010111","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010416',2,true,null)$$,'P0001','pickup_release_authority_required','approved account without an active school role cannot release');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010105',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010105","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select can_confirm_release from public.get_pickup_staff_board('00000000-0000-4000-9000-000000010120') where student_id='00000000-0000-4000-9000-000000010139'),false,'assigned TEACHER board never grants release authority');
reset role;

-- App Admin revocation uses G3's monotonic row and immutable audit history.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.revoke_pickup_release_authority('00000000-0000-4000-9000-000000010103','self revoke not admin')$$,'P0001','pickup_app_admin_required','MANAGER cannot revoke release authority');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.revoke_pickup_release_authority('00000000-0000-4000-9000-000000010103','G5 revocation test')->>'isRevoked'),'true','APP_ADMIN revokes an individual manager');
reset role;
select extensions.is((select version from public.pickup_release_revocations where target_user_id='00000000-0000-4000-9000-000000010103'),1,'revocation version increments to one');
select extensions.is((select count(*)::integer from public.pickup_authority_audit_logs where target_user_id='00000000-0000-4000-9000-000000010103' and action='REVOKE_RELEASE' and version=1),1,'revocation writes immutable audit history');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((select can_confirm_release from public.get_pickup_staff_board() where student_id='00000000-0000-4000-9000-000000010139'),false,'staff board removes release capability immediately after revocation');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010139'),'00000000-0000-4000-9000-000000010189','00000000-0000-4000-9000-000000010415',2,true,null)$$,'P0001','pickup_release_authority_revoked','revoked Manager is denied on a fresh server command');
-- G5-B: revoked Manager is also denied when replaying a prior release request_id, while historical receipt readback remains available.
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010131'),'00000000-0000-4000-9000-000000010181','00000000-0000-4000-9000-000000010301',2,true,null)$$,'P0001','pickup_release_authority_revoked','G5-B: revoked Manager cannot replay an earlier release request_id');
select extensions.is((public.get_pickup_operation_receipt('00000000-0000-4000-9000-000000010301',public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010131'))->>'state'),'RELEASED','G5-B: historical receipt lookup remains available after pickup-specific revocation');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.reinstate_pickup_release_authority('00000000-0000-4000-9000-000000010103','G5 reinstate test')->>'isRevoked'),'false','APP_ADMIN reinstates a revoked account');
reset role;
select extensions.is((select version from public.pickup_release_revocations where target_user_id='00000000-0000-4000-9000-000000010103'),2,'reinstatement advances monotonic version');
select extensions.is((select count(*)::integer from public.pickup_authority_audit_logs where target_user_id='00000000-0000-4000-9000-000000010103'),2,'revoke and reinstate audit rows are preserved');
reset role;

-- Collector and Attendance are revalidated after arrival and fail closed.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select public.revoke_authorized_pickup_person('00000000-0000-4000-9000-000000010185','collector revoked after arrival');
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010135'),'00000000-0000-4000-9000-000000010185','00000000-0000-4000-9000-000000010420',2,true,null)$$,'P0001','collector_invalid','collector revoked after arrival cannot be released');
reset role;
update public.authorized_pickup_persons set valid_from=(now() at time zone 'Africa/Tunis')::date-2,
 valid_until=(now() at time zone 'Africa/Tunis')::date-1 where id='00000000-0000-4000-9000-000000010186';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010136'),'00000000-0000-4000-9000-000000010186','00000000-0000-4000-9000-000000010421',2,true,null)$$,'P0001','collector_invalid','expired collector cannot be released');
reset role;
update public.authorized_pickup_persons set valid_until=(now() at time zone 'Africa/Tunis')::date where id='00000000-0000-4000-9000-000000010186';
update public.attendance_entries set mark='ABSENT' where register_id='00000000-0000-4000-9000-000000010171' and student_id='00000000-0000-4000-9000-000000010136';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010136'),'00000000-0000-4000-9000-000000010186','00000000-0000-4000-9000-000000010422',2,true,null)$$,'P0001','attendance_ineligible','Attendance corrected to ABSENT after arrival blocks release');
reset role;
update public.attendance_entries set mark='EXCUSED' where register_id='00000000-0000-4000-9000-000000010171' and student_id='00000000-0000-4000-9000-000000010137';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010137'),'00000000-0000-4000-9000-000000010187','00000000-0000-4000-9000-000000010423',2,true,null)$$,'P0001','attendance_ineligible','Attendance corrected to EXCUSED after arrival blocks release');
reset role;
update public.attendance_entries set mark='PRESENT' where register_id='00000000-0000-4000-9000-000000010171' and student_id='00000000-0000-4000-9000-000000010137';
update public.attendance_registers set status='DRAFT',submitted_at=null,submitted_by=null where id='00000000-0000-4000-9000-000000010171';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010137'),'00000000-0000-4000-9000-000000010187','00000000-0000-4000-9000-000000010424',2,true,null)$$,'P0001','attendance_ineligible','Attendance changed to persisted DRAFT after arrival blocks release');
reset role;
update public.attendance_registers set status='SUBMITTED',submitted_at=now(),submitted_by='00000000-0000-4000-9000-000000010105' where id='00000000-0000-4000-9000-000000010171';

-- G5-B: suspended actor cannot replay an earlier release request_id either.
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000010104';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010104',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010104","role":"authenticated"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010132'),'00000000-0000-4000-9000-000000010182','00000000-0000-4000-9000-000000010302',2,true,null)$$,'P0001','pickup_release_authority_required','G5-B: suspended actor cannot replay an earlier release request_id');
reset role;
update public.profiles set account_status='APPROVED' where id='00000000-0000-4000-9000-000000010104';

-- G5-A: post-window release succeeds today while closures, inactive policies, and prior-day cycles fail closed.
update public.dismissal_policies set opens_at='00:00:00',closes_at='00:00:01' where id='00000000-0000-4000-9000-000000010170';
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000010101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}',true);
set local role authenticated;
select extensions.is((public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010138'),'00000000-0000-4000-9000-000000010188','00000000-0000-4000-9000-000000010425',2,true,null)->>'code'),'pupil_released','G5-A: post-window release remains allowed for today valid PARENT_ARRIVED cycle');
reset role;
update public.dismissal_policies set opens_at='00:00',closes_at='23:59:59' where id='00000000-0000-4000-9000-000000010170';

insert into public.school_calendar_events(id,class_id,title,category,start_date,end_date,audience_mode,created_by)
values('00000000-0000-4000-9000-000000010179',null,'G5 release closure','CLOSURE',(now() at time zone 'Africa/Tunis')::date,(now() at time zone 'Africa/Tunis')::date,'WHOLE_SCHOOL','00000000-0000-4000-9000-000000010101');
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010143'),'00000000-0000-4000-9000-000000010193','00000000-0000-4000-9000-000000010426',2,true,null)$$,'P0001','schedule_unavailable','G5-A: active school closure blocks release');
reset role;
delete from public.school_calendar_events where id='00000000-0000-4000-9000-000000010179';

update public.dismissal_policies set active=false where id='00000000-0000-4000-9000-000000010170';
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil(public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010143'),'00000000-0000-4000-9000-000000010193','00000000-0000-4000-9000-000000010427',2,true,null)$$,'P0001','schedule_unavailable','G5-A: deactivated dismissal policy blocks release');
reset role;
update public.dismissal_policies set active=true where id='00000000-0000-4000-9000-000000010170';

insert into public.students(id,student_code,full_name,birth_date,status,created_by)
values('00000000-0000-4000-9000-000000010145','PICKUP-G5-15','G5 Stale Day Pupil','2018-01-01','ACTIVE','00000000-0000-4000-9000-000000010101');
insert into public.student_class_memberships(id,student_id,class_id,academic_year_id,status,started_at,assigned_by)
select '00000000-0000-4000-9000-000000010165','00000000-0000-4000-9000-000000010145','00000000-0000-4000-9000-000000010120',y.id,'ACTIVE',(now() at time zone 'Africa/Tunis')::date-1,'00000000-0000-4000-9000-000000010101'
  from public.academic_years y where y.code='2026-2027';
insert into public.authorized_pickup_persons(id,student_id,display_name,relationship_label,verification_method,verification_reference,verified_by,verified_at,valid_from,valid_until)
values('00000000-0000-4000-9000-000000010195','00000000-0000-4000-9000-000000010145','G5 Stale Collector','Family','ID checked','G5-REF-15','00000000-0000-4000-9000-000000010101',now(),(now() at time zone 'Africa/Tunis')::date-1,(now() at time zone 'Africa/Tunis')::date);
insert into public.dismissal_policies(id,class_id,weekday,opens_at,closes_at,effective_from,revision,active,created_by)
values('00000000-0000-4000-9000-000000010172','00000000-0000-4000-9000-000000010120',extract(dow from ((now() at time zone 'Africa/Tunis')::date-1))::smallint,'00:00','23:59:59',(now() at time zone 'Africa/Tunis')::date-1,1,true,'00000000-0000-4000-9000-000000010101');
insert into public.pickup_cycles(cycle_id,student_id,school_date,class_id,academic_year_id,membership_id,dismissal_policy_id,policy_revision)
select '00000000-0000-4000-9000-000000010199','00000000-0000-4000-9000-000000010145',(now() at time zone 'Africa/Tunis')::date-1,'00000000-0000-4000-9000-000000010120',y.id,'00000000-0000-4000-9000-000000010165','00000000-0000-4000-9000-000000010172',1
  from public.academic_years y where y.code='2026-2027';
update public.pickup_cycles set state='PARENT_ARRIVED',version=2,arrival_at=now()-interval '1 day',arrival_actor_user_id='00000000-0000-4000-9000-000000010107',collector_id='00000000-0000-4000-9000-000000010195'
 where cycle_id='00000000-0000-4000-9000-000000010199';
set local role authenticated;
select extensions.throws_ok($$select public.release_pupil('00000000-0000-4000-9000-000000010199','00000000-0000-4000-9000-000000010195','00000000-0000-4000-9000-000000010428',2,true,null)$$,'P0001','cycle_date_mismatch','G5-A: stale prior-day PARENT_ARRIVED cycle is rejected');
reset role;

-- Temporary helper converts concurrent RPC exceptions into inspectable JSON for dblink.
create function public.pickup_g5_test_capture_release(
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
revoke all on function public.pickup_g5_test_capture_release(uuid,uuid,uuid,integer,boolean,text) from public,anon;
grant execute on function public.pickup_g5_test_capture_release(uuid,uuid,uuid,integer,boolean,text) to authenticated;
create temp table pickup_g5_race_results(case_name text,session_name text,result jsonb) on commit preserve rows;
create temp table pickup_g5_session_pids(pid integer) on commit preserve rows;
create temp table pickup_g5_barriers(barrier_name text primary key,observed boolean) on commit preserve rows;
commit;

do $$
declare
  v_conn text; v_cycle uuid; v_collector uuid; v_waiters integer; v_result jsonb;
  v_blocker_pid integer; v_a_pid integer; v_b_pid integer; i integer;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g5_obs',v_conn);
  perform dblink_connect('g5_blocker',v_conn);
  perform dblink_connect('g5_staff_a',v_conn);
  perform dblink_connect('g5_staff_b',v_conn);
  select pid into v_blocker_pid from dblink('g5_blocker','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g5_session_pids values(v_blocker_pid);
  select pid into v_a_pid from dblink('g5_staff_a','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g5_session_pids values(v_a_pid);
  select pid into v_b_pid from dblink('g5_staff_b','select pg_backend_pid()') as t(pid integer);
  insert into pickup_g5_session_pids values(v_b_pid);
  perform dblink_exec('g5_staff_a','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000010101''');
  perform dblink_exec('g5_staff_a','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}''');
  perform dblink_exec('g5_staff_a','set role authenticated');
  perform dblink_exec('g5_staff_b','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000010103''');
  perform dblink_exec('g5_staff_b','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}''');
  perform dblink_exec('g5_staff_b','set role authenticated');
  v_cycle:=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010140');
  v_collector:='00000000-0000-4000-9000-000000010190';
  perform dblink_exec('g5_blocker','begin');
  perform 1 from dblink('g5_blocker',format('select cycle_id from public.pickup_cycles where cycle_id=%L::uuid for update',v_cycle)) as t(cycle_id uuid);
  if dblink_send_query('g5_staff_a',format('select public.pickup_g5_test_capture_release(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_cycle,v_collector,'00000000-0000-4000-9000-000000010430'))<>1
     or dblink_send_query('g5_staff_b',format('select public.pickup_g5_test_capture_release(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_cycle,v_collector,'00000000-0000-4000-9000-000000010431'))<>1 then
    raise exception 'g5_dual_release_queries_not_accepted';
  end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g5_obs',format($obs$
        select count(*)::integer
          from pg_stat_activity a
         where a.pid in (%s,%s)
           and pg_blocking_pids(a.pid) && array[%s,%s,%s]::integer[]
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_a_pid, v_b_pid, v_blocker_pid, v_a_pid, v_b_pid)) as t(blocked_count integer);
    exit when v_waiters=2;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>2 then raise exception 'g5_dual_release_sessions_not_both_blocked_on_lock'; end if;
  insert into pickup_g5_barriers values('two_staff_release_lock_wait',true);
  perform dblink_exec('g5_blocker','commit');
  select result into v_result from dblink_get_result('g5_staff_a') as t(result jsonb);
  insert into pickup_g5_race_results values('two_staff_release','a',v_result);
  select result into v_result from dblink_get_result('g5_staff_b') as t(result jsonb);
  insert into pickup_g5_race_results values('two_staff_release','b',v_result);
  perform result from dblink_get_result('g5_staff_a') as t(result jsonb);
  perform result from dblink_get_result('g5_staff_b') as t(result jsonb);
  perform dblink_disconnect('g5_staff_a');
  perform dblink_disconnect('g5_staff_b');
  perform dblink_disconnect('g5_blocker');
  perform dblink_disconnect('g5_obs');
end;
$$;

select extensions.ok((select count(distinct pid)=3 from pickup_g5_session_pids),'release race used three distinct PostgreSQL sessions');
select extensions.ok((select observed from pickup_g5_barriers where barrier_name='two_staff_release_lock_wait'),'G5-C: observer verified both staff sessions queued on cycle lock');
select extensions.is((select count(*)::integer from pickup_g5_race_results where case_name='two_staff_release' and result->>'code'='pupil_released'),1,'exactly one simultaneous authorized release wins');
select extensions.ok((select count(*)::integer from pickup_g5_race_results where case_name='two_staff_release' and result->>'code' in ('already_released','version_conflict'))=1,'losing release receives authoritative already-released/version conflict');
select extensions.is((select count(*)::integer from public.pickup_events where cycle_id=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010140') and action='CHILD_RELEASED'),1,'two-session release race appends exactly one event');
select extensions.is((select count(*)::integer from public.notification_outbox where source_id=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010140') and event_type='pickup.child_released'),1,'two-session release race enqueues exactly one outbox row');

-- Queue a real G3 revocation RPC ahead of release on the target profile lock.
do $$
declare
  v_conn text; v_cycle uuid; v_blocker_pid integer; v_revoker_pid integer; v_release_pid integer;
  v_waiters integer; v_result jsonb; i integer;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g5_obs',v_conn);
  perform dblink_connect('g5_rev_blocker',v_conn); perform dblink_connect('g5_revoker',v_conn); perform dblink_connect('g5_rev_release',v_conn);
  select pid into v_blocker_pid from dblink('g5_rev_blocker','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_blocker_pid);
  select pid into v_revoker_pid from dblink('g5_revoker','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_revoker_pid);
  select pid into v_release_pid from dblink('g5_rev_release','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_release_pid);
  perform dblink_exec('g5_revoker','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000010101''');
  perform dblink_exec('g5_revoker','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}''');
  perform dblink_exec('g5_revoker','set role authenticated');
  perform dblink_exec('g5_rev_release','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000010103''');
  perform dblink_exec('g5_rev_release','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000010103","role":"authenticated"}''');
  perform dblink_exec('g5_rev_release','set role authenticated');
  perform dblink_exec('g5_rev_blocker','begin');
  perform 1 from dblink('g5_rev_blocker','select id from public.profiles where id=''00000000-0000-4000-9000-000000010103'' for update') as t(id uuid);
  if dblink_send_query('g5_revoker',$q$select public.revoke_pickup_release_authority('00000000-0000-4000-9000-000000010103','Concurrent G5 revoke')$q$)<>1 then raise exception 'g5_revoke_query_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g5_obs',format($obs$
        select count(*)::integer
          from pg_stat_activity a
         where a.pid=%s
           and %s = any(pg_blocking_pids(a.pid))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_revoker_pid, v_blocker_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g5_revoke_session_not_blocked_on_lock'; end if;
  v_cycle:=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010141');
  if dblink_send_query('g5_rev_release',format('select public.pickup_g5_test_capture_release(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_cycle,'00000000-0000-4000-9000-000000010191','00000000-0000-4000-9000-000000010432'))<>1 then raise exception 'g5_rev_race_release_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g5_obs',format($obs$
        select count(*)::integer
          from pg_stat_activity a
         where a.pid=%s
           and (%s = any(pg_blocking_pids(a.pid)) or %s = any(pg_blocking_pids(a.pid)))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_release_pid, v_blocker_pid, v_revoker_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g5_release_session_not_blocked_behind_revocation'; end if;
  insert into pickup_g5_barriers values('revoke_vs_release_lock_wait',true);
  perform dblink_exec('g5_rev_blocker','commit');
  perform result from dblink_get_result('g5_revoker') as t(result jsonb);
  select result into v_result from dblink_get_result('g5_rev_release') as t(result jsonb);
  insert into pickup_g5_race_results values('revoke_vs_release','release',v_result);
  perform result from dblink_get_result('g5_rev_release') as t(result jsonb);
  perform dblink_disconnect('g5_rev_release'); perform dblink_disconnect('g5_revoker'); perform dblink_disconnect('g5_rev_blocker'); perform dblink_disconnect('g5_obs');
end;
$$;
select extensions.ok((select observed from pickup_g5_barriers where barrier_name='revoke_vs_release_lock_wait'),'G5-C: observer verified revocation and release queued deterministically on profile lock');
select extensions.is((select result->>'code' from pickup_g5_race_results where case_name='revoke_vs_release'),'pickup_release_authority_revoked','release queued behind committed revocation is denied');
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010141'),'PARENT_ARRIVED','revocation race does not alter custody cycle');
select extensions.ok((select is_revoked from public.pickup_release_revocations where target_user_id='00000000-0000-4000-9000-000000010103'),'concurrent App Admin revocation committed before waiting release');

-- Queue Attendance correction before release on the same attendance entry lock.
do $$
declare
  v_conn text; v_cycle uuid; v_blocker_pid integer; v_correct_pid integer; v_release_pid integer;
  v_waiters integer; v_result jsonb; i integer; v_mark text;
begin
  v_conn:=format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g5_obs',v_conn);
  perform dblink_connect('g5_att_blocker',v_conn); perform dblink_connect('g5_att_correct',v_conn); perform dblink_connect('g5_att_release',v_conn);
  select pid into v_blocker_pid from dblink('g5_att_blocker','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_blocker_pid);
  select pid into v_correct_pid from dblink('g5_att_correct','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_correct_pid);
  select pid into v_release_pid from dblink('g5_att_release','select pg_backend_pid()') as t(pid integer); insert into pickup_g5_session_pids values(v_release_pid);
  perform dblink_exec('g5_att_release','set request.jwt.claim.sub=''00000000-0000-4000-9000-000000010101''');
  perform dblink_exec('g5_att_release','set request.jwt.claims=''{"sub":"00000000-0000-4000-9000-000000010101","role":"authenticated"}''');
  perform dblink_exec('g5_att_release','set role authenticated');
  perform dblink_exec('g5_att_blocker','begin');
  perform 1 from dblink('g5_att_blocker','select student_id from public.attendance_entries where register_id=''00000000-0000-4000-9000-000000010171'' and student_id=''00000000-0000-4000-9000-000000010142'' for update') as t(student_id uuid);
  if dblink_send_query('g5_att_correct',$q$update public.attendance_entries set mark='ABSENT' where register_id='00000000-0000-4000-9000-000000010171' and student_id='00000000-0000-4000-9000-000000010142' returning mark$q$)<>1 then raise exception 'g5_attendance_correction_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g5_obs',format($obs$
        select count(*)::integer
          from pg_stat_activity a
         where a.pid=%s
           and %s = any(pg_blocking_pids(a.pid))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_correct_pid, v_blocker_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g5_attendance_correction_not_blocked_on_lock'; end if;
  v_cycle:=public.pickup_g5_test_cycle_id('00000000-0000-4000-9000-000000010142');
  if dblink_send_query('g5_att_release',format('select public.pickup_g5_test_capture_release(%L::uuid,%L::uuid,%L::uuid,2,true,null)',v_cycle,'00000000-0000-4000-9000-000000010192','00000000-0000-4000-9000-000000010433'))<>1 then raise exception 'g5_attendance_race_release_not_accepted'; end if;
  v_waiters:=0;
  for i in 1..200 loop
    select blocked_count into v_waiters
      from dblink('g5_obs',format($obs$
        select count(*)::integer
          from pg_stat_activity a
         where a.pid=%s
           and (%s = any(pg_blocking_pids(a.pid)) or %s = any(pg_blocking_pids(a.pid)))
           and (a.wait_event_type='Lock' or exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted))
      $obs$, v_release_pid, v_blocker_pid, v_correct_pid)) as t(blocked_count integer);
    exit when v_waiters=1;
    perform pg_sleep(0.05);
  end loop;
  if v_waiters<>1 then raise exception 'g5_attendance_race_release_not_blocked_on_lock'; end if;
  insert into pickup_g5_barriers values('attendance_vs_release_lock_wait',true);
  perform dblink_exec('g5_att_blocker','commit');
  select mark into v_mark from dblink_get_result('g5_att_correct') as t(mark text);
  select result into v_result from dblink_get_result('g5_att_release') as t(result jsonb);
  insert into pickup_g5_race_results values('attendance_vs_release','release',v_result);
  perform result from dblink_get_result('g5_att_release') as t(result jsonb);
  perform dblink_disconnect('g5_att_release'); perform dblink_disconnect('g5_att_correct'); perform dblink_disconnect('g5_att_blocker'); perform dblink_disconnect('g5_obs');
end;
$$;
select extensions.ok((select observed from pickup_g5_barriers where barrier_name='attendance_vs_release_lock_wait'),'G5-C: observer verified attendance correction and release queued deterministically on attendance lock');
select extensions.is((select result->>'code' from pickup_g5_race_results where case_name='attendance_vs_release'),'attendance_ineligible','release queued behind committed ABSENT correction is denied');
select extensions.is((select mark from public.attendance_entries where register_id='00000000-0000-4000-9000-000000010171' and student_id='00000000-0000-4000-9000-000000010142'),'ABSENT','concurrent Attendance correction commits before release revalidation');
select extensions.is((select state from public.pickup_cycles where student_id='00000000-0000-4000-9000-000000010142'),'PARENT_ARRIVED','Attendance race preserves arrival but does not falsely confirm release');

drop function public.pickup_g5_test_capture_release(uuid,uuid,uuid,integer,boolean,text);
drop function public.pickup_g5_test_cycle_id(uuid);
select * from extensions.finish();
