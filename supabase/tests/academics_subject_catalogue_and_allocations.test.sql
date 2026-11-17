-- KRISTOU SCHOOL — T4A Behavioral Security, Integrity, Audit History & RLS Test Suite
-- Coverage:
-- 1. RLS & least-privilege grants across all 7 T4A tables (curriculum_domains, academic_subjects,
--    academic_subject_components, subject_level_applicability, school_subject_offerings,
--    teacher_subject_allocations, teacher_subject_allocation_events) and column-level SELECT protection
--    hiding internal notes and attribution/deactivation audit columns from direct table access.
-- 2. Exact 8 documented primary subject components (5 Arabic + 3 French) verified by exact code,
--    parent subject, Arabic/French/English labels, source_url, source_page='46', and
--    evidence_status='SOURCE_PARTIAL_PRIMARY'.
-- 3. Separation of historical 2023-2024 textbook evidence from current 2026-2027 applicability:
--    all 78 primary grade-subject pairs start as UNVERIFIED_GRADE_MAPPING (0 APPLICABLE),
--    all 78 school_subject_offerings start disabled (is_enabled=false, 0 enabled),
--    0 initial teacher_subject_allocations, and 0 initial teacher_subject_allocation_events.
-- 4. Seed rerun idempotency (INSERT ... ON CONFLICT DO NOTHING) preserving administrative
--    applicability and offering decisions once established.
-- 5. Provenance-gated external Ministry codes and component parent stage check.
-- 6. Explicit administrative workflow: establish level applicability before enabling school offerings,
--    then allocate subjects to assigned Teachers.
-- 7. Multi-subject single-Teacher and multi-Teacher single-class subject allocations & readback.
-- 8. Append-only allocation audit history (teacher_subject_allocation_events):
--    INITIAL_ALLOCATION, idempotent retry (no extra event), EXPLICIT_DEACTIVATION,
--    REACTIVATION preserving prior deactivation events, OFFERING_DISABLED_DEACTIVATION,
--    CLASS_ASSIGNMENT_REVOKED_DEACTIVATION, unauthenticated system attribution
--    (actor_user_id IS NULL, actor_source='SYSTEM_UNAUTHENTICATED'), and audit immutability.
-- 9. Consistent authorization across direct table access and RPCs (denying PARENT, STUDENT,
--    unapproved accounts, read-only Manager mutations, Teacher self-grant, dual-role self-grant,
--    and cross-class access; protecting notes/audit fields from non-school-wide callers).
-- 10. Preservation of existing T1/T2 roster/Student Overview and Calendar contracts.

begin;

select extensions.plan(89);

-- =========================================================================
-- 1. Verify RLS is enabled on all 7 T4A tables (assertions 1-7)
-- =========================================================================
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.curriculum_domains'::regclass),
  '1. curriculum_domains RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.academic_subjects'::regclass),
  '2. academic_subjects RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.academic_subject_components'::regclass),
  '3. academic_subject_components RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.subject_level_applicability'::regclass),
  '4. subject_level_applicability RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.school_subject_offerings'::regclass),
  '5. school_subject_offerings RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.teacher_subject_allocations'::regclass),
  '6. teacher_subject_allocations RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.teacher_subject_allocation_events'::regclass),
  '7. teacher_subject_allocation_events RLS enabled'
);

