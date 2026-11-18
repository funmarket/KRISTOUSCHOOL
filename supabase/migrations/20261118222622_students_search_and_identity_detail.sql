-- Students directory read projection. People/Academics remain the record owners.
-- Additive read APIs only: no account linking, new records, grades or changed RLS.
create function public.list_school_students(
  p_search text default null,
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_status text default 'ACTIVE',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved'; end if;
  -- Same school-wide read authority as the canonical class/roster reader.
  -- A Manager label or class-creation permission alone does not qualify.
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then raise exception 'insufficient_authority'; end if;
  if p_limit is null or p_limit not between 1 and 100
    or p_offset is null or p_offset not between 0 and 100000
    or char_length(v_search) > 100
    or p_status is null or p_status not in ('ACTIVE', 'ARCHIVED', 'ALL')
  then raise exception 'invalid_student_search'; end if;
  if p_academic_year_id is not null and not exists (
    select 1 from public.academic_years where id = p_academic_year_id
  ) then raise exception 'invalid_academic_year'; end if;
  if p_class_id is not null and not exists (
    select 1 from public.school_classes where id = p_class_id
      and (p_academic_year_id is null or academic_year_id = p_academic_year_id)
  ) then raise exception 'invalid_class_filter'; end if;

  with matches as materialized (
    select s.id, s.student_code, s.full_name, s.status
    from public.students s
    where (p_status = 'ALL' or s.status = p_status)
      and (v_search = '' or strpos(lower(s.full_name), v_search) > 0
        or strpos(lower(s.student_code), v_search) > 0 or s.id::text = v_search)
      and ((p_class_id is null and p_academic_year_id is null) or exists (
        select 1 from public.student_class_memberships m
        where m.student_id = s.id and m.status = 'ACTIVE'
          and (p_class_id is null or m.class_id = p_class_id)
          and (p_academic_year_id is null or m.academic_year_id = p_academic_year_id)
      ))
  ), page as (
    select * from matches order by lower(full_name), student_code, id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'studentId', s.id, 'studentCode', s.student_code,
      'fullName', s.full_name, 'status', s.status,
      'classes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'classId', c.id, 'className', c.name, 'levelCode', c.level_code,
          'academicYearId', y.id, 'academicYearCode', y.code,
          'membershipId', m.id, 'enrollmentStatus', m.status
        ) order by y.starts_on desc, c.name, m.id)
        from public.student_class_memberships m
        join public.school_classes c on c.id = m.class_id
        join public.academic_years y on y.id = m.academic_year_id
        where m.student_id = s.id and m.status = 'ACTIVE'
          and (p_class_id is null or c.id = p_class_id)
          and (p_academic_year_id is null or y.id = p_academic_year_id)
      ), '[]'::jsonb)
    ) order by lower(s.full_name), s.student_code, s.id) from page s), '[]'::jsonb),
    'total', (select count(*) from matches), 'limit', p_limit, 'offset', p_offset
  ) into v_result;
  return v_result;
end;
$$;

create function public.get_school_student_identity(p_student_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then raise exception 'insufficient_authority'; end if;
  -- Authorize before resource lookup: denied callers cannot enumerate pupils.
  select jsonb_build_object(
    'studentId', s.id, 'studentCode', s.student_code,
    'fullName', s.full_name, 'birthDate', s.birth_date, 'status', s.status,
    'hasLinkedStudentAccount', s.linked_profile_id is not null,
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membershipId', m.id, 'classId', c.id, 'className', c.name,
        'levelCode', c.level_code, 'academicYearId', y.id, 'academicYearCode', y.code,
        'enrollmentStatus', m.status, 'startedAt', m.started_at, 'endedAt', m.ended_at,
        'classArchived', c.is_archived
      ) order by y.starts_on desc, m.started_at desc, m.id)
      from public.student_class_memberships m
      join public.school_classes c on c.id = m.class_id
      join public.academic_years y on y.id = m.academic_year_id
      where m.student_id = s.id
    ), '[]'::jsonb)
  ) into v_result from public.students s where s.id = p_student_id;
  if v_result is null then raise exception 'student_not_found'; end if;
  return v_result;
end;
$$;

revoke all on function public.list_school_students(text,uuid,uuid,text,integer,integer) from public, anon;
revoke all on function public.get_school_student_identity(uuid) from public, anon;
grant execute on function public.list_school_students(text,uuid,uuid,text,integer,integer) to authenticated;
grant execute on function public.get_school_student_identity(uuid) to authenticated;

comment on function public.list_school_students(text,uuid,uuid,text,integer,integer) is
  'Authorized school-wide pupil search; one row per People student, bounded paging, literal name/code search. Class filters use ACTIVE memberships.';
comment on function public.get_school_student_identity(uuid) is
  'Administrative identity/enrollment projection. Excludes safety_note, contacts, documents, credentials, grades and private notes. Teacher/family use their existing scoped readers.';
-- Rollback: drop these two functions by exact signatures; no stored school data changes.
