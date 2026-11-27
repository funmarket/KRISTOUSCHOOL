-- Normalized public-catalog parity gate for the installed 20-migration baseline.
-- Expected fingerprints were captured read-only from ofppapwofhovhroyjtkc.
-- This test runs against the clean isolated database built by `supabase db reset`.
-- It compares the G2 baseline only, not OIDs or row data. ENROLL-D01 changes only
-- review_enrollment_application among baseline sources; its expected source digest
-- includes that reviewed replacement. New admission objects/column/FK/index are
-- excluded narrowly and tested in enrollment_admission_completion.test.sql.
-- Later feature-stage
-- objects are excluded explicitly so this regression gate remains meaningful.

begin;

select extensions.plan(11);

create temporary table migration_catalog_fingerprints on commit drop as
with
pickup_relations(relname) as (
  values
    ('dismissal_policies'),('pickup_dismissal_policy_audit_logs'),('authorized_pickup_persons'),
    ('pickup_release_revocations'),('pickup_authority_audit_logs'),('pickup_cycles'),
    ('pickup_requests'),('pickup_events'),('early_departure_requests'),
    ('pickup_audit_export_logs'),('pickup_person_audit_logs'),
    ('pickup_events_id_seq'),('pickup_authority_audit_logs_id_seq'),
    ('pickup_audit_export_logs_id_seq'),('pickup_person_audit_logs_id_seq'),
    ('pickup_dismissal_policy_audit_logs_id_seq'),
    -- ENROLL-D01 additions have their own admission regression suite.
    ('enrollment_admission_completions'),('enrollment_admission_audit_logs'),
    ('family_guardian_audit_logs') -- ENROLL-D02 tested separately
),
pickup_routines(proname) as (
  values
    ('pickup_immutable_audit_row'),('pickup_protect_cycle_identity'),
    ('pickup_touch_early_departure_request'),('pickup_validate_new_cycle'),
    ('pickup_actor_is_app_admin'),('pickup_actor_can_confirm_release'),
    ('pickup_actor_can_view_student'),('pickup_parent_can_announce_arrival'),
    ('get_pickup_actor_authority'),('get_pickup_student_eligibility'),
    ('revoke_user_pickup_release_authority'),('reinstate_user_pickup_release_authority'),
    ('create_pickup_dismissal_policy'),('replace_pickup_dismissal_policy'),
    ('pickup_resolve_schedule'),('get_pickup_schedule'),
    ('create_authorized_pickup_person'),('revoke_authorized_pickup_person'),
    ('list_authorized_pickup_persons'),('export_pickup_events'),
    ('get_pickup_parent_board'),('get_pickup_staff_board'),
    ('parent_arrived'),('get_pickup_operation_receipt'),
    ('provision_pickup_cycles'),('release_pupil'),
    ('revoke_pickup_release_authority'),('reinstate_pickup_release_authority'),
    ('get_pickup_early_departures'),('request_early_departure'),
    ('review_early_departure'),('complete_early_departure_release'),
    ('claim_pickup_outbox_batch'),('acknowledge_pickup_outbox_delivery'),
    ('get_pickup_outbox_summary'),('retry_failed_pickup_notifications'),
    ('enrollment_actor_can_complete'),('enrollment_reject_audit_mutation'),('complete_enrollment_admission'),
    ('get_enrollment_review_access'),('list_enrollment_applications'),('assign_existing_student_to_class'),
    ('list_student_guardians'),('review_student_guardian'),('family_reject_audit_mutation')
),
rel as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity,c.relpersistence,c.relispartition) s
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
),
cols as (
  select format('%s.%s.%s|%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),''),a.attidentity,a.attgenerated,coalesce(coll.collname,'')) s
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  left join pg_collation coll on coll.oid=a.attcollation and a.attcollation<>0
  where n.nspname='public' and c.relkind in ('r','p','v','m','f') and a.attnum>0 and not a.attisdropped
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
    and not (c.relname='notification_outbox' and a.attname in (
      'delivery_status','attempt_count','next_attempt_at','claimed_at','sent_at','last_error','provider_message_id'
    ))
    and not (c.relname='enrollment_applications' and a.attname='student_id')
),
cons as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,co.conname,co.contype,co.convalidated,co.condeferrable,co.condeferred,pg_get_constraintdef(co.oid,true)) s
  from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
    and not (c.relname='notification_outbox' and co.conname like 'notification_outbox_g7_%')
    and not (c.relname='enrollment_applications' and co.conname='enrollment_applications_student_id_fkey')
),
idx as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,ic.relname,i.indisunique,i.indisprimary,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) s
  from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class ic on ic.oid=i.indexrelid
  where n.nspname='public'
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
    and not (c.relname='notification_outbox' and ic.relname like 'notification_outbox_g7_%')
    and not (c.relname='enrollment_applications' and ic.relname='enrollment_applications_student_id_idx')
),
trig as (
  select format('%s.%s|%s|%s|%s|%s',n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true),t.tgfoid::regprocedure::text) s
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
),
proc_meta as (
  select format('%s|%s|%s|%s|%s|%s|%s|%s|%s',p.oid::regprocedure::text,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,pg_get_userbyid(p.proowner),p.prosecdef,p.provolatile,p.proisstrict,coalesce(array_to_string(p.proconfig,','),'')) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prokind in ('f','p')
    and not exists (select 1 from pickup_routines x where x.proname=p.proname)
),
proc_source as (
  select format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',p.oid::regprocedure::text,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,pg_get_userbyid(p.proowner),p.prosecdef,p.provolatile,p.proisstrict,coalesce(array_to_string(p.proconfig,','),''),regexp_replace(p.prosrc,'\s+',' ','g')) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prokind in ('f','p')
    and not exists (select 1 from pickup_routines x where x.proname=p.proname)
),
pol as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',schemaname,tablename,policyname,cmd,permissive,array_to_string(roles,','),coalesce(qual,''),coalesce(with_check,'')) s
  from pg_policies where schemaname='public'
    and not exists (select 1 from pickup_relations x where x.relname=tablename)
),
table_grants as (
  select format('%s.%s|%s|%s|%s|%s',n.nspname,c.relname,case when x.grantee=0 then 'PUBLIC' else gr.rolname end,go.rolname,x.privilege_type,x.is_grantable) s
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) x
  left join pg_roles gr on gr.oid=x.grantee left join pg_roles go on go.oid=x.grantor
  where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
    and not exists (select 1 from pickup_relations x where x.relname=c.relname)
),
routine_grants as (
  select format('%s|%s|%s|%s|%s',p.oid::regprocedure::text,case when x.grantee=0 then 'PUBLIC' else gr.rolname end,go.rolname,x.privilege_type,x.is_grantable) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f'::"char",p.proowner))) x
  left join pg_roles gr on gr.oid=x.grantee left join pg_roles go on go.oid=x.grantor
  where n.nspname='public' and p.prokind in ('f','p')
    and not exists (select 1 from pickup_routines x where x.proname=p.proname)
),
types as (
  select format('%s|%s|%s|%s|%s|%s',n.nspname||'.'||t.typname,t.typtype,pg_get_userbyid(t.typowner),t.typcategory,
    case when t.typtype='d' then format('%s|%s|%s',format_type(t.typbasetype,t.typtypmod),t.typnotnull,coalesce(pg_get_expr(t.typdefaultbin,0),'')) else '' end,
    coalesce((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid),'')) s
  from pg_type t join pg_namespace n on n.oid=t.typnamespace
  where n.nspname='public' and t.typtype in ('e','d','r','m')
),
fingerprints as (
  select 'relations' category,count(*) n,md5(coalesce(string_agg(s,E'\n' order by s),'')) digest from rel
  union all select 'columns',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from cols
  union all select 'constraints',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from cons
  union all select 'indexes',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from idx
  union all select 'triggers',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from trig
  union all select 'function_metadata',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from proc_meta
  union all select 'function_source',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from proc_source
  union all select 'policies',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from pol
  union all select 'table_grants',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from table_grants
  union all select 'routine_grants',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from routine_grants
  union all select 'types',count(*),md5(coalesce(string_agg(s,E'\n' order by s),'')) from types
)
select category,n,digest from fingerprints;
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='relations'),'50:6a45512997971f57eff829e358ef9767','public relations: normalized definition/owner/RLS fingerprint matches hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='columns'),'519:94c56097d3ae7f3f32b17028ea3bffbe','public columns: names/order/types/nullability/defaults match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='constraints'),'304:abbf5bd358ceb8254b66cc2144543a17','public constraints: primary/unique/foreign-key/check definitions match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='indexes'),'93:a3105f3a779e0a734a272d36e55f5000','public indexes match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='triggers'),'40:243e9c72292fe2a2ac8dbec5220555f5','public triggers and trigger functions match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='function_metadata'),'99:9ddcd3aced7d4b67a59dd643b2c63a55','public function signatures/security/owners/configuration match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='function_source'),'99:b95435ae4b1eb6d8988b9496eb9dd204','public function sources match baseline plus reviewed ENROLL-D01 replacement after whitespace normalization');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='policies'),'56:d093adf4ea11deae5d7067ae0fc9fa4a','public RLS policies match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='table_grants'),'839:2643402505bd4f6a74a930e30cd9e5b5','public table/view/sequence grants match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='routine_grants'),'295:97acc07e6163e9b2b1bdf889faec8761','public routine grants match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='types'),'2:ad0b86ba85981a94326ee576e14f199f','public custom type definitions and enum labels match hosted baseline');

select * from extensions.finish();

rollback;