-- =========================================================================
-- 2. Verify least-privilege table, column & function grants (assertions 8-25)
-- =========================================================================
select extensions.ok(
  not has_table_privilege('anon', 'public.curriculum_domains', 'SELECT'),
  '8. anon cannot read curriculum_domains'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.academic_subjects', 'SELECT'),
  '9. anon cannot read academic_subjects'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.academic_subject_components', 'SELECT'),
  '10. anon cannot read academic_subject_components'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.subject_level_applicability', 'SELECT'),
  '11. anon cannot read subject_level_applicability'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.school_subject_offerings', 'SELECT'),
  '12. anon cannot read school_subject_offerings'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.teacher_subject_allocations', 'SELECT'),
  '13. anon cannot read teacher_subject_allocations'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.teacher_subject_allocation_events', 'SELECT'),
  '14. anon cannot read teacher_subject_allocation_events'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.teacher_subject_allocations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.teacher_subject_allocations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.teacher_subject_allocations', 'DELETE'),
  '15. authenticated cannot directly INSERT/UPDATE/DELETE teacher_subject_allocations'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.teacher_subject_allocation_events', 'INSERT')
  and not has_table_privilege('authenticated', 'public.teacher_subject_allocation_events', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.teacher_subject_allocation_events', 'DELETE'),
  '16. authenticated cannot directly INSERT/UPDATE/DELETE teacher_subject_allocation_events'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.school_subject_offerings', 'INSERT')
  and not has_table_privilege('authenticated', 'public.school_subject_offerings', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.school_subject_offerings', 'DELETE'),
  '17. authenticated cannot directly INSERT/UPDATE/DELETE school_subject_offerings'
);
select extensions.ok(
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'curriculum_domains' and column_name = 'notes')
  and not has_column_privilege('authenticated', 'public.academic_subjects', 'notes', 'SELECT')
  and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'academic_subject_components' and column_name = 'notes')
  and not has_column_privilege('authenticated', 'public.subject_level_applicability', 'notes', 'SELECT')
  and not has_column_privilege('authenticated', 'public.school_subject_offerings', 'notes', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'notes', 'SELECT'),
  '18. internal notes columns are revoked from direct authenticated SELECT across all catalogue and allocation tables'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.school_subject_offerings', 'activated_by', 'SELECT')
  and not has_column_privilege('authenticated', 'public.school_subject_offerings', 'activated_at', 'SELECT')
  and not has_column_privilege('authenticated', 'public.school_subject_offerings', 'deactivated_by', 'SELECT')
  and not has_column_privilege('authenticated', 'public.school_subject_offerings', 'deactivated_at', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'allocated_by', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'deactivated_by', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'deactivated_at', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'deactivation_reason', 'SELECT')
  and not has_column_privilege('authenticated', 'public.teacher_subject_allocations', 'transition_reason', 'SELECT'),
  '19. attribution and deactivation audit columns on offerings and allocations are revoked from direct authenticated SELECT'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.list_academic_subject_catalogue(text,text,text)', 'EXECUTE'),
  '20. anon cannot execute list_academic_subject_catalogue'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.assign_teacher_subject_allocation(uuid,uuid,text,text)', 'EXECUTE'),
  '21. anon cannot execute assign_teacher_subject_allocation'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.set_teacher_subject_allocation_active(uuid,boolean,text)', 'EXECUTE'),
  '22. anon cannot execute set_teacher_subject_allocation_active'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.set_school_subject_offering(text,text,text,boolean,integer,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_teacher_subject_allocation_events(uuid,uuid)', 'EXECUTE'),
  '23. anon cannot execute set_school_subject_offering or list_teacher_subject_allocation_events'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.has_active_teacher_subject_allocation(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.has_active_teacher_subject_allocation(uuid,uuid,uuid)', 'EXECUTE'),
  '24. internal helper has_active_teacher_subject_allocation is revoked from anon and authenticated'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.validate_teacher_subject_allocation()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.sync_teacher_subject_allocations_on_assignment_change()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.sync_teacher_subject_allocations_on_offering_change()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_teacher_subject_allocation_event()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.prevent_teacher_subject_allocation_events_mutation()', 'EXECUTE'),
  '25. all T4A trigger functions are revoked from direct authenticated execution'
);

-- =========================================================================
-- 3. Verify Seeded Catalogue Content, Exact 8 Components, Provenance & Baseline Counts (assertions 26-38)
-- =========================================================================
select extensions.is(
  (select count(*)::int from public.curriculum_domains),
  6,
  '26. 6 curriculum domains seeded (5 primary/multi-cycle + 1 secondary reference)'
);

select extensions.is(
  (select count(*)::int from public.academic_subjects where stage_scope = 'PRIMARY'),
  13,
  '27. 13 documented primary candidate subjects seeded'
);

select extensions.is(
  (select count(*)::int from public.academic_subjects where stage_scope = 'COLLEGE_LYCEE_REFERENCE'),
  6,
  '28. 6 collège/lycée reference subjects seeded and kept distinct from primary scope'
);

select extensions.is(
  (select count(*)::int from public.academic_subjects where stage_scope = 'HISTORICAL_OPTIONAL_LANGUAGE'),
  5,
  '29. 5 historical/secondary optional language subjects seeded as reference only'
);

select extensions.is(
  (
    select count(*)::int
    from public.academic_subjects
    where code in ('ECONOMICS', 'MANAGEMENT')
      and reporting_group_code = 'ECONOMICS_AND_MANAGEMENT'
      and stage_scope = 'COLLEGE_LYCEE_REFERENCE'
  ),
  2,
  '30. ECONOMICS and MANAGEMENT are stored as 2 distinct canonical subjects even when grouped for reporting'
);

select extensions.is(
  (
    select count(*)::int
    from public.academic_subjects
    where (code = 'SCIENTIFIC_AWAKENING' and stage_scope = 'PRIMARY')
       or (code = 'LIFE_AND_EARTH_SCIENCES' and stage_scope = 'COLLEGE_LYCEE_REFERENCE')
  ),
  2,
  '31. SCIENTIFIC_AWAKENING (PRIMARY) and LIFE_AND_EARTH_SCIENCES (COLLEGE_LYCEE_REFERENCE) remain distinct'
);

-- Exact row-for-row verification of the 8 primary subject components (codes, parents, labels, CNTE p. 46 URL/page, and SOURCE_PARTIAL_PRIMARY)
select extensions.ok(
  (select count(*)::int from public.academic_subject_components) = 8
  and not exists (
    (
      select
        comp.code,
        sub.code as parent_code,
        comp.label_ar,
        comp.label_fr,
        comp.label_en,
        comp.source_url,
        comp.source_page,
        comp.evidence_status
      from public.academic_subject_components comp
      join public.academic_subjects sub on sub.id = comp.parent_subject_id
      except
      values
        ('ARABIC_ORAL_RECITATION', 'ARABIC', 'التواصل الشفوي والمحفوظات', 'Communication orale et récitation', 'Oral communication and recitation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_READING', 'ARABIC', 'القراءة', 'Lecture', 'Reading', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_LANGUAGE_RULES', 'ARABIC', 'قواعد اللغة: رسم/نحو/صرف', 'Règles de langue : orthographe, grammaire et morphologie', 'Language rules: orthography, grammar and morphology', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_HANDWRITING_DICTATION', 'ARABIC', 'الخط والإملاء', 'Écriture et dictée', 'Handwriting and dictation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_WRITTEN_PRODUCTION', 'ARABIC', 'الإنتاج الكتابي', 'Production écrite', 'Written expression', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_ORAL_RECITATION', 'FRENCH', 'التعبير الشفوي والمحفوظات', 'Expression orale et récitation', 'Oral expression and recitation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_READING', 'FRENCH', 'القراءة', 'Lecture', 'Reading', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_WRITTEN_PRODUCTION_HANDWRITING', 'FRENCH', 'الإنتاج الكتابي والخط', 'Production écrite et écriture', 'Written expression and handwriting', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY')
    )
    union all
    (
      values
        ('ARABIC_ORAL_RECITATION', 'ARABIC', 'التواصل الشفوي والمحفوظات', 'Communication orale et récitation', 'Oral communication and recitation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_READING', 'ARABIC', 'القراءة', 'Lecture', 'Reading', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_LANGUAGE_RULES', 'ARABIC', 'قواعد اللغة: رسم/نحو/صرف', 'Règles de langue : orthographe, grammaire et morphologie', 'Language rules: orthography, grammar and morphology', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_HANDWRITING_DICTATION', 'ARABIC', 'الخط والإملاء', 'Écriture et dictée', 'Handwriting and dictation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('ARABIC_WRITTEN_PRODUCTION', 'ARABIC', 'الإنتاج الكتابي', 'Production écrite', 'Written expression', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_ORAL_RECITATION', 'FRENCH', 'التعبير الشفوي والمحفوظات', 'Expression orale et récitation', 'Oral expression and recitation', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_READING', 'FRENCH', 'القراءة', 'Lecture', 'Reading', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY'),
        ('FRENCH_WRITTEN_PRODUCTION_HANDWRITING', 'FRENCH', 'الإنتاج الكتابي والخط', 'Production écrite et écriture', 'Written expression and handwriting', 'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf', '46', 'SOURCE_PARTIAL_PRIMARY')
      except
      select
        comp.code,
        sub.code as parent_code,
        comp.label_ar,
        comp.label_fr,
        comp.label_en,
        comp.source_url,
        comp.source_page,
        comp.evidence_status
      from public.academic_subject_components comp
      join public.academic_subjects sub on sub.id = comp.parent_subject_id
    )
  ),
  '32. Exact 8 primary subject components (5 ARABIC + 3 FRENCH) match required codes, parents, labels, CNTE p. 46 URL/page, and SOURCE_PARTIAL_PRIMARY status'
);

select extensions.is(
  (
    select count(*)::int
    from public.academic_subjects
    where ministry_code is not null or introduced_year is not null
  ) + (
    select count(*)::int
    from public.academic_subject_components
    where ministry_component_code is not null
  ) + (
    select count(*)::int
    from public.subject_level_applicability
    where weekly_hours is not null or coefficient is not null or introduced_year is not null
  ),
  0,
  '33. Unknown Ministry codes, weekly hours, coefficients, and introduction years remain unset (NULL)'
);

select extensions.is(
  (
    select count(*)::int
    from public.subject_level_applicability sla
    join public.academic_years ay on ay.id = sla.academic_year_id
    where ay.code = '2026-2027'
      and sla.applicability_status = 'UNVERIFIED_GRADE_MAPPING'
      and sla.evidence_status = 'SOURCE_PARTIAL_PRIMARY'
  ),
  78,
  '34. All 78 primary grade-subject pairs for 2026-2027 start as UNVERIFIED_GRADE_MAPPING with SOURCE_PARTIAL_PRIMARY (historical textbook listings do not auto-activate 2026-2027 applicability)'
);

select extensions.is(
  (
    select count(*)::int
    from public.subject_level_applicability sla
    join public.academic_years ay on ay.id = sla.academic_year_id
    where ay.code = '2026-2027'
      and sla.applicability_status = 'APPLICABLE'
  ),
  0,
  '35. Zero 2026-2027 grade-subject pairs are seeded as APPLICABLE prior to explicit school confirmation'
);

select extensions.ok(
  (
    select count(*)::int
    from public.subject_level_applicability sla
    join public.academic_years ay on ay.id = sla.academic_year_id
    where ay.code = '2026-2027'
      and sla.source_version = '2023-2024'
  ) = 19
  and (
    select count(*)::int
    from public.subject_level_applicability sla
    join public.academic_years ay on ay.id = sla.academic_year_id
    where ay.code = '2026-2027'
      and sla.source_version is null
  ) = 59,
  '36. Historical 2023-2024 CNP textbook provenance is preserved on the 19 observed pairs while 59 remaining pairs keep null source_version'
);

select extensions.ok(
  (
    select count(*)::int
    from public.school_subject_offerings sso
    join public.academic_years ay on ay.id = sso.academic_year_id
    where ay.code = '2026-2027' and sso.is_enabled = true
  ) = 0
  and (
    select count(*)::int
    from public.school_subject_offerings sso
    join public.academic_years ay on ay.id = sso.academic_year_id
    where ay.code = '2026-2027'
      and sso.is_enabled = false
      and sso.activated_at is null
      and sso.activated_by is null
  ) = 78,
  '37. All 78 school_subject_offerings rows for 2026-2027 are seeded disabled (0 enabled, 78 disabled with null activation metadata)'
);

select extensions.is(
  (select count(*)::int from public.teacher_subject_allocations)
  + (select count(*)::int from public.teacher_subject_allocation_events),
  0,
  '38. Zero initial teacher_subject_allocations and zero initial teacher_subject_allocation_events exist on baseline seed'
);

-- =========================================================================
-- 4. Schema Constraints on Components & Provenance-Gated Ministry Codes (assertions 39-41)
-- =========================================================================
select extensions.throws_ok(
  $$
    insert into public.academic_subject_components (
      parent_subject_id, code, label_ar, label_fr, label_en,
      observed_source_label, observed_source_lang, source_url, source_document,
      evidence_status, applicability_status
    )
    select
      id, 'PHILOSOPHY_INVALID_COMP', 'فرع', 'Sous-composante', 'Subcomponent',
      'Philosophie', 'fr', 'https://www.cnp.com.tn/CNP1/web/fr/ens_sec.jsp', 'CNP',
      'REFERENCE_ONLY', 'REFERENCE_ONLY'
    from public.academic_subjects where code = 'PHILOSOPHY'
  $$,
  'P0001',
  'component_parent_must_be_primary_subject',
  '39. Subject component cannot attach to a non-primary (COLLEGE_LYCEE_REFERENCE) parent subject'
);

select extensions.throws_ok(
  $$
    update public.academic_subjects set ministry_code = '110104' where code = 'ARABIC'
  $$,
  '23514',
  null,
  '40. Check constraint rejects assigning external ministry_code when verified provenance (source_page) is missing'
);

update public.academic_subjects
   set source_page = 'p. 12',
       ministry_code = '110104'
 where code = 'ARABIC';

select extensions.is(
  (select ministry_code from public.academic_subjects where code = 'ARABIC'),
  '110104',
  '41. External 6-digit ministry_code is accepted when full verified provenance (evidence_status, source_url, source_document, source_version, source_page) is present'
);

update public.academic_subjects
   set ministry_code = null,
       source_page = null
 where code = 'ARABIC';

-- =========================================================================
-- 5. Synthetic Multi-Role Test Fixtures
-- =========================================================================
create temp table pg_temp.t4a_refs (
  ref_key text primary key,
  ref_id uuid
) on commit drop;
grant select, insert, update on pg_temp.t4a_refs to authenticated;

create or replace function pg_temp.set_t4a_ref(p_key text, p_id uuid)
returns uuid
language plpgsql
as $$
begin
  if p_id is null then
    raise exception 'expected_non_null_ref:%', p_key using errcode = 'P0001';
  end if;
  insert into pg_temp.t4a_refs (ref_key, ref_id)
  values (p_key, p_id)
  on conflict (ref_key) do update set ref_id = excluded.ref_id;
  return p_id;
end;
$$;

create or replace function pg_temp.get_t4a_ref(p_key text)
returns uuid
language sql
stable
as $$
  select ref_id from pg_temp.t4a_refs where ref_key = p_key;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-9000-000000000701'::uuid, 'authenticated', 'authenticated', 't4a-owner@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_owner","full_name":"T4A Owner","requested_role":"APP_ADMIN"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000702'::uuid, 'authenticated', 'authenticated', 't4a-admin@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_admin","full_name":"T4A Office Admin","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000703'::uuid, 'authenticated', 'authenticated', 't4a-mgr-ro@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_mgr_ro","full_name":"T4A Manager RosterView","requested_role":"MANAGER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000704'::uuid, 'authenticated', 'authenticated', 't4a-mgr-manage@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_mgr_manage","full_name":"T4A Manager ClassesManage","requested_role":"MANAGER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000705'::uuid, 'authenticated', 'authenticated', 't4a-teacher-cp1@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_teacher_cp1","full_name":"T4A Teacher CP1","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000706'::uuid, 'authenticated', 'authenticated', 't4a-teacher-cp2@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_teacher_cp2","full_name":"T4A Teacher CP2","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000707'::uuid, 'authenticated', 'authenticated', 't4a-teacher-cm2@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_teacher_cm2","full_name":"T4A Teacher CM2","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000708'::uuid, 'authenticated', 'authenticated', 't4a-parent@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_parent","full_name":"T4A Parent","requested_role":"PARENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000709'::uuid, 'authenticated', 'authenticated', 't4a-student@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_student","full_name":"T4A Student","requested_role":"STUDENT"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000710'::uuid, 'authenticated', 'authenticated', 't4a-pending@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_pending","full_name":"T4A Pending Teacher","requested_role":"TEACHER"}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-000000000711'::uuid, 'authenticated', 'authenticated', 't4a-dual@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_dual","full_name":"T4A Dual AdminTeacher","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb, now(), now());

update public.profiles
   set account_status = 'APPROVED'
 where id in (
   '00000000-0000-4000-9000-000000000701'::uuid,
   '00000000-0000-4000-9000-000000000702'::uuid,
   '00000000-0000-4000-9000-000000000703'::uuid,
   '00000000-0000-4000-9000-000000000704'::uuid,
   '00000000-0000-4000-9000-000000000705'::uuid,
   '00000000-0000-4000-9000-000000000706'::uuid,
   '00000000-0000-4000-9000-000000000707'::uuid,
   '00000000-0000-4000-9000-000000000708'::uuid,
   '00000000-0000-4000-9000-000000000709'::uuid,
   '00000000-0000-4000-9000-000000000711'::uuid
 );

delete from public.role_assignments
 where user_id between '00000000-0000-4000-9000-000000000701'::uuid and '00000000-0000-4000-9000-000000000711'::uuid;

insert into public.role_assignments (user_id, role, active) values
  ('00000000-0000-4000-9000-000000000701'::uuid, 'APP_ADMIN', true),
  ('00000000-0000-4000-9000-000000000702'::uuid, 'ADMINISTRATIVE_PERSONNEL', true),
  ('00000000-0000-4000-9000-000000000703'::uuid, 'MANAGER', true),
  ('00000000-0000-4000-9000-000000000704'::uuid, 'MANAGER', true),
  ('00000000-0000-4000-9000-000000000705'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000706'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000707'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000708'::uuid, 'PARENT', true),
  ('00000000-0000-4000-9000-000000000709'::uuid, 'STUDENT', true),
  ('00000000-0000-4000-9000-000000000710'::uuid, 'TEACHER', true),
  ('00000000-0000-4000-9000-000000000711'::uuid, 'ADMINISTRATIVE_PERSONNEL', true),
  ('00000000-0000-4000-9000-000000000711'::uuid, 'TEACHER', true);

insert into public.manager_capability_grants (manager_user_id, capability, active, granted_by) values
  ('00000000-0000-4000-9000-000000000703'::uuid, 'CLASSES_ROSTER_VIEW', true, '00000000-0000-4000-9000-000000000701'::uuid),
  ('00000000-0000-4000-9000-000000000704'::uuid, 'CLASSES_MANAGE', true, '00000000-0000-4000-9000-000000000701'::uuid);

insert into public.school_classes (id, academic_year_id, level_code, name, capacity, created_by)
select '00000000-0000-4000-9000-000000000801'::uuid, id, 'CP', 'CP-T4A', 24, '00000000-0000-4000-9000-000000000701'::uuid
  from public.academic_years where code = '2026-2027'
union all
select '00000000-0000-4000-9000-000000000802'::uuid, id, 'CM2', 'CM2-T4A', 24, '00000000-0000-4000-9000-000000000701'::uuid
  from public.academic_years where code = '2026-2027';

insert into public.students (id, student_code, full_name, birth_date, linked_profile_id, status, created_by) values
  ('00000000-0000-4000-9000-000000000851'::uuid, 'KS-T4A-S1', 'Pupil T4A One', date '2019-05-10', '00000000-0000-4000-9000-000000000709'::uuid, 'ACTIVE', '00000000-0000-4000-9000-000000000701'::uuid);

insert into public.student_class_memberships (student_id, class_id, academic_year_id, status, assigned_by)
select '00000000-0000-4000-9000-000000000851'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, id, 'ACTIVE', '00000000-0000-4000-9000-000000000701'::uuid
  from public.academic_years where code = '2026-2027';

insert into public.parent_child_links (parent_user_id, student_id, relationship_label, active, verified_by) values
  ('00000000-0000-4000-9000-000000000708'::uuid, '00000000-0000-4000-9000-000000000851'::uuid, 'Mother', true, '00000000-0000-4000-9000-000000000701'::uuid);

insert into public.teacher_class_assignments (teacher_user_id, class_id, is_homeroom, active, assigned_by) values
  ('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, true, true, '00000000-0000-4000-9000-000000000701'::uuid),
  ('00000000-0000-4000-9000-000000000706'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, false, true, '00000000-0000-4000-9000-000000000701'::uuid),
  ('00000000-0000-4000-9000-000000000711'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, false, true, '00000000-0000-4000-9000-000000000701'::uuid),
  ('00000000-0000-4000-9000-000000000707'::uuid, '00000000-0000-4000-9000-000000000802'::uuid, true, true, '00000000-0000-4000-9000-000000000701'::uuid);

-- =========================================================================
-- 6. Explicit Applicability & Offering Workflow + Seed Rerun Preservation (assertions 42-50)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000702","role":"authenticated"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.upsert_subject_level_applicability('2026-2027', 'CP', 'PHILOSOPHY', 'APPLICABLE', 'SCHOOL_DECLARED')$$,
  'P0001',
  'secondary_or_historical_subject_not_applicable',
  '42. Cannot mark COLLEGE_LYCEE_REFERENCE subject (PHILOSOPHY) as APPLICABLE on primary level CP'
);

select extensions.throws_ok(
  $$select public.upsert_subject_level_applicability('2026-2027', '6EME', 'ITALIAN', 'OPTIONAL', 'SCHOOL_DECLARED')$$,
  'P0001',
  'secondary_or_historical_subject_not_applicable',
  '43. Cannot mark HISTORICAL_OPTIONAL_LANGUAGE subject (ITALIAN) as OPTIONAL on primary level 6EME'
);

select extensions.throws_ok(
  $$select public.set_school_subject_offering('2026-2027', 'CP', 'ARABIC', true, 6, 'Attempt before applicability confirmed')$$,
  'P0001',
  'subject_not_applicable_to_level',
  '44. Cannot enable school subject offering for ARABIC on CP while applicability is still UNVERIFIED_GRADE_MAPPING'
);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ARABIC', null)$$,
  'P0001',
  'subject_not_applicable_to_level',
  '45. Cannot allocate ARABIC to CP Teacher while level applicability is still UNVERIFIED_GRADE_MAPPING'
);

-- Administrative personnel explicitly declares 2026-2027 applicability for CP (ARABIC, MATHEMATICS, SCIENTIFIC_AWAKENING, ISLAMIC_EDUCATION, VISUAL_ARTS) and CM2 (HISTORY)
select extensions.ok(
  (public.upsert_subject_level_applicability('2026-2027', 'CP', 'ARABIC', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE'
  and (public.upsert_subject_level_applicability('2026-2027', 'CP', 'MATHEMATICS', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE'
  and (public.upsert_subject_level_applicability('2026-2027', 'CP', 'SCIENTIFIC_AWAKENING', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE'
  and (public.upsert_subject_level_applicability('2026-2027', 'CP', 'ISLAMIC_EDUCATION', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE'
  and (public.upsert_subject_level_applicability('2026-2027', 'CP', 'VISUAL_ARTS', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE'
  and (public.upsert_subject_level_applicability('2026-2027', 'CM2', 'HISTORY', 'APPLICABLE', 'SCHOOL_DECLARED') ->> 'applicabilityStatus') = 'APPLICABLE',
  '46. ADMINISTRATIVE_PERSONNEL explicitly confirms 2026-2027 applicability for CP and CM2 test subjects via upsert_subject_level_applicability'
);

-- Before enabling offerings, allocation still fails with subject_offering_not_enabled
select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ARABIC', null)$$,
  'P0001',
  'subject_offering_not_enabled',
  '47. Cannot allocate even an APPLICABLE subject (ARABIC on CP) while its school_subject_offerings row remains disabled'
);

select extensions.ok(
  (public.set_school_subject_offering('2026-2027', 'CP', 'ARABIC', true, 6, 'Explicitly enabled CP Arabic') ->> 'isEnabled')::boolean
  and (public.set_school_subject_offering('2026-2027', 'CP', 'MATHEMATICS', true, 5, 'Explicitly enabled CP Mathematics') ->> 'isEnabled')::boolean
  and (public.set_school_subject_offering('2026-2027', 'CP', 'SCIENTIFIC_AWAKENING', true, 2, 'Explicitly enabled CP Scientific Awakening') ->> 'isEnabled')::boolean
  and (public.set_school_subject_offering('2026-2027', 'CP', 'ISLAMIC_EDUCATION', true, 2, 'Explicitly enabled CP Islamic Education') ->> 'isEnabled')::boolean
  and (public.set_school_subject_offering('2026-2027', 'CP', 'VISUAL_ARTS', true, 1, 'Explicitly enabled CP Visual Arts') ->> 'isEnabled')::boolean
  and (public.set_school_subject_offering('2026-2027', 'CM2', 'HISTORY', true, 1, 'Explicitly enabled CM2 History') ->> 'isEnabled')::boolean,
  '48. ADMINISTRATIVE_PERSONNEL explicitly enables CP and CM2 school offerings after applicability is established'
);

-- Verify seed rerun idempotency: re-running the migration's ON CONFLICT DO NOTHING seed statements under superuser/postgres does NOT overwrite administrative applicability or offering activation
reset role;

insert into public.subject_level_applicability (
  academic_year_id, level_code, subject_id,
  applicability_status, evidence_status,
  weekly_hours, coefficient, introduced_year,
  source_url, source_document, source_version, notes
)
select
  ay.id, 'CP', sub.id,
  'UNVERIFIED_GRADE_MAPPING', 'SOURCE_PARTIAL_PRIMARY',
  null, null, null,
  'https://www.cnp.com.tn/CNP1/web/fr/ens_prim.jsp',
  'CNP — Liste officielle des manuels scolaires de l''enseignement de base (1ère année)',
  '2023-2024',
  'Rerun idempotency check'
from public.academic_years ay
cross join public.academic_subjects sub
where ay.code = '2026-2027' and sub.code = 'ARABIC'
on conflict (academic_year_id, level_code, subject_id) do nothing;

insert into public.school_subject_offerings (
  academic_year_id, level_code, subject_id, applicability_id,
  is_enabled, weekly_periods, activated_by, activated_at, notes
)
select
  sla.academic_year_id, sla.level_code, sla.subject_id, sla.id,
  false, null, null, null,
  'Rerun idempotency check'
from public.subject_level_applicability sla
join public.academic_years ay on ay.id = sla.academic_year_id
join public.academic_subjects sub on sub.id = sla.subject_id
where ay.code = '2026-2027' and sla.level_code = 'CP' and sub.code = 'ARABIC'
on conflict (academic_year_id, level_code, subject_id) do nothing;

select extensions.ok(
  (
    select sla.applicability_status = 'APPLICABLE' and sso.is_enabled = true and sso.weekly_periods = 6
    from public.subject_level_applicability sla
    join public.school_subject_offerings sso on sso.applicability_id = sla.id
    join public.academic_years ay on ay.id = sla.academic_year_id
    join public.academic_subjects sub on sub.id = sla.subject_id
    where ay.code = '2026-2027' and sla.level_code = 'CP' and sub.code = 'ARABIC'
  ),
  '49. Seed rerun (ON CONFLICT DO NOTHING) preserves administrative applicability and enabled school offering state'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000702","role":"authenticated"}', true);
set local role authenticated;

select extensions.is(
  (
    select elem ->> 'notes'
    from jsonb_array_elements(public.list_academic_subject_catalogue('PRIMARY', '2026-2027', 'CP') -> 'subjects') as elem
    where elem ->> 'code' = 'ARABIC'
  ) is not null,
  true,
  '50. School-wide ADMINISTRATIVE_PERSONNEL receives subject notes in list_academic_subject_catalogue'
);

-- =========================================================================
-- 7. Multi-Subject Single-Teacher & Multi-Teacher Single-Class Allocations + Retry Safety (assertions 51-58)
-- =========================================================================
select extensions.ok(
  pg_temp.set_t4a_ref(
    'cp1_arabic_alloc',
    (public.assign_teacher_subject_allocation(
      '00000000-0000-4000-9000-000000000705'::uuid,
      '00000000-0000-4000-9000-000000000801'::uuid,
      'ARABIC',
      'Homeroom Arabic'
    ) ->> 'allocationId')::uuid
  ) is not null,
  '51. Teacher CP1 allocated ARABIC in CP-T4A'
);

select extensions.ok(
  (public.assign_teacher_subject_allocation(
    '00000000-0000-4000-9000-000000000705'::uuid,
    '00000000-0000-4000-9000-000000000801'::uuid,
    'MATHEMATICS',
    'Homeroom Mathematics'
  ) ->> 'allocationId') is not null,
  '52. Teacher CP1 allocated second subject MATHEMATICS in same class CP-T4A'
);

select extensions.ok(
  (public.assign_teacher_subject_allocation(
    '00000000-0000-4000-9000-000000000705'::uuid,
    '00000000-0000-4000-9000-000000000801'::uuid,
    'SCIENTIFIC_AWAKENING',
    'Homeroom Scientific Awakening'
  ) ->> 'allocationId') is not null,
  '53. Teacher CP1 allocated third subject SCIENTIFIC_AWAKENING in same class CP-T4A'
);

-- Duplicate / retry safety: repeating the same allocation call returns idempotentReplay = true and does not create a duplicate row or extra audit event
select extensions.is(
  (public.assign_teacher_subject_allocation(
    '00000000-0000-4000-9000-000000000705'::uuid,
    '00000000-0000-4000-9000-000000000801'::uuid,
    'ARABIC',
    'Duplicate retry'
  ) ->> 'idempotentReplay')::boolean,
  true,
  '54. Duplicate allocation request returns idempotentReplay = true without error or duplicate row'
);

select extensions.ok(
  (
    select count(*)::int
    from public.teacher_subject_allocations
    where id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
  ) = 1
  and (
    select count(*)::int
    from public.teacher_subject_allocation_events
    where allocation_id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
  ) = 1,
  '55. Exactly 1 allocation row and 1 INITIAL_ALLOCATION audit event exist for CP1 ARABIC after idempotent retry'
);

-- Second Teacher (CP2) in the same class CP-T4A allocated ISLAMIC_EDUCATION and VISUAL_ARTS (by Manager with CLASSES_MANAGE)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000704', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000704","role":"authenticated"}', true);

select extensions.ok(
  pg_temp.set_t4a_ref(
    'cp2_islamic_alloc',
    (public.assign_teacher_subject_allocation(
      '00000000-0000-4000-9000-000000000706'::uuid,
      '00000000-0000-4000-9000-000000000801'::uuid,
      'ISLAMIC_EDUCATION',
      'Specialist Islamic Education'
    ) ->> 'allocationId')::uuid
  ) is not null
  and (public.assign_teacher_subject_allocation(
    '00000000-0000-4000-9000-000000000706'::uuid,
    '00000000-0000-4000-9000-000000000801'::uuid,
    'VISUAL_ARTS',
    'Specialist Visual Arts'
  ) ->> 'allocationId') is not null,
  '56. Manager with CLASSES_MANAGE allocates 2 subjects to second Teacher CP2 in the same class CP-T4A'
);

-- Allocate HISTORY to Teacher CM2 in CM2-T4A
select extensions.ok(
  (public.assign_teacher_subject_allocation(
    '00000000-0000-4000-9000-000000000707'::uuid,
    '00000000-0000-4000-9000-000000000802'::uuid,
    'HISTORY',
    'CM2 History'
  ) ->> 'allocationId') is not null,
  '57. Teacher CM2 allocated HISTORY in CM2-T4A'
);

select extensions.is(
  jsonb_array_length(public.list_class_subject_allocations('00000000-0000-4000-9000-000000000801'::uuid, false)),
  5,
  '58. CP-T4A has 5 active subject allocations across 2 distinct Teachers (3 for CP1 + 2 for CP2)'
);

-- =========================================================================
-- 8. Teacher Readback, Self-Grant Denial, Cross-Class Denial & Audit/Notes Protection (assertions 59-70)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000705', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000705","role":"authenticated"}', true);

select extensions.is(
  jsonb_array_length(public.list_my_teacher_subject_allocations('00000000-0000-4000-9000-000000000801'::uuid)),
  3,
  '59. Teacher CP1 reads own 3 allocated subjects in CP-T4A via list_my_teacher_subject_allocations'
);

select extensions.is(
  jsonb_array_length(
    (
      select elem -> 'components'
      from jsonb_array_elements(public.list_my_teacher_subject_allocations('00000000-0000-4000-9000-000000000801'::uuid)) as elem
      where elem ->> 'subjectCode' = 'ARABIC'
    )
  ),
  5,
  '60. Teacher CP1 ARABIC allocation readback includes all 5 parent-linked Arabic components'
);

select extensions.is(
  (select count(*)::int from public.teacher_subject_allocations),
  3,
  '61. RLS on teacher_subject_allocations restricts Teacher CP1 to own 3 active rows only (hides CP2 and CM2 rows)'
);

select extensions.ok(
  (
    select (elem ->> 'notes') is null
    from jsonb_array_elements(public.list_academic_subject_catalogue('PRIMARY', '2026-2027', 'CP') -> 'subjects') as elem
    where elem ->> 'code' = 'ARABIC'
  )
  and (
    select bool_and((elem ->> 'allocatedBy') is null and (elem ->> 'deactivatedBy') is null and (elem ->> 'deactivationReason') is null)
    from jsonb_array_elements(public.list_class_subject_allocations('00000000-0000-4000-9000-000000000801'::uuid, false)) as elem
  ),
  '62. Non-school-wide Teacher CP1 receives null for internal notes and attribution/deactivation audit fields in RPC projections'
);

select extensions.is(
  (select count(*)::int from public.teacher_subject_allocation_events),
  0,
  '63. RLS on teacher_subject_allocation_events denies non-administrative Teacher CP1 (0 rows visible)'
);

select extensions.throws_ok(
  $$select public.list_teacher_subject_allocation_events('00000000-0000-4000-9000-000000000801'::uuid, null)$$,
  'P0001',
  'insufficient_authority',
  '64. Non-administrative Teacher CP1 is denied list_teacher_subject_allocation_events'
);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ISLAMIC_EDUCATION', 'Self grant attempt')$$,
  'P0001',
  'self_allocation_denied',
  '65. Teacher CP1 cannot self-grant subject allocation (self_allocation_denied)'
);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000706'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ARABIC', 'Other teacher attempt')$$,
  'P0001',
  'insufficient_authority',
  '66. Teacher CP1 cannot allocate subjects to another Teacher (insufficient_authority)'
);

select extensions.throws_ok(
  $$select public.list_class_subject_allocations('00000000-0000-4000-9000-000000000802'::uuid, false)$$,
  'P0001',
  'insufficient_authority',
  '67. Cross-class denial: Teacher CP1 cannot list subject allocations for unassigned class CM2-T4A'
);

select extensions.throws_ok(
  $$select public.list_my_teacher_subject_allocations('00000000-0000-4000-9000-000000000802'::uuid)$$,
  'P0001',
  'insufficient_authority',
  '68. Cross-class denial: Teacher CP1 cannot call list_my_teacher_subject_allocations for unassigned class CM2-T4A'
);

-- Dual-role user (ADMINISTRATIVE_PERSONNEL + TEACHER) attempting to self-grant a Teacher subject allocation is also denied
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000711', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000711","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000711'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ARABIC', 'Dual role self grant')$$,
  'P0001',
  'self_allocation_denied',
  '69. Dual-role ADMINISTRATIVE_PERSONNEL+TEACHER cannot self-grant a Teacher subject allocation'
);

-- Cross-class assignment mismatch: Admin attempting to allocate ARABIC to Teacher CP1 in CM2-T4A (where CP1 is not assigned)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000702","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000802'::uuid, 'ARABIC', 'Unassigned class')$$,
  'P0001',
  'class_assignment_not_found',
  '70. Cross-class denial: Cannot allocate subject to Teacher in a class where they have no teacher_class_assignments row'
);

-- =========================================================================
-- 9. Parent, Student, Unapproved & Read-Only Manager Denials across Tables & RPCs (assertions 71-77)
-- =========================================================================
-- PENDING account denial
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000710', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000710","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.list_academic_subject_catalogue()$$,
  'P0001',
  'actor_not_approved',
  '71. Unapproved (PENDING) Teacher account is denied list_academic_subject_catalogue'
);

select extensions.is(
  (select count(*)::int from public.curriculum_domains)
  + (select count(*)::int from public.academic_subjects)
  + (select count(*)::int from public.academic_subject_components)
  + (select count(*)::int from public.subject_level_applicability)
  + (select count(*)::int from public.school_subject_offerings)
  + (select count(*)::int from public.teacher_subject_allocations)
  + (select count(*)::int from public.teacher_subject_allocation_events),
  0,
  '72. Unapproved (PENDING) account sees 0 rows across all 7 T4A tables under RLS'
);

-- PARENT denial across both RPCs and direct table SELECT
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000708', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000708","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.list_academic_subject_catalogue()$$,
  'P0001',
  'insufficient_authority',
  '73. Approved PARENT is denied list_academic_subject_catalogue'
);

select extensions.is(
  (select count(*)::int from public.curriculum_domains)
  + (select count(*)::int from public.academic_subjects)
  + (select count(*)::int from public.academic_subject_components)
  + (select count(*)::int from public.subject_level_applicability)
  + (select count(*)::int from public.school_subject_offerings)
  + (select count(*)::int from public.teacher_subject_allocations)
  + (select count(*)::int from public.teacher_subject_allocation_events),
  0,
  '74. Approved PARENT sees 0 rows across all 7 T4A tables under RLS (matching RPC denial)'
);

-- STUDENT denial across both RPCs and direct table SELECT
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000709', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000709","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ARABIC', 'Student attempt')$$,
  'P0001',
  'insufficient_authority',
  '75. Approved STUDENT is denied assign_teacher_subject_allocation'
);

select extensions.is(
  (select count(*)::int from public.curriculum_domains)
  + (select count(*)::int from public.academic_subjects)
  + (select count(*)::int from public.academic_subject_components)
  + (select count(*)::int from public.subject_level_applicability)
  + (select count(*)::int from public.school_subject_offerings)
  + (select count(*)::int from public.teacher_subject_allocations)
  + (select count(*)::int from public.teacher_subject_allocation_events),
  0,
  '76. Approved STUDENT sees 0 rows across all 7 T4A tables under RLS (matching RPC denial)'
);

-- Read-only Manager (CLASSES_ROSTER_VIEW only) denial for mutations
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000703', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000703","role":"authenticated"}', true);

select extensions.throws_ok(
  $$select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, 'ISLAMIC_EDUCATION', 'Roster-only manager attempt')$$,
  'P0001',
  'insufficient_authority',
  '77. Manager with CLASSES_ROSTER_VIEW only cannot mutate teacher_subject_allocations'
);

