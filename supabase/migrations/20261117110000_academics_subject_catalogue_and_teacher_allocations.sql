-- KRISTOU SCHOOL — T4A: Academics Subject Catalogue & Teacher Subject-Allocation Foundation
-- Forward additive migration owned by Academics.
-- Preserves existing teacher_class_assignments, school_classes, school_levels, academic_years,
-- T1/T2 roster/Student Overview readers, and Calendar authorization contracts.
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

-- ============================================================================
-- 1. Curriculum Domains
-- ============================================================================
create table if not exists public.curriculum_domains (
  code text primary key check (code ~ '^[A-Z0-9_]{2,64}$'),
  cycle_scope text not null check (cycle_scope in ('PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY', 'MULTI_CYCLE')),
  label_ar text not null check (char_length(btrim(label_ar)) between 2 and 140),
  label_fr text not null check (char_length(btrim(label_fr)) between 2 and 140),
  label_en text not null check (char_length(btrim(label_en)) between 2 and 140),
  observed_source_label text,
  observed_source_lang text check (observed_source_lang is null or observed_source_lang in ('ar', 'fr', 'en', 'bilingual')),
  source_url text,
  source_document text,
  evidence_status text not null check (
    evidence_status in ('SOURCE_VERIFIED_PRIMARY', 'SOURCE_PARTIAL_PRIMARY', 'SECONDARY_CATALOGUE_OBSERVED', 'REFERENCE_ONLY', 'UNVERIFIED')
  ),
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. Canonical Subjects (Primary candidates + distinct Collège/Lycée & Historical references)
-- ============================================================================
create table if not exists public.academic_subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,64}$'),
  domain_code text not null references public.curriculum_domains(code) on delete restrict,
  stage_scope text not null check (
    stage_scope in ('PRIMARY', 'COLLEGE_LYCEE_REFERENCE', 'HISTORICAL_OPTIONAL_LANGUAGE')
  ),
  reporting_group_code text check (reporting_group_code is null or reporting_group_code ~ '^[A-Z0-9_]{2,64}$'),
  ministry_code text unique check (
    ministry_code is null or (
      char_length(btrim(ministry_code)) between 2 and 32
      and ministry_code = btrim(ministry_code)
    )
  ),
  label_ar text not null check (char_length(btrim(label_ar)) between 2 and 140),
  label_fr text not null check (char_length(btrim(label_fr)) between 2 and 140),
  label_en text not null check (char_length(btrim(label_en)) between 2 and 140),
  observed_source_label text not null check (char_length(btrim(observed_source_label)) between 1 and 200),
  observed_source_lang text not null check (observed_source_lang in ('ar', 'fr', 'en', 'bilingual')),
  source_url text not null check (char_length(btrim(source_url)) >= 8),
  source_document text not null check (char_length(btrim(source_document)) >= 2),
  source_version text,
  source_page text,
  evidence_status text not null check (
    evidence_status in (
      'SOURCE_VERIFIED_PRIMARY',
      'SOURCE_PARTIAL_PRIMARY',
      'SECONDARY_CATALOGUE_OBSERVED',
      'HISTORICAL_TIMELINE_OBSERVED',
      'REFERENCE_ONLY'
    )
  ),
  applicability_status text not null check (
    applicability_status in (
      'PRIMARY_CANDIDATE',
      'PENDING_OFFICIAL_PLAN_D_ETUDES',
      'SECONDARY_REFERENCE_ONLY',
      'HISTORICAL_REFERENCE_ONLY'
    )
  ),
  introduced_year integer check (introduced_year is null or introduced_year between 1956 and 2100),
  notes text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_subjects_stage_applicability_chk check (
    (stage_scope = 'PRIMARY' and applicability_status in ('PRIMARY_CANDIDATE', 'PENDING_OFFICIAL_PLAN_D_ETUDES'))
    or (stage_scope = 'COLLEGE_LYCEE_REFERENCE' and applicability_status = 'SECONDARY_REFERENCE_ONLY')
    or (stage_scope = 'HISTORICAL_OPTIONAL_LANGUAGE' and applicability_status = 'HISTORICAL_REFERENCE_ONLY')
  ),
  constraint academic_subjects_ministry_code_provenance_chk check (
    ministry_code is null or (
      evidence_status = 'SOURCE_VERIFIED_PRIMARY'
      and source_url is not null and char_length(btrim(source_url)) >= 8
      and source_document is not null and char_length(btrim(source_document)) >= 2
      and source_version is not null and char_length(btrim(source_version)) >= 2
      and source_page is not null and char_length(btrim(source_page)) >= 1
    )
  )
);

-- ============================================================================
-- 3. Parent-Linked Subject Components (Arabic 5 components, French 3 components)
-- ============================================================================
create table if not exists public.academic_subject_components (
  id uuid primary key default gen_random_uuid(),
  parent_subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9_]{2,64}$'),
  ministry_component_code text unique check (
    ministry_component_code is null or (
      char_length(btrim(ministry_component_code)) between 2 and 32
      and ministry_component_code = btrim(ministry_component_code)
    )
  ),
  label_ar text not null check (char_length(btrim(label_ar)) between 2 and 140),
  label_fr text not null check (char_length(btrim(label_fr)) between 2 and 140),
  label_en text not null check (char_length(btrim(label_en)) between 2 and 140),
  observed_source_label text not null check (char_length(btrim(observed_source_label)) between 1 and 200),
  observed_source_lang text not null check (observed_source_lang in ('ar', 'fr', 'en', 'bilingual')),
  source_url text not null check (char_length(btrim(source_url)) >= 8),
  source_document text not null check (char_length(btrim(source_document)) >= 2),
  source_version text,
  source_page text,
  evidence_status text not null check (
    evidence_status in ('SOURCE_VERIFIED_PRIMARY', 'SOURCE_PARTIAL_PRIMARY', 'REFERENCE_ONLY')
  ),
  applicability_status text not null check (
    applicability_status in ('PRIMARY_CANDIDATE', 'PENDING_OFFICIAL_PLAN_D_ETUDES', 'REFERENCE_ONLY')
  ),
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_subject_id, code),
  constraint academic_subject_components_ministry_code_provenance_chk check (
    ministry_component_code is null or (
      evidence_status = 'SOURCE_VERIFIED_PRIMARY'
      and source_url is not null and char_length(btrim(source_url)) >= 8
      and source_document is not null and char_length(btrim(source_document)) >= 2
      and source_version is not null and char_length(btrim(source_version)) >= 2
      and source_page is not null and char_length(btrim(source_page)) >= 1
    )
  )
);

create or replace function public.validate_subject_component_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_parent public.academic_subjects%rowtype;
begin
  select * into v_parent from public.academic_subjects where id = new.parent_subject_id;
  if not found then
    raise exception 'parent_subject_not_found' using errcode = 'P0001';
  end if;
  if v_parent.stage_scope <> 'PRIMARY' then
    raise exception 'component_parent_must_be_primary_subject' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_subject_component_parent() from public, anon, authenticated;

drop trigger if exists academic_subject_components_validate_parent_trg on public.academic_subject_components;
create trigger academic_subject_components_validate_parent_trg
  before insert or update on public.academic_subject_components
  for each row execute function public.validate_subject_component_parent();

-- ============================================================================
-- 4. Academic-Year / Level Applicability
-- ============================================================================
create table if not exists public.subject_level_applicability (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  level_code text not null references public.school_levels(code) on delete restrict,
  subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  applicability_status text not null check (
    applicability_status in ('APPLICABLE', 'OPTIONAL', 'NOT_APPLICABLE', 'UNVERIFIED_GRADE_MAPPING')
  ),
  evidence_status text not null check (
    evidence_status in ('SOURCE_VERIFIED_PRIMARY', 'SOURCE_PARTIAL_PRIMARY', 'SCHOOL_DECLARED', 'UNVERIFIED')
  ),
  weekly_hours numeric(4,2) check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 40)),
  coefficient numeric(4,2) check (coefficient is null or (coefficient > 0 and coefficient <= 20)),
  introduced_year integer check (introduced_year is null or introduced_year between 1956 and 2100),
  source_url text,
  source_document text,
  source_version text,
  source_page text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, level_code, subject_id)
);

-- ============================================================================
-- 5. KRISTOU School Explicitly Enabled Subject Offerings
-- ============================================================================
create table if not exists public.school_subject_offerings (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  level_code text not null references public.school_levels(code) on delete restrict,
  subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  applicability_id uuid not null references public.subject_level_applicability(id) on delete restrict,
  is_enabled boolean not null default false,
  weekly_periods integer check (weekly_periods is null or (weekly_periods > 0 and weekly_periods <= 40)),
  activated_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete set null,
  deactivated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, level_code, subject_id),
  foreign key (academic_year_id, level_code, subject_id)
    references public.subject_level_applicability(academic_year_id, level_code, subject_id)
    on delete restrict
);

create or replace function public.validate_subject_level_applicability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_subject public.academic_subjects%rowtype;
begin
  select * into v_subject from public.academic_subjects where id = new.subject_id;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  -- Non-primary subjects (Collège/Lycée or historical optional languages) cannot be marked APPLICABLE/OPTIONAL on primary levels
  if v_subject.stage_scope <> 'PRIMARY' and new.applicability_status in ('APPLICABLE', 'OPTIONAL') then
    raise exception 'secondary_or_historical_subject_not_applicable' using errcode = 'P0001';
  end if;

  -- Prevent invalidating applicability while a school offering is still actively enabled
  if tg_op = 'UPDATE'
     and new.applicability_status not in ('APPLICABLE', 'OPTIONAL')
     and exists (
       select 1 from public.school_subject_offerings sso
       where sso.applicability_id = new.id
         and sso.is_enabled = true
     ) then
    raise exception 'offering_enabled_for_applicability' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_subject_level_applicability() from public, anon, authenticated;

drop trigger if exists subject_level_applicability_validate_trg on public.subject_level_applicability;
create trigger subject_level_applicability_validate_trg
  before insert or update on public.subject_level_applicability
  for each row execute function public.validate_subject_level_applicability();

create or replace function public.validate_school_subject_offering()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app public.subject_level_applicability%rowtype;
  v_subject public.academic_subjects%rowtype;
begin
  -- When disabling an enabled offering, acquire L2 (school_classes) and L3 (teacher_class_assignments)
  -- FOR SHARE in canonical order before L4 (subject_level_applicability) and L5 (school_subject_offerings).
  if tg_op = 'UPDATE' and old.is_enabled = true and new.is_enabled = false then
    perform 1
    from public.school_classes sc
    where sc.academic_year_id = new.academic_year_id
      and sc.level_code = new.level_code
    order by sc.id
    for share;

    perform 1
    from public.teacher_class_assignments tca
    where tca.class_id in (
      select sc.id
      from public.school_classes sc
      where sc.academic_year_id = new.academic_year_id
        and sc.level_code = new.level_code
    )
    order by tca.id
    for share;
  end if;

  select * into v_app
  from public.subject_level_applicability
  where id = new.applicability_id
    and academic_year_id = new.academic_year_id
    and level_code = new.level_code
    and subject_id = new.subject_id
  for share;

  if not found then
    raise exception 'subject_applicability_not_found' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where id = new.subject_id;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  if new.is_enabled then
    if v_subject.stage_scope <> 'PRIMARY'
       or v_app.applicability_status not in ('APPLICABLE', 'OPTIONAL') then
      raise exception 'subject_not_applicable_to_level' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_school_subject_offering() from public, anon, authenticated;

drop trigger if exists school_subject_offerings_validate_trg on public.school_subject_offerings;
create trigger school_subject_offerings_validate_trg
  before insert or update on public.school_subject_offerings
  for each row execute function public.validate_school_subject_offering();

