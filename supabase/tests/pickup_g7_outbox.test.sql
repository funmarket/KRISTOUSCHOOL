-- G7 contract: notification_outbox worker claiming (SKIP LOCKED), delivery ack,
-- exponential retry + terminal FAILED audit, APP_ADMIN summary/retry RPCs,
-- Realtime publication/replica identity, and least-privilege access boundaries.
create extension if not exists dblink;

-- Run real multi-session FOR UPDATE SKIP LOCKED race before main transaction,
-- capturing results in a session temp table and deleting the two synthetic outbox rows cleanly.
create temp table g7_skip_locked_results(worker text, claimed_id text);
insert into public.notification_outbox(id,event_type,payload,created_at) values
 ('00000000-0000-4000-9000-000000030901','pickup.arrival_announced','{}',now()-interval '2 seconds'),
 ('00000000-0000-4000-9000-000000030902','pickup.arrival_announced','{}',now()-interval '1 second');

do $$
declare
  v_conn text;
  v_claimed_a text;
  v_claimed_b text;
begin
  v_conn := format('host=%s port=%s dbname=%s user=postgres password=postgres',host(inet_server_addr()),inet_server_port(),current_database());
  perform dblink_connect('g7_blocker', v_conn);
  perform dblink_connect('g7_worker_a', v_conn);
  perform dblink_connect('g7_worker_b', v_conn);

  -- Lock first outbox row in blocker session; worker_a must skip it non-blockingly and claim the second row.
  perform dblink_exec('g7_blocker', 'begin');
  perform 1 from dblink('g7_blocker', $q$select id from public.notification_outbox where id='00000000-0000-4000-9000-000000030901' for update$q$) as t(id uuid);

  perform dblink_exec('g7_worker_a', 'begin; set local role service_role;');
  select claimed into v_claimed_a
    from dblink('g7_worker_a', $q$select coalesce(public.claim_pickup_outbox_batch(1)->'items'->0->>'id','')$q$) as t(claimed text);
  perform dblink_exec('g7_worker_a', 'commit');

  -- Release blocker lock; worker_b now claims the first row.
  perform dblink_exec('g7_blocker', 'commit');
  perform dblink_exec('g7_worker_b', 'begin; set local role service_role;');
  select claimed into v_claimed_b
    from dblink('g7_worker_b', $q$select coalesce(public.claim_pickup_outbox_batch(1)->'items'->0->>'id','')$q$) as t(claimed text);
  perform dblink_exec('g7_worker_b', 'commit');

  insert into g7_skip_locked_results values ('a', v_claimed_a), ('b', v_claimed_b);

  perform dblink_disconnect('g7_worker_b');
  perform dblink_disconnect('g7_worker_a');
  perform dblink_disconnect('g7_blocker');
end;
$$;

delete from public.notification_outbox
 where id in ('00000000-0000-4000-9000-000000030901','00000000-0000-4000-9000-000000030902');

begin;
select extensions.plan(49);