-- =========================================================================
-- 10. Append-Only Allocation Audit History, Reactivation, Offering Disablement & Class Revocation (assertions 78-86)
-- =========================================================================
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000702","role":"authenticated"}', true);

-- Explicit deactivation of CP1 ARABIC allocation
select extensions.is(
  (public.set_teacher_subject_allocation_active(
    pg_temp.get_t4a_ref('cp1_arabic_alloc'),
    false,
    'Temporary medical leave'
  ) ->> 'active')::boolean,
  false,
  '78. Explicit deactivation of CP1 ARABIC allocation sets active = false'
);

-- Reactivation of CP1 ARABIC allocation via set_teacher_subject_allocation_active
select extensions.is(
  (public.set_teacher_subject_allocation_active(
    pg_temp.get_t4a_ref('cp1_arabic_alloc'),
    true,
    'Returned from medical leave'
  ) ->> 'active')::boolean,
  true,
  '79. Reactivation of CP1 ARABIC allocation sets active = true while parent assignment and offering are active'
);

-- Verify append-only audit trail for CP1 ARABIC retained INITIAL_ALLOCATION -> EXPLICIT_DEACTIVATION -> REACTIVATION without losing prior deactivation metadata
select extensions.ok(
  (
    select array_agg(ev.operation_type order by ev.resulting_version asc)
    from public.teacher_subject_allocation_events ev
    where ev.allocation_id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
  ) = array['INITIAL_ALLOCATION', 'EXPLICIT_DEACTIVATION', 'REACTIVATION']
  and exists (
    select 1
    from public.teacher_subject_allocation_events ev
    where ev.allocation_id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
      and ev.operation_type = 'EXPLICIT_DEACTIVATION'
      and ev.resulting_deactivation_reason = 'Temporary medical leave'
      and ev.actor_user_id = '00000000-0000-4000-9000-000000000702'::uuid
      and ev.actor_source = 'AUTHENTICATED_USER'
  )
  and exists (
    select 1
    from public.teacher_subject_allocation_events ev
    where ev.allocation_id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
      and ev.operation_type = 'REACTIVATION'
      and ev.previous_deactivation_reason = 'Temporary medical leave'
      and ev.resulting_deactivation_reason is null
      and ev.causal_reason = 'Returned from medical leave'
  ),
  '80. Reactivating CP1 ARABIC preserves prior EXPLICIT_DEACTIVATION audit event and records REACTIVATION event in teacher_subject_allocation_events'
);

