-- ENROLL-D01: admission completion, not class placement or annual renewal.
-- Existing owners: students (People), parent_child_links (Family), applications (Enrollment).
alter table public.enrollment_applications
  add column student_id uuid references public.students(id) on delete set null;
create index enrollment_applications_student_id_idx on public.enrollment_applications(student_id);

create table public.enrollment_admission_completions (
  application_id uuid primary key references public.enrollment_applications(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_user_id uuid references public.profiles(id) on delete restrict,
  guardian_verified boolean not null,
  completed_by uuid not null references public.profiles(id) on delete restrict,
  completed_at timestamptz not null default now(),
  active boolean not null default true,
  check (not guardian_verified or guardian_user_id is not null)
);
create table public.enrollment_admission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.enrollment_admission_completions(application_id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action='ADMISSION_COMPLETED'),
  previous_status text not null,
  resulting_version integer not null,
  created_at timestamptz not null default now()
);
alter table public.enrollment_admission_completions enable row level security;
alter table public.enrollment_admission_audit_logs enable row level security;
revoke all on public.enrollment_admission_completions, public.enrollment_admission_audit_logs from public, anon, authenticated;

create function public.enrollment_reject_audit_mutation()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'admission_audit_immutable' using errcode='P0001'; end;
$$;
create trigger enrollment_admission_audit_immutable before update or delete on public.enrollment_admission_audit_logs
for each row execute function public.enrollment_reject_audit_mutation();
revoke all on function public.enrollment_reject_audit_mutation() from public,anon,authenticated;