-- ============================================================================
-- 6. Teacher Subject Allocations & Append-Only Allocation Audit History
-- ============================================================================
-- Canonical T4A Lock Hierarchy (strictly enforced across all RPCs and triggers):
--   Step L0: Caller authentication & role/capability check (before locking target rows)
--   Step L1: Caller profile row (`public.profiles` FOR SHARE) to revalidate APPROVED status
--   Step L2: Target class row (`public.school_classes` FOR SHARE, ordered by id)
--   Step L3: Parent class assignment (`public.teacher_class_assignments` FOR UPDATE / FOR SHARE, ordered by id)
--   Step L4: Level applicability (`public.subject_level_applicability` FOR UPDATE / FOR SHARE, ordered by id)
--   Step L5: School subject offering (`public.school_subject_offerings` FOR UPDATE / FOR SHARE, ordered by id)
--   Step L6: Teacher subject allocation (`public.teacher_subject_allocations` FOR UPDATE, ordered by id)
--   Step L7: Append-only audit event (`public.teacher_subject_allocation_events` INSERT)
-- ============================================================================
create table if not exists public.teacher_subject_allocations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teacher_class_assignments(id) on delete restrict,
  teacher_user_id uuid not null references public.profiles(id) on delete restrict,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  level_code text not null references public.school_levels(code) on delete restrict,
  subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  offering_id uuid not null references public.school_subject_offerings(id) on delete restrict,
  active boolean not null default true,
  allocated_by uuid references public.profiles(id) on delete set null,
  allocated_at timestamptz not null default now(),
  deactivated_by uuid references public.profiles(id) on delete set null,
  deactivated_at timestamptz,
  deactivation_reason text,
  notes text,
  transition_reason text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, subject_id),
  unique (teacher_user_id, class_id, subject_id)
);

create index if not exists teacher_subject_allocations_teacher_active_idx
  on public.teacher_subject_allocations (teacher_user_id, active, class_id);

create index if not exists teacher_subject_allocations_class_active_idx
  on public.teacher_subject_allocations (class_id, active, subject_id);

create table if not exists public.teacher_subject_allocation_events (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.teacher_subject_allocations(id) on delete restrict,
  assignment_id uuid not null references public.teacher_class_assignments(id) on delete restrict,
  teacher_user_id uuid not null references public.profiles(id) on delete restrict,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  level_code text not null references public.school_levels(code) on delete restrict,
  subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  offering_id uuid not null references public.school_subject_offerings(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_source text not null check (actor_source in ('AUTHENTICATED_USER', 'SYSTEM_UNAUTHENTICATED')),
  operation_type text not null check (
    operation_type in (
      'INITIAL_ALLOCATION',
      'EXPLICIT_DEACTIVATION',
      'REACTIVATION',
      'CLASS_ASSIGNMENT_REVOKED_DEACTIVATION',
      'OFFERING_DISABLED_DEACTIVATION'
    )
  ),
  previous_active boolean,
  resulting_active boolean not null,
  previous_version integer check (previous_version is null or previous_version >= 1),
  resulting_version integer not null check (resulting_version >= 1),
  previous_allocated_by uuid references public.profiles(id) on delete set null,
  previous_allocated_at timestamptz,
  resulting_allocated_by uuid references public.profiles(id) on delete set null,
  resulting_allocated_at timestamptz,
  previous_deactivated_by uuid references public.profiles(id) on delete set null,
  previous_deactivated_at timestamptz,
  previous_deactivation_reason text,
  resulting_deactivated_by uuid references public.profiles(id) on delete set null,
  resulting_deactivated_at timestamptz,
  resulting_deactivation_reason text,
  causal_reason text,
  recorded_at timestamptz not null default now(),
  constraint teacher_subject_allocation_events_version_progression_chk check (
    (operation_type = 'INITIAL_ALLOCATION' and previous_active is null and previous_version is null and resulting_active = true and resulting_version = 1)
    or (operation_type <> 'INITIAL_ALLOCATION' and previous_active is not null and previous_version is not null and resulting_version = previous_version + 1)
  )
);

create index if not exists tsa_events_allocation_version_idx
  on public.teacher_subject_allocation_events (allocation_id, resulting_version asc);

create index if not exists tsa_events_class_recorded_idx
  on public.teacher_subject_allocation_events (class_id, recorded_at desc);

create or replace function public.prevent_teacher_subject_allocation_events_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'allocation_audit_history_immutable' using errcode = 'P0001';
end;
$$;

revoke all on function public.prevent_teacher_subject_allocation_events_mutation() from public, anon, authenticated;

drop trigger if exists tsa_events_immutable_trg on public.teacher_subject_allocation_events;
create trigger tsa_events_immutable_trg
  before update or delete on public.teacher_subject_allocation_events
  for each row execute function public.prevent_teacher_subject_allocation_events_mutation();

create or replace function public.validate_teacher_subject_allocation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_class public.school_classes%rowtype;
  v_assignment public.teacher_class_assignments%rowtype;
  v_applicability public.subject_level_applicability%rowtype;
  v_offering public.school_subject_offerings%rowtype;
  v_subject public.academic_subjects%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.assignment_id <> old.assignment_id
       or new.teacher_user_id <> old.teacher_user_id
       or new.class_id <> old.class_id
       or new.academic_year_id <> old.academic_year_id
       or new.level_code <> old.level_code
       or new.subject_id <> old.subject_id then
      raise exception 'allocation_identity_immutable' using errcode = 'P0001';
    end if;
  end if;

  -- Follow canonical lock order: school_classes (L2) -> teacher_class_assignments (L3)
  -- -> subject_level_applicability (L4) -> school_subject_offerings (L5).
  select * into v_class
  from public.school_classes
  where id = new.class_id
  for share;

  if not found then
    raise exception 'class_not_found' using errcode = 'P0001';
  end if;

  if v_class.academic_year_id <> new.academic_year_id or v_class.level_code <> new.level_code then
    raise exception 'class_level_or_year_mismatch' using errcode = 'P0001';
  end if;

  select * into v_assignment
  from public.teacher_class_assignments
  where id = new.assignment_id
  for share;

  if not found then
    raise exception 'class_assignment_not_found' using errcode = 'P0001';
  end if;

  if v_assignment.teacher_user_id <> new.teacher_user_id or v_assignment.class_id <> new.class_id then
    raise exception 'class_assignment_mismatch' using errcode = 'P0001';
  end if;

  select * into v_applicability
  from public.subject_level_applicability
  where academic_year_id = new.academic_year_id
    and level_code = new.level_code
    and subject_id = new.subject_id
  for share;

  if not found then
    raise exception 'subject_applicability_not_found' using errcode = 'P0001';
  end if;

  select * into v_offering
  from public.school_subject_offerings
  where id = new.offering_id
  for share;

  if not found then
    raise exception 'subject_offering_not_found' using errcode = 'P0001';
  end if;

  if v_offering.academic_year_id <> new.academic_year_id
     or v_offering.level_code <> new.level_code
     or v_offering.subject_id <> new.subject_id
     or v_offering.applicability_id <> v_applicability.id then
    raise exception 'offering_level_mismatch' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where id = new.subject_id;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  if new.active then
    if v_class.is_archived then
      raise exception 'class_archived' using errcode = 'P0001';
    end if;

    if not v_assignment.active then
      raise exception 'class_assignment_inactive' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.profiles p
      join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'TEACHER'::public.app_role
      where p.id = new.teacher_user_id
        and p.account_status = 'APPROVED'
    ) then
      raise exception 'invalid_teacher_account' using errcode = 'P0001';
    end if;

    if v_subject.stage_scope <> 'PRIMARY'
       or v_applicability.applicability_status not in ('APPLICABLE', 'OPTIONAL') then
      raise exception 'subject_not_applicable_to_level' using errcode = 'P0001';
    end if;

    if not v_offering.is_enabled then
      raise exception 'subject_offering_not_enabled' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_teacher_subject_allocation() from public, anon, authenticated;

drop trigger if exists teacher_subject_allocations_validate_trg on public.teacher_subject_allocations;
create trigger teacher_subject_allocations_validate_trg
  before insert or update on public.teacher_subject_allocations
  for each row execute function public.validate_teacher_subject_allocation();

create or replace function public.record_teacher_subject_allocation_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_uid uuid := auth.uid();
  v_actor_source text;
  v_op_type text;
  v_reason text;
begin
  v_actor_source := case
    when v_actor_uid is not null then 'AUTHENTICATED_USER'
    else 'SYSTEM_UNAUTHENTICATED'
  end;

  if tg_op = 'INSERT' then
    v_op_type := 'INITIAL_ALLOCATION';
    v_reason := coalesce(new.notes, 'initial_allocation');

    insert into public.teacher_subject_allocation_events (
      allocation_id, assignment_id, teacher_user_id, class_id,
      academic_year_id, level_code, subject_id, offering_id,
      actor_user_id, actor_source, operation_type,
      previous_active, resulting_active,
      previous_version, resulting_version,
      previous_allocated_by, previous_allocated_at,
      resulting_allocated_by, resulting_allocated_at,
      previous_deactivated_by, previous_deactivated_at, previous_deactivation_reason,
      resulting_deactivated_by, resulting_deactivated_at, resulting_deactivation_reason,
      causal_reason, recorded_at
    ) values (
      new.id, new.assignment_id, new.teacher_user_id, new.class_id,
      new.academic_year_id, new.level_code, new.subject_id, new.offering_id,
      v_actor_uid, v_actor_source, v_op_type,
      null, new.active,
      null, new.version,
      null, null,
      new.allocated_by, new.allocated_at,
      null, null, null,
      new.deactivated_by, new.deactivated_at, new.deactivation_reason,
      v_reason, now()
    );
    return new;
  end if;

  -- On UPDATE, record an audit event only when active state or version transitions
  if old.active is not distinct from new.active and old.version is not distinct from new.version then
    return new;
  end if;

  if old.active = false and new.active = true then
    v_op_type := 'REACTIVATION';
    v_reason := coalesce(new.transition_reason, 'explicit_reactivation');
  elsif old.active = true and new.active = false then
    if new.deactivation_reason = 'class_assignment_deactivated' then
      v_op_type := 'CLASS_ASSIGNMENT_REVOKED_DEACTIVATION';
    elsif new.deactivation_reason = 'subject_offering_disabled' then
      v_op_type := 'OFFERING_DISABLED_DEACTIVATION';
    else
      v_op_type := 'EXPLICIT_DEACTIVATION';
    end if;
    v_reason := coalesce(new.deactivation_reason, 'explicit_deactivation');
  else
    return new;
  end if;

  insert into public.teacher_subject_allocation_events (
    allocation_id, assignment_id, teacher_user_id, class_id,
    academic_year_id, level_code, subject_id, offering_id,
    actor_user_id, actor_source, operation_type,
    previous_active, resulting_active,
    previous_version, resulting_version,
    previous_allocated_by, previous_allocated_at,
    resulting_allocated_by, resulting_allocated_at,
    previous_deactivated_by, previous_deactivated_at, previous_deactivation_reason,
    resulting_deactivated_by, resulting_deactivated_at, resulting_deactivation_reason,
    causal_reason, recorded_at
  ) values (
    new.id, new.assignment_id, new.teacher_user_id, new.class_id,
    new.academic_year_id, new.level_code, new.subject_id, new.offering_id,
    v_actor_uid, v_actor_source, v_op_type,
    old.active, new.active,
    old.version, new.version,
    old.allocated_by, old.allocated_at,
    new.allocated_by, new.allocated_at,
    old.deactivated_by, old.deactivated_at, old.deactivation_reason,
    new.deactivated_by, new.deactivated_at, new.deactivation_reason,
    v_reason, now()
  );

  return new;
end;
$$;

revoke all on function public.record_teacher_subject_allocation_event() from public, anon, authenticated;

drop trigger if exists teacher_subject_allocations_audit_trg on public.teacher_subject_allocations;
create trigger teacher_subject_allocations_audit_trg
  after insert or update on public.teacher_subject_allocations
  for each row execute function public.record_teacher_subject_allocation_event();

