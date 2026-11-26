-- Normalized public-catalog parity gate for the installed 20-migration baseline.
-- Expected fingerprints were captured read-only from ofppapwofhovhroyjtkc.
-- This test runs against the clean isolated database built by `supabase db reset`.
-- It compares stable catalog definitions and grants, not OIDs or row data.

begin;

select extensions.plan(11);

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