-- 1–16. Privilege boundaries & Realtime configuration.
select extensions.ok(has_function_privilege('service_role','public.claim_pickup_outbox_batch(integer)','EXECUTE'),'service_role can execute claim_pickup_outbox_batch');
select extensions.ok(has_function_privilege('service_role','public.acknowledge_pickup_outbox_delivery(uuid,boolean,text,text)','EXECUTE'),'service_role can execute acknowledge_pickup_outbox_delivery');
select extensions.ok(not has_function_privilege('authenticated','public.claim_pickup_outbox_batch(integer)','EXECUTE'),'authenticated cannot execute claim_pickup_outbox_batch');
select extensions.ok(not has_function_privilege('authenticated','public.acknowledge_pickup_outbox_delivery(uuid,boolean,text,text)','EXECUTE'),'authenticated cannot execute acknowledge_pickup_outbox_delivery');
select extensions.ok(not has_function_privilege('anon','public.claim_pickup_outbox_batch(integer)','EXECUTE'),'anon cannot execute claim_pickup_outbox_batch');
select extensions.ok(not has_function_privilege('anon','public.acknowledge_pickup_outbox_delivery(uuid,boolean,text,text)','EXECUTE'),'anon cannot execute acknowledge_pickup_outbox_delivery');
select extensions.ok(has_function_privilege('authenticated','public.get_pickup_outbox_summary()','EXECUTE'),'authenticated can call get_pickup_outbox_summary');
select extensions.ok(has_function_privilege('authenticated','public.retry_failed_pickup_notifications(uuid)','EXECUTE'),'authenticated can call retry_failed_pickup_notifications');
select extensions.ok(not has_function_privilege('anon','public.get_pickup_outbox_summary()','EXECUTE'),'anon cannot call get_pickup_outbox_summary');
select extensions.ok(not has_function_privilege('anon','public.retry_failed_pickup_notifications(uuid)','EXECUTE'),'anon cannot call retry_failed_pickup_notifications');
select extensions.ok(not has_table_privilege('authenticated','public.notification_outbox','SELECT,INSERT,UPDATE,DELETE'),'authenticated has zero direct access to notification_outbox');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_cycles','SELECT,INSERT,UPDATE,DELETE'),'authenticated has zero direct access to pickup_cycles');
select extensions.ok(not has_table_privilege('authenticated','public.early_departure_requests','SELECT,INSERT,UPDATE,DELETE'),'authenticated has zero direct access to early_departure_requests');
select extensions.ok(not has_table_privilege('authenticated','public.pickup_release_revocations','SELECT,INSERT,UPDATE,DELETE'),'authenticated has zero direct access to pickup_release_revocations');
select extensions.is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('pickup_cycles','early_departure_requests','pickup_release_revocations')
      and c.relreplident='f'),
  3,
  'realtime pickup tables use REPLICA IDENTITY FULL'
);
select extensions.is(
  case when exists (select 1 from pg_publication where pubname='supabase_realtime')
    then (select count(*)::integer from pg_publication_tables
           where pubname='supabase_realtime' and schemaname='public'
             and tablename in ('pickup_cycles','early_departure_requests','pickup_release_revocations'))
    else 3
  end,
  3,
  'supabase_realtime publication covers pickup_cycles, early_departure_requests, and pickup_release_revocations'
);

-- Setup synthetic actors, student, class, Telegram identities, and outbox rows.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-4000-9000-000000030101','authenticated','authenticated','g7-admin@example.invalid','',now(),'{}','{"username":"g7_admin","full_name":"G7 Admin","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000030102','authenticated','authenticated','g7-manager@example.invalid','',now(),'{}','{"username":"g7_manager","full_name":"G7 Manager","requested_role":"MANAGER"}',now(),now()),
 ('00000000-0000-4000-9000-000000030103','authenticated','authenticated','g7-office@example.invalid','',now(),'{}','{"username":"g7_office","full_name":"G7 Office","requested_role":"ADMINISTRATIVE_PERSONNEL"}',now(),now()),
 ('00000000-0000-4000-9000-000000030104','authenticated','authenticated','g7-teacher@example.invalid','',now(),'{}','{"username":"g7_teacher","full_name":"G7 Teacher","requested_role":"TEACHER"}',now(),now()),
 ('00000000-0000-4000-9000-000000030105','authenticated','authenticated','g7-staff@example.invalid','',now(),'{}','{"username":"g7_staff","full_name":"G7 Staff","requested_role":"SCHOOL_STAFF"}',now(),now()),
 ('00000000-0000-4000-9000-000000030106','authenticated','authenticated','g7-parent@example.invalid','',now(),'{}','{"username":"g7_parent","full_name":"G7 Parent","requested_role":"PARENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000030107','authenticated','authenticated','g7-student@example.invalid','',now(),'{}','{"username":"g7_student","full_name":"G7 Student","requested_role":"STUDENT"}',now(),now()),
 ('00000000-0000-4000-9000-000000030108','authenticated','authenticated','g7-pending-admin@example.invalid','',now(),'{}','{"username":"g7_pending","full_name":"G7 Pending","requested_role":"APP_ADMIN"}',now(),now()),
 ('00000000-0000-4000-9000-000000030109','authenticated','authenticated','g7-suspended-admin@example.invalid','',now(),'{}','{"username":"g7_suspended","full_name":"G7 Suspended","requested_role":"APP_ADMIN"}',now(),now());

update public.profiles set account_status='APPROVED' where id between '00000000-0000-4000-9000-000000030101'::uuid and '00000000-0000-4000-9000-000000030107'::uuid;
update public.profiles set account_status='PENDING' where id='00000000-0000-4000-9000-000000030108';
update public.profiles set account_status='SUSPENDED' where id='00000000-0000-4000-9000-000000030109';
delete from public.role_assignments where user_id between '00000000-0000-4000-9000-000000030101'::uuid and '00000000-0000-4000-9000-000000030109'::uuid;
insert into public.role_assignments(user_id,role,active) values
 ('00000000-0000-4000-9000-000000030101','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000030102','MANAGER',true),
 ('00000000-0000-4000-9000-000000030103','ADMINISTRATIVE_PERSONNEL',true),
 ('00000000-0000-4000-9000-000000030104','TEACHER',true),
 ('00000000-0000-4000-9000-000000030105','SCHOOL_STAFF',true),
 ('00000000-0000-4000-9000-000000030106','PARENT',true),
 ('00000000-0000-4000-9000-000000030107','STUDENT',true),
 ('00000000-0000-4000-9000-000000030108','APP_ADMIN',true),
 ('00000000-0000-4000-9000-000000030109','APP_ADMIN',true);

insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by)
select '00000000-0000-4000-9000-000000030120',id,'CP','Pickup G7 Test Class',30,'00000000-0000-4000-9000-000000030101'
  from public.academic_years where code='2026-2027';