-- Disable CP ISLAMIC_EDUCATION school offering: verify CP2 ISLAMIC_EDUCATION allocation is automatically deactivated with OFFERING_DISABLED_DEACTIVATION event
select extensions.is(
  (public.set_school_subject_offering('2026-2027', 'CP', 'ISLAMIC_EDUCATION', false, 2, 'Temporarily suspended offering') ->> 'isEnabled')::boolean,
  false,
  '81. Disabling CP ISLAMIC_EDUCATION school offering succeeds via set_school_subject_offering'
);

-- Inspect private persisted postconditions as the isolated fixture owner; RPC mutation above used authenticated authority.
reset role;
select extensions.ok(
  exists (
    select 1
    from public.teacher_subject_allocations tsa
    where tsa.id = pg_temp.get_t4a_ref('cp2_islamic_alloc')
      and tsa.active = false
      and tsa.deactivation_reason = 'subject_offering_disabled'
      and tsa.deactivated_by = '00000000-0000-4000-9000-000000000702'::uuid
  )
  and exists (
    select 1
    from public.teacher_subject_allocation_events ev
    where ev.allocation_id = pg_temp.get_t4a_ref('cp2_islamic_alloc')
      and ev.operation_type = 'OFFERING_DISABLED_DEACTIVATION'
      and ev.causal_reason = 'subject_offering_disabled'
      and ev.actor_user_id = '00000000-0000-4000-9000-000000000702'::uuid
  ),
  '82. Disabling school offering cascades to active=false on dependent allocations and records OFFERING_DISABLED_DEACTIVATION audit event'
);