-- Automatically deactivate active subject allocations when parent class assignment is deactivated,
-- while preserving the historical allocation rows and appending an audit event.
-- Honest actor attribution: uses auth.uid() when present, or NULL (SYSTEM_UNAUTHENTICATED) if run by an unauthenticated administrative process.
create or replace function public.sync_teacher_subject_allocations_on_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.active = true and new.active = false then
    -- Acquire locks in explicit sequential canonical order:
    -- L4 (subject_level_applicability FOR SHARE) -> L5 (school_subject_offerings FOR SHARE) -> L6 (teacher_subject_allocations FOR UPDATE)
    perform 1
    from public.subject_level_applicability sla
    where sla.id in (
      select sso.applicability_id
      from public.teacher_subject_allocations tsa
      join public.school_subject_offerings sso on sso.id = tsa.offering_id
      where tsa.assignment_id = new.id
        and tsa.active = true
    )
    order by sla.id
    for share;

    perform 1
    from public.school_subject_offerings sso
    where sso.id in (
      select tsa.offering_id
      from public.teacher_subject_allocations tsa
      where tsa.assignment_id = new.id
        and tsa.active = true
    )
    order by sso.id
    for share;

    perform 1
    from public.teacher_subject_allocations tsa
    where tsa.assignment_id = new.id
      and tsa.active = true
    order by tsa.id
    for update;

    update public.teacher_subject_allocations
       set active = false,
           deactivated_by = auth.uid(),
           deactivated_at = now(),
           deactivation_reason = 'class_assignment_deactivated',
           version = version + 1,
           updated_at = now()
     where assignment_id = new.id
       and active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_teacher_subject_allocations_on_assignment_change() from public, anon, authenticated;

drop trigger if exists tca_sync_subject_allocations_trg on public.teacher_class_assignments;
create trigger tca_sync_subject_allocations_trg
  after update of active on public.teacher_class_assignments
  for each row execute function public.sync_teacher_subject_allocations_on_assignment_change();

-- Automatically deactivate active subject allocations when a school subject offering is disabled,
-- while preserving historical allocation rows intact and appending an audit event.
create or replace function public.sync_teacher_subject_allocations_on_offering_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.is_enabled = true and new.is_enabled = false then
    perform 1
    from public.teacher_subject_allocations tsa
    where tsa.offering_id = new.id
      and tsa.active = true
    order by tsa.id
    for update;

    update public.teacher_subject_allocations
       set active = false,
           deactivated_by = auth.uid(),
           deactivated_at = now(),
           deactivation_reason = 'subject_offering_disabled',
           version = version + 1,
           updated_at = now()
     where offering_id = new.id
       and active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_teacher_subject_allocations_on_offering_change() from public, anon, authenticated;

drop trigger if exists sso_sync_subject_allocations_trg on public.school_subject_offerings;
create trigger sso_sync_subject_allocations_trg
  after update of is_enabled on public.school_subject_offerings
  for each row execute function public.sync_teacher_subject_allocations_on_offering_change();

-- Standard updated_at triggers
drop trigger if exists curriculum_domains_set_updated_at on public.curriculum_domains;
create trigger curriculum_domains_set_updated_at before update on public.curriculum_domains for each row execute function public.set_updated_at();

drop trigger if exists academic_subjects_set_updated_at on public.academic_subjects;
create trigger academic_subjects_set_updated_at before update on public.academic_subjects for each row execute function public.set_updated_at();

drop trigger if exists academic_subject_components_set_updated_at on public.academic_subject_components;
create trigger academic_subject_components_set_updated_at before update on public.academic_subject_components for each row execute function public.set_updated_at();

drop trigger if exists subject_level_applicability_set_updated_at on public.subject_level_applicability;
create trigger subject_level_applicability_set_updated_at before update on public.subject_level_applicability for each row execute function public.set_updated_at();

drop trigger if exists school_subject_offerings_set_updated_at on public.school_subject_offerings;
create trigger school_subject_offerings_set_updated_at before update on public.school_subject_offerings for each row execute function public.set_updated_at();

drop trigger if exists teacher_subject_allocations_set_updated_at on public.teacher_subject_allocations;
create trigger teacher_subject_allocations_set_updated_at before update on public.teacher_subject_allocations for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. Seed Source-Grounded Curriculum Domains, Canonical Subjects, Components,
--    Grade Applicability & Initially Disabled School Offerings
-- ============================================================================
insert into public.curriculum_domains (
  code, cycle_scope, label_ar, label_fr, label_en,
  observed_source_label, observed_source_lang, source_url, source_document, evidence_status, sort_order
) values
  (
    'LANGUAGES', 'MULTI_CYCLE',
    'مجال اللغات', 'Domaine des langues', 'Languages Domain',
    'مجال اللغات', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    'SOURCE_VERIFIED_PRIMARY', 1
  ),
  (
    'SCIENCES_AND_TECHNOLOGY', 'MULTI_CYCLE',
    'مجال العلوم والتكنولوجيا', 'Domaine des sciences et de la technologie', 'Sciences and Technology Domain',
    'مجال العلوم والتكنولوجيا', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    'SOURCE_VERIFIED_PRIMARY', 2
  ),
  (
    'SOCIAL_AND_CITIZENSHIP', 'MULTI_CYCLE',
    'مجال التنشئة الاجتماعية والمواطنة', 'Domaine de la socialisation et de la citoyenneté', 'Social Studies and Citizenship Domain',
    'مجال التنشئة الاجتماعية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    'SOURCE_VERIFIED_PRIMARY', 3
  ),
  (
    'ARTS_AND_CULTURE', 'PRIMARY',
    'مجال الفنون والثقافة', 'Domaine des arts et de la culture', 'Arts and Culture Domain',
    'التربية الفنية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    'SOURCE_VERIFIED_PRIMARY', 4
  ),
  (
    'PHYSICAL_AND_SPORTS_EDUCATION', 'MULTI_CYCLE',
    'مجال التربية البدنية', 'Domaine de l’éducation physique', 'Physical Education Domain',
    'التربية البدنية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    'SOURCE_VERIFIED_PRIMARY', 5
  ),
  (
    'SECONDARY_HUMANITIES_AND_ECONOMICS', 'UPPER_SECONDARY',
    'مجال العلوم الإنسانية والاقتصادية (مرجع إعدادي/ثانوي)',
    'Humanités, philosophie, économie et gestion (référence collège/lycée)',
    'Secondary Humanities, Philosophy, Economics and Management (Reference)',
    'Philosophie / Économie / Gestion', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_sec.jsp',
    'CNP — Manuels de l’enseignement secondaire 2023-2024 (référence hors cycle primaire)',
    'REFERENCE_ONLY', 6
  )
on conflict (code) do update set
  cycle_scope = excluded.cycle_scope,
  label_ar = excluded.label_ar,
  label_fr = excluded.label_fr,
  label_en = excluded.label_en,
  observed_source_label = excluded.observed_source_label,
  observed_source_lang = excluded.observed_source_lang,
  source_url = excluded.source_url,
  source_document = excluded.source_document,
  evidence_status = excluded.evidence_status,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 24 Canonical Subjects:
