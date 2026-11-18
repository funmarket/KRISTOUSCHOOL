"""Real local PostgreSQL/RLS/concurrency/HTTP tests. See docs/CLASS_MANAGEMENT_BACKEND_CONTRACT.md."""
import sys,os,uuid,json,time,subprocess,unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import psycopg
import tempfile
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
REPO=Path(__file__).resolve().parents[2]
E=Path(os.environ.get('KRISTOU_CM_EVIDENCE_DIR') or tempfile.mkdtemp(prefix='kristou_cm_evidence_'))
E.mkdir(parents=True,exist_ok=True)
M=next((REPO/'supabase/migrations').glob('*class_management_creation_permissions_and_years.sql'))
RT=None
class LocalDatabase:
 def __enter__(self):
  if os.environ.get('KRISTOU_CM_CONFIRM_ISOLATED')!='YES_DISPOSABLE_SYNTHETIC_ONLY':
   raise RuntimeError('Explicit disposable-database confirmation is required')
  self.dsn=os.environ.get('KRISTOU_CM_TEST_DSN','');info=conninfo_to_dict(self.dsn)
  if info.get('host') not in ['127.0.0.1','localhost','::1'] or not info.get('dbname','').startswith(('kristou_cm_','kristou_packet_d_')):
   raise RuntimeError('Only explicitly named local disposable databases are accepted')
  self.admin=psycopg.connect(self.dsn,autocommit=True,row_factory=dict_row)
  if self.admin.execute("select (select count(*) from public.profiles)+(select count(*) from public.school_classes)+(select count(*) from public.academic_years where code<>'2026-2027') as n").fetchone()['n']:
   raise RuntimeError('Refusing to test a database containing account records')
  if self.admin.execute("select to_regprocedure('public.get_attendance_register(uuid,date,uuid)') as f").fetchone()['f'] is None:
   raise RuntimeError('Replay the exact installed Attendance prerequisite before this compatibility test')
  return self
 def actor(self,uid=None,role='authenticated',autocommit=True):
  if role not in ['authenticated','anon']:raise ValueError('Invalid test role')
  c=psycopg.connect(self.dsn,autocommit=autocommit,row_factory=dict_row)
  c.execute('set role '+role);c.execute("select set_config('request.jwt.claim.sub',%s,false)",(str(uid) if uid else '',))
  c.execute("set statement_timeout='15000ms'")
  row=c.execute('select current_user as who,rolsuper,rolbypassrls from pg_roles where rolname=current_user').fetchone()
  assert row['who']==role and not row['rolsuper'] and not row['rolbypassrls'],row
  return c
 def __exit__(self,*_):self.admin.close()

class Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  global RT
  RT=LocalDatabase().__enter__();cls.rt=RT;cls.a=RT.admin
  cls.ids={}
  for label,role,status in [('owner','APP_ADMIN','APPROVED'),('owner2','APP_ADMIN','APPROVED'),('teacher','TEACHER','APPROVED'),('manager','MANAGER','APPROVED'),('office','ADMINISTRATIVE_PERSONNEL','APPROVED'),('parent','PARENT','APPROVED'),('student','STUDENT','APPROVED'),('staff','SCHOOL_STAFF','APPROVED'),('pending','TEACHER','PENDING')]:
   uid=uuid.uuid4();cls.ids[label]=uid;n='cm_'+label+'_'+uid.hex[:8]
   cls.a.execute("insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) values(%s,'authenticated','authenticated',%s,%s::jsonb,now(),now())",(uid,n+'@example.invalid',json.dumps({'username':n,'full_name':'Isolated CM '+label,'requested_role':role})))
   cls.a.execute('update public.profiles set account_status=%s::public.account_approval_status where id=%s',(status,uid));cls.a.execute('insert into public.role_assignments(user_id,role) values(%s,%s::public.app_role)',(uid,role))
  # Real pre-migration class and content to prove additive preservation.
  cls.year=cls.a.execute("select id from public.academic_years where code='2026-2027'").fetchone()['id'];cls.oldclass=uuid.uuid4()
  cls.a.execute("insert into public.school_classes(id,academic_year_id,level_code,name,capacity,created_by) values(%s,%s,'CP','Existing preserved class',37,%s)",(cls.oldclass,cls.year,cls.ids['owner']))
  cls.before=cls.a.execute("select to_jsonb(s) as row from public.school_classes s where id=%s",(cls.oldclass,)).fetchone()['row']
  cls.functions_before=cls.a.execute("select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'").fetchall()
  try:
   with cls.actor('teacher') as c:c.execute("select public.create_school_class('2026-2027','CP','Baseline teacher denial',28,null)")
  except psycopg.Error as e:assert 'insufficient_authority' in str(e);print('RED baseline: Teacher class creation denied',flush=True)
  else:raise AssertionError('Expected baseline Teacher denial')
  cls.a.execute(M.read_text());print('APPLIED candidate',M.name,flush=True)
 @classmethod
 def tearDownClass(cls):
  ids=list(cls.ids.values())
  # Remove only this run's synthetic fixtures. The caller still owns/drops the disposable database.
  cls.a.execute('delete from public.class_creation_permissions where user_id=any(%s)',(ids,))
  cls.a.execute('delete from public.account_governance_audit_logs where target_user_id=any(%s) or actor_user_id=any(%s)',(ids,ids))
  cls.a.execute('delete from public.manager_capability_grants where manager_user_id=any(%s)',(ids,))
  cls.a.execute('delete from public.teacher_class_assignments where teacher_user_id=any(%s)',(ids,))
  cls.a.execute('delete from public.school_classes where created_by=any(%s)',(ids,))
  cls.a.execute('delete from auth.users where id=any(%s)',(ids,))
  cls.a.execute("delete from public.academic_years where code='2027-2028'")
  assert cls.a.execute('select count(*) as n from public.profiles').fetchone()['n']==0
  print('CLEANUP: synthetic accounts/classes/permission rows removed',flush=True)
 @classmethod
 def actor(cls,label=None,auto=True):return cls.rt.actor(cls.ids[label] if label else None,autocommit=auto)
 def rpc(self,label,sql,args=()):
  with self.actor(label) as c:return c.execute(sql,args).fetchone()['r']
 def perm(self,label):return self.rpc(label,'select public.get_my_class_creation_permission() as r')
 def setting(self,label,allowed,version,actor='owner',reason='Owner reviewed change'):
  return self.rpc(actor,'select public.governance_set_class_creation_permission(%s,%s,%s,%s) as r',(self.ids[label],allowed,reason,version))
 def create(self,label,name):return self.rpc(label,"select public.create_school_class('2026-2027','CP',%s,31,null) as r",(name,))
 def denied(self,label,sql,args=(),text=None):
  with self.assertRaises(psycopg.Error) as cm:self.rpc(label,sql,args)
  if text:self.assertIn(text,str(cm.exception))
 def reset(self,label):
  p=self.perm(label)
  if not p['canCreate'] and p['reasonCode']=='owner_denied':self.setting(label,True,p['version'])
 def test_01_existing_data_and_function_owners_preserved(self):
  row=self.a.execute('select to_jsonb(s) as row from public.school_classes s where id=%s',(self.oldclass,)).fetchone()['row'];self.assertEqual(row,self.before)
  old={r['signature']:r['hash'] for r in self.functions_before}
  new={r['signature']:r['hash'] for r in self.a.execute("select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'").fetchall()}
  self.assertEqual(sorted(k for k,v in old.items() if new.get(k)!=v),['create_school_class(text,text,text,integer,text)','list_school_classes_with_rosters()'])
 def test_02_default_role_matrix_and_empty_class_creation(self):
  for label in ['owner','owner2','teacher','manager','office']:
   self.assertTrue(self.perm(label)['canCreate']);receipt=self.create(label,'Default '+label);self.assertTrue(receipt['id'])
   row=self.a.execute('select created_by,capacity from public.school_classes where id=%s',(receipt['id'],)).fetchone();self.assertEqual(row['created_by'],self.ids[label]);self.assertEqual(row['capacity'],31)
  for label in ['parent','student','staff','pending']:
   self.assertFalse(self.perm(label)['canCreate']);self.denied(label,"select public.create_school_class('2026-2027','CP','Forbidden',28,null) as r")
 def test_03_year_reader_independent_of_classes_and_permission_override(self):
  self.a.execute("insert into public.academic_years(code,label,starts_on,ends_on,is_active) values('2027-2028','Future configured year','2027-09-15','2028-06-30',false) on conflict do nothing")
  for label in ['owner','teacher','manager','office']:
   rows=self.rpc(label,'select public.list_academic_years() as r');self.assertIn('2027-2028',[r['code'] for r in rows]);self.assertTrue(all('startsOn' in r and 'endsOn' in r for r in rows))
  for label in ['parent','student','staff','pending']:self.denied(label,'select public.list_academic_years() as r')
 def test_04_capacity_and_existing_roster_scopes(self):
  rows=self.rpc('office','select public.list_school_classes_with_rosters() as r');old=next(r for r in rows if r['id']==str(self.oldclass));self.assertEqual(old['capacity'],37);self.assertEqual(old['roster'],[])
  self.denied('teacher','select public.list_school_classes_with_rosters() as r',text='insufficient_authority')
  self.a.execute('insert into public.teacher_class_assignments(teacher_user_id,class_id,active,assigned_by) values(%s,%s,true,%s)',(self.ids['teacher'],self.oldclass,self.ids['owner']))
  rows=self.rpc('teacher','select public.list_school_classes_with_rosters() as r');self.assertEqual([r['id'] for r in rows],[str(self.oldclass)])
  self.a.execute('update public.teacher_class_assignments set active=false where teacher_user_id=%s',(self.ids['teacher'],))
 def test_05_owner_denial_overrides_full_access_and_restores(self):
  self.a.execute("insert into public.manager_capability_grants(manager_user_id,capability,active,granted_by) values(%s,'FULL_ACCESS',true,%s) on conflict(manager_user_id,capability) do update set active=true",(self.ids['manager'],self.ids['owner']))
  for label in ['manager','office','teacher']:
   before=self.perm(label);r=self.setting(label,False,before['version']);self.assertFalse(r['canCreate']);self.assertTrue(r['changed']);self.assertEqual(r['reasonCode'],'owner_denied')
   self.denied(label,"select public.create_school_class('2026-2027','CP','Denied override',28,null) as r",text='class_creation_denied')
   self.assertTrue(self.rpc(label,'select public.list_academic_years() as r'))
   self.reset(label)
 def test_06_owner_only_reason_version_and_noop(self):
  before=self.perm('teacher')
  for label in ['teacher','manager','office','parent','student','staff','pending']:
   self.denied(label,'select public.governance_set_class_creation_permission(%s,false,%s,%s) as r',(self.ids['teacher'],'Unauthorized change',before['version']),'owner_only_operation')
  self.denied('owner','select public.governance_set_class_creation_permission(%s,false,%s,%s) as r',(self.ids['teacher'],'',before['version']),'reason_required')
  r=self.setting('teacher',False,before['version']);self.denied('owner','select public.governance_set_class_creation_permission(%s,true,%s,%s) as r',(self.ids['teacher'],'Stale update',before['version']),'version_conflict')
  count=self.a.execute('select count(*) as n from public.account_governance_audit_logs').fetchone()['n'];same=self.setting('teacher',False,r['version']);self.assertFalse(same['changed']);self.assertEqual(count,self.a.execute('select count(*) as n from public.account_governance_audit_logs').fetchone()['n']);self.reset('teacher')
 def test_07_owner_authority_retained_and_ineligible_targets(self):
  self.denied('owner','select public.governance_set_class_creation_permission(%s,false,%s,0) as r',(self.ids['owner2'],'Attempt restriction'),'owner_authority_retained')
  for label in ['parent','student','staff']:
   self.denied('owner','select public.governance_set_class_creation_permission(%s,true,%s,0) as r',(self.ids[label],'Attempt grant'),'invalid_target_role')
 def test_08_direct_table_private_helper_and_anonymous_denied(self):
  for label in ['owner','teacher','manager','parent']:
   for sql in ['select * from public.class_creation_permissions','update public.class_creation_permissions set denied=false','select private.class_creation_permission(%s)']:
    self.denied(label,sql,(self.ids['teacher'],) if '%s' in sql else ())
  with self.rt.actor(role='anon') as c:
   with self.assertRaises(psycopg.Error):c.execute('select public.get_my_class_creation_permission()')
  self.denied(None,'select public.get_my_class_creation_permission() as r',text='actor_unauthenticated')
 def test_09_owner_list_and_private_reason_projection(self):
  p=self.perm('teacher');self.setting('teacher',False,p['version'],reason='Private Owner reason')
  own=self.perm('teacher');self.assertNotIn('reason',own);self.assertNotIn('changeReason',own)
  rows=self.rpc('owner','select public.governance_list_class_creation_permissions(200,0) as r');r=next(r for r in rows if r['userId']==str(self.ids['teacher']));self.assertEqual(r['changeReason'],'Private Owner reason');self.assertFalse(r['canCreate'])
  for label in ['office','manager','teacher','parent']:self.denied(label,'select public.governance_list_class_creation_permissions() as r',text='owner_only_operation')
  self.reset('teacher')
 def test_10_denial_preserves_roster_and_attendance_authority(self):
  self.a.execute('update public.teacher_class_assignments set active=true where teacher_user_id=%s',(self.ids['teacher'],))
  p=self.perm('teacher');self.setting('teacher',False,p['version'])
  rows=self.rpc('teacher','select public.list_school_classes_with_rosters() as r');self.assertEqual([r['id'] for r in rows],[str(self.oldclass)])
  day=self.a.execute("select (clock_timestamp() at time zone 'Africa/Tunis')::date as d").fetchone()['d']
  register=self.rpc('teacher','select public.get_attendance_register(%s,%s,null) as r',(self.oldclass,day));self.assertEqual(register['classId'],str(self.oldclass));self.reset('teacher')
  self.a.execute('update public.teacher_class_assignments set active=false where teacher_user_id=%s',(self.ids['teacher'],))
 def test_11_suspension_and_role_revocation_remove_creation(self):
  self.a.execute("update public.profiles set account_status='SUSPENDED' where id=%s",(self.ids['teacher'],));self.assertFalse(self.perm('teacher')['canCreate']);self.denied('teacher',"select public.create_school_class('2026-2027','CP','Suspended creation',28,null) as r",text='actor_not_approved')
  self.a.execute("update public.profiles set account_status='APPROVED' where id=%s",(self.ids['teacher'],));self.a.execute("update public.role_assignments set active=false where user_id=%s and role='TEACHER'",(self.ids['teacher'],));self.assertFalse(self.perm('teacher')['canCreate']);self.denied('teacher',"select public.create_school_class('2026-2027','CP','Revoked creation',28,null) as r",text='class_creation_denied');self.a.execute("update public.role_assignments set active=true where user_id=%s and role='TEACHER'",(self.ids['teacher'],))
 def test_12_audit_attribution_and_duplicate_validation(self):
  p=self.perm('teacher');r=self.setting('teacher',False,p['version']);audit=self.a.execute('select * from public.account_governance_audit_logs where id=%s',(r['auditLogId'],)).fetchone();self.assertEqual(audit['actor_user_id'],self.ids['owner']);self.assertEqual(audit['action'],'DENY_CLASS_CREATION');self.assertEqual(audit['previous_roles'],audit['resulting_roles']);self.reset('teacher')
  self.create('teacher','Unique class test');self.denied('teacher',"select public.create_school_class('2026-2027','CP','Unique class test',28,null) as r",text='duplicate key')
  self.denied('teacher',"select public.create_school_class('1900-1901','CP','Invalid year',28,null) as r",text='invalid_academic_year')
 def test_13_two_session_deny_commits_before_create(self):
  teacher='teacher';p=self.perm(teacher)
  with self.actor('owner',auto=False) as first:
   first.execute('select public.governance_set_class_creation_permission(%s,false,%s,%s)',(self.ids[teacher],'Concurrent denial',p['version']))
   with self.actor(teacher) as second:
    pid=second.execute('select pg_backend_pid() as pid').fetchone()['pid']
    with ThreadPoolExecutor(1) as pool:
     future=pool.submit(second.execute,"select public.create_school_class('2026-2027','CP','Race denied creation',28,null)")
     self.wait_block(pid);first.commit()
     with self.assertRaises(psycopg.Error) as cm:future.result(timeout=10)
     self.assertIn('class_creation_denied',str(cm.exception))
  self.assertEqual(self.a.execute("select count(*) as n from public.school_classes where name='Race denied creation'").fetchone()['n'],0);self.reset(teacher)
 def test_14_two_session_create_finishes_before_deny(self):
  with self.actor('teacher',auto=False) as first:
   receipt=first.execute("select public.create_school_class('2026-2027','CP','Race committed creation',28,null) as r").fetchone()['r'];p=first.execute('select public.get_my_class_creation_permission() as r').fetchone()['r']
   with self.actor('owner') as second:
    pid=second.execute('select pg_backend_pid() as pid').fetchone()['pid']
    with ThreadPoolExecutor(1) as pool:
     future=pool.submit(second.execute,'select public.governance_set_class_creation_permission(%s,false,%s,%s)',(self.ids['teacher'],'Concurrent denial after create',p['version']))
     self.wait_block(pid);first.commit();future.result(timeout=10)
  self.assertTrue(self.a.execute('select id from public.school_classes where id=%s',(receipt['id'],)).fetchone());self.denied('teacher',"select public.create_school_class('2026-2027','CP','Next creation denied',28,null) as r",text='class_creation_denied');self.reset('teacher')
 def test_15_two_session_suspension_before_create(self):
  with psycopg.connect(self.rt.dsn,autocommit=False) as first:
   first.execute("update public.profiles set account_status='SUSPENDED' where id=%s",(self.ids['teacher'],))
   with self.actor('teacher') as second:
    pid=second.execute('select pg_backend_pid() as pid').fetchone()['pid']
    with ThreadPoolExecutor(1) as pool:
     future=pool.submit(second.execute,"select public.create_school_class('2026-2027','CP','Suspension race',28,null)");self.wait_block(pid);first.commit()
     with self.assertRaises(psycopg.Error) as cm:future.result(timeout=10)
     self.assertIn('actor_not_approved',str(cm.exception))
  self.a.execute("update public.profiles set account_status='APPROVED' where id=%s",(self.ids['teacher'],))
 def test_16_two_session_owner_revoked_while_permission_change_waits(self):
  p=self.perm('teacher')
  with psycopg.connect(self.rt.dsn,autocommit=False) as first:
   first.execute("update public.role_assignments set active=false where user_id=%s and role='APP_ADMIN'",(self.ids['owner2'],))
   with self.actor('owner2') as second:
    pid=second.execute('select pg_backend_pid() as pid').fetchone()['pid']
    with ThreadPoolExecutor(1) as pool:
     future=pool.submit(second.execute,'select public.governance_set_class_creation_permission(%s,false,%s,%s)',(self.ids['teacher'],'Revoked Owner mutation',p['version']));self.wait_block(pid);first.commit()
     with self.assertRaises(psycopg.Error) as cm:future.result(timeout=10)
     self.assertIn('owner_only_operation',str(cm.exception))
  self.assertTrue(self.perm('teacher')['canCreate'])

 def test_17_pgtap_suites(self):
  self.a.execute('create schema if not exists extensions');self.a.execute('create extension if not exists pgtap with schema extensions');self.a.execute('grant usage on schema extensions to anon,authenticated')
  suites=[*sorted((REPO/'supabase/tests').glob('*.test.sql'))]
  for suite in suites:
   with psycopg.connect(self.rt.dsn,autocommit=True) as c:
    c.execute('set search_path=public,extensions')
    cursor=c.execute(suite.read_text(),prepare=False); lines=[]
    while True:
     if cursor.description:
      lines.extend(str(row[0]) for row in cursor.fetchall())
     if not cursor.nextset():break
    output='\n'.join(lines);(E/(suite.name+'.log')).write_text(output)
    print('PGTAP',suite.name,output[-160:],flush=True)
    self.assertNotIn('not ok',output)
    self.assertNotIn('Looks like',output)


 def test_18_real_postgrest_contract(self):
  import base64,hmac,hashlib,secrets,urllib.request,urllib.error,socket
  binary=os.environ.get('KRISTOU_POSTGREST_BIN')
  if not binary:raise RuntimeError('KRISTOU_POSTGREST_BIN is required for actual HTTP acceptance')
  secret=secrets.token_hex(32)
  def encode(b):return base64.urlsafe_b64encode(b).decode().rstrip('=')
  def token(label):
   claim={'role':'authenticated' if label else 'anon','exp':int(time.time())+600}
   if label:claim['sub']=str(self.ids[label])
   body=encode(b'{"alg":"HS256","typ":"JWT"}')+'.'+encode(json.dumps(claim).encode())
   return body+'.'+encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest())
  sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
  env=dict(os.environ,PGRST_DB_URI=self.rt.dsn,PGRST_DB_SCHEMAS='public',PGRST_DB_ANON_ROLE='anon',PGRST_JWT_SECRET=secret,PGRST_SERVER_HOST='127.0.0.1',PGRST_SERVER_PORT=str(port))
  def call(label,fn,args=None):
   req=urllib.request.Request(f'http://127.0.0.1:{port}/rpc/{fn}',data=json.dumps(args or {}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token(label)})
   try:
    with urllib.request.urlopen(req) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:return e.code,json.load(e)
  with (E/'postgrest-http.log').open('w') as log:
   proc=subprocess.Popen([binary],env=env,stdout=log,stderr=subprocess.STDOUT)
   try:
    for _ in range(100):
     try:urllib.request.urlopen(f'http://127.0.0.1:{port}/');break
     except Exception:time.sleep(.02)
    status,rows=call('teacher','list_academic_years');self.assertEqual(status,200);self.assertTrue(rows)
    status,p=call('teacher','get_my_class_creation_permission');self.assertEqual(status,200);self.assertTrue(p['canCreate'])
    status,receipt=call('teacher','create_school_class',{'p_academic_year_code':'2026-2027','p_level_code':'CP','p_name':'HTTP persisted class','p_capacity':39});self.assertEqual(status,200);self.assertIn('id',receipt)
    status,classes=call('owner','list_school_classes_with_rosters');self.assertEqual(status,200);self.assertEqual(next(c['capacity'] for c in classes if c['id']==receipt['id']),39)
    status,p=call('owner','governance_set_class_creation_permission',{'p_target_user_id':str(self.ids['teacher']),'p_allowed':False,'p_reason':'HTTP Owner denial','p_expected_version':p['version']});self.assertEqual(status,200);self.assertFalse(p['canCreate'])
    status,error=call('teacher','create_school_class',{'p_academic_year_code':'2026-2027','p_level_code':'CP','p_name':'HTTP forbidden'});self.assertEqual(status,400);self.assertEqual(error['message'],'insufficient_authority')
    status,error=call('parent','governance_list_class_creation_permissions');self.assertEqual(status,400);self.assertEqual(error['message'],'owner_only_operation')
    status,error=call(None,'list_academic_years');self.assertIn(status,[401,403]);self.reset('teacher')
    print('HTTP: 8 real ordinary-JWT contract scenarios passed',flush=True)
   finally:proc.terminate();proc.wait(timeout=10)


 def test_19_audit_failure_rolls_back_permission_and_profile_version(self):
  before=self.perm('teacher')
  profile_before=self.a.execute('select governance_version from public.profiles where id=%s',(self.ids['teacher'],)).fetchone()['governance_version']
  audit_before=self.a.execute('select count(*) as n from public.account_governance_audit_logs').fetchone()['n']
  self.a.execute("alter table public.account_governance_audit_logs add constraint cm_test_audit_failure check(action<>'DENY_CLASS_CREATION') not valid")
  try:
   self.denied('owner','select public.governance_set_class_creation_permission(%s,false,%s,%s) as r',(self.ids['teacher'],'Real audit constraint failure',before['version']),'cm_test_audit_failure')
  finally:self.a.execute('alter table public.account_governance_audit_logs drop constraint cm_test_audit_failure')
  self.assertEqual(self.perm('teacher'),before)
  self.assertEqual(self.a.execute('select governance_version from public.profiles where id=%s',(self.ids['teacher'],)).fetchone()['governance_version'],profile_before)
  self.assertEqual(self.a.execute('select count(*) as n from public.account_governance_audit_logs').fetchone()['n'],audit_before)
 def test_20_two_session_teacher_role_revocation_before_create(self):
  with psycopg.connect(self.rt.dsn,autocommit=False) as first:
   first.execute("update public.role_assignments set active=false where user_id=%s and role='TEACHER'",(self.ids['teacher'],))
   with self.actor('teacher') as second:
    pid=second.execute('select pg_backend_pid() as pid').fetchone()['pid']
    with ThreadPoolExecutor(1) as pool:
     future=pool.submit(second.execute,"select public.create_school_class('2026-2027','CP','Role revocation race',28,null)");self.wait_block(pid);first.commit()
     with self.assertRaises(psycopg.Error) as cm:future.result(timeout=10)
     self.assertIn('insufficient_authority',str(cm.exception))
  self.assertEqual(self.a.execute("select count(*) as n from public.school_classes where name='Role revocation race'").fetchone()['n'],0)
  self.a.execute("update public.role_assignments set active=true where user_id=%s and role='TEACHER'",(self.ids['teacher'],))

 def wait_block(self,pid):
  for _ in range(100):
   row=self.a.execute('select pg_blocking_pids(%s) as blockers',(pid,)).fetchone()
   if row['blockers']:print('OBSERVED_REAL_LOCK_WAIT',pid,row['blockers'],flush=True);return
   time.sleep(.02)
  self.fail('No genuine PostgreSQL lock contention observed')

if __name__=='__main__':
 try:
  result=unittest.main(verbosity=2,exit=False).result
 finally:
  if RT: RT.__exit__(None,None,None)
 sys.exit(0 if result.wasSuccessful() else 1)