set local role authenticated;

-- Deactivate Teacher CP1's class assignment via assign_teacher_to_class RPC
select extensions.is(
  (public.assign_teacher_to_class('00000000-0000-4000-9000-000000000705'::uuid, '00000000-0000-4000-9000-000000000801'::uuid, true, false) ->> 'active')::boolean,
  false,
  '83. Deactivating Teacher CP1 class assignment succeeds via assign_teacher_to_class'
);

-- Inspect private persisted postconditions as the isolated fixture owner; RPC mutation above used authenticated authority.
reset role;
select extensions.ok(
  (
    select count(*)::int
    from public.teacher_subject_allocations
    where teacher_user_id = '00000000-0000-4000-9000-000000000705'::uuid
      and class_id = '00000000-0000-4000-9000-000000000801'::uuid
      and active = false
      and deactivation_reason = 'class_assignment_deactivated'
      and deactivated_by = '00000000-0000-4000-9000-000000000702'::uuid
  ) = 3
  and (
    select count(*)::int
    from public.teacher_subject_allocation_events
    where teacher_user_id = '00000000-0000-4000-9000-000000000705'::uuid
      and class_id = '00000000-0000-4000-9000-000000000801'::uuid
      and operation_type = 'CLASS_ASSIGNMENT_REVOKED_DEACTIVATION'
      and causal_reason = 'class_assignment_deactivated'
      and actor_user_id = '00000000-0000-4000-9000-000000000702'::uuid
  ) = 3,
  '84. Revoking Teacher CP1 class assignment deactivates all 3 allocations and appends 3 CLASS_ASSIGNMENT_REVOKED_DEACTIVATION audit events'
);