-- 13 Documented Primary Candidates + 6 Collège/Lycée Reference Subjects + 5 Historical Optional Languages.
-- Unknown Ministry codes, hours, coefficients, and introduction years remain NULL.
-- Historical 2023-2024 CNP textbook dates are preserved in source_version and are not treated as verification of 2026-2027 applicability.
insert into public.academic_subjects (
  code, domain_code, stage_scope, reporting_group_code, ministry_code,
  label_ar, label_fr, label_en,
  observed_source_label, observed_source_lang,
  source_url, source_document, source_version, source_page,
  evidence_status, applicability_status, introduced_year, notes, sort_order
) values
  -- Primary Candidates (13)
  (
    'ARABIC', 'LANGUAGES', 'PRIMARY', null, null,
    'اللغة العربية', 'Langue arabe', 'Arabic Language',
    'العربية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Parent primary subject with 5 CNTE language components; historical 2023-2024 CNP primary textbook listing observed across 1ère–6ème année de base (not 2026-2027 plan d’études verification).',
    10
  ),
  (
    'FRENCH', 'LANGUAGES', 'PRIMARY', null, null,
    'اللغة الفرنسية', 'Langue française', 'French Language',
    'الفرنسية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Parent primary subject with 3 CNTE language components; historical 2023-2024 CNP primary textbook listing observed for 3ème–6ème année de base (not 2026-2027 plan d’études verification).',
    20
  ),
  (
    'ENGLISH', 'LANGUAGES', 'PRIMARY', null, null,
    'اللغة الإنجليزية', 'Langue anglaise', 'English Language',
    'الانقليزية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary language subject; historical 2023-2024 CNP primary textbook listing observed for 4ème and 6ème année de base (not 2026-2027 plan d’études verification).',
    30
  ),
  (
    'MATHEMATICS', 'SCIENCES_AND_TECHNOLOGY', 'PRIMARY', null, null,
    'الرياضيات', 'Mathématiques', 'Mathematics',
    'الرياضيات', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Core primary subject; historical 2023-2024 CNP primary textbook listing observed for 1ère and 2ème année de base (not 2026-2027 plan d’études verification).',
    40
  ),
  (
    'SCIENTIFIC_AWAKENING', 'SCIENCES_AND_TECHNOLOGY', 'PRIMARY', null, null,
    'الإيقاظ العلمي', 'Éveil scientifique', 'Scientific Awakening',
    'الإيقاظ العلمي', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary scientific awakening (historical 2023-2024 CNP 1ère année textbook observed); kept strictly distinct from secondary Sciences de la Vie et de la Terre (SVT).',
    50
  ),
  (
    'TECHNOLOGICAL_EDUCATION', 'SCIENCES_AND_TECHNOLOGY', 'PRIMARY', null, null,
    'التربية التكنولوجية', 'Éducation technologique', 'Technological Education',
    'التربية التكنولوجية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    null, null,
    'SOURCE_PARTIAL_PRIMARY', 'PENDING_OFFICIAL_PLAN_D_ETUDES', null,
    'Observed in CNTE primary portal; exact per-grade primary applicability awaits official Ministry plan d’études PDF.',
    60
  ),
  (
    'ISLAMIC_EDUCATION', 'SOCIAL_AND_CITIZENSHIP', 'PRIMARY', null, null,
    'التربية الإسلامية', 'Éducation islamique', 'Islamic Education',
    'التربية الإسلامية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary Islamic education subject observed in CNTE and historical 2023-2024 CNP 1ère année textbook listing (not 2026-2027 plan d’études verification).',
    70
  ),
  (
    'CIVIC_EDUCATION', 'SOCIAL_AND_CITIZENSHIP', 'PRIMARY', null, null,
    'التربية المدنية', 'Éducation civique', 'Civic Education',
    'التربية المدنية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary civic education subject observed in CNTE and historical 2023-2024 CNP 5ème année textbook listing (not 2026-2027 plan d’études verification).',
    80
  ),
  (
    'HISTORY', 'SOCIAL_AND_CITIZENSHIP', 'PRIMARY', null, null,
    'التاريخ', 'Histoire', 'History',
    'التاريخ', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary history subject observed in CNTE and historical 2023-2024 CNP 5ème année textbook listing (not 2026-2027 plan d’études verification).',
    90
  ),
  (
    'GEOGRAPHY', 'SOCIAL_AND_CITIZENSHIP', 'PRIMARY', null, null,
    'الجغرافيا', 'Géographie', 'Geography',
    'الجغرافيا', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa (cycle primaire) & CNP Liste officielle des manuels scolaires du primaire 2023-2024 (https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp)',
    '2023-2024', null,
    'SOURCE_VERIFIED_PRIMARY', 'PRIMARY_CANDIDATE', null,
    'Primary geography subject observed in CNTE and historical 2023-2024 CNP 5ème année textbook listing (not 2026-2027 plan d’études verification).',
    100
  ),
  (
    'VISUAL_ARTS', 'ARTS_AND_CULTURE', 'PRIMARY', null, null,
    'التربية التشكيلية', 'Arts plastiques (Éducation plastique)', 'Visual Arts',
    'التربية التشكيلية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    null, null,
    'SOURCE_PARTIAL_PRIMARY', 'PENDING_OFFICIAL_PLAN_D_ETUDES', null,
    'Observed in CNTE primary portal; exact per-grade primary hours/coefficients await official plan d’études PDF.',
    110
  ),
  (
    'MUSIC_EDUCATION', 'ARTS_AND_CULTURE', 'PRIMARY', null, null,
    'التربية الموسيقية', 'Éducation musicale', 'Music Education',
    'التربية الموسيقية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    null, null,
    'SOURCE_PARTIAL_PRIMARY', 'PENDING_OFFICIAL_PLAN_D_ETUDES', null,
    'Observed in CNTE primary portal; exact per-grade primary hours/coefficients await official plan d’études PDF.',
    120
  ),
  (
    'PHYSICAL_EDUCATION', 'PHYSICAL_AND_SPORTS_EDUCATION', 'PRIMARY', null, null,
    'التربية البدنية', 'Éducation physique', 'Physical Education',
    'التربية البدنية', 'ar',
    'https://www.ent1.cnte.tn/ecole/index.php',
    'CNTE El Madrasa — Portail éducatif tunisien du cycle primaire',
    null, null,
    'SOURCE_PARTIAL_PRIMARY', 'PENDING_OFFICIAL_PLAN_D_ETUDES', null,
    'Observed in CNTE primary portal; exact per-grade primary hours/coefficients await official plan d’études PDF.',
    130
  ),
  -- Collège / Lycée Reference Subjects (6 — distinct from primary offerings)
  (
    'PHYSICAL_SCIENCES', 'SCIENCES_AND_TECHNOLOGY', 'COLLEGE_LYCEE_REFERENCE', null, null,
    'العلوم الفيزيائية', 'Sciences physiques', 'Physical Sciences',
    'Sciences Physiques', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_prep.jsp',
    'CNP — Manuels de l’enseignement préparatoire et secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Collège/lycée reference discipline (observed in 2023-2024 CNP secondary textbook list); not applicable to primary CP–6EME.',
    210
  ),
  (
    'LIFE_AND_EARTH_SCIENCES', 'SCIENCES_AND_TECHNOLOGY', 'COLLEGE_LYCEE_REFERENCE', null, null,
    'علوم الحياة والأرض', 'Sciences de la vie et de la terre (SVT)', 'Life and Earth Sciences',
    'Sciences de la Vie et de la Terre', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_prep.jsp',
    'CNP — Manuels de l’enseignement préparatoire et secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Collège/lycée reference discipline (observed in 2023-2024 CNP secondary textbook list); never merged with primary SCIENTIFIC_AWAKENING (Éveil scientifique).',
    220
  ),
  (
    'INFORMATICS', 'SCIENCES_AND_TECHNOLOGY', 'COLLEGE_LYCEE_REFERENCE', null, null,
    'الإعلامية', 'Informatique', 'Computer Science / Informatics',
    'Informatique', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_prep.jsp',
    'CNP — Manuels de l’enseignement préparatoire et secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Collège/lycée reference discipline (observed in 2023-2024 CNP secondary textbook list); not activated for primary CP–6EME.',
    230
  ),
  (
    'PHILOSOPHY', 'SECONDARY_HUMANITIES_AND_ECONOMICS', 'COLLEGE_LYCEE_REFERENCE', null, null,
    'الفلسفة', 'Philosophie', 'Philosophy',
    'Philosophie', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_sec.jsp',
    'CNP — Manuels de l’enseignement secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Upper-secondary (lycée) reference discipline (observed in 2023-2024 CNP secondary textbook list); not applicable to primary CP–6EME.',
    240
  ),
  (
    'ECONOMICS', 'SECONDARY_HUMANITIES_AND_ECONOMICS', 'COLLEGE_LYCEE_REFERENCE', 'ECONOMICS_AND_MANAGEMENT', null,
    'الاقتصاد', 'Économie', 'Economics',
    'Économie', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_sec.jsp',
    'CNP — Manuels de l’enseignement secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Kept as a distinct canonical subject from MANAGEMENT even when grouped under ECONOMICS_AND_MANAGEMENT for reporting (observed in 2023-2024 CNP secondary textbook list).',
    250
  ),
  (
    'MANAGEMENT', 'SECONDARY_HUMANITIES_AND_ECONOMICS', 'COLLEGE_LYCEE_REFERENCE', 'ECONOMICS_AND_MANAGEMENT', null,
    'التصرف', 'Gestion', 'Management',
    'Gestion', 'fr',
    'https://www.cnp.com.tn/CNP1/web/fr/ens_sec.jsp',
    'CNP — Manuels de l’enseignement secondaire 2023-2024',
    '2023-2024', null,
    'SECONDARY_CATALOGUE_OBSERVED', 'SECONDARY_REFERENCE_ONLY', null,
    'Kept as a distinct canonical subject from ECONOMICS even when grouped under ECONOMICS_AND_MANAGEMENT for reporting (observed in 2023-2024 CNP secondary textbook list).',
    260
  ),
  -- Historical / Secondary Optional Languages (5 — reference only, introduction years unset until primary decree verification)
  (
    'ITALIAN', 'LANGUAGES', 'HISTORICAL_OPTIONAL_LANGUAGE', null, null,
    'اللغة الإيطالية', 'Langue italienne', 'Italian Language',
    'Italien', 'fr',
    'http://www.tunisianet.net.tn/enseignement-en-tunisie/',
    'Tunisianet — Aperçu historique de l’enseignement en Tunisie',
    null, null,
    'HISTORICAL_TIMELINE_OBSERVED', 'HISTORICAL_REFERENCE_ONLY', null,
    'Secondary optional language reference; official Ministry decree introduction year remains unset pending primary decree verification.',
    310
  ),
  (
    'GERMAN', 'LANGUAGES', 'HISTORICAL_OPTIONAL_LANGUAGE', null, null,
    'اللغة الألمانية', 'Langue allemande', 'German Language',
    'Allemand', 'fr',
    'http://www.tunisianet.net.tn/enseignement-en-tunisie/',
    'Tunisianet — Aperçu historique de l’enseignement en Tunisie',
    null, null,
    'HISTORICAL_TIMELINE_OBSERVED', 'HISTORICAL_REFERENCE_ONLY', null,
    'Secondary optional language reference; official Ministry decree introduction year remains unset pending primary decree verification.',
    320
  ),
  (
    'SPANISH', 'LANGUAGES', 'HISTORICAL_OPTIONAL_LANGUAGE', null, null,
    'اللغة الإسبانية', 'Langue espagnole', 'Spanish Language',
    'Espagnol', 'fr',
    'http://www.tunisianet.net.tn/enseignement-en-tunisie/',
    'Tunisianet — Aperçu historique de l’enseignement en Tunisie',
    null, null,
    'HISTORICAL_TIMELINE_OBSERVED', 'HISTORICAL_REFERENCE_ONLY', null,
    'Secondary optional language reference; official Ministry decree introduction year remains unset pending primary decree verification.',
    330
  ),
  (
    'RUSSIAN', 'LANGUAGES', 'HISTORICAL_OPTIONAL_LANGUAGE', null, null,
    'اللغة الروسية', 'Langue russe', 'Russian Language',
    'Russe', 'fr',
    'http://www.tunisianet.net.tn/enseignement-en-tunisie/',
    'Tunisianet — Aperçu historique de l’enseignement en Tunisie',
    null, null,
    'HISTORICAL_TIMELINE_OBSERVED', 'HISTORICAL_REFERENCE_ONLY', null,
    'Secondary optional language reference; official Ministry decree introduction year remains unset pending primary decree verification.',
    340
  ),
  (
    'CHINESE', 'LANGUAGES', 'HISTORICAL_OPTIONAL_LANGUAGE', null, null,
    'اللغة الصينية', 'Langue chinoise', 'Chinese Language',
    'Chinois', 'fr',
    'http://www.tunisianet.net.tn/enseignement-en-tunisie/',
    'Tunisianet — Aperçu historique de l’enseignement en Tunisie',
    null, null,
    'HISTORICAL_TIMELINE_OBSERVED', 'HISTORICAL_REFERENCE_ONLY', null,
    'Secondary optional language reference; official Ministry decree introduction year remains unset pending primary decree verification.',
    350
  )
on conflict (code) do update set
  domain_code = excluded.domain_code,
  stage_scope = excluded.stage_scope,
  reporting_group_code = excluded.reporting_group_code,
  label_ar = excluded.label_ar,
  label_fr = excluded.label_fr,
  label_en = excluded.label_en,
  observed_source_label = excluded.observed_source_label,
  observed_source_lang = excluded.observed_source_lang,
  source_url = excluded.source_url,
  source_document = excluded.source_document,
  source_version = excluded.source_version,
  source_page = excluded.source_page,
  evidence_status = excluded.evidence_status,
  applicability_status = excluded.applicability_status,
  introduced_year = excluded.introduced_year,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 8 Parent-Linked Subject Components (5 under ARABIC, 3 under FRENCH)
-- Grouping provenance: https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf, printed page 46.
-- Classified conservatively as SOURCE_PARTIAL_PRIMARY because the full PDF was not retrieved independently.
-- Local component codes and proposed product display translations are local identifiers, not official Ministry codes.
insert into public.academic_subject_components (
  parent_subject_id, code, ministry_component_code,
  label_ar, label_fr, label_en,
  observed_source_label, observed_source_lang,
  source_url, source_document, source_version, source_page,
  evidence_status, applicability_status, sort_order
)
select
  s.id, v.code, null,
  v.label_ar, v.label_fr, v.label_en,
  v.observed_source_label, v.observed_source_lang,
  v.source_url, v.source_document, v.source_version, v.source_page,
  v.evidence_status, v.applicability_status, v.sort_order
from (
  values
    (
      'ARABIC', 'ARABIC_ORAL_RECITATION',
      'التواصل الشفوي والمحفوظات', 'Communication orale et récitation', 'Oral communication and recitation',
      'التواصل الشفوي والمحفوظات', 'ar',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 1
    ),
    (
      'ARABIC', 'ARABIC_READING',
      'القراءة', 'Lecture', 'Reading',
      'القراءة', 'ar',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 2
    ),
    (
      'ARABIC', 'ARABIC_LANGUAGE_RULES',
      'قواعد اللغة: رسم/نحو/صرف', 'Règles de langue : orthographe, grammaire et morphologie', 'Language rules: orthography, grammar and morphology',
      'قواعد اللغة (رسم / نحو / صرف)', 'ar',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 3
    ),
    (
      'ARABIC', 'ARABIC_HANDWRITING_DICTATION',
      'الخط والإملاء', 'Écriture et dictée', 'Handwriting and dictation',
      'الخط والإملاء', 'ar',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 4
    ),
    (
      'ARABIC', 'ARABIC_WRITTEN_PRODUCTION',
      'الإنتاج الكتابي', 'Production écrite', 'Written expression',
      'الإنتاج الكتابي', 'ar',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 5
    ),
    (
      'FRENCH', 'FRENCH_ORAL_RECITATION',
      'التعبير الشفوي والمحفوظات', 'Expression orale et récitation', 'Oral expression and recitation',
      'Expression orale et récitation', 'fr',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 1
    ),
    (
      'FRENCH', 'FRENCH_READING',
      'القراءة', 'Lecture', 'Reading',
      'Lecture', 'fr',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 2
    ),
    (
      'FRENCH', 'FRENCH_WRITTEN_PRODUCTION_HANDWRITING',
      'الإنتاج الكتابي والخط', 'Production écrite et écriture', 'Written expression and handwriting',
      'Production écrite et écriture', 'fr',
      'https://www.ent1.cnte.tn/guide-formation/pdf/espace_dir.pdf',
      'CNTE — Guide d’utilisation de l’espace directeur (El Madrasa), printed page 46 (partial primary-source excerpt; full PDF not independently retrieved)',
      null, '46', 'SOURCE_PARTIAL_PRIMARY', 'PRIMARY_CANDIDATE', 3
    )
) as v(
  parent_code, code,
  label_ar, label_fr, label_en,
  observed_source_label, observed_source_lang,
  source_url, source_document, source_version, source_page,
  evidence_status, applicability_status, sort_order
)
join public.academic_subjects s on s.code = v.parent_code
on conflict (code) do update set
  parent_subject_id = excluded.parent_subject_id,
  label_ar = excluded.label_ar,
  label_fr = excluded.label_fr,
  label_en = excluded.label_en,
  observed_source_label = excluded.observed_source_label,
  observed_source_lang = excluded.observed_source_lang,
  source_url = excluded.source_url,
  source_document = excluded.source_document,
  source_version = excluded.source_version,
  source_page = excluded.source_page,
  evidence_status = excluded.evidence_status,
  applicability_status = excluded.applicability_status,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Academic-year 2026-2027 level applicability for the 13 primary candidates across CP..6EME (6 × 13 = 78 rows):
