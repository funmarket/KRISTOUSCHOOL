-- ENROLL-D02: existing Enrollment, Academics and Family owners; no new identity registry.
create function public.get_enrollment_review_access()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select public.enrollment_actor_can_complete();
$$;
create function public.list_enrollment_applications()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id),'[]'::jsonb)
    from public.enrollment_applications a
    where public.enrollment_actor_can_complete() or a.submitted_by_user_id=auth.uid());
end;
$$;

create function public.assign_existing_student_to_class(
  p_student_id uuid,p_class_id uuid,p_expected_membership_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_class public.school_classes%rowtype;
  v_current public.student_class_memberships%rowtype;
  v_id uuid;
  v_day date:=(now() at time zone 'Africa/Tunis')::date;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  perform 1 from public.profiles where id=auth.uid() and account_status='APPROVED' for share;
  if not found then raise exception 'actor_not_approved'; end if;
  perform 1 from public.role_assignments where user_id=auth.uid() and active for share;
  perform 1 from public.manager_capability_grants where manager_user_id=auth.uid() and active for share;
  if not (public.current_user_has_role('APP_ADMIN') or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL')
    or public.current_user_has_capability('CLASSES_MANAGE')) then raise exception 'insufficient_authority'; end if;
  perform 1 from public.students where id=p_student_id and status='ACTIVE' for update;
  if not found then raise exception 'student_not_available'; end if;
  select * into v_class from public.school_classes where id=p_class_id and not is_archived for update;
  if not found then raise exception 'class_not_found'; end if;
  select * into v_current from public.student_class_memberships
    where student_id=p_student_id and academic_year_id=v_class.academic_year_id and status='ACTIVE' for update;
  if v_current.class_id=p_class_id then
    return jsonb_build_object('studentId',p_student_id,'classId',p_class_id,'membershipId',v_current.id,'replayed',true);
  end if;
  if v_current.id is distinct from p_expected_membership_id then raise exception 'version_conflict'; end if;
  if (select count(*) from public.student_class_memberships where class_id=p_class_id and status='ACTIVE')>=v_class.capacity
    then raise exception 'class_capacity_reached'; end if;
  if v_current.id is not null then
    update public.student_class_memberships set status='TRANSFERRED',ended_at=v_day where id=v_current.id;
  end if;
  insert into public.student_class_memberships(student_id,class_id,academic_year_id,status,started_at,assigned_by)
    values(p_student_id,p_class_id,v_class.academic_year_id,'ACTIVE',v_day,auth.uid()) returning id into v_id;
  return jsonb_build_object('studentId',p_student_id,'classId',p_class_id,'membershipId',v_id,'replayed',false);
end;
$$;

create table public.family_guardian_audit_logs (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.parent_child_links(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('VERIFY','REVOKE')),
  previous_active boolean not null,
  previous_verified_by uuid references public.profiles(id) on delete restrict,
  reason text not null check(char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table public.family_guardian_audit_logs enable row level security;
revoke all on public.family_guardian_audit_logs from public,anon,authenticated;
create function public.family_reject_audit_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'family_audit_immutable'; end;
$$;
create trigger family_guardian_audit_immutable before update or delete on public.family_guardian_audit_logs
  for each row execute function public.family_reject_audit_mutation();
revoke all on function public.family_reject_audit_mutation() from public,anon,authenticated;

create function public.list_student_guardians(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved'; end if;
  if not (public.current_user_has_role('APP_ADMIN') or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL')
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW') or public.current_user_has_capability('CLASSES_MANAGE'))
    then raise exception 'insufficient_authority'; end if;
  if not exists(select 1 from public.students where id=p_student_id) then raise exception 'target_not_found'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'parentUserId',l.parent_user_id,
    'parentName',p.full_name,'relationshipLabel',l.relationship_label,'active',l.active,
    'verified',l.verified_by is not null,'updatedAt',l.updated_at) order by l.created_at,l.id),'[]'::jsonb)
    from public.parent_child_links l join public.profiles p on p.id=l.parent_user_id where l.student_id=p_student_id);
end;
$$;

create function public.review_student_guardian(
  p_student_id uuid,p_link_id uuid,p_action text,p_expected_updated_at timestamptz,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_link public.parent_child_links%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated'; end if;
  perform 1 from public.profiles where id=auth.uid() and account_status='APPROVED' for share;
  if not found then raise exception 'actor_not_approved'; end if;
  perform 1 from public.role_assignments where user_id=auth.uid() and active for share;
  perform 1 from public.manager_capability_grants where manager_user_id=auth.uid() and active for share;
  if not (public.current_user_has_role('APP_ADMIN') or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL')
    or public.current_user_has_capability('CLASSES_MANAGE')) then raise exception 'insufficient_authority'; end if;
  if p_action is null or p_action not in ('VERIFY','REVOKE') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500
    then raise exception 'invalid_guardian_request'; end if;
  perform 1 from public.students where id=p_student_id for update;
  if not found then raise exception 'target_not_found'; end if;
  select * into v_link from public.parent_child_links where id=p_link_id and student_id=p_student_id for update;
  if not found then raise exception 'target_not_found'; end if;
  if p_expected_updated_at is null or v_link.updated_at<>p_expected_updated_at then raise exception 'version_conflict'; end if;
  if p_action='VERIFY' then
    perform 1 from public.profiles where id=v_link.parent_user_id and account_status='APPROVED' for share;
    if not found then raise exception 'invalid_parent_account'; end if;
    perform 1 from public.role_assignments where user_id=v_link.parent_user_id and role='PARENT' and active for share;
    if not found then raise exception 'invalid_parent_account'; end if;
  end if;
  if (p_action='VERIFY' and v_link.active and v_link.verified_by is not null) or (p_action='REVOKE' and not v_link.active) then
    return jsonb_build_object('linkId',v_link.id,'studentId',p_student_id,'replayed',true);
  end if;
  insert into public.family_guardian_audit_logs(link_id,actor_user_id,action,previous_active,previous_verified_by,reason)
    values(v_link.id,auth.uid(),p_action,v_link.active,v_link.verified_by,btrim(p_reason));
  update public.parent_child_links set active=(p_action='VERIFY'),
    verified_by=case when p_action='VERIFY' then auth.uid() else verified_by end
    where id=v_link.id;
  return jsonb_build_object('linkId',v_link.id,'studentId',p_student_id,'replayed',false);
end;
$$;

revoke all on function public.get_enrollment_review_access(),public.list_enrollment_applications(),
  public.assign_existing_student_to_class(uuid,uuid,uuid),public.list_student_guardians(uuid),
  public.review_student_guardian(uuid,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.get_enrollment_review_access(),public.list_enrollment_applications(),
  public.assign_existing_student_to_class(uuid,uuid,uuid),public.list_student_guardians(uuid),
  public.review_student_guardian(uuid,uuid,text,timestamptz,text) to authenticated;
