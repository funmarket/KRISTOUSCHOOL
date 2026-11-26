-- G4: scoped Pickup board reads, durable parent-arrival command and receipt.
-- This migration does not create cycles, release pupils, or dispatch notifications.

-- G3's product scope was narrower than the approved Teacher board requirement.
-- Extend only the view helper to the currently assigned class; release authority
-- remains exclusively in pickup_actor_can_confirm_release().
create or replace function public.pickup_actor_can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and p_student_id is not null and (
    exists (
      select 1 from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      where p.id=auth.uid() and p.account_status='APPROVED'
        and r.active and r.role in (
          'APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
          'ADMINISTRATIVE_PERSONNEL'::public.app_role
        )
    )
    or exists (
      select 1 from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      join public.teacher_class_assignments a on a.teacher_user_id=p.id and a.active
      join public.student_class_memberships m on m.class_id=a.class_id and m.student_id=p_student_id
      where p.id=auth.uid() and p.account_status='APPROVED'
        and r.active and r.role='TEACHER'::public.app_role
        and m.started_at <= (statement_timestamp() at time zone 'Africa/Tunis')::date
        and (m.ended_at is null or m.ended_at >= (statement_timestamp() at time zone 'Africa/Tunis')::date)
        and (m.status='ACTIVE' or m.ended_at is not null)
    )
    or exists (
      select 1 from public.profiles p
      join public.role_assignments r on r.user_id=p.id
      join public.parent_child_links l on l.parent_user_id=p.id
      join public.students s on s.id=l.student_id and s.status='ACTIVE'
      where p.id=auth.uid() and p.account_status='APPROVED'
        and r.role='PARENT'::public.app_role and r.active
        and l.student_id=p_student_id and l.active and l.verified_by is not null
    )
  );
$$;

