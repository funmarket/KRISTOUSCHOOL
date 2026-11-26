-- G3-B: default/revocable physical-release authority and narrow Attendance projection.

create or replace function public.pickup_actor_is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      where p.id=auth.uid()
        and p.account_status='APPROVED'
        and r.role='APP_ADMIN'::public.app_role
        and r.active
    );
$$;

create or replace function public.pickup_actor_can_confirm_release()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      where p.id=auth.uid()
        and p.account_status='APPROVED'
        and r.active
        and r.role in (
          'APP_ADMIN'::public.app_role,
          'MANAGER'::public.app_role,
          'ADMINISTRATIVE_PERSONNEL'::public.app_role
        )
    )
    and not exists (
      select 1 from public.pickup_release_revocations rev
      where rev.target_user_id=auth.uid() and rev.is_revoked
    );
$$;

create or replace function public.pickup_actor_can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and (
      (
        exists (
          select 1 from public.profiles p
          join public.role_assignments r on r.user_id=p.id
          where p.id=auth.uid() and p.account_status='APPROVED'
            and r.active and r.role in (
              'APP_ADMIN'::public.app_role,
              'MANAGER'::public.app_role,
              'ADMINISTRATIVE_PERSONNEL'::public.app_role
            )
        )
      )
      or (
        exists (
          select 1 from public.profiles p
          join public.role_assignments r on r.user_id=p.id
          where p.id=auth.uid() and p.account_status='APPROVED'
            and r.role='PARENT'::public.app_role and r.active
        )
        and exists (
          select 1 from public.parent_child_links l
          join public.students s on s.id=l.student_id and s.status='ACTIVE'
          where l.parent_user_id=auth.uid() and l.student_id=p_student_id
            and l.active and l.verified_by is not null
        )
      )
    );
$$;

