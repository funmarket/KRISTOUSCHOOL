"""Real PostgreSQL tests; use only an explicitly confirmed empty disposable local DB.

Replay the current base migrations plus installed Calendar/Attendance prerequisites first.
The runner applies the single Students candidate, uses ordinary authenticated/anon roles,
and removes only its synthetic fixtures. It never connects to hosted Supabase.
"""
import json
import os
from pathlib import Path
import unittest
import uuid

import psycopg
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / 'supabase/migrations/20261118222622_students_search_and_identity_detail.sql'


class StudentsReadContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('KRISTOU_STUDENTS_CONFIRM_ISOLATED') != 'YES_DISPOSABLE_SYNTHETIC_ONLY':
            raise RuntimeError('Explicit disposable-database confirmation required')
        cls.dsn = os.environ.get('KRISTOU_STUDENTS_TEST_DSN', '')
        info = conninfo_to_dict(cls.dsn)
        if info.get('host') not in ['127.0.0.1', 'localhost', '::1'] or not info.get('dbname', '').startswith('kristou_packet_d_'):
            raise RuntimeError('Refusing a non-local/non-disposable database')
        cls.a = psycopg.connect(cls.dsn, autocommit=True, row_factory=dict_row)
        if cls.a.execute('select count(*) as n from public.profiles').fetchone()['n']:
            raise RuntimeError('Refusing a database containing existing accounts')
        cls.old_functions = cls.a.execute("select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'").fetchall()
        cls.ids = {}
        for label, role, status in [
            ('owner', 'APP_ADMIN', 'APPROVED'), ('office', 'ADMINISTRATIVE_PERSONNEL', 'APPROVED'),
            ('manager', 'MANAGER', 'APPROVED'), ('delegated', 'MANAGER', 'APPROVED'),
            ('teacher', 'TEACHER', 'APPROVED'), ('parent', 'PARENT', 'APPROVED'),
            ('student', 'STUDENT', 'APPROVED'), ('staff', 'SCHOOL_STAFF', 'APPROVED'),
            ('pending', 'APP_ADMIN', 'PENDING'),
        ]:
            uid = uuid.uuid4(); cls.ids[label] = uid
            name = 'student_test_' + label + '_' + uid.hex[:8]
            cls.a.execute("insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) values(%s,'authenticated','authenticated',%s,%s::jsonb,now(),now())", (uid, name + '@example.invalid', json.dumps({'username': name, 'full_name': name, 'requested_role': role})))
            cls.a.execute('update public.profiles set account_status=%s::public.account_approval_status where id=%s', (status, uid))
            cls.a.execute('insert into public.role_assignments(user_id,role) values(%s,%s::public.app_role)', (uid, role))
        cls.year = cls.a.execute("select id from public.academic_years where code='2026-2027'").fetchone()['id']
        cls.year2 = cls.a.execute("insert into public.academic_years(code,label,starts_on,ends_on) values('2025-2026','Test historical year','2025-09-15','2026-06-30') returning id").fetchone()['id']
        cls.classes = []
        for year, name in [(cls.year, 'Isolated class A'), (cls.year, 'Isolated class B'), (cls.year2, 'Isolated previous class')]:
            cls.classes.append(cls.a.execute("insert into public.school_classes(academic_year_id,level_code,name) values(%s,'CP',%s) returning id", (year, name)).fetchone()['id'])
        cls.pupils = []
        for code, name, status in [('TN-001', 'Amélie Élève', 'ACTIVE'), ('TN-002', 'آمنة بن علي', 'ACTIVE'), ('TN-003', 'Unassigned pupil', 'ACTIVE'), ('TN-004', 'Archived pupil', 'ARCHIVED'), ('LIT%_05', 'Literal percent', 'ACTIVE')]:
            cls.pupils.append(cls.a.execute("insert into public.students(student_code,full_name,birth_date,status,safety_note) values(%s,%s,'2018-04-03',%s,'RESTRICTED_SENTINEL') returning id", (code, name, status)).fetchone()['id'])
        for student, schoolclass, year in [(cls.pupils[0], cls.classes[0], cls.year), (cls.pupils[1], cls.classes[1], cls.year), (cls.pupils[0], cls.classes[2], cls.year2)]:
            cls.a.execute("insert into public.student_class_memberships(student_id,class_id,academic_year_id,started_at) values(%s,%s,%s,'2026-09-15')", (student, schoolclass, year))
        cls.a.execute('update public.students set linked_profile_id=%s where id=%s', (cls.ids['student'], cls.pupils[0]))
        cls.a.execute('insert into public.parent_child_links(parent_user_id,student_id,verified_by) values(%s,%s,%s)', (cls.ids['parent'], cls.pupils[0], cls.ids['owner']))
        cls.a.execute('insert into public.teacher_class_assignments(teacher_user_id,class_id) values(%s,%s)', (cls.ids['teacher'], cls.classes[0]))
        cls.a.execute("insert into public.manager_capability_grants(manager_user_id,capability,granted_by) values(%s,'CLASSES_ROSTER_VIEW',%s)", (cls.ids['delegated'], cls.ids['owner']))
        # Support both a pre-candidate replay (RED/GREEN) and a fully migrated local stack.
        present = cls.a.execute("select to_regprocedure('public.list_school_students(text,uuid,uuid,text,integer,integer)') as f").fetchone()['f']
        if present is None:
            with cls.actor('owner') as c:
                try: c.execute('select public.list_school_students()')
                except psycopg.errors.UndefinedFunction: print('RED: Students search API absent in baseline', flush=True)
                else: raise AssertionError('Expected an absent baseline API')
            cls.a.execute(MIGRATION.read_text())
            print('APPLIED: isolated Students read candidate', flush=True)
        else:
            import re
            bodies = re.findall(r'as \$\$(.*?)\$\$;', MIGRATION.read_text(), re.S)
            for name, body in zip(['list_school_students', 'get_school_student_identity'], bodies, strict=True):
                actual = cls.a.execute("select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=%s", (name,)).fetchall()
                assert len(actual) == 1 and actual[0]['prosrc'] == body, 'Installed local candidate differs: ' + name
            print('VERIFIED: exact already-applied local candidate', flush=True)

    @classmethod
    def actor(cls, label=None, role='authenticated'):
        c = psycopg.connect(cls.dsn, autocommit=True, row_factory=dict_row)
        if role not in ('authenticated', 'anon'): raise ValueError('Invalid role')
        c.execute('set role ' + role)
        c.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(cls.ids[label]) if label else '',))
        row = c.execute('select current_user as who,rolsuper,rolbypassrls from pg_roles where rolname=current_user').fetchone()
        assert row['who'] == role and not row['rolsuper'] and not row['rolbypassrls']
        return c

    @classmethod
    def tearDownClass(cls):
        cls.a.execute('delete from public.students where id=any(%s)', (cls.pupils,))
        cls.a.execute('delete from public.school_classes where id=any(%s)', (cls.classes,))
        cls.a.execute('delete from public.academic_years where id=%s', (cls.year2,))
        cls.a.execute('delete from public.manager_capability_grants where manager_user_id=any(%s)', (list(cls.ids.values()),))
        cls.a.execute('delete from auth.users where id=any(%s)', (list(cls.ids.values()),))
        assert cls.a.execute('select count(*) as n from public.profiles').fetchone()['n'] == 0
        cls.a.close()
        print('CLEANUP: all owned synthetic pupils/accounts/relationships removed', flush=True)

    def call(self, label, sql='select public.list_school_students() as r', args=()):
        with self.actor(label) as c: return c.execute(sql, args).fetchone()['r']

    def test_01_schoolwide_matrix_and_linked_denials(self):
        for actor in ['owner', 'office', 'delegated']:
            self.assertEqual(self.call(actor)['total'], 4)
            self.assertEqual(self.call(actor, 'select public.get_school_student_identity(%s) as r', (self.pupils[0],))['studentId'], str(self.pupils[0]))
        for actor in ['manager', 'teacher', 'parent', 'student', 'staff', 'pending', None]:
            for sql, args in [('select public.list_school_students() as r', ()), ('select public.get_school_student_identity(%s) as r', (self.pupils[0],))]:
                with self.assertRaises(psycopg.Error): self.call(actor, sql, args)

    def test_02_anonymous_grants_denied(self):
        with self.actor(role='anon') as c:
            for sql in ['select public.list_school_students()', 'select public.get_school_student_identity(null)']:
                with self.assertRaises(psycopg.errors.InsufficientPrivilege): c.execute(sql)

    def test_03_literal_multilingual_search(self):
        for query, expected in [('AMÉLIE', self.pupils[0]), ('آمنة', self.pupils[1]), ('tn-002', self.pupils[1]), ('%', self.pupils[4]), (str(self.pupils[0]), self.pupils[0])]:
            r = self.call('owner', 'select public.list_school_students(p_search=>%s) as r', (query,))
            self.assertEqual(r['total'], 1); self.assertEqual(r['items'][0]['studentId'], str(expected))
        self.assertEqual(self.call('owner', 'select public.list_school_students(p_search=>%s) as r', ("' OR true --",))['items'], [])

    def test_04_year_class_filter_and_dedup(self):
        all_rows = self.call('owner')['items']
        self.assertEqual(len(all_rows), len({r['studentId'] for r in all_rows}))
        first = next(r for r in all_rows if r['studentId'] == str(self.pupils[0]))
        self.assertEqual(len(first['classes']), 2)
        r = self.call('owner', 'select public.list_school_students(p_academic_year_id=>%s,p_class_id=>%s) as r', (self.year, self.classes[0]))
        self.assertEqual(r['total'], 1); self.assertEqual(len(r['items'][0]['classes']), 1)
        self.assertEqual(self.call('owner', 'select public.list_school_students(p_academic_year_id=>%s) as r', (self.year,))['total'], 2)

    def test_05_paging_empty_and_unassigned(self):
        first = self.call('owner', 'select public.list_school_students(p_limit=>2) as r')
        second = self.call('owner', 'select public.list_school_students(p_limit=>2,p_offset=>2) as r')
        self.assertEqual(first['total'], 4); self.assertEqual(second['total'], 4)
        self.assertFalse({r['studentId'] for r in first['items']} & {r['studentId'] for r in second['items']})
        self.assertEqual(self.call('owner', 'select public.list_school_students(p_offset=>99) as r')['items'], [])
        r = self.call('owner', 'select public.list_school_students(p_search=>%s) as r', ('TN-003',))
        self.assertEqual(r['items'][0]['classes'], [])

    def test_06_field_projection_and_history(self):
        r = self.call('office', 'select public.get_school_student_identity(%s) as r', (self.pupils[0],))
        self.assertEqual(set(r), {'studentId', 'studentCode', 'fullName', 'birthDate', 'status', 'hasLinkedStudentAccount', 'memberships'})
        self.assertTrue(r['hasLinkedStudentAccount']); self.assertEqual(len(r['memberships']), 2)
        self.assertNotIn('RESTRICTED_SENTINEL', json.dumps(r))
        self.assertNotIn('birthDate', self.call('owner')['items'][0])
        with self.assertRaisesRegex(psycopg.Error, 'student_not_found'):
            self.call('owner', 'select public.get_school_student_identity(%s) as r', (uuid.uuid4(),))

    def test_07_invalid_arguments(self):
        for sql, args in [('select public.list_school_students(p_limit=>0) as r', ()), ('select public.list_school_students(p_offset=>-1) as r', ()), ('select public.list_school_students(p_limit=>null) as r', ()), ('select public.list_school_students(p_search=>%s) as r', ('x'*101,)), ('select public.list_school_students(p_status=>null) as r', ()), ('select public.list_school_students(p_class_id=>%s,p_academic_year_id=>%s) as r', (self.classes[2], self.year))]:
            with self.assertRaises(psycopg.Error): self.call('owner', sql, args)

    def test_08_archived_and_all_statuses(self):
        self.assertEqual(self.call('owner', "select public.list_school_students(p_status=>'ARCHIVED') as r")['total'], 1)
        self.assertEqual(self.call('owner', "select public.list_school_students(p_status=>'ALL') as r")['total'], 5)

    def test_09_revocation_visible_on_existing_session(self):
        with self.actor('delegated') as c:
            self.assertEqual(c.execute('select public.list_school_students() as r').fetchone()['r']['total'], 4)
            self.a.execute('update public.manager_capability_grants set active=false where manager_user_id=%s', (self.ids['delegated'],))
            try:
                with self.assertRaisesRegex(psycopg.Error, 'insufficient_authority'): c.execute('select public.list_school_students()')
            finally: self.a.execute('update public.manager_capability_grants set active=true where manager_user_id=%s', (self.ids['delegated'],))
        with self.actor('office') as c:
            self.a.execute("update public.profiles set account_status='SUSPENDED' where id=%s", (self.ids['office'],))
            try:
                with self.assertRaisesRegex(psycopg.Error, 'actor_not_approved'): c.execute('select public.get_school_student_identity(%s)', (self.pupils[0],))
            finally: self.a.execute("update public.profiles set account_status='APPROVED' where id=%s", (self.ids['office'],))

    def test_10_existing_functions_and_scopes_preserved(self):
        current = {r['signature']: r['hash'] for r in self.a.execute("select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'").fetchall()}
        self.assertTrue(all(current[r['signature']] == r['hash'] for r in self.old_functions))
        with self.actor('teacher') as c:
            roster = c.execute('select public.list_school_classes_with_rosters() as r').fetchone()['r']
            self.assertEqual([r['id'] for r in roster], [str(self.classes[0])])
        with self.actor('parent') as c:
            self.assertEqual([r['id'] for r in c.execute('select id from public.students').fetchall()], [self.pupils[0]])

    def test_11_pgtap_security_suites(self):
        self.a.execute('create schema if not exists extensions; create extension if not exists pgtap with schema extensions; grant usage on schema extensions to anon,authenticated')
        for suite in sorted((REPO/'supabase/tests').glob('*.test.sql')):
            with psycopg.connect(self.dsn, autocommit=True) as c:
                c.execute('set search_path=public,extensions')
                cursor = c.execute(suite.read_text(), prepare=False)
                lines = []
                while True:
                    if cursor.description: lines.extend(str(r[0]) for r in cursor.fetchall())
                    if not cursor.nextset(): break
                text = '\n'.join(lines)
                self.assertNotIn('not ok', text, suite.name + '\n' + text)
                self.assertNotIn('Looks like', text, suite.name + '\n' + text)
                print('PGTAP', suite.name, text, sep='\n', flush=True)

    def test_12_actual_postgrest_http(self):
        import base64, hashlib, hmac, secrets, socket, subprocess, time
        import urllib.request
        import urllib.error
        binary = os.environ.get('KRISTOU_POSTGREST_BIN')
        if not binary: raise RuntimeError('Actual PostgREST binary required')
        secret = secrets.token_hex(32)
        encode = lambda b: base64.urlsafe_b64encode(b).decode().rstrip('=')
        def token(label):
            claims = {'role': 'authenticated' if label else 'anon', 'exp': int(time.time())+120}
            if label: claims['sub'] = str(self.ids[label])
            body = encode(b'{"alg":"HS256","typ":"JWT"}') + '.' + encode(json.dumps(claims).encode())
            return body + '.' + encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
        sock = socket.socket(); sock.bind(('127.0.0.1',0)); port = sock.getsockname()[1]; sock.close()
        env = dict(os.environ, PGRST_DB_URI=self.dsn, PGRST_DB_SCHEMAS='public', PGRST_DB_ANON_ROLE='anon', PGRST_JWT_SECRET=secret, PGRST_SERVER_HOST='127.0.0.1', PGRST_SERVER_PORT=str(port))
        def call(label, fn, args=None):
            req = urllib.request.Request(f'http://127.0.0.1:{port}/rpc/{fn}', data=json.dumps(args or {}).encode(), headers={'Content-Type':'application/json','Authorization':'Bearer '+token(label)})
            try:
                with urllib.request.urlopen(req) as res: return res.status, json.load(res)
            except urllib.error.HTTPError as err: return err.code, json.load(err)
        with __import__('tempfile').TemporaryFile() as log:
            proc = subprocess.Popen([binary], env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    try: urllib.request.urlopen(f'http://127.0.0.1:{port}/'); break
                    except Exception: time.sleep(.02)
                status, data = call('owner','list_school_students',{'p_search':'TN-001'})
                self.assertEqual(status,200); self.assertEqual(data['items'][0]['studentId'],str(self.pupils[0]))
                status, data = call('office','get_school_student_identity',{'p_student_id':str(self.pupils[0])})
                self.assertEqual(status,200); self.assertNotIn('safety_note',data)
                status, data = call('delegated','list_school_students',{'p_limit':1,'p_offset':1})
                self.assertEqual(status,200); self.assertEqual(len(data['items']),1); self.assertEqual(data['total'],4)
                for actor in ['manager','teacher','parent','student']:
                    status, error = call(actor,'list_school_students')
                    self.assertEqual(status,400); self.assertEqual(error['message'],'insufficient_authority')
                status, error = call(None,'list_school_students')
                self.assertIn(status,[401,403])
                print('HTTP: 8 real PostgREST allow/deny/search/detail/paging cases passed',flush=True)
            finally: proc.terminate(); proc.wait(timeout=10)


if __name__ == '__main__': unittest.main(verbosity=2)
