-- KRISTOU SCHOOL — People, Family, Academics & Enrollment Foundation
-- F2-A1..A6, F2-A9, F2-A10, F3-C1, PUB-03 Inquiries
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

-- 1. Academic Years & School Levels
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

insert into public.academic_years (code, label, starts_on, ends_on, is_active)
values ('2026-2027', '2026-2027', date '2026-09-15', date '2027-06-30', true)
on conflict (code) do nothing;

create table if not exists public.school_levels (
  code text primary key,
  label_ar text not null,
  label_fr text not null,
  label_en text not null,
  sort_order integer not null
);

insert into public.school_levels (code, label_ar, label_fr, label_en, sort_order) values
  ('CP', 'السنة الأولى (CP)', '1ère année (CP)', 'Year 1 (CP)', 1),
  ('CE1', 'السنة الثانية (CE1)', '2ème année (CE1)', 'Year 2 (CE1)', 2),
  ('CE2', 'السنة الثالثة (CE2)', '3ème année (CE2)', 'Year 3 (CE2)', 3),
  ('CM1', 'السنة الرابعة (CM1)', '4ème année (CM1)', 'Year 4 (CM1)', 4),
  ('CM2', 'السنة الخامسة (CM2)', '5ème année (CM2)', 'Year 5 (CM2)', 5),
  ('6EME', 'السنة السادسة (6ème)', '6ème année', 'Year 6', 6)
on conflict (code) do nothing;

-- 2. Canonical School Classes
create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  level_code text not null references public.school_levels(code) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  room_label text,
  capacity integer not null default 28 check (capacity between 1 and 60),
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_classes_unique_per_year
  on public.school_classes (academic_year_id, level_code, lower(btrim(name)));

-- 3. People-owned Student Identity (independent of Auth credentials)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  birth_date date not null,
  linked_profile_id uuid unique references public.profiles(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  safety_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Student Class Memberships (max 1 ACTIVE membership per student per academic year)
create table if not exists public.student_class_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED')),
  started_at date not null default current_date,
  ended_at date,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_one_active_membership_per_year
  on public.student_class_memberships (student_id, academic_year_id)
  where status = 'ACTIVE';

-- 5. Teacher Class Assignments
create table if not exists public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete cascade,
  is_homeroom boolean not null default true,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_user_id, class_id)
);

-- 6. Verified Parent-Child Guardian Links
create table if not exists public.parent_child_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship_label text not null default 'Parent',
  active boolean not null default true,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_user_id, student_id)
);