-- Latest ENROLL-D01 instruction explicitly includes approved Managers. This does
-- not grant them class-placement, roster, account governance or Pickup authority.
create function public.enrollment_actor_can_complete()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select public.is_approved_school_member() and (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('MANAGER'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or (public.current_user_has_role('SCHOOL_STAFF'::public.app_role) and exists (
      select 1 from public.manager_capability_grants g
      where g.manager_user_id=auth.uid() and g.active and g.capability='ENROLLMENT_REVIEW'
    ))
  );
$$;
revoke all on function public.enrollment_actor_can_complete() from public,anon,authenticated;

create or replace function public.review_enrollment_application(
  p_application_id uuid, p_decision text, p_review_note text default null, p_expected_version integer default 1
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid();
  v_app public.enrollment_applications%rowtype;
  v_next text:=upper(btrim(coalesce(p_decision,'')));
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.enrollment_actor_can_complete() then raise exception 'insufficient_authority' using errcode='P0001'; end if;
  select * into v_app from public.enrollment_applications where id=p_application_id for update;
  if not found then raise exception 'target_not_found' using errcode='P0001'; end if;
  if p_expected_version is null or v_app.version<>p_expected_version then raise exception 'version_conflict' using errcode='P0001'; end if;
  if v_next='ENROLLED' and (v_app.student_id is null or not exists (
    select 1 from public.enrollment_admission_completions c
    join public.students s on s.id=c.student_id and s.status='ACTIVE'
    where c.application_id=v_app.id and c.student_id=v_app.student_id and c.active
  )) then raise exception 'admission_completion_required' using errcode='P0001'; end if;
  if not (
    (v_app.status='SUBMITTED' and v_next='UNDER_REVIEW')
    or (v_app.status='UNDER_REVIEW' and v_next in ('NEED_DOCUMENTS','ACCEPTED','WAITLIST','REJECTED'))
    or (v_app.status='NEED_DOCUMENTS' and v_next='UNDER_REVIEW')
    or (v_app.status='WAITLIST' and v_next in ('UNDER_REVIEW','ACCEPTED','REJECTED'))
    or (v_app.status='ACCEPTED' and v_next='ENROLLED')
    or (v_app.status=v_next and v_next in ('UNDER_REVIEW','NEED_DOCUMENTS','ACCEPTED','WAITLIST','REJECTED','ENROLLED'))
  ) then raise exception 'invalid_transition' using errcode='P0001'; end if;
  if v_app.status<>v_next or v_app.review_note is distinct from nullif(btrim(coalesce(p_review_note,'')),'') then
    update public.enrollment_applications set status=v_next, review_note=nullif(btrim(coalesce(p_review_note,'')),''),
      reviewed_by=v_uid,reviewed_at=now(),version=version+1 where id=v_app.id returning * into v_app;
    if v_app.submitted_by_user_id is not null then
      perform public.enqueue_school_notification(v_app.submitted_by_user_id,'system','Admission Status Updated',
        'Application '||v_app.reference_code||' is now '||v_next||'.','registration',v_app.id::text);
    end if;
  end if;
  return jsonb_build_object('id',v_app.id,'referenceCode',v_app.reference_code,'status',v_app.status,
    'studentId',v_app.student_id,'version',v_app.version,'reviewedAt',v_app.reviewed_at);
end;
$$;
revoke all on function public.review_enrollment_application(uuid,text,text,integer) from public,anon;
grant execute on function public.review_enrollment_application(uuid,text,text,integer) to authenticated;

create function public.complete_enrollment_admission(
  p_application_id uuid,
  p_existing_student_id uuid default null,
  p_verify_guardian boolean default true,
  p_expected_version integer default 1
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor uuid:=auth.uid();
  v_app public.enrollment_applications%rowtype;
  v_completion public.enrollment_admission_completions%rowtype;
  v_student public.students%rowtype;
  v_guardian uuid;
  v_guardian_verified boolean:=false;
  v_previous_status text;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  -- Locks keep approval/role revocation from racing an in-flight completion.
  perform 1 from public.profiles where id=v_actor and account_status='APPROVED' for share;
  if not found then raise exception 'insufficient_authority' using errcode='P0001'; end if;
  perform 1 from public.role_assignments where user_id=v_actor and active for share;
  perform 1 from public.manager_capability_grants where manager_user_id=v_actor and active for share;
  if not public.enrollment_actor_can_complete() then raise exception 'insufficient_authority' using errcode='P0001'; end if;
  if p_verify_guardian is null or p_application_id is null then raise exception 'invalid_admission_request' using errcode='P0001'; end if;
  select * into v_app from public.enrollment_applications where id=p_application_id for update;
  if not found then raise exception 'target_not_found' using errcode='P0001'; end if;
  select * into v_completion from public.enrollment_admission_completions where application_id=v_app.id;
  if found then
    if not v_completion.active or v_app.status<>'ENROLLED' or v_app.student_id is distinct from v_completion.student_id
      or (p_existing_student_id is not null and p_existing_student_id<>v_completion.student_id)
      or v_completion.guardian_verified is distinct from (p_verify_guardian and v_completion.guardian_user_id is not null)
    then raise exception 'admission_completion_conflict' using errcode='P0001'; end if;
    return jsonb_build_object('applicationId',v_app.id,'studentId',v_completion.student_id,'status','ENROLLED',
      'version',v_app.version,'guardianVerified',v_completion.guardian_verified,'replayed',true);
  end if;
  if p_expected_version is null or p_expected_version<>v_app.version then raise exception 'version_conflict' using errcode='P0001'; end if;
  -- Legacy ENROLLED-without-student rows are repaired only by explicit completion.
  if v_app.status<>'ACCEPTED' and not (v_app.status='ENROLLED' and v_app.student_id is null) then
    raise exception 'application_not_accepted' using errcode='P0001';
  end if;
  if v_app.student_id is not null and p_existing_student_id is distinct from v_app.student_id then
    raise exception 'admission_completion_conflict' using errcode='P0001';
  end if;
  v_previous_status:=v_app.status;
  -- submitted_by_user_id is an explicit account reference, NOT a contact match.
  -- Office/anonymous submissions do not magically make the submitter a guardian.
  if exists(select 1 from public.role_assignments where user_id=v_app.submitted_by_user_id and role='PARENT'::public.app_role) then
    v_guardian:=v_app.submitted_by_user_id;
  end if;
  if p_verify_guardian and v_guardian is not null then
    perform 1 from public.profiles where id=v_guardian and account_status='APPROVED' for share;
    if not found then raise exception 'invalid_parent_account' using errcode='P0001'; end if;
    perform 1 from public.role_assignments where user_id=v_guardian and role='PARENT'::public.app_role and active for share;
    if not found then raise exception 'invalid_parent_account' using errcode='P0001'; end if;
  end if;
  if p_existing_student_id is not null then
    select * into v_student from public.students where id=p_existing_student_id and status='ACTIVE' for update;
    if not found then raise exception 'student_not_available' using errcode='P0001'; end if;
    if p_verify_guardian and v_guardian is not null and exists (
      select 1 from public.parent_child_links where student_id=v_student.id and active and verified_by is not null
    ) and not exists (
      select 1 from public.parent_child_links where student_id=v_student.id and parent_user_id=v_guardian and active and verified_by is not null
    ) then raise exception 'guardian_student_conflict' using errcode='P0001'; end if;
  else
    v_student.id:=gen_random_uuid();
    insert into public.students(id,student_code,full_name,birth_date,status,created_by)
    values(v_student.id,'KS-'||upper(replace(v_student.id::text,'-','')),v_app.student_full_name,v_app.birth_date,'ACTIVE',v_actor)
    returning * into v_student;
  end if;
  if p_verify_guardian and v_guardian is not null then
    insert into public.parent_child_links(parent_user_id,student_id,relationship_label,active,verified_by)
    values(v_guardian,v_student.id,'Parent',true,v_actor)
    on conflict(parent_user_id,student_id) do update set active=true,verified_by=v_actor
      where not public.parent_child_links.active or public.parent_child_links.verified_by is null;
    v_guardian_verified:=true;
  end if;
  insert into public.enrollment_admission_completions(application_id,student_id,guardian_user_id,guardian_verified,completed_by)
  values(v_app.id,v_student.id,v_guardian,v_guardian_verified,v_actor);
  update public.enrollment_applications set student_id=v_student.id,status='ENROLLED',version=version+1,
    reviewed_by=v_actor,reviewed_at=now() where id=v_app.id returning * into v_app;
  insert into public.enrollment_admission_audit_logs(application_id,student_id,actor_user_id,action,previous_status,resulting_version)
  values(v_app.id,v_student.id,v_actor,'ADMISSION_COMPLETED',v_previous_status,v_app.version);
  if v_app.submitted_by_user_id is not null then
    perform public.enqueue_school_notification(v_app.submitted_by_user_id,'system','Admission Completed',
      'Application '||v_app.reference_code||' admission is complete; class placement is separate.','registration',v_app.id::text);
  end if;
  return jsonb_build_object('applicationId',v_app.id,'studentId',v_student.id,'status','ENROLLED',
    'version',v_app.version,'guardianVerified',v_guardian_verified,'replayed',false);
end;
$$;
revoke all on function public.complete_enrollment_admission(uuid,uuid,boolean,integer) from public,anon;
grant execute on function public.complete_enrollment_admission(uuid,uuid,boolean,integer) to authenticated;
