-- G5: explicit cycle provisioning, verified physical release, and live release authority.
-- Reuses the G3 revocation/audit tables and the G4 cycle/request/event/outbox contract.

alter table public.pickup_events
  drop constraint pickup_events_action_check;
alter table public.pickup_events
  add constraint pickup_events_action_check
  check (action in (
    'CYCLE_PROVISIONED', 'ARRIVAL_ANNOUNCED', 'CHILD_RELEASED',
    'EARLY_DEPARTURE_REQUESTED', 'EARLY_DEPARTURE_REVIEWED',
    'EARLY_DEPARTURE_CANCELLED', 'OUTAGE_RECONCILED'
  ));

create or replace function public.provision_pickup_cycles(p_school_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_school_date date := coalesce(p_school_date,(clock_timestamp() at time zone 'Africa/Tunis')::date);
  v_actor_role public.app_role;
  v_student record;
  v_schedule jsonb;
  v_policy public.dismissal_policies%rowtype;
  v_membership public.student_class_memberships%rowtype;
  v_cycle_id uuid;
  v_request_id uuid;
  v_created integer := 0;
  v_skipped integer := 0;
  v_window_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if v_school_date is null then raise exception 'schedule_unavailable' using errcode='P0001'; end if;

  perform 1 from public.profiles p
   where p.id=v_actor and p.account_status='APPROVED'
   for share;
  if not found then raise exception 'pickup_provision_authority_required' using errcode='P0001'; end if;

  select r.role into v_actor_role
    from public.role_assignments r
   where r.user_id=v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1
   for share;
  if not found then raise exception 'pickup_provision_authority_required' using errcode='P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('pickup-cycle-provision:'||v_school_date::text,0));

  if exists (
    select 1 from public.school_calendar_events e
     where e.category in ('CLOSURE','HOLIDAY') and e.status='SCHEDULED'
       and e.audience_mode='WHOLE_SCHOOL'
       and v_school_date between e.start_date and e.end_date
  ) then
    raise exception 'schedule_unavailable' using errcode='P0001';
  end if;

  select count(*)::integer into v_skipped
    from public.students s
   where s.status='ACTIVE'
     and (select count(*)
            from public.student_class_memberships m
            join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
           where m.student_id=s.id
             and m.started_at<=v_school_date
             and (m.ended_at is null or m.ended_at>=v_school_date)
             and (m.status='ACTIVE' or m.ended_at is not null))>1;

  -- Only a single effective membership can bind a cycle. Ambiguous membership
  -- rows are counted as skipped; the G3 Attendance projection remains fail-closed.
  for v_student in
    select s.id as student_id,m.id as membership_id,m.class_id,m.academic_year_id
      from public.students s
      join public.student_class_memberships m on m.student_id=s.id
      join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
     where s.status='ACTIVE' and not c.is_archived
       and m.started_at<=v_school_date
       and (m.ended_at is null or m.ended_at>=v_school_date)
       and (m.status='ACTIVE' or m.ended_at is not null)
       and (
         select count(*) from public.student_class_memberships m2
         join public.school_classes c2 on c2.id=m2.class_id and c2.academic_year_id=m2.academic_year_id
         where m2.student_id=s.id
           and m2.started_at<=v_school_date
           and (m2.ended_at is null or m2.ended_at>=v_school_date)
           and (m2.status='ACTIVE' or m2.ended_at is not null)
       )=1
     order by m.class_id,s.id
     for share of s,m,c
  loop
    v_schedule:=public.pickup_resolve_schedule(v_student.student_id,v_school_date);
    if v_schedule->>'status'<>'AVAILABLE'
       or (v_schedule->>'membershipId')::uuid is distinct from v_student.membership_id
       or (v_schedule->>'classId')::uuid is distinct from v_student.class_id then
      v_skipped:=v_skipped+1;
      continue;
    end if;

    select d.* into v_policy
      from public.dismissal_policies d
     where d.id=(v_schedule->>'dismissalPolicyId')::uuid
       and d.active and d.revision=(v_schedule->>'policyRevision')::integer
     for share;
    if not found then
      v_skipped:=v_skipped+1;
      continue;
    end if;

    -- Re-resolve after locking policy and effective membership so a concurrent
    -- policy replacement/transfer cannot create a cycle bound to stale identity.
    select m.* into v_membership
      from public.student_class_memberships m
     where m.id=v_student.membership_id and m.student_id=v_student.student_id
       and m.class_id=v_student.class_id and m.academic_year_id=v_student.academic_year_id
       and m.started_at<=v_school_date and (m.ended_at is null or m.ended_at>=v_school_date)
       and (m.status='ACTIVE' or m.ended_at is not null)
     for share;
    if not found then
      v_skipped:=v_skipped+1;
      continue;
    end if;
    v_schedule:=public.pickup_resolve_schedule(v_student.student_id,v_school_date);
    if v_schedule->>'status'<>'AVAILABLE'
       or (v_schedule->>'membershipId')::uuid is distinct from v_membership.id
       or (v_schedule->>'classId')::uuid is distinct from v_membership.class_id
       or (v_schedule->>'dismissalPolicyId')::uuid is distinct from v_policy.id
       or (v_schedule->>'policyRevision')::integer is distinct from v_policy.revision then
      v_skipped:=v_skipped+1;
      continue;
    end if;
    v_window_count:=v_window_count+1;

    v_cycle_id:=gen_random_uuid();
    insert into public.pickup_cycles(
      cycle_id,student_id,school_date,class_id,academic_year_id,membership_id,
      dismissal_policy_id,policy_revision,state,version,created_at
    ) values (
      v_cycle_id,v_student.student_id,v_school_date,v_membership.class_id,
      v_membership.academic_year_id,v_membership.id,v_policy.id,v_policy.revision,
      'WAITING',1,v_now
    ) on conflict do nothing
    returning cycle_id into v_cycle_id;

    if v_cycle_id is null then
      v_skipped:=v_skipped+1;
      continue;
    end if;

    v_request_id:=v_cycle_id;
    insert into public.pickup_events(
      actor_user_id,actor_role,student_id,cycle_id,class_id,action,
      prior_state,new_state,prior_version,new_version,request_id,occurred_at
    ) values (
      v_actor,v_actor_role,v_student.student_id,v_cycle_id,v_membership.class_id,
      'CYCLE_PROVISIONED',null,'WAITING',null,1,v_request_id,v_now
    );
    v_created:=v_created+1;
  end loop;

  if v_window_count=0 then raise exception 'schedule_unavailable' using errcode='P0001'; end if;
  return jsonb_build_object(
    'ok',true,'schoolDate',v_school_date,'timezone','Africa/Tunis',
    'provisionedCount',v_created,'skippedCount',v_skipped
  );
end;
$$;

create or replace function public.release_pupil(
  p_cycle_id uuid,
  p_collector_id uuid,
  p_request_id uuid,
  p_expected_version integer,
  p_in_person_verified boolean,
  p_handoff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.app_role;
  v_cycle public.pickup_cycles%rowtype;
  v_saved public.pickup_requests%rowtype;
  v_hash text;
  v_payload jsonb;
  v_digest_schema text;
  v_now timestamptz := clock_timestamp();
  v_school_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
  v_elig record;
  v_register_id uuid;
  v_membership_id uuid;
  v_mark text;
  v_result jsonb;
  v_revoked boolean := false;
begin
  if p_in_person_verified is distinct from true then
    raise exception 'attestation_required' using errcode='P0001';
  end if;
  if p_cycle_id is null then raise exception 'invalid_pickup_request' using errcode='P0001'; end if;

  select * into v_cycle from public.pickup_cycles where cycle_id=p_cycle_id for update;
  if not found then raise exception 'pickup_cycle_not_found' using errcode='P0001'; end if;
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if p_collector_id is null or p_request_id is null or p_expected_version is null or p_expected_version<=0 then
    raise exception 'invalid_pickup_request' using errcode='P0001';
  end if;

  v_payload:=jsonb_build_object(
    'cycleId',p_cycle_id,'collectorId',p_collector_id,
    'expectedVersion',p_expected_version,'inPersonVerified',p_in_person_verified,
    'handoffNotes',p_handoff_notes
  );
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode='P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')',v_digest_schema)
    into v_hash using convert_to(v_payload::text,'UTF8'),'sha256';

  -- Follow G5 ordering: cycle lock first, then serialize the actor/request key.
  perform pg_advisory_xact_lock(hashtextextended('pickup-request:'||v_actor::text||':'||p_request_id::text,0));
  select * into v_saved from public.pickup_requests r
   where r.actor_user_id=v_actor and r.request_id=p_request_id;
  if found then
    if v_saved.operation_type<>'RELEASE' or v_saved.payload_hash<>v_hash then
      raise exception 'idempotency_conflict' using errcode='P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed',true);
  end if;

  -- Lock the profile row before checking authority. G3 revocation RPCs lock the
  -- same target profile before the revocation row, so a committed revocation
  -- always wins if it queued before this release's shared lock.
  perform 1 from public.profiles p where p.id=v_actor and p.account_status='APPROVED' for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode='P0001'; end if;

  select r.role into v_actor_role from public.role_assignments r
   where r.user_id=v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1 for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode='P0001'; end if;

  select rev.is_revoked into v_revoked from public.pickup_release_revocations rev
   where rev.target_user_id=v_actor for share;
  if coalesce(v_revoked,false) then raise exception 'pickup_release_authority_revoked' using errcode='P0001'; end if;

  if v_cycle.state='WAITING' then
    v_result:=jsonb_build_object('ok',false,'code','arrival_required','cycleId',v_cycle.cycle_id,
      'state',v_cycle.state,'version',v_cycle.version,'requestId',p_request_id,'replayed',false);
    insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
      values(v_actor,p_request_id,'RELEASE',v_hash,v_result);
    return v_result;
  elsif v_cycle.state='RELEASED' then
    v_result:=jsonb_build_object('ok',false,'code','already_released','cycleId',v_cycle.cycle_id,
      'state',v_cycle.state,'version',v_cycle.version,'requestId',p_request_id,'replayed',false);
    insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
      values(v_actor,p_request_id,'RELEASE',v_hash,v_result);
    return v_result;
  elsif v_cycle.version<>p_expected_version then
    v_result:=jsonb_build_object('ok',false,'code','version_conflict','cycleId',v_cycle.cycle_id,
      'state',v_cycle.state,'version',v_cycle.version,'requestId',p_request_id,'replayed',false);
    insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
      values(v_actor,p_request_id,'RELEASE',v_hash,v_result);
    return v_result;
  end if;

  if v_cycle.state<>'PARENT_ARRIVED' then raise exception 'arrival_required' using errcode='P0001'; end if;

  perform 1 from public.authorized_pickup_persons person
   where person.id=p_collector_id and person.student_id=v_cycle.student_id
     and person.verified_by is not null and person.verified_at is not null
     and person.valid_from<=v_school_date and person.valid_until>=v_school_date
     and person.revoked_at is null
   for share;
  if not found or v_cycle.collector_id is distinct from p_collector_id then
    raise exception 'collector_invalid' using errcode='P0001';
  end if;

  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id,v_cycle.school_date);
  if not coalesce(v_elig.eligible,false)
     or v_elig.membership_id is distinct from v_cycle.membership_id
     or v_elig.class_id is distinct from v_cycle.class_id then
    raise exception 'attendance_ineligible' using errcode='P0001';
  end if;
  v_register_id:=v_elig.register_id;
  v_membership_id:=v_elig.membership_id;

  perform 1 from public.attendance_registers ar
   where ar.id=v_register_id and ar.status='SUBMITTED'
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode='P0001'; end if;
  perform 1 from public.attendance_entries ae
   where ae.register_id=v_register_id and ae.student_id=v_cycle.student_id
     and ae.membership_id=v_membership_id and ae.mark in ('PRESENT','LATE')
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode='P0001'; end if;

  -- Re-read the Attendance-owned projection after taking shared row locks. An
  -- Attendance correction that committed first is now observed and blocks release.
  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id,v_cycle.school_date);
  if not coalesce(v_elig.eligible,false)
     or v_elig.membership_id is distinct from v_cycle.membership_id
     or v_elig.class_id is distinct from v_cycle.class_id
     or v_elig.register_id is distinct from v_register_id
     or v_elig.attendance_mark not in ('PRESENT','LATE') then
    raise exception 'attendance_ineligible' using errcode='P0001';
  end if;

  update public.pickup_cycles set state='RELEASED',version=version+1,
    release_at=v_now,release_actor_user_id=v_actor
   where cycle_id=p_cycle_id returning * into v_cycle;
  v_result:=jsonb_build_object('ok',true,'code','pupil_released','cycleId',v_cycle.cycle_id,
    'studentId',v_cycle.student_id,'state',v_cycle.state,'version',v_cycle.version,
    'requestId',p_request_id,'occurredAt',v_now,'replayed',false);
  insert into public.pickup_requests(actor_user_id,request_id,operation_type,payload_hash,result)
    values(v_actor,p_request_id,'RELEASE',v_hash,v_result);
  insert into public.pickup_events(actor_user_id,actor_role,student_id,cycle_id,class_id,action,
    prior_state,new_state,prior_version,new_version,collector_id,request_id,reason,occurred_at)
    values(v_actor,v_actor_role,v_cycle.student_id,v_cycle.cycle_id,v_cycle.class_id,'CHILD_RELEASED',
      'PARENT_ARRIVED','RELEASED',p_expected_version,v_cycle.version,p_collector_id,p_request_id,
      p_handoff_notes,v_now);
  insert into public.notification_outbox(event_type,source_id,payload,created_at)
    values('pickup.child_released',v_cycle.cycle_id,jsonb_build_object(
      'cycleId',v_cycle.cycle_id,'studentId',v_cycle.student_id,'classId',v_cycle.class_id,
      'requestId',p_request_id
    ),v_now);
  return v_result;
