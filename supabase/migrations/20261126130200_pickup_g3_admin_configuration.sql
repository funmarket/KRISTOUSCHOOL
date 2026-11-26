-- G3-C: APP_ADMIN configuration, collector management, authority audit and export.

create or replace function public.revoke_user_pickup_release_authority(
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_target_user_id is null or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_pickup_authority_request' using errcode='P0001';
  end if;

  perform 1 from public.profiles p where p.id=p_target_user_id for update;
  if not found or not exists (
    select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
    where p.id=p_target_user_id and p.account_status='APPROVED' and r.active
      and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,'ADMINISTRATIVE_PERSONNEL'::public.app_role)
  ) then
    raise exception 'release_authority_target_ineligible' using errcode='P0001';
  end if;

  insert into public.pickup_release_revocations(target_user_id) values(p_target_user_id)
  on conflict(target_user_id) do nothing;
  select version into v_version
    from public.pickup_release_revocations
    where target_user_id=p_target_user_id
    for update;
  if (select is_revoked from public.pickup_release_revocations where target_user_id=p_target_user_id) then
    raise exception 'pickup_release_authority_already_revoked' using errcode='P0001';
  end if;
  v_version:=v_version+1;
  update public.pickup_release_revocations
     set is_revoked=true,version=v_version,last_actor_user_id=auth.uid(),
         last_reason=btrim(p_reason),updated_at=v_now
   where target_user_id=p_target_user_id;
  insert into public.pickup_authority_audit_logs(actor_user_id,target_user_id,action,reason,version,effective_at)
  values(auth.uid(),p_target_user_id,'REVOKE_RELEASE',btrim(p_reason),v_version,v_now);
  return jsonb_build_object('targetUserId',p_target_user_id,'isRevoked',true,'version',v_version,'effectiveAt',v_now);
end;
$$;

create or replace function public.reinstate_user_pickup_release_authority(
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_target_user_id is null or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_pickup_authority_request' using errcode='P0001';
  end if;
  perform 1 from public.profiles p where p.id=p_target_user_id for update;
  if not found or not exists (
    select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
    where p.id=p_target_user_id and p.account_status='APPROVED' and r.active
      and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,'ADMINISTRATIVE_PERSONNEL'::public.app_role)
  ) then
    raise exception 'release_authority_target_ineligible' using errcode='P0001';
  end if;
  select version into v_version
    from public.pickup_release_revocations
    where target_user_id=p_target_user_id and is_revoked
    for update;
  if not found then raise exception 'pickup_release_authority_not_revoked' using errcode='P0001'; end if;
  v_version:=v_version+1;
  update public.pickup_release_revocations
     set is_revoked=false,version=v_version,last_actor_user_id=auth.uid(),
         last_reason=btrim(p_reason),updated_at=v_now
   where target_user_id=p_target_user_id;
  insert into public.pickup_authority_audit_logs(actor_user_id,target_user_id,action,reason,version,effective_at)
  values(auth.uid(),p_target_user_id,'REINSTATE_RELEASE',btrim(p_reason),v_version,v_now);
  return jsonb_build_object('targetUserId',p_target_user_id,'isRevoked',false,'version',v_version,'effectiveAt',v_now);
end;
$$;