-- All 78 primary level/subject combinations start as UNVERIFIED_GRADE_MAPPING (SOURCE_PARTIAL_PRIMARY).
-- Historical 2023-2024 CNP textbook observations remain in source metadata and explanatory notes only;
-- they do not become an operational claim of current 2026-2027 applicability.
-- ON CONFLICT DO NOTHING preserves any legitimate existing administrative applicability decisions on reruns.
insert into public.subject_level_applicability (
  academic_year_id, level_code, subject_id,
  applicability_status, evidence_status,
  weekly_hours, coefficient, introduced_year,
  source_url, source_document, source_version, source_page, notes
)
select
  ay.id,
  sl.code,
  sub.id,
  'UNVERIFIED_GRADE_MAPPING' as applicability_status,
  'SOURCE_PARTIAL_PRIMARY' as evidence_status,
  null::numeric(4,2) as weekly_hours,
  null::numeric(4,2) as coefficient,
  null::integer as introduced_year,
  case
    when (sl.code = 'CP' and sub.code in ('ARABIC', 'MATHEMATICS', 'SCIENTIFIC_AWAKENING', 'ISLAMIC_EDUCATION'))
      or (sl.code = 'CE1' and sub.code in ('ARABIC', 'MATHEMATICS'))
      or (sl.code = 'CE2' and sub.code in ('ARABIC', 'FRENCH'))
      or (sl.code = 'CM1' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
      or (sl.code = 'CM2' and sub.code in ('ARABIC', 'FRENCH', 'HISTORY', 'GEOGRAPHY', 'CIVIC_EDUCATION'))
      or (sl.code = '6EME' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
    then 'https://www.cnp.com.tn/CNP1/web/fr/ens_base.jsp'
    else 'https://www.ent1.cnte.tn/ecole/index.php'
  end as source_url,
  case
    when (sl.code = 'CP' and sub.code in ('ARABIC', 'MATHEMATICS', 'SCIENTIFIC_AWAKENING', 'ISLAMIC_EDUCATION'))
      or (sl.code = 'CE1' and sub.code in ('ARABIC', 'MATHEMATICS'))
      or (sl.code = 'CE2' and sub.code in ('ARABIC', 'FRENCH'))
      or (sl.code = 'CM1' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
      or (sl.code = 'CM2' and sub.code in ('ARABIC', 'FRENCH', 'HISTORY', 'GEOGRAPHY', 'CIVIC_EDUCATION'))
      or (sl.code = '6EME' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
    then 'CNP — Liste officielle des manuels scolaires du primaire 2023-2024 (historical textbook observation only)'
    else 'CNTE El Madrasa — Portail éducatif primaire (affectation par niveau en attente du plan d’études officiel)'
  end as source_document,
  case
    when (sl.code = 'CP' and sub.code in ('ARABIC', 'MATHEMATICS', 'SCIENTIFIC_AWAKENING', 'ISLAMIC_EDUCATION'))
      or (sl.code = 'CE1' and sub.code in ('ARABIC', 'MATHEMATICS'))
      or (sl.code = 'CE2' and sub.code in ('ARABIC', 'FRENCH'))
      or (sl.code = 'CM1' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
      or (sl.code = 'CM2' and sub.code in ('ARABIC', 'FRENCH', 'HISTORY', 'GEOGRAPHY', 'CIVIC_EDUCATION'))
      or (sl.code = '6EME' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
    then '2023-2024'
    else null
  end as source_version,
  null::text as source_page,
  case
    when (sl.code = 'CP' and sub.code in ('ARABIC', 'MATHEMATICS', 'SCIENTIFIC_AWAKENING', 'ISLAMIC_EDUCATION'))
      or (sl.code = 'CE1' and sub.code in ('ARABIC', 'MATHEMATICS'))
      or (sl.code = 'CE2' and sub.code in ('ARABIC', 'FRENCH'))
      or (sl.code = 'CM1' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
      or (sl.code = 'CM2' and sub.code in ('ARABIC', 'FRENCH', 'HISTORY', 'GEOGRAPHY', 'CIVIC_EDUCATION'))
      or (sl.code = '6EME' and sub.code in ('ARABIC', 'FRENCH', 'ENGLISH'))
    then 'Historical 2023-2024 CNP primary textbook observation recorded in source_version; starts UNVERIFIED_GRADE_MAPPING until official 2026-2027 Ministry plan d’études verification or explicit school declaration.'
    else 'Observed on CNTE El Madrasa primary portal without grade-level mapping or 2026-2027 plan d’études verification. Starts UNVERIFIED_GRADE_MAPPING.'
  end as notes
from public.academic_years ay
cross join public.school_levels sl
cross join public.academic_subjects sub
where ay.code = '2026-2027'
  and sub.stage_scope = 'PRIMARY'
on conflict (academic_year_id, level_code, subject_id) do nothing;

-- Seed all 78 initial KRISTOU school_subject_offerings rows (one per initial applicability row in 2026-2027) as DISABLED (is_enabled = false).
-- Activation requires an authorized actor to establish permitted applicability (APPLICABLE or OPTIONAL) and then explicitly enable the offering.
-- ON CONFLICT DO NOTHING preserves any legitimate existing administrative offering decisions on reruns.
insert into public.school_subject_offerings (
  academic_year_id, level_code, subject_id, applicability_id,
  is_enabled, weekly_periods, activated_by, activated_at, deactivated_by, deactivated_at, notes
)
select
  sla.academic_year_id,
  sla.level_code,
  sla.subject_id,
  sla.id,
  false as is_enabled,
  null::integer as weekly_periods,
  null::uuid as activated_by,
  null::timestamptz as activated_at,
  null::uuid as deactivated_by,
  null::timestamptz as deactivated_at,
  'Initial school offering seeded disabled; applicability establishment and explicit KRISTOU school approval are required before activation.'
from public.subject_level_applicability sla
join public.academic_years ay on ay.id = sla.academic_year_id
where ay.code = '2026-2027'
on conflict (academic_year_id, level_code, subject_id) do nothing;

-- ============================================================================
-- 8. Row Level Security & Least-Privilege Column-Scoped Grants
-- ============================================================================
alter table public.curriculum_domains enable row level security;
alter table public.academic_subjects enable row level security;
alter table public.academic_subject_components enable row level security;
alter table public.subject_level_applicability enable row level security;
alter table public.school_subject_offerings enable row level security;
alter table public.teacher_subject_allocations enable row level security;
alter table public.teacher_subject_allocation_events enable row level security;

revoke all on public.curriculum_domains from public, anon, authenticated;
revoke all on public.academic_subjects from public, anon, authenticated;
revoke all on public.academic_subject_components from public, anon, authenticated;
revoke all on public.subject_level_applicability from public, anon, authenticated;
revoke all on public.school_subject_offerings from public, anon, authenticated;
revoke all on public.teacher_subject_allocations from public, anon, authenticated;
revoke all on public.teacher_subject_allocation_events from public, anon, authenticated;

-- Least-privilege column-scoped SELECT grants to authenticated:
-- Internal administrative notes and attribution/deactivation audit columns (notes, allocated_by,
-- deactivated_by, deactivated_at, deactivation_reason, activated_by, activated_at) are NOT granted
-- via broad table SELECT on academic_subjects, subject_level_applicability, school_subject_offerings,
-- or teacher_subject_allocations.
grant select (
  code, cycle_scope, label_ar, label_fr, label_en,
  observed_source_label, observed_source_lang, source_url, source_document,
  evidence_status, sort_order, created_at, updated_at
) on public.curriculum_domains to authenticated;

grant select (
  id, code, domain_code, stage_scope, reporting_group_code, ministry_code,
  label_ar, label_fr, label_en, observed_source_label, observed_source_lang,
  source_url, source_document, source_version, source_page,
  evidence_status, applicability_status, introduced_year, sort_order, created_at, updated_at
) on public.academic_subjects to authenticated;

grant select (
  id, parent_subject_id, code, ministry_component_code,
  label_ar, label_fr, label_en, observed_source_label, observed_source_lang,
  source_url, source_document, source_version, source_page,
  evidence_status, applicability_status, sort_order, created_at, updated_at
) on public.academic_subject_components to authenticated;

grant select (
  id, academic_year_id, level_code, subject_id,
  applicability_status, evidence_status, weekly_hours, coefficient, introduced_year,
  source_url, source_document, source_version, source_page, created_at, updated_at
) on public.subject_level_applicability to authenticated;

grant select (
  id, academic_year_id, level_code, subject_id, applicability_id,
  is_enabled, weekly_periods, created_at, updated_at
) on public.school_subject_offerings to authenticated;

grant select (
  id, assignment_id, teacher_user_id, class_id, academic_year_id,
  level_code, subject_id, offering_id, active, allocated_at, version, created_at, updated_at
) on public.teacher_subject_allocations to authenticated;

grant select on public.teacher_subject_allocation_events to authenticated;

-- Catalogue, component, applicability, and offering SELECT policies align with list_academic_subject_catalogue:
-- Approved school staff/teachers/roster-managers only (no anonymous, Parent, or Student access).
drop policy if exists curriculum_domains_member_select on public.curriculum_domains;
create policy curriculum_domains_member_select on public.curriculum_domains
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_role('TEACHER'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists academic_subjects_member_select on public.academic_subjects;
create policy academic_subjects_member_select on public.academic_subjects
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_role('TEACHER'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists academic_subject_components_member_select on public.academic_subject_components;
create policy academic_subject_components_member_select on public.academic_subject_components
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_role('TEACHER'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists subject_level_applicability_member_select on public.subject_level_applicability;
create policy subject_level_applicability_member_select on public.subject_level_applicability
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_role('TEACHER'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists school_subject_offerings_member_select on public.school_subject_offerings;
create policy school_subject_offerings_member_select on public.school_subject_offerings
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_role('TEACHER'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

drop policy if exists teacher_subject_allocations_scoped_select on public.teacher_subject_allocations;
create policy teacher_subject_allocations_scoped_select on public.teacher_subject_allocations
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
      or (
        public.current_user_has_role('TEACHER'::public.app_role)
        and teacher_subject_allocations.teacher_user_id = auth.uid()
        and teacher_subject_allocations.active = true
        and exists (
          select 1
          from public.teacher_class_assignments tca
          join public.school_classes sc on sc.id = tca.class_id
          where tca.id = teacher_subject_allocations.assignment_id
            and tca.teacher_user_id = auth.uid()
            and tca.active = true
            and sc.is_archived = false
        )
        and exists (
          select 1
          from public.school_subject_offerings sso
          where sso.id = teacher_subject_allocations.offering_id
            and sso.is_enabled = true
        )
      )
    )
  );

-- Audit history SELECT policy: restricted to school-wide administrative/roster-oversight actors
-- (APP_ADMIN, ADMINISTRATIVE_PERSONNEL, CLASSES_ROSTER_VIEW, CLASSES_MANAGE).
-- No anonymous, Parent, Student, or ordinary Teacher access.
drop policy if exists teacher_subject_allocation_events_admin_select on public.teacher_subject_allocation_events;
create policy teacher_subject_allocation_events_admin_select on public.teacher_subject_allocation_events
  for select to authenticated
  using (
    public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
      or public.current_user_has_capability('CLASSES_MANAGE')
    )
  );

-- ============================================================================
-- 9. Internal Helper & Least-Privilege Read / Management RPCs
-- ============================================================================

-- Internal verification helper (revoked from public, anon, authenticated so callers cannot probe third-party pairs)
create or replace function public.has_active_teacher_subject_allocation(
  p_teacher_user_id uuid,
  p_class_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_teacher_user_id is not null
    and p_class_id is not null
    and p_subject_id is not null
    and exists (
      select 1
      from public.teacher_subject_allocations tsa
      join public.teacher_class_assignments tca on tca.id = tsa.assignment_id
      join public.school_classes sc on sc.id = tsa.class_id
      join public.school_subject_offerings sso on sso.id = tsa.offering_id
      join public.subject_level_applicability sla on sla.id = sso.applicability_id
      join public.academic_subjects sub on sub.id = tsa.subject_id
      join public.profiles p on p.id = tsa.teacher_user_id
      join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'TEACHER'::public.app_role
      where tsa.teacher_user_id = p_teacher_user_id
        and tsa.class_id = p_class_id
        and tsa.subject_id = p_subject_id
        and tsa.active = true
        and tca.active = true
        and sc.is_archived = false
        and sso.is_enabled = true
        and sla.applicability_status in ('APPLICABLE', 'OPTIONAL')
        and sub.stage_scope = 'PRIMARY'
        and p.account_status = 'APPROVED'
    );
$$;

revoke all on function public.has_active_teacher_subject_allocation(uuid, uuid, uuid) from public, anon, authenticated;

-- 9.1 Read Catalogue, Components, Applicability & Offerings
create or replace function public.list_academic_subject_catalogue(
  p_stage_scope text default null,
  p_academic_year_code text default '2026-2027',
  p_level_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_wide boolean;
  v_stage text := nullif(upper(btrim(coalesce(p_stage_scope, ''))), '');
  v_year_code text := coalesce(nullif(btrim(p_academic_year_code), ''), '2026-2027');
  v_level text := nullif(upper(btrim(coalesce(p_level_code, ''))), '');
  v_year public.academic_years%rowtype;
  v_domains jsonb;
  v_subjects jsonb;
begin
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  v_school_wide := (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  );

  if not v_school_wide and not public.current_user_has_role('TEACHER'::public.app_role) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if v_stage is not null and v_stage not in ('PRIMARY', 'COLLEGE_LYCEE_REFERENCE', 'HISTORICAL_OPTIONAL_LANGUAGE') then
    raise exception 'invalid_stage_scope' using errcode = 'P0001';
  end if;

  select * into v_year from public.academic_years where code = v_year_code;
  if not found then
    raise exception 'invalid_academic_year' using errcode = 'P0001';
  end if;

  if v_level is not null and not exists (select 1 from public.school_levels where code = v_level) then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', cd.code,
    'cycleScope', cd.cycle_scope,
    'labelAr', cd.label_ar,
    'labelFr', cd.label_fr,
    'labelEn', cd.label_en,
    'observedSourceLabel', cd.observed_source_label,
    'observedSourceLang', cd.observed_source_lang,
    'sourceUrl', cd.source_url,
    'sourceDocument', cd.source_document,
    'evidenceStatus', cd.evidence_status,
    'sortOrder', cd.sort_order
  ) order by cd.sort_order, cd.code), '[]'::jsonb)
  into v_domains
  from public.curriculum_domains cd;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sub.id,
    'code', sub.code,
    'domainCode', sub.domain_code,
    'stageScope', sub.stage_scope,
    'reportingGroupCode', sub.reporting_group_code,
    'ministryCode', sub.ministry_code,
    'labelAr', sub.label_ar,
    'labelFr', sub.label_fr,
    'labelEn', sub.label_en,
    'observedSourceLabel', sub.observed_source_label,
    'observedSourceLang', sub.observed_source_lang,
    'sourceUrl', sub.source_url,
    'sourceDocument', sub.source_document,
    'sourceVersion', sub.source_version,
    'sourcePage', sub.source_page,
    'evidenceStatus', sub.evidence_status,
    'applicabilityStatus', sub.applicability_status,
    'introducedYear', sub.introduced_year,
    'notes', case when v_school_wide then sub.notes else null end,
    'sortOrder', sub.sort_order,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', comp.id,
        'code', comp.code,
        'parentSubjectId', comp.parent_subject_id,
        'ministryComponentCode', comp.ministry_component_code,
        'labelAr', comp.label_ar,
        'labelFr', comp.label_fr,
        'labelEn', comp.label_en,
        'observedSourceLabel', comp.observed_source_label,
        'observedSourceLang', comp.observed_source_lang,
        'sourceUrl', comp.source_url,
        'sourceDocument', comp.source_document,
        'sourceVersion', comp.source_version,
        'sourcePage', comp.source_page,
        'evidenceStatus', comp.evidence_status,
        'applicabilityStatus', comp.applicability_status,
        'sortOrder', comp.sort_order
      ) order by comp.sort_order, comp.code)
      from public.academic_subject_components comp
      where comp.parent_subject_id = sub.id
    ), '[]'::jsonb),
    'levelOfferings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicabilityId', sla.id,
        'offeringId', sso.id,
        'levelCode', sla.level_code,
        'applicabilityStatus', sla.applicability_status,
        'evidenceStatus', sla.evidence_status,
        'weeklyHours', sla.weekly_hours,
        'coefficient', sla.coefficient,
        'introducedYear', sla.introduced_year,
        'isEnabled', coalesce(sso.is_enabled, false),
        'weeklyPeriods', sso.weekly_periods
      ) order by sl.sort_order)
      from public.subject_level_applicability sla
      join public.school_levels sl on sl.code = sla.level_code
      left join public.school_subject_offerings sso
        on sso.applicability_id = sla.id
      where sla.academic_year_id = v_year.id
        and sla.subject_id = sub.id
        and (v_level is null or sla.level_code = v_level)
    ), '[]'::jsonb)
  ) order by sub.sort_order, sub.code), '[]'::jsonb)
  into v_subjects
  from public.academic_subjects sub
  where (v_stage is null or sub.stage_scope = v_stage);

  return jsonb_build_object(
    'academicYear', jsonb_build_object(
      'id', v_year.id,
      'code', v_year.code,
      'label', v_year.label
    ),
    'domains', v_domains,
    'subjects', v_subjects
  );
