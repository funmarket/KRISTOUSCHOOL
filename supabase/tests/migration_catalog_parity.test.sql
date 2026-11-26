-- Normalized public-catalog parity gate for the installed 20-migration baseline.
-- Expected fingerprints were captured read-only from ofppapwofhovhroyjtkc.
-- This test runs against the clean isolated database built by `supabase db reset`.
-- It compares stable catalog definitions and grants, not OIDs or row data.

begin;

select extensions.plan(12);

create temporary table migration_catalog_fingerprints on commit drop as
with
rel as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity,c.relpersistence,c.relispartition) s
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
),
cols as (
  select format('%s.%s.%s|%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),''),a.attidentity,a.attgenerated,coalesce(coll.collname,'')) s
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  left join pg_collation coll on coll.oid=a.attcollation and a.attcollation<>0
  where n.nspname='public' and c.relkind in ('r','p','v','m','f') and a.attnum>0 and not a.attisdropped
),
cons as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,co.conname,co.contype,co.convalidated,co.condeferrable,co.condeferred,pg_get_constraintdef(co.oid,true)) s
  from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
),
idx as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',n.nspname,c.relname,ic.relname,i.indisunique,i.indisprimary,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) s
  from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class ic on ic.oid=i.indexrelid
  where n.nspname='public'
),
trig as (
  select format('%s.%s|%s|%s|%s|%s',n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true),t.tgfoid::regprocedure::text) s
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
),
proc_meta as (
  select format('%s|%s|%s|%s|%s|%s|%s|%s|%s',p.oid::regprocedure::text,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,pg_get_userbyid(p.proowner),p.prosecdef,p.provolatile,p.proisstrict,coalesce(array_to_string(p.proconfig,','),'')) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prokind in ('f','p')
),
proc_source as (
  select format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',p.oid::regprocedure::text,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,pg_get_userbyid(p.proowner),p.prosecdef,p.provolatile,p.proisstrict,coalesce(array_to_string(p.proconfig,','),''),p.prosrc) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prokind in ('f','p')
),
pol as (
  select format('%s.%s|%s|%s|%s|%s|%s|%s',schemaname,tablename,policyname,cmd,permissive,array_to_string(roles,','),coalesce(qual,''),coalesce(with_check,'')) s
  from pg_policies where schemaname='public'
),
table_grants as (
  select format('%s.%s|%s|%s|%s|%s',n.nspname,c.relname,case when x.grantee=0 then 'PUBLIC' else gr.rolname end,go.rolname,x.privilege_type,x.is_grantable) s
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) x
  left join pg_roles gr on gr.oid=x.grantee left join pg_roles go on go.oid=x.grantor
  where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
),
routine_grants as (
  select format('%s|%s|%s|%s|%s',p.oid::regprocedure::text,case when x.grantee=0 then 'PUBLIC' else gr.rolname end,go.rolname,x.privilege_type,x.is_grantable) s
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f'::"char",p.proowner))) x
  left join pg_roles gr on gr.oid=x.grantee left join pg_roles go on go.oid=x.grantor
  where n.nspname='public' and p.prokind in ('f','p')
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
create temporary table hosted_function_source_fingerprints(signature text primary key, source_md5 text) on commit drop;
insert into hosted_function_source_fingerprints(signature,source_md5) values
  ('assign_teacher_subject_allocation(uuid,uuid,text,text)', '4a49909fc2fcdec0c62b95234951d662'),
  ('assign_teacher_to_class(uuid,uuid,boolean,boolean)', 'bdbf87cfb3539eb287bca619e70a288a'),
  ('attendance_can_read_entry(uuid,uuid)', 'c3635a5ea129555782eca72c3dd36a8d'),
  ('attendance_can_read_register(uuid)', '15f03376b2bbfb7175663ae05b241a62'),
  ('attendance_can_staff_class(uuid,uuid)', '1fde0e1484e22ec9bc5260d6f613b277'),
  ('attendance_is_family_student(uuid)', 'bec9b30441a9ac508ead2cd6ef5ef07b'),
  ('attendance_is_office()', '66dedd550b8de025ff5aecfeee88fb29'),
  ('attendance_keep_audit_immutable()', 'c909ce368f1fc927dec5985fd31a3062'),
  ('attendance_roster_fingerprint(uuid,date)', 'f3dae4d25e284c19be38da4d44aff2c9'),
  ('attendance_roster(uuid,date)', '7d100c802a1a0c360be2882125e53af5'),
  ('calendar_assert_audience(uuid)', '3a50d31127e3891c7e29a1a004ef623a'),
  ('calendar_can_read_event(uuid)', 'b7f4cd35df340f40f1817a13d82fd744'),
  ('calendar_check_audience_trigger()', 'bf1b27202c831ea268d2adf6c3aeb247'),
  ('calendar_keep_audience_immutable()', '7c371efded6ff30342b2d0b2dbe3dc4c'),
  ('can_access_class(uuid)', '9da2af67ae6f74a0daf39b70d8d0e34a'),
  ('can_access_message_thread(uuid)', 'c6b0b6750e90814472957be22a6005fe'),
  ('can_access_student_record(uuid)', 'b9c3d270f4c86d7642440b6bb9f7c2b4'),
  ('can_users_direct_message(uuid,uuid)', 'd8f1088d51851b606329a8d7b5083bff'),
  ('cancel_school_calendar_event(uuid,text)', '2e11ac2eee75c7c2782209d7e096ca9d'),
  ('claim_telegram_account_link(text,bigint,text,text,text,text)', '2c67449793848c879b7b0f9b62e61463'),
  ('create_and_enroll_student(text,text,date,uuid,uuid,text,uuid)', '5f01bcf2a57eee7187d44a53416929af'),
  ('create_class_announcement(uuid,text,text,text)', '554fa50b429ac0e01710370033d26ac8'),
  ('create_class_homework(uuid,text,text,date)', '5244f41aed90bd41df6073547e7a43c9'),
  ('create_school_calendar_event(text,text,text,date,date,text,uuid,uuid,boolean,boolean)', '347a3cf44bc928f47e48cbcd25493a3b'),
  ('create_school_class(text,text,text,integer,text)', '156a371171dc9e7e2e8b15b667c23215'),
  ('current_profile_id()', '72a6ba22c2c238ae6688f810febc2b31'),
  ('current_user_has_capability(text)', 'd6439a838b514156cf4d7558ed72afec'),
  ('current_user_has_role(app_role)', 'f688215628af36fd5a017b5e6c07cd49'),
  ('enqueue_school_notification(uuid,text,text,text,text,text)', '0e05b1f89ebb688611033ad13be89fd1'),
  ('get_attendance_register(uuid,date,uuid)', '689069a551dd16b9667374cfeeb6b03f'),
  ('get_my_class_creation_permission()', 'b40c07926273736d80d353ce81c55ff0'),
  ('get_my_school_context()', 'ba1f41d6edde39e7e8f6007861aae20a'),
  ('get_school_student_identity(uuid)', '5425e1d1ac8146830679f003c86aa63b'),
  ('governance_appoint_privileged_role(uuid,app_role,text,text,integer,boolean)', '20ff70ab7e66bb5e5d644ceb8b28d568'),
  ('governance_get_account_detail(uuid)', 'f5e42e3c7698bba03148217ca5f91d72'),
  ('governance_get_actor_scope()', '5a4d68e956195565dfd636c1b916a24d'),
  ('governance_list_account_directory(integer,integer,account_approval_status,app_role,text)', '918dd66478e1b90f40ed47644fbc60b2'),
  ('governance_list_class_creation_permissions(integer,integer)', '60f9ba0801662efc221da680f82973d5'),
  ('governance_list_manager_grants()', 'b312c75e98d4d4754db47f1b2ccb2702'),
  ('governance_list_pending_accounts(integer,integer,app_role,text)', '32d35b2dbbb3184e0530c5e51406ee98'),
  ('governance_resolve_caller_role(boolean)', '0ca87376b7823ad194173d726de51774'),
  ('governance_review_account(uuid,text,app_role,text,integer,text)', '1660aac6c013de45955a814bc20bf76e'),
  ('governance_set_class_creation_permission(uuid,boolean,text,integer)', '162881c789de369b0866469f881ac09e'),
  ('governance_set_manager_capability(uuid,text,boolean,text)', '24ae7ab25742447c1ba32a4ecfc7b2c4'),
  ('handle_new_user()', '958a2eda1df097f4332d121e55c4723c'),
  ('has_active_teacher_subject_allocation(uuid,uuid,uuid)', 'f1784fbd7168b1a99747fd7089689594'),
  ('is_allowed_username_codepoint(integer)', '6ddb2d1dc64d7ef53cea3964cee9fe8f'),
  ('is_approved_school_member()', 'ff6686f6625c58184558deb9fcee8f58'),
  ('is_linked_student_self(uuid)', '7a52310c00fb8f82ef8dbd3d68ab3c7f'),
  ('is_username_letter_or_digit_codepoint(integer)', '006ad6fcf7af5e42ad5fa981ee2c17a2'),
  ('is_username_mark_codepoint(integer)', '0a881180fad1724fb0d09d85bc061b45'),
  ('is_username_separator_codepoint(integer)', '7aa810973c4a3f26952ef701f13f0f45'),
  ('is_valid_username(text)', '3a46c3f34aedcdff99eefb9456c48687'),
  ('list_academic_subject_catalogue(text,text,text)', '4a664df544b57e685e98098968fbab26'),
  ('list_academic_years()', '2ecdc248bdf880342df14cf076e6835e'),
  ('list_approved_message_recipients()', 'efa9fbb08e042f26345d852a48a29b8a'),
  ('list_attendance_audit(uuid)', '3ebfccede68d9da83fee8a549efcd757'),
  ('list_class_subject_allocations(uuid,boolean)', '6ed6f29bcd0ddbaa5ecff56288be272a'),
  ('list_my_teacher_subject_allocations(uuid)', 'e9b893295ccaa6310bf2cdb5ef835337'),
  ('list_school_classes_with_rosters()', '1c73d6b07a4ff4cb86620b1851cae3d5'),
  ('list_school_students(text,uuid,uuid,text,integer,integer)', '072dc13ee61c6beb9297c797cefd9993'),
  ('list_student_attendance(uuid,date,date)', '39dc175f75d9db757e0e904f719ab0ca'),
  ('list_teacher_subject_allocation_events(uuid,uuid)', '5bf7da67a26acd5a9070b19fe6f19c7a'),
  ('mark_all_user_notifications_read()', '23be23c27067a71b678da68f629cb716'),
  ('mark_user_notification_read(uuid)', 'b890247a06f08cc2d377adfff322c54b'),
  ('moderate_class_question(uuid,boolean)', 'c877cf298055fe5ede8614ccc101244e'),
  ('normalize_profile_username()', 'afcaff5bdda86a20a3c4df549486963d'),
  ('normalize_username_display(text)', '209adadc4e0d34a5ad5d5d5ffe659c24'),
  ('normalize_username_key(text)', 'e4404335ba1eea37fe55ffb42091dfcd'),
  ('post_class_question(uuid,text)', 'eadae48766b3cff231eb385a8b02360b'),
  ('prevent_teacher_subject_allocation_events_mutation()', '146807f161adf8d244c7ffaf7a49dc2a'),
  ('publish_school_broadcast(text,text,text,text,boolean,uuid[],text[])', 'eafe8875b299ac60bc5345baed0caf90'),
  ('record_teacher_subject_allocation_event()', '2c838f9055892692b1cdcfdfd368f9f5'),
  ('reply_class_question(uuid,text)', 'a9395d09654a8bb59238ec2d42d79ff1'),
  ('reply_operational_thread(uuid,text)', 'f75be1fb352fd239938463a1dc3d33fa'),
  ('reply_parent_note(uuid,text)', 'd3e74a19278e4d76b9695b05ebea656a'),
  ('respond_public_inquiry(uuid,text,text)', '0ebf45af96894a6fab909f8821409543'),
  ('respond_to_calendar_event(uuid,text)', '9d9e1d4bd2f3ec9c98bbc193535e7454'),
  ('review_enrollment_application(uuid,text,text,integer)', 'eb8379d93744aa7b327fbebfcbb5a021'),
  ('save_attendance_register(uuid,date,integer,text,uuid,jsonb,boolean,text,uuid)', 'b5852c5ff83dab52bb318816c3ac2728'),
  ('save_food_menu_week(text,jsonb,boolean)', '54e550c8d91a46036fffc7c7a9c426e5'),
  ('send_operational_message(uuid,text,text)', 'db0a43734d5dd0d4223da2624fc0cf6c'),
  ('send_parent_note(uuid,text,text)', '115ad5fd44c7ee7fbc1a95f22605ddc3'),
  ('set_school_subject_offering(text,text,text,boolean,integer,text)', '9e3237e77012e4ab86ecb345b26f62d8'),
  ('set_teacher_subject_allocation_active(uuid,boolean,text)', '52ff8076a4577b8b3dbb712b0131b13c'),
  ('set_updated_at()', 'abc24736eedbd3caddc31fa9ffa658a6'),
  ('submit_enrollment_application(text,date,text,text,text,text,text)', '65e7c895e8f8dafcaeb4473d70a3737c'),
  ('submit_public_inquiry(text,text,text,text,text)', '2077a77af1199cac5a3d0c8e0b3fd8f6'),
  ('sync_teacher_subject_allocations_on_assignment_change()', '9d52af2404ed95a6d73002eeaeb25f6a'),
  ('sync_teacher_subject_allocations_on_offering_change()', 'c6add7200dfdd3255528b9b178453207'),
  ('upsert_directory_entry(uuid,text,text,text,text,text[],text[],text,boolean)', 'fa3bb1d316ada698a172de1664fc16e5'),
  ('upsert_my_preferences(text,text,text,boolean,boolean)', 'dc15402815b0f1967f2a80f5ab046003'),
  ('upsert_school_calendar_event(text,text,text,date,date,uuid,boolean,boolean)', '90d45afea407d6af9562d0141d6c615a'),
  ('upsert_subject_level_applicability(text,text,text,text,text,numeric,numeric,text)', '1e72215d57dd4f9d5b82ec09df8158b5'),
  ('validate_school_broadcast_targets()', '20608c6d71df2a1d8f53e0005a97b0fe'),
  ('validate_school_subject_offering()', '9b2bcdc8ac4daa63e2e0f41586ca8138'),
  ('validate_subject_component_parent()', '2d0419890c30e7bea9b2e0928e753e47'),
  ('validate_subject_level_applicability()', 'd967ff2c13e81845e0a9764af06a582c'),
  ('validate_teacher_subject_allocation()', '62b36feb6267431fe1dce12e9b8f3581');
create temporary table local_function_source_differences on commit drop as
select h.signature,h.source_md5 as hosted_source_md5,md5(p.prosrc) as replay_source_md5
from hosted_function_source_fingerprints h
left join pg_proc p on p.oid=h.signature::regprocedure
where p.oid is null or md5(p.prosrc)<>h.source_md5;
select extensions.diag(coalesce((select string_agg(format('%s hosted=%s replay=%s',signature,hosted_source_md5,replay_source_md5),E'\n' order by signature) from local_function_source_differences),'No per-function source differences.'));
select extensions.is((select count(*)::integer from local_function_source_differences),0,'all public function source bodies match live individually');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='relations'),'50:6a45512997971f57eff829e358ef9767','public relations: normalized definition/owner/RLS fingerprint matches hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='columns'),'519:94c56097d3ae7f3f32b17028ea3bffbe','public columns: names/order/types/nullability/defaults match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='constraints'),'304:60ddb737da94705fe02e13c1a27332ee','public constraints: primary/unique/foreign-key/check definitions match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='indexes'),'93:a3105f3a779e0a734a272d36e55f5000','public indexes match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='triggers'),'40:243e9c72292fe2a2ac8dbec5220555f5','public triggers and trigger functions match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='function_metadata'),'99:9ddcd3aced7d4b67a59dd643b2c63a55','public function signatures/security/owners/configuration match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='function_source'),'99:1b66f7c8d32fd2116849b696371c2c7f','public function source bodies match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='policies'),'56:d093adf4ea11deae5d7067ae0fc9fa4a','public RLS policies match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='table_grants'),'839:2643402505bd4f6a74a930e30cd9e5b5','public table/view/sequence grants match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='routine_grants'),'295:97acc07e6163e9b2b1bdf889faec8761','public routine grants match hosted baseline');
select extensions.is((select format('%s:%s',n,digest) from migration_catalog_fingerprints where category='types'),'2:ad0b86ba85981a94326ee576e14f199f','public custom type definitions and enum labels match hosted baseline');

select * from extensions.finish();

rollback;