end;
$$;

-- G3 already owns the revocation rows and immutable audit history. These stable
-- G5 operation names delegate to those audited commands instead of duplicating rules.
create or replace function public.revoke_pickup_release_authority(p_target_user_id uuid,p_reason text)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.revoke_user_pickup_release_authority(p_target_user_id,p_reason); $$;

create or replace function public.reinstate_pickup_release_authority(p_target_user_id uuid,p_reason text)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.reinstate_user_pickup_release_authority(p_target_user_id,p_reason); $$;

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
    c.release_at,coalesce(rel.full_name,rel.username),false,
    coalesce((c.state='PARENT_ARRIVED' and coalesce(el.eligible,false)
      and el.membership_id=c.membership_id and el.class_id=c.class_id
      and public.pickup_actor_can_confirm_release()
      and person.id=c.collector_id and person.verified_by is not null and person.verified_at is not null
      and person.valid_from<=v_date and person.valid_until>=v_date and person.revoked_at is null),false),
    (sched.sch->>'status'='AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid=c.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer=c.policy_revision and (sched.sch->>'membershipId')::uuid=c.membership_id
      and (sched.sch->>'classId')::uuid=c.class_id)
  from public.pickup_cycles c join public.students s on s.id=c.student_id and s.status='ACTIVE'
  join public.school_classes cl on cl.id=c.class_id
  left join public.profiles arr on arr.id=c.arrival_actor_user_id
  left join public.profiles rel on rel.id=c.release_actor_user_id
  left join public.authorized_pickup_persons person on person.id=c.collector_id
  cross join lateral (select public.pickup_resolve_schedule(c.student_id,v_date) as sch) sched
  left join lateral (select e.eligible,e.reason_code,e.membership_id,e.class_id
    from public.get_pickup_student_eligibility(c.student_id,v_date) e) el on true
  where c.school_date=v_date and (p_class_id is null or c.class_id=p_class_id)
    and (public.pickup_actor_is_app_admin() or public.current_user_has_role('MANAGER'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or exists(select 1 from public.teacher_class_assignments a where a.teacher_user_id=v_actor
        and a.class_id=c.class_id and a.active))
  order by cl.name,s.full_name,c.cycle_id;
end;
$$;

create or replace function public.get_pickup_operation_receipt(p_request_id uuid,p_cycle_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_actor uuid:=auth.uid(); v_row public.pickup_requests%rowtype;
  v_cycle uuid; v_state text; v_version integer; v_student uuid;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if p_request_id is null then raise exception 'invalid_pickup_request' using errcode='P0001'; end if;
  select * into v_row from public.pickup_requests r
   where r.actor_user_id=v_actor and r.request_id=p_request_id;
  if not found then return jsonb_build_object('found',false,'requestId',p_request_id); end if;
  if v_row.operation_type not in ('ARRIVAL','RELEASE') then
    raise exception 'pickup_receipt_unavailable' using errcode='P0001';
  end if;
  v_cycle:=(v_row.result->>'cycleId')::uuid;
  if p_cycle_id is not null and p_cycle_id<>v_cycle then raise exception 'pickup_receipt_unavailable' using errcode='P0001'; end if;
  select c.state,c.version,c.student_id into v_state,v_version,v_student
    from public.pickup_cycles c where c.cycle_id=v_cycle;
  if not found then raise exception 'pickup_receipt_unavailable' using errcode='P0001'; end if;

  if v_row.operation_type='ARRIVAL' then
    if not exists(select 1 from public.parent_child_links l where l.parent_user_id=v_actor
      and l.student_id=v_student and l.active and l.verified_by is not null)
      or not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
        where p.id=v_actor and p.account_status='APPROVED' and r.active and r.role='PARENT'::public.app_role) then
      raise exception 'pickup_receipt_unavailable' using errcode='P0001';
    end if;
  else
    -- A release receipt is limited to the authenticated actor's own request.
    -- Approval is rechecked, while a later Pickup-specific revocation does not
    -- erase readback of an already committed handoff.
    if not exists(select 1 from public.profiles p where p.id=v_actor and p.account_status='APPROVED')
      or not exists(select 1 from public.role_assignments r where r.user_id=v_actor and r.active
        and r.role in ('APP_ADMIN'::public.app_role,'MANAGER'::public.app_role,
                       'ADMINISTRATIVE_PERSONNEL'::public.app_role)) then
      raise exception 'pickup_receipt_unavailable' using errcode='P0001';
    end if;
  end if;
  return jsonb_build_object('found',true,'requestId',p_request_id,'operationType',v_row.operation_type,
    'result',v_row.result,'cycleId',v_cycle,'state',v_state,'version',v_version);
end;
$$;

revoke all on function public.provision_pickup_cycles(date) from public,anon;
revoke all on function public.release_pupil(uuid,uuid,uuid,integer,boolean,text) from public,anon;
revoke all on function public.revoke_pickup_release_authority(uuid,text) from public,anon;
revoke all on function public.reinstate_pickup_release_authority(uuid,text) from public,anon;
revoke all on function public.get_pickup_staff_board(uuid) from public,anon;
revoke all on function public.get_pickup_operation_receipt(uuid,uuid) from public,anon;
grant execute on function public.provision_pickup_cycles(date) to authenticated;
grant execute on function public.release_pupil(uuid,uuid,uuid,integer,boolean,text) to authenticated;
grant execute on function public.revoke_pickup_release_authority(uuid,text) to authenticated;
grant execute on function public.reinstate_pickup_release_authority(uuid,text) to authenticated;
grant execute on function public.get_pickup_staff_board(uuid) to authenticated;
grant execute on function public.get_pickup_operation_receipt(uuid,uuid) to authenticated;