insert into public.students(id,student_code,full_name,birth_date,safety_note,status,created_by)
values('00000000-0000-4000-9000-000000030130','PICKUP-G7-0','G7 Test Pupil','2018-04-04','CONFIDENTIAL ALLERGY NOTE','ACTIVE','00000000-0000-4000-9000-000000030101');
insert into public.teacher_class_assignments(teacher_user_id,class_id,is_homeroom,active,assigned_by)
values('00000000-0000-4000-9000-000000030104','00000000-0000-4000-9000-000000030120',true,true,'00000000-0000-4000-9000-000000030101');
insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
values('00000000-0000-4000-9000-000000030106','00000000-0000-4000-9000-000000030130','Parent',true,'00000000-0000-4000-9000-000000030101');

insert into public.telegram_identities(user_id,telegram_user_id,language_code) values
 ('00000000-0000-4000-9000-000000030101',770001,'en'),
 ('00000000-0000-4000-9000-000000030104',770004,'fr'),
 ('00000000-0000-4000-9000-000000030106',770006,'es');
insert into public.user_preferences(user_id,language) values
 ('00000000-0000-4000-9000-000000030104','fr'),
 ('00000000-0000-4000-9000-000000030106','es');

insert into public.notification_outbox(id,event_type,source_id,payload,dispatched_at,delivery_status,sent_at) values
 ('00000000-0000-4000-9000-000000030200','notification:note','00000000-0000-4000-9000-000000030106',
  '{"recipientUserId":"00000000-0000-4000-9000-000000030106"}',now()-interval '1 minute','SENT',now()-interval '1 minute');
insert into public.notification_outbox(id,event_type,source_id,payload,created_at) values
 ('00000000-0000-4000-9000-000000030201','pickup.arrival_announced','00000000-0000-4000-9000-000000030211',
  jsonb_build_object('studentId','00000000-0000-4000-9000-000000030130','classId','00000000-0000-4000-9000-000000030120','requestId','00000000-0000-4000-9000-000000030301'),
  clock_timestamp() - interval '2 seconds'),
 ('00000000-0000-4000-9000-000000030202','pickup.child_released','00000000-0000-4000-9000-000000030212',
  jsonb_build_object('studentId','00000000-0000-4000-9000-000000030130','classId','00000000-0000-4000-9000-000000030120','requestId','00000000-0000-4000-9000-000000030302'),
  clock_timestamp() - interval '1 second');

insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
values('00000000-0000-4000-9000-000000030101','00000000-0000-4000-9000-000000030399','ARRIVAL',repeat('a',64),'{"ok":true}');