-- 7. Enrollment Applications (F3-C1)
create table if not exists public.enrollment_applications (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  student_full_name text not null check (char_length(btrim(student_full_name)) between 2 and 120),
  birth_date date not null,
  desired_level_code text not null references public.school_levels(code),
  parent_full_name text not null check (char_length(btrim(parent_full_name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 6 and 32),
  email text,
  notes text,
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'SUBMITTED' check (
    status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEED_DOCUMENTS', 'ACCEPTED', 'WAITLIST', 'REJECTED', 'ENROLLED')
  ),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Public School Inquiries (PUB-03)
create table if not exists public.public_school_inquiries (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null check (char_length(btrim(sender_name)) between 2 and 120),
  phone text,
  email text,
  subject text not null check (char_length(btrim(subject)) between 2 and 160),
  message text not null check (char_length(btrim(message)) between 5 and 1500),
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'NEW' check (status in ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  staff_response text,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated triggers
drop trigger if exists school_classes_set_updated_at on public.school_classes;
create trigger school_classes_set_updated_at before update on public.school_classes for each row execute function public.set_updated_at();
drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students for each row execute function public.set_updated_at();
drop trigger if exists scm_set_updated_at on public.student_class_memberships;
create trigger scm_set_updated_at before update on public.student_class_memberships for each row execute function public.set_updated_at();
drop trigger if exists tca_set_updated_at on public.teacher_class_assignments;
create trigger tca_set_updated_at before update on public.teacher_class_assignments for each row execute function public.set_updated_at();
drop trigger if exists pcl_set_updated_at on public.parent_child_links;
create trigger pcl_set_updated_at before update on public.parent_child_links for each row execute function public.set_updated_at();
drop trigger if exists ea_set_updated_at on public.enrollment_applications;
create trigger ea_set_updated_at before update on public.enrollment_applications for each row execute function public.set_updated_at();
drop trigger if exists psi_set_updated_at on public.public_school_inquiries;
create trigger psi_set_updated_at before update on public.public_school_inquiries for each row execute function public.set_updated_at();

-- Enable RLS and strict least-privilege grants
alter table public.academic_years enable row level security;
alter table public.school_levels enable row level security;
alter table public.school_classes enable row level security;
alter table public.students enable row level security;
alter table public.student_class_memberships enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.parent_child_links enable row level security;
alter table public.enrollment_applications enable row level security;
alter table public.public_school_inquiries enable row level security;

revoke all on public.academic_years from anon, authenticated;
revoke all on public.school_levels from anon, authenticated;
revoke all on public.school_classes from anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.student_class_memberships from anon, authenticated;
revoke all on public.teacher_class_assignments from anon, authenticated;
revoke all on public.parent_child_links from anon, authenticated;
revoke all on public.enrollment_applications from anon, authenticated;
revoke all on public.public_school_inquiries from anon, authenticated;

grant select on public.school_levels to anon, authenticated;
grant select on public.academic_years to authenticated;
grant select on public.school_classes to authenticated;
grant select on public.students to authenticated;
grant select on public.student_class_memberships to authenticated;
grant select on public.teacher_class_assignments to authenticated;
grant select on public.parent_child_links to authenticated;
grant select on public.enrollment_applications to authenticated;
grant select on public.public_school_inquiries to authenticated;

drop policy if exists school_levels_public_select on public.school_levels;
create policy school_levels_public_select on public.school_levels for select to anon, authenticated using (true);

drop policy if exists academic_years_member_select on public.academic_years;
create policy academic_years_member_select on public.academic_years for select to authenticated
  using (public.is_approved_school_member());

create or replace function public.can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
    or (
      public.current_user_has_role('TEACHER'::public.app_role)
      and exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = p_class_id and tca.teacher_user_id = auth.uid() and tca.active = true
      )
    )
    or exists (
      select 1
      from public.student_class_memberships scm
      join public.students s on s.id = scm.student_id and s.status = 'ACTIVE'
      where scm.class_id = p_class_id and scm.status = 'ACTIVE' and s.linked_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.student_class_memberships scm
      join public.students s on s.id = scm.student_id and s.status = 'ACTIVE'
      join public.parent_child_links pcl on pcl.student_id = scm.student_id and pcl.active = true
      where scm.class_id = p_class_id and scm.status = 'ACTIVE' and pcl.parent_user_id = auth.uid()
    )
  ) and public.is_approved_school_member();
$$;

revoke all on function public.can_access_class(uuid) from public;
grant execute on function public.can_access_class(uuid) to authenticated;

create or replace function public.is_linked_student_self(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_student_id is not null
    and auth.uid() is not null
    and public.is_approved_school_member()
    and exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.status = 'ACTIVE'
        and s.linked_profile_id = auth.uid()
    );
$$;

revoke all on function public.is_linked_student_self(uuid) from public, anon;
grant execute on function public.is_linked_student_self(uuid) to authenticated;

create or replace function public.can_access_student_record(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_student_id is not null
    and auth.uid() is not null
    and public.is_approved_school_member()
    and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
      or exists (
        select 1 from public.students s
        where s.id = p_student_id and s.status = 'ACTIVE' and s.linked_profile_id = auth.uid()
      )
      or exists (
        select 1 from public.parent_child_links pcl
        where pcl.student_id = p_student_id and pcl.parent_user_id = auth.uid() and pcl.active = true
      )
      or (
        public.current_user_has_role('TEACHER'::public.app_role)
        and exists (
          select 1
          from public.student_class_memberships scm
          join public.teacher_class_assignments tca on tca.class_id = scm.class_id and tca.active = true
          where scm.student_id = p_student_id and scm.status = 'ACTIVE' and tca.teacher_user_id = auth.uid()
        )
      )
    );
$$;

revoke all on function public.can_access_student_record(uuid) from public, anon;
grant execute on function public.can_access_student_record(uuid) to authenticated;

drop policy if exists school_classes_scoped_select on public.school_classes;
create policy school_classes_scoped_select on public.school_classes for select to authenticated
  using (public.can_access_class(id));

drop policy if exists students_scoped_select on public.students;
create policy students_scoped_select on public.students for select to authenticated
  using (public.can_access_student_record(id));

drop policy if exists scm_scoped_select on public.student_class_memberships;
create policy scm_scoped_select on public.student_class_memberships for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
      or (
        public.current_user_has_role('TEACHER'::public.app_role)
        and exists (
          select 1 from public.teacher_class_assignments tca
          where tca.class_id = student_class_memberships.class_id
            and tca.teacher_user_id = auth.uid()
            and tca.active = true
        )
      )
      or public.is_linked_student_self(student_id)
      or exists (
        select 1 from public.parent_child_links pcl
        where pcl.student_id = student_class_memberships.student_id
          and pcl.parent_user_id = auth.uid()
          and pcl.active = true
      )
    )
  );

drop policy if exists tca_scoped_select on public.teacher_class_assignments;
create policy tca_scoped_select on public.teacher_class_assignments for select to authenticated
  using (
    public.is_approved_school_member() and (
      teacher_user_id = auth.uid()
      or public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists pcl_scoped_select on public.parent_child_links;
create policy pcl_scoped_select on public.parent_child_links for select to authenticated
  using (
    public.is_approved_school_member() and (
      parent_user_id = auth.uid()
      or public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists enrollment_applications_scoped_select on public.enrollment_applications;
create policy enrollment_applications_scoped_select on public.enrollment_applications for select to authenticated
  using (
    public.is_approved_school_member() and (
      submitted_by_user_id = auth.uid()
      or public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('ENROLLMENT_REVIEW')
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    )
  );

drop policy if exists public_inquiries_scoped_select on public.public_school_inquiries;
create policy public_inquiries_scoped_select on public.public_school_inquiries for select to authenticated
  using (
    public.is_approved_school_member() and (
      submitted_by_user_id = auth.uid()
      or public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('ENROLLMENT_REVIEW')
    )
  );

-- 9. Transactional RPCs
create or replace function public.submit_enrollment_application(
  p_student_full_name text,
  p_birth_date date,
  p_desired_level_code text,
  p_parent_full_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_app public.enrollment_applications%rowtype;
  v_level text := upper(btrim(coalesce(p_desired_level_code, '')));
  v_staff record;
begin
  if char_length(btrim(coalesce(p_student_full_name, ''))) < 2 then
    raise exception 'invalid_student_name' using errcode = 'P0001';
  end if;
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_parent_full_name, ''))) < 2 then
    raise exception 'invalid_parent_name' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) < 6 then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.school_levels where code = v_level) then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;

  v_ref := 'ADM-' || to_char(now() at time zone 'Africa/Tunis', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.enrollment_applications (
    reference_code, student_full_name, birth_date, desired_level_code,
    parent_full_name, phone, email, notes, submitted_by_user_id, status
  ) values (
    v_ref, btrim(p_student_full_name), p_birth_date, v_level,
    btrim(p_parent_full_name), btrim(p_phone), nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(), 'SUBMITTED'
  ) returning * into v_app;

  -- Notify approved Owner & Admin staff safely (reference code only, no full PII in notification body)
  for v_staff in
    select distinct p.id
    from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true
    where p.account_status = 'APPROVED'
      and ra.role in ('APP_ADMIN'::public.app_role, 'ADMINISTRATIVE_PERSONNEL'::public.app_role)
  loop
    perform public.enqueue_school_notification(
      v_staff.id, 'system', 'New Admission Request', 'Application ' || v_ref || ' awaiting office review.', 'registration', v_app.id::text
    );
  end loop;

  return jsonb_build_object(
    'id', v_app.id,
    'referenceCode', v_app.reference_code,
    'status', v_app.status,
    'createdAt', v_app.created_at
  );
end;
$$;

revoke all on function public.submit_enrollment_application(text, date, text, text, text, text, text) from public;
grant execute on function public.submit_enrollment_application(text, date, text, text, text, text, text) to anon, authenticated;

create or replace function public.review_enrollment_application(
  p_application_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expected_version integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.enrollment_applications%rowtype;
  v_next text := upper(btrim(coalesce(p_decision, '')));
begin
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('ENROLLMENT_REVIEW')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;
  if v_next not in ('UNDER_REVIEW', 'NEED_DOCUMENTS', 'ACCEPTED', 'WAITLIST', 'REJECTED', 'ENROLLED') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  select * into v_app from public.enrollment_applications where id = p_application_id for update;
  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;
  if v_app.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  update public.enrollment_applications
     set status = v_next,
         review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
         reviewed_by = v_uid,
         reviewed_at = now(),
         version = version + 1,
         updated_at = now()
   where id = p_application_id
  returning * into v_app;

  if v_app.submitted_by_user_id is not null then
    perform public.enqueue_school_notification(
      v_app.submitted_by_user_id, 'system',
      'Admission Status Updated',
      'Application ' || v_app.reference_code || ' is now ' || v_next || '.',
      'registration', v_app.id::text
    );
  end if;

  return jsonb_build_object(
    'id', v_app.id,
    'referenceCode', v_app.reference_code,
    'status', v_app.status,
    'version', v_app.version,
    'reviewedAt', v_app.reviewed_at
  );
end;
$$;

revoke all on function public.review_enrollment_application(uuid, text, text, integer) from public, anon;
grant execute on function public.review_enrollment_application(uuid, text, text, integer) to authenticated;

create or replace function public.submit_public_inquiry(
  p_sender_name text,
  p_phone text,
  p_email text,
  p_subject text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.public_school_inquiries%rowtype;
begin
  if char_length(btrim(coalesce(p_sender_name, ''))) < 2 or char_length(btrim(coalesce(p_subject, ''))) < 2 or char_length(btrim(coalesce(p_message, ''))) < 5 then
    raise exception 'invalid_inquiry_input' using errcode = 'P0001';
  end if;
  insert into public.public_school_inquiries (
    sender_name, phone, email, subject, message, submitted_by_user_id, status
  ) values (
    btrim(p_sender_name), nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_email, '')), ''),
    btrim(p_subject), btrim(p_message), auth.uid(), 'NEW'
  ) returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'createdAt', v_row.created_at);