create or replace function public.pickup_parent_can_announce_arrival(
  p_student_id uuid,
  p_collector_id uuid,
  p_school_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and p_student_id is not null
    and p_collector_id is not null
    and p_school_date is not null
    and exists (
      select 1
      from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      join public.parent_child_links l on l.parent_user_id=p.id
      join public.authorized_pickup_persons person on person.student_id=l.student_id
      join public.students s on s.id=l.student_id
      where p.id=auth.uid()
        and p.account_status='APPROVED'
        and r.role='PARENT'::public.app_role and r.active
        and l.student_id=p_student_id and l.active and l.verified_by is not null
        and s.status='ACTIVE'
        and person.id=p_collector_id
        and person.verified_by is not null and person.verified_at is not null
        and person.valid_from<=p_school_date and person.valid_until>=p_school_date
        and person.revoked_at is null
    );
$$;

create or replace function public.get_pickup_actor_authority(
  p_student_id uuid,
  p_collector_id uuid default null,
  p_school_date date default (clock_timestamp() at time zone 'Africa/Tunis')::date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_release boolean;
  v_can_arrive boolean;
  v_can_manage boolean;
begin
  if auth.uid() is null then
    raise exception 'actor_unauthenticated' using errcode='P0001';
  end if;
  if not public.pickup_actor_can_view_student(p_student_id) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;
  v_can_release:=public.pickup_actor_can_confirm_release();
  v_can_arrive:=public.pickup_parent_can_announce_arrival(p_student_id,p_collector_id,p_school_date);
  v_can_manage:=public.pickup_actor_is_app_admin();
  return jsonb_build_object(
    'studentId',p_student_id,
    'canAnnounceArrival',v_can_arrive,
    'canConfirmRelease',v_can_release,
    'canManagePickupPolicy',v_can_manage,
    'authorityVersion',coalesce((select version from public.pickup_release_revocations where target_user_id=auth.uid()),0)
  );
end;
$$;

create or replace function public.get_pickup_student_eligibility(
  p_student_id uuid,
  p_school_date date
)
returns table(
  student_id uuid,
  eligibility text,
  eligible boolean,
  reason_code text,
  membership_id uuid,
  class_id uuid,
  academic_year_id uuid,
  register_id uuid,
  register_status text,
  register_version integer,
  attendance_mark text,
  school_date date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_student public.students%rowtype;
  v_membership public.student_class_memberships%rowtype;
  v_membership_count integer;
  v_teacher_id uuid;
  v_teacher_count integer;
  v_register public.attendance_registers%rowtype;
  v_register_count integer;
  v_mark text;
  v_entry_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'actor_unauthenticated' using errcode='P0001';
  end if;
  if p_student_id is null or p_school_date is null then
    raise exception 'invalid_pickup_eligibility_request' using errcode='P0001';
  end if;
  if not public.pickup_actor_can_view_student(p_student_id) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;

  select * into v_student from public.students s where s.id=p_student_id;
  if not found or v_student.status<>'ACTIVE' then
    return query select p_student_id,'UNAVAILABLE',false,'student_unavailable',null::uuid,null::uuid,null::uuid,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;

  select count(*) into v_membership_count
  from public.student_class_memberships m
  join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
  where m.student_id=p_student_id
    and m.started_at<=p_school_date
    and (m.ended_at is null or m.ended_at>=p_school_date)
    and (m.status='ACTIVE' or m.ended_at is not null);
  if v_membership_count>1 then
    return query select p_student_id,'UNAVAILABLE',false,'conflicting_effective_memberships',null::uuid,null::uuid,null::uuid,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;

  select m.* into v_membership
  from public.student_class_memberships m
  join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
  where m.student_id=p_student_id
    and m.started_at<=p_school_date
    and (m.ended_at is null or m.ended_at>=p_school_date)
    and (m.status='ACTIVE' or m.ended_at is not null)
  order by m.started_at desc,m.id
  limit 1;
  if not found then
    return query select p_student_id,'UNAVAILABLE',false,'effective_membership_missing',null::uuid,null::uuid,null::uuid,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;

  select count(*), (array_agg(a.teacher_user_id order by a.teacher_user_id))[1]
    into v_teacher_count,v_teacher_id
  from public.teacher_class_assignments a
  join public.profiles p on p.id=a.teacher_user_id and p.account_status='APPROVED'
  join public.role_assignments r on r.user_id=p.id and r.role='TEACHER'::public.app_role and r.active
  where a.class_id=v_membership.class_id and a.active and a.is_homeroom;
  if v_teacher_count<>1 or v_teacher_id is null then
    return query select p_student_id,'UNAVAILABLE',false,'responsible_teacher_unavailable',v_membership.id,v_membership.class_id,v_membership.academic_year_id,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;

  select count(*) into v_register_count
  from public.attendance_registers r
  where r.academic_year_id=v_membership.academic_year_id
    and r.class_id=v_membership.class_id
    and r.school_date=p_school_date;
  if v_register_count>1 then
    return query select p_student_id,'UNAVAILABLE',false,'conflicting_registers',v_membership.id,v_membership.class_id,v_membership.academic_year_id,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;

  select r.* into v_register
  from public.attendance_registers r
  where r.academic_year_id=v_membership.academic_year_id
    and r.class_id=v_membership.class_id
    and r.school_date=p_school_date
    and r.teacher_user_id=v_teacher_id;
  if not found then
    return query select p_student_id,'UNAVAILABLE',false,'register_missing',v_membership.id,v_membership.class_id,v_membership.academic_year_id,null::uuid,null::text,null::integer,null::text,p_school_date;
    return;
  end if;
  if v_register.status<>'SUBMITTED' then
    return query select p_student_id,'UNAVAILABLE',false,'register_not_submitted',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,null::text,p_school_date;
    return;
  end if;

  select e.mark,e.membership_id into v_mark,v_entry_membership_id
  from public.attendance_entries e
  where e.register_id=v_register.id and e.student_id=p_student_id;
  if not found or v_entry_membership_id is distinct from v_membership.id then
    return query select p_student_id,'UNAVAILABLE',false,'attendance_entry_missing_or_conflicting',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,null::text,p_school_date;
    return;
  end if;
  if v_mark is null then
    return query select p_student_id,'UNAVAILABLE',false,'attendance_mark_missing',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,null::text,p_school_date;
  elsif v_mark in ('PRESENT','LATE') then
    return query select p_student_id,'ELIGIBLE_CANDIDATE',true,'attendance_present',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,v_mark,p_school_date;
  elsif v_mark='ABSENT' then
    return query select p_student_id,'INELIGIBLE',false,'attendance_absent',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,v_mark,p_school_date;
  elsif v_mark='EXCUSED' then
    return query select p_student_id,'INELIGIBLE',false,'attendance_excused',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,v_mark,p_school_date;
  else
    return query select p_student_id,'UNAVAILABLE',false,'attendance_mark_unknown',v_membership.id,v_membership.class_id,v_membership.academic_year_id,v_register.id,v_register.status,v_register.version,v_mark,p_school_date;
  end if;
end;
$$;

revoke all on function public.pickup_actor_is_app_admin() from public,anon,authenticated;
revoke all on function public.pickup_actor_can_confirm_release() from public,anon,authenticated;
revoke all on function public.pickup_actor_can_view_student(uuid) from public,anon,authenticated;
revoke all on function public.pickup_parent_can_announce_arrival(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.get_pickup_actor_authority(uuid,uuid,date) from public,anon;
grant execute on function public.get_pickup_actor_authority(uuid,uuid,date) to authenticated;
revoke all on function public.get_pickup_student_eligibility(uuid,date) from public,anon;
grant execute on function public.get_pickup_student_eligibility(uuid,date) to authenticated;