create or replace function public.get_pickup_parent_board()
returns table (
  cycle_id uuid, student_id uuid, student_label text, class_id uuid, class_label text,
  state text, version integer, school_date date, window_start timestamptz, window_end timestamptz,
  eligible boolean, eligibility_reason text, collectors jsonb,
  arrival_at timestamptz, arrival_actor_label text, collector_label text,
  release_at timestamptz, release_actor_label text,
  can_announce_arrival boolean, can_confirm_release boolean, schedule_available boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not exists (select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
    where p.id=v_actor and p.account_status='APPROVED' and r.active and r.role='PARENT'::public.app_role) then
    raise exception 'pickup_parent_required' using errcode='P0001';
  end if;
  return query
  select c.cycle_id,c.student_id,s.full_name,c.class_id,cl.name,c.state,c.version,c.school_date,
    case when sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id then ((c.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis') end,
    case when sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id then ((c.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis') end,
    coalesce(el.eligible,false),coalesce(el.reason_code,'eligibility_unavailable'),
    coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'relationshipLabel',p.relationship_label,'validUntil',p.valid_until) order by p.display_name,p.id)
      from public.authorized_pickup_persons p where p.student_id=c.student_id and p.verified_by is not null
       and p.verified_at is not null and p.valid_from<=v_date and p.valid_until>=v_date and p.revoked_at is null),'[]'::jsonb),
    c.arrival_at,coalesce(arr.full_name,arr.username),coalesce(person.display_name,''),
    c.release_at,coalesce(rel.full_name,rel.username),
    (c.state='WAITING' and coalesce(el.eligible,false) and sched.sch->>'status'='AVAILABLE'
      and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id
      and clock_timestamp() >= ((c.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis')
      and clock_timestamp() < ((c.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis')
      and exists(select 1 from public.authorized_pickup_persons p where p.student_id=c.student_id
        and p.verified_by is not null and p.verified_at is not null and p.valid_from<=v_date
        and p.valid_until>=v_date and p.revoked_at is null)
      and public.pickup_parent_can_announce_arrival(c.student_id,
        (select p.id from public.authorized_pickup_persons p where p.student_id=c.student_id
          and p.verified_by is not null and p.verified_at is not null and p.valid_from<=v_date
          and p.valid_until>=v_date and p.revoked_at is null order by p.display_name,p.id limit 1),v_date)),
    false,(sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id)
  from public.pickup_cycles c
  join public.students s on s.id=c.student_id and s.status='ACTIVE'
  join public.school_classes cl on cl.id=c.class_id
  left join public.profiles arr on arr.id=c.arrival_actor_user_id
  left join public.profiles rel on rel.id=c.release_actor_user_id
  left join public.authorized_pickup_persons person on person.id=c.collector_id
  cross join lateral (select public.pickup_resolve_schedule(c.student_id,v_date) as sch) sched
  left join lateral (select e.eligible,e.reason_code from public.get_pickup_student_eligibility(c.student_id,v_date) e) el on true
  where c.school_date=v_date and exists(select 1 from public.parent_child_links l
    where l.parent_user_id=v_actor and l.student_id=c.student_id and l.active and l.verified_by is not null)
  order by s.full_name,c.cycle_id;
end;
$$;

create or replace function public.get_pickup_staff_board(p_class_id uuid default null)
returns table (
  cycle_id uuid, student_id uuid, student_label text, class_id uuid, class_label text,
  state text, version integer, school_date date, window_start timestamptz, window_end timestamptz,
  eligible boolean, eligibility_reason text, collectors jsonb,
  arrival_at timestamptz, arrival_actor_label text, collector_label text,
  release_at timestamptz, release_actor_label text,
  can_announce_arrival boolean, can_confirm_release boolean, schedule_available boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
    where p.id=v_actor and p.account_status='APPROVED' and r.active
      and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,
                     'ADMINISTRATIVE_PERSONNEL'::public.app_role,'TEACHER'::public.app_role)) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;
  if p_class_id is not null and not exists(select 1 from public.teacher_class_assignments a
    where a.teacher_user_id=v_actor and a.class_id=p_class_id and a.active)
    and not (public.pickup_actor_is_app_admin() or public.current_user_has_role('MANAGER'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)) then
    raise exception 'insufficient_pickup_scope' using errcode='P0001';
  end if;
  return query
  select c.cycle_id,c.student_id,s.full_name,c.class_id,cl.name,c.state,c.version,c.school_date,
    case when sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id then ((c.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis') end,
    case when sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id then ((c.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis') end,
    coalesce(el.eligible,false),coalesce(el.reason_code,'eligibility_unavailable'),
    '[]'::jsonb,c.arrival_at,coalesce(arr.full_name,arr.username),coalesce(person.display_name,''),
    c.release_at,coalesce(rel.full_name,rel.username),false,false,
    (sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id)
  from public.pickup_cycles c join public.students s on s.id=c.student_id and s.status='ACTIVE'
  join public.school_classes cl on cl.id=c.class_id
  left join public.profiles arr on arr.id=c.arrival_actor_user_id
  left join public.profiles rel on rel.id=c.release_actor_user_id
  left join public.authorized_pickup_persons person on person.id=c.collector_id
  cross join lateral (select public.pickup_resolve_schedule(c.student_id,v_date) as sch) sched
  left join lateral (select e.eligible,e.reason_code from public.get_pickup_student_eligibility(c.student_id,v_date) e) el on true
  where c.school_date=v_date and (p_class_id is null or c.class_id=p_class_id)
    and (public.pickup_actor_is_app_admin() or public.current_user_has_role('MANAGER'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or exists(select 1 from public.teacher_class_assignments a where a.teacher_user_id=v_actor
        and a.class_id=c.class_id and a.active))
  order by cl.name,s.full_name,c.cycle_id;
end;
$$;

create or replace function public.parent_arrived(
  p_cycle_id uuid, p_collector_id uuid, p_request_id uuid, p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_actor uuid:=auth.uid(); v_cycle public.pickup_cycles%rowtype; v_hash text;
  v_saved public.pickup_requests%rowtype; v_now timestamptz:=clock_timestamp();
  v_payload jsonb; v_digest_schema text; v_link_id uuid;
  v_date date:=(v_now at time zone 'Africa/Tunis')::date; v_schedule jsonb; v_elig record; v_result jsonb;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if p_cycle_id is null or p_collector_id is null or p_request_id is null or p_expected_version is null or p_expected_version<=0 then
    raise exception 'invalid_pickup_request' using errcode='P0001';
  end if;
  if not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
    where p.id=v_actor and p.account_status='APPROVED' and r.active and r.role='PARENT'::public.app_role) then
    raise exception 'pickup_parent_required' using errcode='P0001';
  end if;
  v_payload:=jsonb_build_object('cycleId',p_cycle_id,'collectorId',p_collector_id,'expectedVersion',p_expected_version);
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode='P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')',v_digest_schema)
    into v_hash using convert_to(v_payload::text,'UTF8'),'sha256';
  -- Serialize request identity across cycles, then lock the cycle. This prevents
  -- a reused request UUID on two cycles from deadlocking or recording twice.
  perform pg_advisory_xact_lock(hashtextextended('pickup-request:'||v_actor::text||':'||p_request_id::text,0));
  select * into v_cycle from public.pickup_cycles where cycle_id=p_cycle_id for update;
  if not found then raise exception 'pickup_cycle_not_found' using errcode='P0001'; end if;
  select l.id into v_link_id from public.parent_child_links l join public.students s on s.id=l.student_id
    where l.parent_user_id=v_actor and l.student_id=v_cycle.student_id and l.active
      and l.verified_by is not null and s.status='ACTIVE' for share of l;
  if not found then
    raise exception 'pickup_parent_child_link_required' using errcode='P0001';
  end if;
  select * into v_saved from public.pickup_requests r where r.actor_user_id=v_actor and r.request_id=p_request_id;
  if found then
    if v_saved.operation_type<>'ARRIVAL' or v_saved.payload_hash<>v_hash then
      raise exception 'idempotency_conflict' using errcode='P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed',true);
  end if;
  if v_cycle.state<>'WAITING' or v_cycle.version<>p_expected_version then
    v_result:=jsonb_build_object('ok',false,'code','version_conflict','cycleId',v_cycle.cycle_id,
      'state',v_cycle.state,'version',v_cycle.version,'requestId',p_request_id,'replayed',false);
    insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
      values(v_actor,p_request_id,'ARRIVAL',v_hash,v_result);
    return v_result;
  end if;
  if v_cycle.school_date<>v_date then raise exception 'schedule_unavailable' using errcode='P0001'; end if;
  v_schedule:=public.pickup_resolve_schedule(v_cycle.student_id,v_date);
  if v_schedule->>'status'<>'AVAILABLE'
     or (v_schedule->>'dismissalPolicyId')::uuid<>v_cycle.dismissal_policy_id
     or (v_schedule->>'policyRevision')::integer<>v_cycle.policy_revision
     or (v_schedule->>'membershipId')::uuid<>v_cycle.membership_id
     or (v_schedule->>'classId')::uuid<>v_cycle.class_id then
    raise exception 'schedule_unavailable' using errcode='P0001';
  end if;
  if v_now < ((v_cycle.school_date + (v_schedule->>'opensAt')::time) at time zone 'Africa/Tunis')
     or v_now >= ((v_cycle.school_date + (v_schedule->>'closesAt')::time) at time zone 'Africa/Tunis') then
    raise exception 'outside_dismissal_window' using errcode='P0001';
  end if;
  perform 1 from public.authorized_pickup_persons person
    where person.id=p_collector_id and person.student_id=v_cycle.student_id
      and person.verified_by is not null and person.verified_at is not null
      and person.valid_from<=v_date and person.valid_until>=v_date and person.revoked_at is null
    for share;
  if not found or not public.pickup_parent_can_announce_arrival(v_cycle.student_id,p_collector_id,v_date) then
    raise exception 'collector_or_parent_not_authorized' using errcode='P0001';
  end if;
  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id,v_date);
  if not coalesce(v_elig.eligible,false) then
    raise exception '%',coalesce(v_elig.reason_code,'attendance_unavailable') using errcode='P0001';
  end if;
  perform 1 from public.attendance_registers ar where ar.id=v_elig.register_id and ar.status='SUBMITTED' for share;
  if not found then raise exception 'register_not_submitted' using errcode='P0001'; end if;
  perform 1 from public.attendance_entries ae where ae.register_id=v_elig.register_id
    and ae.student_id=v_cycle.student_id and ae.membership_id=v_cycle.membership_id
    and ae.mark in ('PRESENT','LATE') for share;
  if not found then raise exception 'attendance_entry_missing_or_conflicting' using errcode='P0001'; end if;
  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id,v_date);
  if not coalesce(v_elig.eligible,false) then
    raise exception '%',coalesce(v_elig.reason_code,'attendance_unavailable') using errcode='P0001';
  end if;
  update public.pickup_cycles set state='PARENT_ARRIVED',version=version+1,
    arrival_at=v_now,arrival_actor_user_id=v_actor,collector_id=p_collector_id
    where cycle_id=p_cycle_id returning * into v_cycle;
  v_result:=jsonb_build_object('ok',true,'code','parent_arrived','cycleId',v_cycle.cycle_id,
    'studentId',v_cycle.student_id,'state',v_cycle.state,'version',v_cycle.version,
    'requestId',p_request_id,'occurredAt',v_now,'replayed',false);
  insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
    values(v_actor,p_request_id,'ARRIVAL',v_hash,v_result);
  insert into public.pickup_events(actor_user_id,actor_role,student_id,cycle_id,class_id,action,
    prior_state,new_state,prior_version,new_version,collector_id,request_id,occurred_at)
    values(v_actor,'PARENT'::public.app_role,v_cycle.student_id,v_cycle.cycle_id,v_cycle.class_id,
      'ARRIVAL_ANNOUNCED','WAITING','PARENT_ARRIVED',p_expected_version,v_cycle.version,p_collector_id,p_request_id,v_now);
  insert into public.notification_outbox(event_type,source_id,payload,created_at)
    values('pickup.arrival_announced',v_cycle.cycle_id,jsonb_build_object('cycleId',v_cycle.cycle_id,
      'studentId',v_cycle.student_id,'classId',v_cycle.class_id,'requestId',p_request_id),v_now);
  return v_result;
end;
$$;

create or replace function public.get_pickup_operation_receipt(p_request_id uuid,p_cycle_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_actor uuid:=auth.uid(); v_row public.pickup_requests%rowtype; v_cycle uuid; v_state text; v_version integer; v_student uuid;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if p_request_id is null then raise exception 'invalid_pickup_request' using errcode='P0001'; end if;
  select * into v_row from public.pickup_requests r where r.actor_user_id=v_actor and r.request_id=p_request_id;
  if not found then return jsonb_build_object('found',false,'requestId',p_request_id); end if;
  if v_row.operation_type<>'ARRIVAL' then raise exception 'pickup_receipt_unavailable' using errcode='P0001'; end if;
  v_cycle:=(v_row.result->>'cycleId')::uuid;
  if p_cycle_id is not null and p_cycle_id<>v_cycle then raise exception 'pickup_receipt_unavailable' using errcode='P0001'; end if;
  select c.state,c.version,c.student_id into v_state,v_version,v_student from public.pickup_cycles c where c.cycle_id=v_cycle;
  if not found or not exists(select 1 from public.parent_child_links l where l.parent_user_id=v_actor
    and l.student_id=v_student and l.active and l.verified_by is not null)
    or not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
      where p.id=v_actor and p.account_status='APPROVED' and r.active and r.role='PARENT'::public.app_role) then
    raise exception 'pickup_receipt_unavailable' using errcode='P0001';
  end if;
  return jsonb_build_object('found',true,'requestId',p_request_id,'operationType',v_row.operation_type,
    'result',v_row.result,'cycleId',v_cycle,'state',v_state,'version',v_version);
end;
$$;

revoke all on function public.pickup_actor_can_view_student(uuid) from public,anon,authenticated;
revoke all on function public.get_pickup_parent_board() from public,anon;
revoke all on function public.get_pickup_staff_board(uuid) from public,anon;
revoke all on function public.parent_arrived(uuid,uuid,uuid,integer) from public,anon;
revoke all on function public.get_pickup_operation_receipt(uuid,uuid) from public,anon;
grant execute on function public.get_pickup_parent_board() to authenticated;
grant execute on function public.get_pickup_staff_board(uuid) to authenticated;
grant execute on function public.parent_arrived(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.get_pickup_operation_receipt(uuid,uuid) to authenticated;