set local role authenticated;

select extensions.throws_ok(
  $$select public.set_teacher_subject_allocation_active(pg_temp.get_t4a_ref('cp1_arabic_alloc'), true, 'Try reactivating while class inactive')$$,
  'P0001',
  'class_assignment_inactive',
  '85. Cannot reactivate a subject allocation while parent teacher_class_assignments row is inactive'
);

-- Verify unauthenticated system/trigger deactivation attribution (actor_user_id IS NULL, actor_source = 'SYSTEM_UNAUTHENTICATED') and immutability of audit events
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.teacher_class_assignments
   set active = false
 where teacher_user_id = '00000000-0000-4000-9000-000000000707'::uuid
   and class_id = '00000000-0000-4000-9000-000000000802'::uuid;

select extensions.ok(
  exists (
    select 1
    from public.teacher_subject_allocation_events ev
    where ev.teacher_user_id = '00000000-0000-4000-9000-000000000707'::uuid
      and ev.class_id = '00000000-0000-4000-9000-000000000802'::uuid
      and ev.operation_type = 'CLASS_ASSIGNMENT_REVOKED_DEACTIVATION'
      and ev.actor_user_id is null
      and ev.actor_source = 'SYSTEM_UNAUTHENTICATED'
      and ev.resulting_deactivated_by is null
  ),
  '86. Unauthenticated system trigger deactivation records actor_user_id IS NULL and actor_source = SYSTEM_UNAUTHENTICATED without stale UUID attribution'
);