create or replace function public.create_pickup_dismissal_policy(
  p_class_id uuid,
  p_weekday smallint,
  p_opens_at time,
  p_closes_at time,
  p_effective_from date,
  p_effective_until date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision integer;
  v_id uuid;
  v_now timestamptz:=clock_timestamp();
  v_scope text:=coalesce(p_class_id::text,'school');
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_weekday is null or p_weekday not between 0 and 6 or p_opens_at is null or p_closes_at is null
     or p_closes_at<=p_opens_at or p_effective_from is null
     or (p_effective_until is not null and p_effective_until<p_effective_from)
     or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_dismissal_policy' using errcode='P0001';
  end if;
  if p_class_id is not null and not exists (
    select 1 from public.school_classes c where c.id=p_class_id and not c.is_archived
  ) then raise exception 'dismissal_policy_class_unavailable' using errcode='P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('pickup-dismissal-policy:'||v_scope||':'||p_weekday::text,0));
  if exists (
    select 1 from public.dismissal_policies d
    where d.active and d.weekday=p_weekday and d.class_id is not distinct from p_class_id
      and d.effective_from<=coalesce(p_effective_until,'infinity'::date)
      and p_effective_from<=coalesce(d.effective_until,'infinity'::date)
  ) then raise exception 'dismissal_policy_overlaps_existing' using errcode='P0001'; end if;
  select coalesce(max(d.revision),0)+1 into v_revision
    from public.dismissal_policies d
    where d.weekday=p_weekday and d.class_id is not distinct from p_class_id;
  insert into public.dismissal_policies(class_id,weekday,opens_at,closes_at,effective_from,effective_until,revision,created_by)
  values(p_class_id,p_weekday,p_opens_at,p_closes_at,p_effective_from,p_effective_until,v_revision,auth.uid())
  returning id into v_id;
  insert into public.pickup_dismissal_policy_audit_logs(actor_user_id,policy_id,action,prior_revision,new_revision,reason,occurred_at)
  values(auth.uid(),v_id,'CREATED',null,v_revision,btrim(p_reason),v_now);
  return jsonb_build_object('policyId',v_id,'revision',v_revision,'timezone','Africa/Tunis','effectiveFrom',p_effective_from,'effectiveUntil',p_effective_until);
end;
$$;

create or replace function public.replace_pickup_dismissal_policy(
  p_policy_id uuid,
  p_opens_at time,
  p_closes_at time,
  p_effective_from date,
  p_effective_until date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.dismissal_policies%rowtype;
  v_revision integer;
  v_new_id uuid;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_policy_id is null or p_opens_at is null or p_closes_at is null or p_closes_at<=p_opens_at
     or p_effective_from is null or (p_effective_until is not null and p_effective_until<p_effective_from)
     or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_dismissal_policy' using errcode='P0001';
  end if;
  select * into v_old from public.dismissal_policies where id=p_policy_id for update;
  if not found or not v_old.active then raise exception 'dismissal_policy_unavailable' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pickup-dismissal-policy:'||coalesce(v_old.class_id::text,'school')||':'||v_old.weekday::text,0));
  if exists (
    select 1 from public.dismissal_policies d
    where d.active and d.id<>v_old.id and d.weekday=v_old.weekday
      and d.class_id is not distinct from v_old.class_id
      and d.effective_from<=coalesce(p_effective_until,'infinity'::date)
      and p_effective_from<=coalesce(d.effective_until,'infinity'::date)
  ) then raise exception 'dismissal_policy_overlaps_existing' using errcode='P0001'; end if;
  update public.dismissal_policies set active=false where id=v_old.id;
  select coalesce(max(d.revision),0)+1 into v_revision
    from public.dismissal_policies d
    where d.weekday=v_old.weekday and d.class_id is not distinct from v_old.class_id;
  insert into public.dismissal_policies(class_id,weekday,opens_at,closes_at,effective_from,effective_until,revision,created_by)
  values(v_old.class_id,v_old.weekday,p_opens_at,p_closes_at,p_effective_from,p_effective_until,v_revision,auth.uid())
  returning id into v_new_id;
  insert into public.pickup_dismissal_policy_audit_logs(actor_user_id,policy_id,action,prior_revision,new_revision,reason,occurred_at)
  values(auth.uid(),v_new_id,'REPLACED',v_old.revision,v_revision,btrim(p_reason),v_now);
  return jsonb_build_object('policyId',v_new_id,'revision',v_revision,'timezone','Africa/Tunis','effectiveFrom',p_effective_from,'effectiveUntil',p_effective_until);
end;
$$;

create or replace function public.pickup_resolve_schedule(p_student_id uuid,p_school_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.student_class_memberships%rowtype;
  v_policy public.dismissal_policies%rowtype;
  v_count integer;
begin
  if p_student_id is null or p_school_date is null then
    return jsonb_build_object('status','UNAVAILABLE','reasonCode','schedule_unavailable');
  end if;
  select m.* into v_membership
  from public.student_class_memberships m
  join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
  where m.student_id=p_student_id
    and m.started_at<=p_school_date
    and (m.ended_at is null or m.ended_at>=p_school_date)
    and (m.status='ACTIVE' or m.ended_at is not null)
  order by m.started_at desc,m.id limit 1;
  if not found then
    return jsonb_build_object('status','UNAVAILABLE','reasonCode','schedule_unavailable');
  end if;
  if exists (
    select 1 from public.school_calendar_events e
    where e.category in ('CLOSURE','HOLIDAY') and e.status='SCHEDULED'
      and p_school_date between e.start_date and e.end_date
      and (
        e.audience_mode='WHOLE_SCHOOL'
        or exists (
          select 1 from public.school_calendar_event_targets t
          where t.event_id=e.id and t.class_id=v_membership.class_id
        )
      )
  ) then
    return jsonb_build_object('status','UNAVAILABLE','reasonCode','schedule_unavailable','closure',true);
  end if;

  select count(*) into v_count
  from public.dismissal_policies d
  where d.active and d.class_id=v_membership.class_id
    and d.weekday=extract(dow from p_school_date)::smallint
    and d.effective_from<=p_school_date
    and (d.effective_until is null or d.effective_until>=p_school_date);
  if v_count=0 then
    select count(*) into v_count
    from public.dismissal_policies d
    where d.active and d.class_id is null
      and d.weekday=extract(dow from p_school_date)::smallint
      and d.effective_from<=p_school_date
      and (d.effective_until is null or d.effective_until>=p_school_date);
    if v_count<>1 then return jsonb_build_object('status','UNAVAILABLE','reasonCode','schedule_unavailable'); end if;
    select d.* into v_policy
    from public.dismissal_policies d
    where d.active and d.class_id is null
      and d.weekday=extract(dow from p_school_date)::smallint
      and d.effective_from<=p_school_date
      and (d.effective_until is null or d.effective_until>=p_school_date);
  elsif v_count<>1 then
    return jsonb_build_object('status','UNAVAILABLE','reasonCode','schedule_unavailable');
  else
    select d.* into v_policy
    from public.dismissal_policies d
    where d.active and d.class_id=v_membership.class_id
      and d.weekday=extract(dow from p_school_date)::smallint
      and d.effective_from<=p_school_date
      and (d.effective_until is null or d.effective_until>=p_school_date);
  end if;
  return jsonb_build_object(
    'status','AVAILABLE','reasonCode',null,'dismissalPolicyId',v_policy.id,
    'policyRevision',v_policy.revision,'classId',v_membership.class_id,
    'membershipId',v_membership.id,'opensAt',v_policy.opens_at,
    'closesAt',v_policy.closes_at,'timezone','Africa/Tunis'
  );
end;
$$;

create or replace function public.get_pickup_schedule(p_student_id uuid,p_school_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_can_view_student(p_student_id) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;
  return public.pickup_resolve_schedule(p_student_id,p_school_date);
end;
$$;

create or replace function public.create_authorized_pickup_person(
  p_student_id uuid,
  p_display_name text,
  p_relationship_label text,
  p_verification_method text,
  p_verification_reference text,
  p_valid_from date,
  p_valid_until date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person public.authorized_pickup_persons%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_student_id is null or p_valid_from is null or p_valid_until is null or p_valid_until<p_valid_from
     or char_length(btrim(coalesce(p_display_name,''))) not between 2 and 120
     or char_length(btrim(coalesce(p_relationship_label,''))) not between 2 and 80
     or char_length(btrim(coalesce(p_verification_method,''))) not between 2 and 80
     or char_length(btrim(coalesce(p_verification_reference,''))) not between 3 and 160
     or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_authorized_pickup_person' using errcode='P0001';
  end if;
  if not exists(select 1 from public.students s where s.id=p_student_id and s.status='ACTIVE') then
    raise exception 'pickup_student_unavailable' using errcode='P0001';
  end if;
  insert into public.authorized_pickup_persons(
    student_id,display_name,relationship_label,verification_method,verification_reference,
    verified_by,verified_at,valid_from,valid_until
  ) values(
    p_student_id,btrim(p_display_name),btrim(p_relationship_label),btrim(p_verification_method),
    btrim(p_verification_reference),auth.uid(),clock_timestamp(),p_valid_from,p_valid_until
  ) returning * into v_person;
  insert into public.pickup_person_audit_logs(actor_user_id,authorized_person_id,student_id,action,reason)
  values(auth.uid(),v_person.id,p_student_id,'REGISTERED',btrim(p_reason));
  return jsonb_build_object(
    'id',v_person.id,'studentId',v_person.student_id,'displayName',v_person.display_name,
    'relationshipLabel',v_person.relationship_label,'validFrom',v_person.valid_from,
    'validUntil',v_person.valid_until,'verifiedAt',v_person.verified_at
  );
end;
$$;

create or replace function public.revoke_authorized_pickup_person(p_person_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person public.authorized_pickup_persons%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_person_id is null or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_authorized_pickup_person' using errcode='P0001';
  end if;
  select * into v_person from public.authorized_pickup_persons where id=p_person_id for update;
  if not found or v_person.revoked_at is not null then raise exception 'authorized_pickup_person_unavailable' using errcode='P0001'; end if;
  update public.authorized_pickup_persons
     set revoked_at=v_now,revoked_by=auth.uid(),revocation_reason=btrim(p_reason)
   where id=p_person_id;
  insert into public.pickup_person_audit_logs(actor_user_id,authorized_person_id,student_id,action,reason,occurred_at)
  values(auth.uid(),p_person_id,v_person.student_id,'REVOKED',btrim(p_reason),v_now);
  return jsonb_build_object('id',p_person_id,'studentId',v_person.student_id,'revokedAt',v_now);
end;
$$;

create or replace function public.list_authorized_pickup_persons(
  p_student_id uuid,
  p_school_date date default (clock_timestamp() at time zone 'Africa/Tunis')::date
)
returns table(
  id uuid,
  student_id uuid,
  display_name text,
  relationship_label text,
  valid_from date,
  valid_until date,
  verified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_can_view_student(p_student_id) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;
  return query
  select person.id,person.student_id,person.display_name,person.relationship_label,
         person.valid_from,person.valid_until,person.verified_at
  from public.authorized_pickup_persons person
  where person.student_id=p_student_id
    and person.valid_from<=p_school_date and person.valid_until>=p_school_date
    and person.revoked_at is null
  order by person.display_name,person.id;
end;
$$;

create or replace function public.export_pickup_events(
  p_from_at timestamptz,
  p_until_at timestamptz,
  p_student_id uuid,
  p_reason text
)
returns setof public.pickup_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer; v_log_id bigint;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.pickup_actor_is_app_admin() then raise exception 'pickup_app_admin_required' using errcode='P0001'; end if;
  if p_from_at is null or p_until_at is null or p_until_at<p_from_at
     or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'invalid_pickup_audit_export' using errcode='P0001';
  end if;
  select count(*) into v_count from public.pickup_events e
    where e.occurred_at between p_from_at and p_until_at
      and (p_student_id is null or e.student_id=p_student_id);
  insert into public.pickup_audit_export_logs(actor_user_id,from_at,until_at,student_id,reason,exported_event_count)
  values(auth.uid(),p_from_at,p_until_at,p_student_id,btrim(p_reason),v_count)
  returning id into v_log_id;
  return query select e.* from public.pickup_events e
    where e.occurred_at between p_from_at and p_until_at
      and (p_student_id is null or e.student_id=p_student_id)
    order by e.occurred_at,e.id;
end;
$$;

revoke all on function public.revoke_user_pickup_release_authority(uuid,text) from public,anon;
grant execute on function public.revoke_user_pickup_release_authority(uuid,text) to authenticated;
revoke all on function public.reinstate_user_pickup_release_authority(uuid,text) from public,anon;
grant execute on function public.reinstate_user_pickup_release_authority(uuid,text) to authenticated;
revoke all on function public.create_pickup_dismissal_policy(uuid,smallint,time,time,date,date,text) from public,anon;
grant execute on function public.create_pickup_dismissal_policy(uuid,smallint,time,time,date,date,text) to authenticated;
revoke all on function public.replace_pickup_dismissal_policy(uuid,time,time,date,date,text) from public,anon;
grant execute on function public.replace_pickup_dismissal_policy(uuid,time,time,date,date,text) to authenticated;
revoke all on function public.pickup_resolve_schedule(uuid,date) from public,anon,authenticated;
revoke all on function public.get_pickup_schedule(uuid,date) from public,anon;
grant execute on function public.get_pickup_schedule(uuid,date) to authenticated;
revoke all on function public.create_authorized_pickup_person(uuid,text,text,text,text,date,date,text) from public,anon;
grant execute on function public.create_authorized_pickup_person(uuid,text,text,text,text,date,date,text) to authenticated;
revoke all on function public.revoke_authorized_pickup_person(uuid,text) from public,anon;
grant execute on function public.revoke_authorized_pickup_person(uuid,text) to authenticated;
revoke all on function public.list_authorized_pickup_persons(uuid,date) from public,anon;
grant execute on function public.list_authorized_pickup_persons(uuid,date) to authenticated;
revoke all on function public.export_pickup_events(timestamptz,timestamptz,uuid,text) from public,anon;
grant execute on function public.export_pickup_events(timestamptz,timestamptz,uuid,text) to authenticated;