end;
$$;

revoke all on function public.list_academic_subject_catalogue(text, text, text) from public, anon;
grant execute on function public.list_academic_subject_catalogue(text, text, text) to authenticated;

-- 9.2 Read Own Active Teacher Subject Allocations (Teacher-scoped)
create or replace function public.list_my_teacher_subject_allocations(
  p_class_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not public.current_user_has_role('TEACHER'::public.app_role) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if p_class_id is not null and not exists (
    select 1
    from public.teacher_class_assignments tca
    join public.school_classes sc on sc.id = tca.class_id
    where tca.teacher_user_id = v_uid
      and tca.class_id = p_class_id
      and tca.active = true
      and sc.is_archived = false
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'allocationId', tsa.id,
    'assignmentId', tsa.assignment_id,
    'teacherUserId', tsa.teacher_user_id,
    'classId', tsa.class_id,
    'className', sc.name,
    'levelCode', tsa.level_code,
    'academicYear', ay.code,
    'isHomeroom', tca.is_homeroom,
    'subjectId', sub.id,
    'subjectCode', sub.code,
    'domainCode', sub.domain_code,
    'labelAr', sub.label_ar,
    'labelFr', sub.label_fr,
    'labelEn', sub.label_en,
    'offeringId', sso.id,
    'active', tsa.active,
    'allocatedAt', tsa.allocated_at,
    'version', tsa.version,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', comp.id,
        'code', comp.code,
        'labelAr', comp.label_ar,
        'labelFr', comp.label_fr,
        'labelEn', comp.label_en,
        'sortOrder', comp.sort_order
      ) order by comp.sort_order, comp.code)
      from public.academic_subject_components comp
      where comp.parent_subject_id = sub.id
    ), '[]'::jsonb)
  ) order by sl.sort_order, sc.name, sub.sort_order, sub.code), '[]'::jsonb)
  into v_result
  from public.teacher_subject_allocations tsa
  join public.teacher_class_assignments tca on tca.id = tsa.assignment_id
  join public.school_classes sc on sc.id = tsa.class_id
  join public.school_levels sl on sl.code = tsa.level_code
  join public.academic_years ay on ay.id = tsa.academic_year_id
  join public.school_subject_offerings sso on sso.id = tsa.offering_id
  join public.subject_level_applicability sla on sla.id = sso.applicability_id
  join public.academic_subjects sub on sub.id = tsa.subject_id
  where tsa.teacher_user_id = v_uid
    and tsa.active = true
    and tca.active = true
    and sc.is_archived = false
    and sso.is_enabled = true
    and sla.applicability_status in ('APPLICABLE', 'OPTIONAL')
    and sub.stage_scope = 'PRIMARY'
    and (p_class_id is null or tsa.class_id = p_class_id);

  return v_result;
end;
$$;

revoke all on function public.list_my_teacher_subject_allocations(uuid) from public, anon;
grant execute on function public.list_my_teacher_subject_allocations(uuid) to authenticated;