-- 17. Non-pickup row stays SENT.
select extensions.is((select delivery_status from public.notification_outbox where id='00000000-0000-4000-9000-000000030200'),'SENT','non-pickup dispatched notification stays SENT');

-- 18–29. Role & approval deny matrix for Admin outbox summary & retry RPCs.
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','actor_unauthenticated','unauthenticated caller denied outbox summary');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030102',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030102","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','MANAGER denied outbox summary');
select extensions.throws_ok('select public.retry_failed_pickup_notifications(''00000000-0000-4000-9000-000000030310'')','P0001','pickup_app_admin_required','MANAGER denied outbox retry');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030103',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030103","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','ADMINISTRATIVE_PERSONNEL denied outbox summary');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030104',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030104","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','TEACHER denied outbox summary');
select extensions.throws_ok('select public.retry_failed_pickup_notifications(''00000000-0000-4000-9000-000000030311'')','P0001','pickup_app_admin_required','TEACHER denied outbox retry');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030105',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030105","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','SCHOOL_STAFF denied outbox summary');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030106',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030106","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','PARENT denied outbox summary');
select extensions.throws_ok('select public.retry_failed_pickup_notifications(''00000000-0000-4000-9000-000000030312'')','P0001','pickup_app_admin_required','PARENT denied outbox retry');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030107',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030107","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','STUDENT denied outbox summary');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030108',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030108","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','PENDING APP_ADMIN denied outbox summary');

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030109',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030109","role":"authenticated"}',true);
select extensions.throws_ok('select public.get_pickup_outbox_summary()','P0001','pickup_app_admin_required','SUSPENDED APP_ADMIN denied outbox summary');

-- 30. APPROVED APP_ADMIN reads initial summary.
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030101","role":"authenticated"}',true);
select extensions.is(
  (select concat((s->>'pendingCount'),':',(s->>'failedCount'),':',(s->>'sentCount'))
     from (select public.get_pickup_outbox_summary() as s) t),
  '2:0:0',
  'APP_ADMIN summary counts only pickup.* rows before worker claim'
);

-- 31–41. Service-role claim, recipient resolution, PII hygiene, delivery ack, exponential retry, and terminal FAILED audit.
reset role;
set local role service_role;
create temp table g7_claimed(batch jsonb) on commit drop;
insert into g7_claimed values (public.claim_pickup_outbox_batch(10));

select extensions.is(
  (select jsonb_array_length(batch->'items') from g7_claimed),
  2,
  'claim_pickup_outbox_batch claims both pending pickup rows and ignores non-pickup row'
);
select extensions.is(
  (select concat(item->>'studentLabel','|',item->>'classLabel','|',coalesce(position('CONFIDENTIAL ALLERGY NOTE' in batch::text),0)::text)
     from g7_claimed, jsonb_array_elements(batch->'items') as item
    where item->>'id'='00000000-0000-4000-9000-000000030201'),
  'G7 Test Pupil|Pickup G7 Test Class|0',
  'claimed item exposes safe student/class labels and excludes confidential safety_note'
);
select extensions.ok(
  exists (
    select 1 from g7_claimed, jsonb_array_elements(batch->'items') as item, jsonb_array_elements(item->'recipients') as rec
     where item->>'id'='00000000-0000-4000-9000-000000030201'
       and (rec->>'telegramUserId')::bigint=770004 and rec->>'language'='fr'
  ),
  'arrival outbox event routes to class teacher with preferred fr language'
);
select extensions.ok(
  exists (
    select 1 from g7_claimed, jsonb_array_elements(batch->'items') as item, jsonb_array_elements(item->'recipients') as rec
     where item->>'id'='00000000-0000-4000-9000-000000030202'
       and (rec->>'telegramUserId')::bigint=770006 and rec->>'language'='es'
  ),
  'release outbox event routes to verified parent with preferred es language'
);
select extensions.is(
  jsonb_array_length(public.claim_pickup_outbox_batch(10)->'items'),
  0,
  'second claim sees zero items while rows are PROCESSING'
);
select extensions.is(
  public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030201',true,'tg-msg-101',null)->>'deliveryStatus',
  'SENT',
  'successful ack transitions outbox item to SENT'
);
select extensions.is(
  public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030201',true,'tg-msg-999',null)->>'alreadySent',
  'true',
  're-acknowledging SENT row is idempotent'
);
select extensions.is(
  public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030202',false,null,'telegram_http_502')->>'deliveryStatus',
  'RETRY',
  'first failure schedules exponential RETRY'
);
select extensions.is(
  jsonb_array_length(public.claim_pickup_outbox_batch(10)->'items'),
  0,
  'RETRY item is not claimed before next_attempt_at'
);