-- =========================================================================
-- 11. Audit Event Immutability & Preservation of Existing T1/T2 + Calendar Contracts (assertions 87-88)
-- =========================================================================
select extensions.throws_ok(
  $$delete from public.teacher_subject_allocation_events$$,
  'P0001',
  'allocation_audit_history_immutable',
  '87. teacher_subject_allocation_events is append-only and rejects UPDATE/DELETE even by privileged caller'
);

-- Switch to active Teacher CP2 on CP-T4A: verify T1/T2 roster and Calendar event creation remain intact
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000706', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000706","role":"authenticated"}', true);
set local role authenticated;

select extensions.ok(
  public.can_access_class('00000000-0000-4000-9000-000000000801'::uuid)
  and public.can_access_student_record('00000000-0000-4000-9000-000000000851'::uuid)
  and jsonb_array_length(public.list_school_classes_with_rosters()) >= 1
  and (
    select (public.upsert_school_calendar_event(
      'CP-T4A Class Test',
      'Preserved calendar contract',
      'TEST',
      date '2026-11-20',
      date '2026-11-20',
      '00000000-0000-4000-9000-000000000801'::uuid,
      true,
      false
    )).class_id
  ) = '00000000-0000-4000-9000-000000000801'::uuid,
  '88. Existing T1/T2 class/student access functions and Calendar class-scoped event creation contract remain intact'
);


-- Regrant through the allocation command must preserve the supplied new causal reason,
-- rather than reuse stale deactivation context.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-000000000702","role":"authenticated"}', true);
select public.assign_teacher_to_class('00000000-0000-4000-9000-000000000705', '00000000-0000-4000-9000-000000000801', true, true);
select public.assign_teacher_subject_allocation('00000000-0000-4000-9000-000000000705', '00000000-0000-4000-9000-000000000801', 'ARABIC', 'Reassigned after review');
select extensions.ok(exists (
  select 1 from public.teacher_subject_allocation_events
  where allocation_id = pg_temp.get_t4a_ref('cp1_arabic_alloc')
    and operation_type = 'REACTIVATION'
    and causal_reason = 'Reassigned after review'
), '89. Allocation-command reactivation records the new reason without reusing stale transition context');
rollback;