-- 9.3 Read Class Subject Allocations (Office/Owner/Delegated Manager or Assigned Active Teacher)
create or replace function public.list_class_subject_allocations(
  p_class_id uuid,
  p_include_inactive boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_wide boolean;
  v_include_inactive boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if p_class_id is null then
    raise exception 'class_not_found' using errcode = 'P0001';
  end if;

  v_school_wide := (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  );

  if not v_school_wide and not (
    public.current_user_has_role('TEACHER'::public.app_role)
    and exists (
      select 1
      from public.teacher_class_assignments tca
      join public.school_classes sc on sc.id = tca.class_id
      where tca.class_id = p_class_id
        and tca.teacher_user_id = v_uid
        and tca.active = true
        and sc.is_archived = false
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.school_classes where id = p_class_id) then
    raise exception 'class_not_found' using errcode = 'P0001';
  end if;

  -- Only school-wide administrative/roster viewers can inspect inactive historical allocations
  v_include_inactive := (v_school_wide and coalesce(p_include_inactive, false));

  select coalesce(jsonb_agg(jsonb_build_object(
    'allocationId', tsa.id,
    'assignmentId', tsa.assignment_id,
    'teacherUserId', tsa.teacher_user_id,
    'teacherName', coalesce(p.full_name, p.username),
    'classId', tsa.class_id,
    'levelCode', tsa.level_code,
    'isHomeroom', tca.is_homeroom,
    'assignmentActive', tca.active,
    'subjectId', sub.id,
    'subjectCode', sub.code,
    'domainCode', sub.domain_code,
    'labelAr', sub.label_ar,
    'labelFr', sub.label_fr,
    'labelEn', sub.label_en,
    'offeringId', sso.id,
    'offeringEnabled', sso.is_enabled,
    'active', tsa.active,
    'allocatedBy', case when v_school_wide then tsa.allocated_by else null end,
    'allocatedAt', tsa.allocated_at,
    'deactivatedBy', case when v_school_wide then tsa.deactivated_by else null end,
    'deactivatedAt', case when v_school_wide then tsa.deactivated_at else null end,
    'deactivationReason', case when v_school_wide then tsa.deactivation_reason else null end,
    'version', tsa.version
  ) order by tca.is_homeroom desc, coalesce(p.full_name, p.username), sub.sort_order, sub.code), '[]'::jsonb)
  into v_result
  from public.teacher_subject_allocations tsa
  join public.teacher_class_assignments tca on tca.id = tsa.assignment_id
  join public.profiles p on p.id = tsa.teacher_user_id
  join public.school_subject_offerings sso on sso.id = tsa.offering_id
  join public.academic_subjects sub on sub.id = tsa.subject_id
  where tsa.class_id = p_class_id
    and (
      v_include_inactive
      or (
        tsa.active = true
        and tca.active = true
        and sso.is_enabled = true
        and (v_school_wide or tsa.teacher_user_id = v_uid)
      )
    );

  return v_result;
end;
$$;

revoke all on function public.list_class_subject_allocations(uuid, boolean) from public, anon;
grant execute on function public.list_class_subject_allocations(uuid, boolean) to authenticated;

-- 9.4 Manage Subject Level Applicability (APP_ADMIN, ADMINISTRATIVE_PERSONNEL, or CLASSES_MANAGE)
create or replace function public.upsert_subject_level_applicability(
  p_academic_year_code text,
  p_level_code text,
  p_subject_code text,
  p_applicability_status text,
  p_evidence_status text default 'SCHOOL_DECLARED',
  p_weekly_hours numeric default null,
  p_coefficient numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_status public.account_approval_status;
  v_year public.academic_years%rowtype;
  v_level text := upper(btrim(coalesce(p_level_code, '')));
  v_sub_code text := upper(btrim(coalesce(p_subject_code, '')));
  v_app_status text := upper(btrim(coalesce(p_applicability_status, '')));
  v_ev_status text := upper(btrim(coalesce(p_evidence_status, 'SCHOOL_DECLARED')));
  v_subject public.academic_subjects%rowtype;
  v_row public.subject_level_applicability%rowtype;
begin
  -- L0: Initial auth and role/capability check
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  -- L1: Lock caller profile FOR SHARE and revalidate mutable authority
  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_year from public.academic_years where code = btrim(coalesce(p_academic_year_code, '2026-2027'));
  if not found then
    raise exception 'invalid_academic_year' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.school_levels where code = v_level) then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where code = v_sub_code;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  if v_app_status not in ('APPLICABLE', 'OPTIONAL', 'NOT_APPLICABLE', 'UNVERIFIED_GRADE_MAPPING') then
    raise exception 'invalid_applicability_status' using errcode = 'P0001';
  end if;

  if v_ev_status not in ('SOURCE_VERIFIED_PRIMARY', 'SOURCE_PARTIAL_PRIMARY', 'SCHOOL_DECLARED', 'UNVERIFIED') then
    raise exception 'invalid_evidence_status' using errcode = 'P0001';
  end if;

  if v_subject.stage_scope <> 'PRIMARY' and v_app_status in ('APPLICABLE', 'OPTIONAL') then
    raise exception 'secondary_or_historical_subject_not_applicable' using errcode = 'P0001';
  end if;

  -- L4: Upsert subject_level_applicability
  insert into public.subject_level_applicability (
    academic_year_id, level_code, subject_id,
    applicability_status, evidence_status,
    weekly_hours, coefficient, notes
  ) values (
    v_year.id, v_level, v_subject.id,
    v_app_status, v_ev_status,
    p_weekly_hours, p_coefficient,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  on conflict (academic_year_id, level_code, subject_id) do update set
    applicability_status = excluded.applicability_status,
    evidence_status = excluded.evidence_status,
    weekly_hours = excluded.weekly_hours,
    coefficient = excluded.coefficient,
    notes = coalesce(excluded.notes, public.subject_level_applicability.notes),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'academicYearId', v_row.academic_year_id,
    'levelCode', v_row.level_code,
    'subjectId', v_row.subject_id,
    'subjectCode', v_subject.code,
    'applicabilityStatus', v_row.applicability_status,
    'evidenceStatus', v_row.evidence_status,
    'weeklyHours', v_row.weekly_hours,
    'coefficient', v_row.coefficient
  );
end;
$$;

revoke all on function public.upsert_subject_level_applicability(text, text, text, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.upsert_subject_level_applicability(text, text, text, text, text, numeric, numeric, text) to authenticated;

-- 9.5 Manage Explicit KRISTOU Subject Offerings (APP_ADMIN, ADMINISTRATIVE_PERSONNEL, or CLASSES_MANAGE)
-- Follows canonical lock hierarchy:
--   L0 -> L1 (profiles FOR SHARE) -> L2 (school_classes FOR SHARE ordered by id)
--   -> L3 (teacher_class_assignments FOR SHARE ordered by id) -> L4 (subject_level_applicability FOR UPDATE)
--   -> L5 (school_subject_offerings FOR UPDATE) -> L6 (teacher_subject_allocations FOR UPDATE) -> L7 (audit events)
create or replace function public.set_school_subject_offering(
  p_academic_year_code text,
  p_level_code text,
  p_subject_code text,
  p_is_enabled boolean,
  p_weekly_periods integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_status public.account_approval_status;
  v_year public.academic_years%rowtype;
  v_level text := upper(btrim(coalesce(p_level_code, '')));
  v_sub_code text := upper(btrim(coalesce(p_subject_code, '')));
  v_subject public.academic_subjects%rowtype;
  v_app public.subject_level_applicability%rowtype;
  v_row public.school_subject_offerings%rowtype;
begin
  -- L0: Initial auth and authority check
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if p_is_enabled is null then
    raise exception 'invalid_offering_state' using errcode = 'P0001';
  end if;

  -- L1: Lock caller profile FOR SHARE
  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  select * into v_year from public.academic_years where code = btrim(coalesce(p_academic_year_code, '2026-2027'));
  if not found then
    raise exception 'invalid_academic_year' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.school_levels where code = v_level) then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where code = v_sub_code;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  -- L2: Lock affected school_classes for (academic_year_id, level_code) FOR SHARE in deterministic id order
  perform 1
  from public.school_classes sc
  where sc.academic_year_id = v_year.id
    and sc.level_code = v_level
  order by sc.id
  for share;

  -- L3: Lock affected teacher_class_assignments for those classes FOR SHARE in deterministic id order
  perform 1
  from public.teacher_class_assignments tca
  join public.school_classes sc on sc.id = tca.class_id
  where sc.academic_year_id = v_year.id
    and sc.level_code = v_level
  order by tca.id
  for share;

  -- L4: Lock subject_level_applicability FOR UPDATE
  select * into v_app
  from public.subject_level_applicability
  where academic_year_id = v_year.id
    and level_code = v_level
    and subject_id = v_subject.id
  for update;

  if not found then
    raise exception 'subject_not_applicable_to_level' using errcode = 'P0001';
  end if;

  -- Revalidate mutable caller authority after acquiring locks
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if p_is_enabled and (
    v_subject.stage_scope <> 'PRIMARY'
    or v_app.applicability_status not in ('APPLICABLE', 'OPTIONAL')
  ) then
    raise exception 'subject_not_applicable_to_level' using errcode = 'P0001';
  end if;

  -- L5: Upsert school_subject_offerings (if disabling, trigger locks L6 teacher_subject_allocations FOR UPDATE ordered by id and inserts L7 events)
  insert into public.school_subject_offerings (
    academic_year_id, level_code, subject_id, applicability_id,
    is_enabled, weekly_periods,
    activated_by, activated_at,
    deactivated_by, deactivated_at,
    notes
  ) values (
    v_year.id, v_level, v_subject.id, v_app.id,
    p_is_enabled, p_weekly_periods,
    case when p_is_enabled then v_uid else null end,
    case when p_is_enabled then now() else null end,
    case when not p_is_enabled then v_uid else null end,
    case when not p_is_enabled then now() else null end,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  on conflict (academic_year_id, level_code, subject_id) do update set
    applicability_id = excluded.applicability_id,
    is_enabled = excluded.is_enabled,
    weekly_periods = coalesce(excluded.weekly_periods, public.school_subject_offerings.weekly_periods),
    activated_by = case when excluded.is_enabled then v_uid else public.school_subject_offerings.activated_by end,
    activated_at = case when excluded.is_enabled then now() else public.school_subject_offerings.activated_at end,
    deactivated_by = case when not excluded.is_enabled then v_uid else null end,
    deactivated_at = case when not excluded.is_enabled then now() else null end,
    notes = coalesce(excluded.notes, public.school_subject_offerings.notes),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'academicYearId', v_row.academic_year_id,
    'levelCode', v_row.level_code,
    'subjectId', v_row.subject_id,
    'subjectCode', v_subject.code,
    'applicabilityId', v_row.applicability_id,
    'isEnabled', v_row.is_enabled,
    'weeklyPeriods', v_row.weekly_periods
  );
end;
$$;

revoke all on function public.set_school_subject_offering(text, text, text, boolean, integer, text) from public, anon;
grant execute on function public.set_school_subject_offering(text, text, text, boolean, integer, text) to authenticated;

-- 9.6 Allocate Subject to Assigned Class Teacher (Concurrency-safe, Retry-safe, Self-grant denied)
-- Follows canonical lock hierarchy:
--   L0 -> L1 (profiles FOR SHARE) -> L2 (school_classes FOR SHARE) -> L3 (teacher_class_assignments FOR UPDATE)
--   -> L4 (subject_level_applicability FOR SHARE) -> L5 (school_subject_offerings FOR UPDATE)
--   -> L6 (teacher_subject_allocations FOR UPDATE) -> L7 (teacher_subject_allocation_events INSERT)
create or replace function public.assign_teacher_subject_allocation(
  p_teacher_user_id uuid,
  p_class_id uuid,
  p_subject_code text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_status public.account_approval_status;
  v_sub_code text := upper(btrim(coalesce(p_subject_code, '')));
  v_subject public.academic_subjects%rowtype;
  v_class public.school_classes%rowtype;
  v_assignment public.teacher_class_assignments%rowtype;
  v_offering public.school_subject_offerings%rowtype;
  v_applicability public.subject_level_applicability%rowtype;
  v_existing public.teacher_subject_allocations%rowtype;
  v_row public.teacher_subject_allocations%rowtype;
  v_replay boolean := false;
begin
  -- L0: Initial auth, self-grant check, and authority check
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  if p_teacher_user_id is not null and p_teacher_user_id = v_uid then
    raise exception 'self_allocation_denied' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if p_teacher_user_id is null or p_class_id is null or v_sub_code = '' then
    raise exception 'invalid_allocation_input' using errcode = 'P0001';
  end if;

  -- Transaction-scoped advisory lock serializes concurrent duplicate allocation attempts for the same (class, teacher, subject)
  perform pg_advisory_xact_lock(
    hashtext('teacher_subject_allocation'),
    hashtext(p_class_id::text || ':' || p_teacher_user_id::text || ':' || v_sub_code)
  );

  -- L1: Lock caller profile FOR SHARE
  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  -- Verify target Teacher is an APPROVED account with active TEACHER role
  if not exists (
    select 1
    from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'TEACHER'::public.app_role
    where p.id = p_teacher_user_id
      and p.account_status = 'APPROVED'
  ) then
    raise exception 'invalid_teacher_account' using errcode = 'P0001';
  end if;

  -- L2: Lock school_classes FOR SHARE
  select * into v_class from public.school_classes where id = p_class_id for share;
  if not found then
    raise exception 'class_not_found' using errcode = 'P0001';
  end if;
  if v_class.is_archived then
    raise exception 'class_archived' using errcode = 'P0001';
  end if;

  -- L3: Lock parent teacher_class_assignments row FOR UPDATE so concurrent revocation serializes in identical order
  select * into v_assignment
  from public.teacher_class_assignments
  where teacher_user_id = p_teacher_user_id
    and class_id = p_class_id
  for update;

  if not found then
    raise exception 'class_assignment_not_found' using errcode = 'P0001';
  end if;
  if not v_assignment.active then
    raise exception 'class_assignment_inactive' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where code = v_sub_code;
  if not found then
    raise exception 'subject_not_found' using errcode = 'P0001';
  end if;

  -- L4: Lock subject_level_applicability FOR SHARE
  select * into v_applicability
  from public.subject_level_applicability
  where academic_year_id = v_class.academic_year_id
    and level_code = v_class.level_code
    and subject_id = v_subject.id
  for share;

  if not found
     or v_subject.stage_scope <> 'PRIMARY'
     or v_applicability.applicability_status not in ('APPLICABLE', 'OPTIONAL') then
    raise exception 'subject_not_applicable_to_level' using errcode = 'P0001';
  end if;

  -- L5: Lock school_subject_offerings FOR UPDATE so concurrent offering disablement serializes in identical order
  select * into v_offering
  from public.school_subject_offerings
  where academic_year_id = v_class.academic_year_id
    and level_code = v_class.level_code
    and subject_id = v_subject.id
  for update;

  if not found or not v_offering.is_enabled then
    raise exception 'subject_offering_not_enabled' using errcode = 'P0001';
  end if;

  -- Revalidate mutable caller authority and target Teacher status after all parent locks are held
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if p_teacher_user_id = v_uid then
    raise exception 'self_allocation_denied' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'TEACHER'::public.app_role
    where p.id = p_teacher_user_id
      and p.account_status = 'APPROVED'
  ) then
    raise exception 'invalid_teacher_account' using errcode = 'P0001';
  end if;

  -- L6: Lock teacher_subject_allocations FOR UPDATE (if existing)
  select * into v_existing
  from public.teacher_subject_allocations
  where assignment_id = v_assignment.id
    and subject_id = v_subject.id
  for update;

  if found then
    if v_existing.active then
      v_row := v_existing;
      v_replay := true;
    else
      update public.teacher_subject_allocations
         set active = true,
             transition_reason = nullif(btrim(coalesce(p_notes, '')), ''),
             offering_id = v_offering.id,
             allocated_by = v_uid,
             allocated_at = now(),
             deactivated_by = null,
             deactivated_at = null,
             deactivation_reason = null,
             notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
             version = version + 1,
             updated_at = now()
       where id = v_existing.id
      returning * into v_row;
      v_replay := false;
    end if;
  else
    insert into public.teacher_subject_allocations (
      assignment_id, teacher_user_id, class_id,
      academic_year_id, level_code, subject_id, offering_id,
      active, allocated_by, allocated_at, notes, version
    ) values (
      v_assignment.id, p_teacher_user_id, p_class_id,
      v_class.academic_year_id, v_class.level_code, v_subject.id, v_offering.id,
      true, v_uid, now(), nullif(btrim(coalesce(p_notes, '')), ''), 1
    )
    returning * into v_row;
    v_replay := false;
  end if;

  return jsonb_build_object(
    'allocationId', v_row.id,
    'assignmentId', v_row.assignment_id,
    'teacherUserId', v_row.teacher_user_id,
    'classId', v_row.class_id,
    'levelCode', v_row.level_code,
    'subjectId', v_row.subject_id,
    'subjectCode', v_subject.code,
    'offeringId', v_row.offering_id,
    'active', v_row.active,
    'version', v_row.version,
    'idempotentReplay', v_replay
  );
end;
$$;

revoke all on function public.assign_teacher_subject_allocation(uuid, uuid, text, text) from public, anon;
grant execute on function public.assign_teacher_subject_allocation(uuid, uuid, text, text) to authenticated;

-- 9.7 Activate / Deactivate Teacher Subject Allocation (Preserves historical row & audit history)
-- Follows canonical lock hierarchy:
--   Unlocked initial lookup by p_allocation_id -> L0 self-grant & authority check
--   -> L1 (profiles FOR SHARE) -> L2 (school_classes FOR SHARE)
--   -> L3 (teacher_class_assignments FOR UPDATE) -> L4 (subject_level_applicability FOR SHARE)
--   -> L5 (school_subject_offerings FOR UPDATE) -> L6 (teacher_subject_allocations FOR UPDATE) -> L7 (audit events)
create or replace function public.set_teacher_subject_allocation_active(
  p_allocation_id uuid,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_status public.account_approval_status;
  v_initial public.teacher_subject_allocations%rowtype;
  v_class public.school_classes%rowtype;
  v_assignment public.teacher_class_assignments%rowtype;
  v_offering public.school_subject_offerings%rowtype;
  v_applicability public.subject_level_applicability%rowtype;
  v_row public.teacher_subject_allocations%rowtype;
  v_subject public.academic_subjects%rowtype;
begin
  -- L0: Initial auth and authority check before acquiring any target locks
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if p_allocation_id is null or p_active is null then
    raise exception 'invalid_allocation_input' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  -- Unlocked lookup to discover parent hierarchy IDs without locking L6 ahead of L2..L5
  select * into v_initial
  from public.teacher_subject_allocations
  where id = p_allocation_id;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  if v_initial.teacher_user_id = v_uid then
    raise exception 'self_allocation_denied' using errcode = 'P0001';
  end if;

  -- L1: Lock caller profile FOR SHARE
  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  -- L2: Lock parent school_classes FOR SHARE
  select * into v_class
  from public.school_classes
  where id = v_initial.class_id
  for share;

  -- L3: Lock parent teacher_class_assignments FOR UPDATE
  select * into v_assignment
  from public.teacher_class_assignments
  where id = v_initial.assignment_id
  for update;

  -- L4: Lock subject_level_applicability FOR SHARE
  select * into v_applicability
  from public.subject_level_applicability
  where academic_year_id = v_initial.academic_year_id
    and level_code = v_initial.level_code
    and subject_id = v_initial.subject_id
  for share;

  -- L5: Lock school_subject_offerings FOR UPDATE
  select * into v_offering
  from public.school_subject_offerings
  where id = v_initial.offering_id
  for update;

  -- L6: Lock teacher_subject_allocations FOR UPDATE
  select * into v_row
  from public.teacher_subject_allocations
  where id = p_allocation_id
  for update;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  -- Revalidate self-grant and mutable caller authority after all locks are held
  if v_row.teacher_user_id = v_uid then
    raise exception 'self_allocation_denied' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_subject from public.academic_subjects where id = v_row.subject_id;

  if v_row.active = p_active then
    return jsonb_build_object(
      'allocationId', v_row.id,
      'assignmentId', v_row.assignment_id,
      'teacherUserId', v_row.teacher_user_id,
      'classId', v_row.class_id,
      'subjectId', v_row.subject_id,
      'subjectCode', v_subject.code,
      'active', v_row.active,
      'deactivatedAt', v_row.deactivated_at,
      'deactivationReason', v_row.deactivation_reason,
      'version', v_row.version,
      'idempotentReplay', true
    );
  end if;

  update public.teacher_subject_allocations
     set active = p_active,
         transition_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         allocated_by = case when p_active then v_uid else allocated_by end,
         allocated_at = case when p_active then now() else allocated_at end,
         deactivated_by = case when not p_active then v_uid else null end,
         deactivated_at = case when not p_active then now() else null end,
         deactivation_reason = case
           when not p_active then coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'manual_deactivation')
           else null
         end,
         version = version + 1,
         updated_at = now()
   where id = p_allocation_id
  returning * into v_row;

  return jsonb_build_object(
    'allocationId', v_row.id,
    'assignmentId', v_row.assignment_id,
    'teacherUserId', v_row.teacher_user_id,
    'classId', v_row.class_id,
    'subjectId', v_row.subject_id,
    'subjectCode', v_subject.code,
    'active', v_row.active,
    'deactivatedAt', v_row.deactivated_at,
    'deactivationReason', v_row.deactivation_reason,
    'version', v_row.version,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.set_teacher_subject_allocation_active(uuid, boolean, text) from public, anon;
grant execute on function public.set_teacher_subject_allocation_active(uuid, boolean, text) to authenticated;

-- 9.8 Align assign_teacher_to_class with Canonical Lock Hierarchy (L0 -> L1 -> L2 -> L3 -> L4 -> L5 -> L6 -> L7)
create or replace function public.assign_teacher_to_class(
  p_teacher_user_id uuid,
  p_class_id uuid,
  p_is_homeroom boolean default true,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_status public.account_approval_status;
  v_class public.school_classes%rowtype;
begin
  -- L0: Initial auth and authority check
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  -- L1: Lock caller profile FOR SHARE
  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  -- L2: Lock target school_classes FOR SHARE before locking L3 teacher_class_assignments
  select * into v_class from public.school_classes where id = p_class_id for share;
  if not found then
    raise exception 'class_not_found' using errcode = 'P0001';
  end if;

  -- Revalidate caller authority and target Teacher account after lock wait
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

  -- L3: Upsert teacher_class_assignments (if active becomes false, trigger locks L4 -> L5 -> L6 in canonical order and inserts L7 events)
  insert into public.teacher_class_assignments (teacher_user_id, class_id, is_homeroom, active, assigned_by)
  values (p_teacher_user_id, p_class_id, coalesce(p_is_homeroom, true), coalesce(p_active, true), v_uid)
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

-- 9.9 Read Append-Only Teacher Subject Allocation Audit Events (APP_ADMIN, ADMINISTRATIVE_PERSONNEL, CLASSES_ROSTER_VIEW, or CLASSES_MANAGE)
create or replace function public.list_teacher_subject_allocation_events(
  p_class_id uuid default null,
  p_allocation_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
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
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'eventId', ev.id,
    'allocationId', ev.allocation_id,
    'assignmentId', ev.assignment_id,
    'teacherUserId', ev.teacher_user_id,
    'classId', ev.class_id,
    'academicYearId', ev.academic_year_id,
    'levelCode', ev.level_code,
    'subjectId', ev.subject_id,
    'subjectCode', sub.code,
    'offeringId', ev.offering_id,
    'actorUserId', ev.actor_user_id,
    'actorSource', ev.actor_source,
    'operationType', ev.operation_type,
    'previousActive', ev.previous_active,
    'resultingActive', ev.resulting_active,
    'previousVersion', ev.previous_version,
    'resultingVersion', ev.resulting_version,
    'previousAllocatedBy', ev.previous_allocated_by,
    'resultingAllocatedBy', ev.resulting_allocated_by,
    'previousAllocatedAt', ev.previous_allocated_at,
    'resultingAllocatedAt', ev.resulting_allocated_at,
    'previousDeactivatedBy', ev.previous_deactivated_by,
    'resultingDeactivatedBy', ev.resulting_deactivated_by,
    'previousDeactivatedAt', ev.previous_deactivated_at,
    'resultingDeactivatedAt', ev.resulting_deactivated_at,
    'previousDeactivationReason', ev.previous_deactivation_reason,
    'resultingDeactivationReason', ev.resulting_deactivation_reason,
    'causalReason', ev.causal_reason,
    'recordedAt', ev.recorded_at
  ) order by ev.recorded_at asc, ev.resulting_version asc, ev.id asc), '[]'::jsonb)
  into v_result
  from public.teacher_subject_allocation_events ev
  join public.academic_subjects sub on sub.id = ev.subject_id
  where (p_class_id is null or ev.class_id = p_class_id)
    and (p_allocation_id is null or ev.allocation_id = p_allocation_id);

  return v_result;
end;
$$;

revoke all on function public.list_teacher_subject_allocation_events(uuid, uuid) from public, anon;
grant execute on function public.list_teacher_subject_allocation_events(uuid, uuid) to authenticated;