end;
$$;

revoke all on function public.submit_public_inquiry(text, text, text, text, text) from public;
grant execute on function public.submit_public_inquiry(text, text, text, text, text) to anon, authenticated;

create or replace function public.respond_public_inquiry(
  p_inquiry_id uuid,
  p_status text,
  p_staff_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.public_school_inquiries%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('ENROLLMENT_REVIEW')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  update public.public_school_inquiries
     set status = p_status,
         staff_response = nullif(btrim(coalesce(p_staff_response, '')), ''),
         responded_by = auth.uid(),
         responded_at = now(),
         updated_at = now()
   where id = p_inquiry_id
  returning * into v_row;

  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'respondedAt', v_row.responded_at);
end;
$$;

revoke all on function public.respond_public_inquiry(uuid, text, text) from public, anon;
grant execute on function public.respond_public_inquiry(uuid, text, text) to authenticated;

create or replace function public.create_school_class(
  p_academic_year_code text,
  p_level_code text,
  p_name text,
  p_capacity integer default 28,
  p_room_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_id uuid;
  v_cls public.school_classes%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select id into v_year_id from public.academic_years where code = btrim(coalesce(p_academic_year_code, '2026-2027'));
  if v_year_id is null then
    raise exception 'invalid_academic_year' using errcode = 'P0001';
  end if;

  insert into public.school_classes (academic_year_id, level_code, name, capacity, room_label, created_by)
  values (v_year_id, upper(btrim(p_level_code)), btrim(p_name), coalesce(p_capacity, 28), nullif(btrim(coalesce(p_room_label, '')), ''), auth.uid())
  returning * into v_cls;

  return jsonb_build_object('id', v_cls.id, 'name', v_cls.name, 'levelCode', v_cls.level_code);
end;
$$;

revoke all on function public.create_school_class(text, text, text, integer, text) from public, anon;
grant execute on function public.create_school_class(text, text, text, integer, text) to authenticated;

create or replace function public.create_and_enroll_student(
  p_student_code text,
  p_full_name text,
  p_birth_date date,
  p_class_id uuid,
  p_parent_user_id uuid default null,
  p_relationship_label text default 'Parent',
  p_linked_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cls public.school_classes%rowtype;
  v_student public.students%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_cls from public.school_classes where id = p_class_id and is_archived = false;
  if not found then raise exception 'class_not_found' using errcode = 'P0001'; end if;

  insert into public.students (student_code, full_name, birth_date, linked_profile_id, created_by)
  values (upper(btrim(p_student_code)), btrim(p_full_name), p_birth_date, p_linked_profile_id, auth.uid())
  returning * into v_student;

  insert into public.student_class_memberships (student_id, class_id, academic_year_id, status, assigned_by)
  values (v_student.id, v_cls.id, v_cls.academic_year_id, 'ACTIVE', auth.uid());

  if p_parent_user_id is not null then
    if not exists (
      select 1 from public.profiles pr
      join public.role_assignments ra on ra.user_id = pr.id and ra.active = true and ra.role = 'PARENT'::public.app_role
      where pr.id = p_parent_user_id and pr.account_status = 'APPROVED'
    ) then
      raise exception 'invalid_parent_account' using errcode = 'P0001';
    end if;
    insert into public.parent_child_links (parent_user_id, student_id, relationship_label, active, verified_by)
    values (p_parent_user_id, v_student.id, coalesce(nullif(btrim(p_relationship_label), ''), 'Parent'), true, auth.uid())
    on conflict (parent_user_id, student_id) do update set active = true, verified_by = auth.uid();
  end if;

  return jsonb_build_object('studentId', v_student.id, 'studentCode', v_student.student_code, 'classId', v_cls.id);
end;
$$;

revoke all on function public.create_and_enroll_student(text, text, date, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.create_and_enroll_student(text, text, date, uuid, uuid, text, uuid) to authenticated;

create or replace function public.assign_teacher_to_class(
  p_teacher_user_id uuid,
  p_class_id uuid,
  p_is_homeroom boolean default true,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'TEACHER'::public.app_role
    where p.id = p_teacher_user_id and p.account_status = 'APPROVED'
  ) then
    raise exception 'invalid_teacher_account' using errcode = 'P0001';
  end if;

  insert into public.teacher_class_assignments (teacher_user_id, class_id, is_homeroom, active, assigned_by)
  values (p_teacher_user_id, p_class_id, coalesce(p_is_homeroom, true), coalesce(p_active, true), auth.uid())
  on conflict (teacher_user_id, class_id) do update set
    is_homeroom = excluded.is_homeroom,
    active = excluded.active,
    assigned_by = excluded.assigned_by,
    updated_at = now();

  return jsonb_build_object('teacherUserId', p_teacher_user_id, 'classId', p_class_id, 'active', coalesce(p_active, true));
end;
$$;

revoke all on function public.assign_teacher_to_class(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.assign_teacher_to_class(uuid, uuid, boolean, boolean) to authenticated;

create or replace function public.list_school_classes_with_rosters()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_wide boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;

  v_school_wide := (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  );

  if not v_school_wide and not (
    public.current_user_has_role('TEACHER'::public.app_role)
    and exists (
      select 1 from public.teacher_class_assignments tca
      where tca.teacher_user_id = v_uid and tca.active = true
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'name', sc.name,
      'level', coalesce(sl.label_fr, sc.level_code),
      'levelCode', sc.level_code,
      'academicYear', ay.code,
      'roomLabel', sc.room_label,
      'homeroomTeacherName', (
        select coalesce(p.full_name, p.username)
        from public.teacher_class_assignments tca
        join public.profiles p on p.id = tca.teacher_user_id
        where tca.class_id = sc.id and tca.active = true
        order by tca.is_homeroom desc, tca.created_at asc
        limit 1
      ),
      'activeStudentCount', (
        select count(*)::integer
        from public.student_class_memberships scm
        where scm.class_id = sc.id and scm.status = 'ACTIVE'
      ),
      'roster', coalesce((
        select jsonb_agg(jsonb_build_object(
          'studentId', st.id,
          'studentCode', st.student_code,
          'fullName', st.full_name,
          'enrollmentStatus', scm.status,
          'enrolledAt', scm.started_at,
          'primaryGuardianName', (
            select coalesce(gp.full_name, gp.username)
            from public.parent_child_links pcl
            join public.profiles gp on gp.id = pcl.parent_user_id
            where pcl.student_id = st.id and pcl.active = true
            order by pcl.created_at asc
            limit 1
          )
        ) order by st.full_name)
        from public.student_class_memberships scm
        join public.students st on st.id = scm.student_id
        where scm.class_id = sc.id and scm.status = 'ACTIVE'
      ), '[]'::jsonb)
    ) order by sl.sort_order, sc.name
  ), '[]'::jsonb)
  into v_result
  from public.school_classes sc
  join public.academic_years ay on ay.id = sc.academic_year_id
  join public.school_levels sl on sl.code = sc.level_code
  where sc.is_archived = false
    and (
      v_school_wide
      or exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = sc.id and tca.teacher_user_id = v_uid and tca.active = true
      )
    );

  return v_result;
end;
$$;

revoke all on function public.list_school_classes_with_rosters() from public, anon;
grant execute on function public.list_school_classes_with_rosters() to authenticated;

create or replace function public.get_my_school_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_children jsonb := '[]'::jsonb;
  v_classes jsonb := '[]'::jsonb;
  v_linked_child_ids uuid[] := '{}'::uuid[];
  v_assigned_class_ids uuid[] := '{}'::uuid[];
  v_counts jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;

  -- Linked children for Parents
  select
    coalesce(array_agg(st.id), '{}'::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', st.id,
      'fullName', st.full_name,
      'classId', coalesce(sc.id::text, ''),
      'className', coalesce(sc.name, ''),
      'level', coalesce(sl.label_fr, sc.level_code, ''),
      'birthDate', st.birth_date,
      'photoUrl', '',
      'pickupAuthorizedNames', '[]'::jsonb
    ) order by st.full_name), '[]'::jsonb)
  into v_linked_child_ids, v_children
  from public.parent_child_links pcl
  join public.students st on st.id = pcl.student_id and st.status = 'ACTIVE'
  left join public.student_class_memberships scm on scm.student_id = st.id and scm.status = 'ACTIVE'
  left join public.school_classes sc on sc.id = scm.class_id
  left join public.school_levels sl on sl.code = sc.level_code
  where pcl.parent_user_id = v_uid and pcl.active = true;

  -- Accessible classes (assigned to Teacher, active Student membership, Parent child class, or Admin/Owner/Delegated Manager)
  select
    coalesce(array_agg(distinct sc.id), '{}'::uuid[]),
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'id', sc.id,
      'name', sc.name,
      'level', coalesce(sl.label_fr, sc.level_code),
      'teacherId', coalesce((
        select tca.teacher_user_id::text from public.teacher_class_assignments tca
        where tca.class_id = sc.id and tca.active = true order by tca.is_homeroom desc limit 1
      ), ''),
      'teacherName', coalesce((
        select coalesce(p.full_name, p.username)
        from public.teacher_class_assignments tca
        join public.profiles p on p.id = tca.teacher_user_id
        where tca.class_id = sc.id and tca.active = true order by tca.is_homeroom desc limit 1
      ), ''),
      'academicYear', ay.code,
      'studentCount', (
        select count(*)::integer from public.student_class_memberships scm
        where scm.class_id = sc.id and scm.status = 'ACTIVE'
      )
    )), '[]'::jsonb)
  into v_assigned_class_ids, v_classes
  from public.school_classes sc
  join public.academic_years ay on ay.id = sc.academic_year_id
  join public.school_levels sl on sl.code = sc.level_code
  where sc.is_archived = false
    and (
      (
        public.current_user_has_role('TEACHER'::public.app_role)
        and exists (
          select 1 from public.teacher_class_assignments tca
          where tca.class_id = sc.id and tca.teacher_user_id = v_uid and tca.active = true
        )
      )
      or exists (
        select 1
        from public.student_class_memberships scm
        join public.students st on st.id = scm.student_id and st.status = 'ACTIVE'
        where scm.class_id = sc.id and scm.status = 'ACTIVE' and st.linked_profile_id = v_uid
      )
      or exists (
        select 1
        from public.student_class_memberships scm
        join public.students st on st.id = scm.student_id and st.status = 'ACTIVE'
        join public.parent_child_links pcl on pcl.student_id = scm.student_id and pcl.active = true
        where scm.class_id = sc.id and scm.status = 'ACTIVE' and pcl.parent_user_id = v_uid
      )
    );

  if (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_role('MANAGER'::public.app_role)
  ) then
    select jsonb_build_object(
      'activeClasses', (select count(*)::integer from public.school_classes where is_archived = false),
      'activeStudents', (select count(*)::integer from public.students where status = 'ACTIVE'),
      'pendingAdmissions', (select count(*)::integer from public.enrollment_applications where status in ('SUBMITTED', 'UNDER_REVIEW', 'NEED_DOCUMENTS')),
      'openInquiries', (select count(*)::integer from public.public_school_inquiries where status in ('NEW', 'IN_PROGRESS'))
    ) into v_counts;
  end if;

  return jsonb_build_object(
    'linkedChildrenIds', to_jsonb(v_linked_child_ids),
    'assignedClassIds', to_jsonb(v_assigned_class_ids),
    'children', v_children,
    'classes', v_classes,
    'operationalCounts', v_counts
  );
end;
$$;

revoke all on function public.get_my_school_context() from public, anon;
grant execute on function public.get_my_school_context() to authenticated;