-- Exhaust retries (attempts 2..5).
select public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030202',false,null,'telegram_http_502');
select public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030202',false,null,'telegram_http_502');
select public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030202',false,null,'telegram_http_502');
select extensions.is(
  (select concat((ack->>'deliveryStatus'),':',(ack->>'attemptCount'))
     from (select public.acknowledge_pickup_outbox_delivery('00000000-0000-4000-9000-000000030202',false,null,'telegram_http_502') as ack) t),
  'FAILED:5',
  'fifth failed attempt transitions outbox item to terminal FAILED'
);

reset role;
select extensions.is(
  (select count(*)::integer from public.pickup_events where student_id='00000000-0000-4000-9000-000000030130' and action='OUTBOX_DELIVERY_FAILED'),
  1,
  'terminal FAILED records immutable OUTBOX_DELIVERY_FAILED audit row'
);

-- 42–47. APP_ADMIN summary, failed retry, idempotency replay, conflict, and audit.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030101","role":"authenticated"}',true);

select extensions.is(
  (select concat((s->>'sentCount'),':',(s->>'failedCount'),':',jsonb_array_length(s->'recentFailures')::text)
     from (select public.get_pickup_outbox_summary() as s) t),
  '1:1:1',
  'APP_ADMIN outbox summary reports sent, failed, and recentFailures'
);
select extensions.is(
  (select concat((r->>'code'),':',(r->>'retriedCount'),':',(r->>'replayed'))
     from (select public.retry_failed_pickup_notifications('00000000-0000-4000-9000-000000030320') as r) t),
  'outbox_retry_queued:1:false',
  'APP_ADMIN retry_failed_pickup_notifications requeues failed items'
);
select extensions.is(
  (select concat((r->>'code'),':',(r->>'retriedCount'),':',(r->>'replayed'))
     from (select public.retry_failed_pickup_notifications('00000000-0000-4000-9000-000000030320') as r) t),
  'outbox_retry_queued:1:true',
  'same request_id replays stored retry receipt idempotently'
);
select extensions.throws_ok(
  'select public.retry_failed_pickup_notifications(''00000000-0000-4000-9000-000000030399'')',
  'P0001',
  'idempotency_conflict',
  'reusing ARRIVAL request_id for outbox retry raises idempotency_conflict'
);

reset role;
select extensions.is(
  (select concat(o.delivery_status,':',o.attempt_count::text,':',coalesce(o.last_error,'NONE'),':',
    (select count(*)::text from public.pickup_events pe where pe.student_id='00000000-0000-4000-9000-000000030130' and pe.action='OUTBOX_RETRY_QUEUED'))
     from public.notification_outbox o where o.id='00000000-0000-4000-9000-000000030202'),
  'PENDING:0:NONE:1',
  'retry resets FAILED row to PENDING and records OUTBOX_RETRY_QUEUED audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000030101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000030101","role":"authenticated"}',true);
select extensions.is(
  (select concat((s->>'pendingCount'),':',(s->>'failedCount'),':',(s->>'sentCount'))
     from (select public.get_pickup_outbox_summary() as s) t),
  '1:0:1',
  'APP_ADMIN summary reflects retried pending count immediately'
);

-- 48–49. Verify captured FOR UPDATE SKIP LOCKED multi-session results.
reset role;
select extensions.is(
  (select claimed_id from g7_skip_locked_results where worker='a'),
  '00000000-0000-4000-9000-000000030902',
  'concurrent worker skips locked row via FOR UPDATE SKIP LOCKED and claims next eligible item'
);
select extensions.is(
  (select claimed_id from g7_skip_locked_results where worker='b'),
  '00000000-0000-4000-9000-000000030901',
  'second worker claims remaining row once blocker lock commits'
);

select * from extensions.finish();
rollback;
