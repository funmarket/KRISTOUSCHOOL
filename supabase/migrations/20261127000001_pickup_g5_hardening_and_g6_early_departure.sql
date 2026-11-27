-- G5 Hardening (G5-A/B) & G6 Early Departure Backend.
-- Extends early_departure_requests, hardens release_pupil (stale-date, schedule, live-authority replay),
-- skips COMPLETED early departures in provision_pickup_cycles, exposes early_departure on boards,
-- and adds request_early_departure, review_early_departure, complete_early_departure_release, get_pickup_early_departures.

alter table public.early_departure_requests
  add column if not exists school_date date not null default (clock_timestamp() at time zone 'Africa/Tunis')::date,
  add column if not exists requested_pickup_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists released_by_user_id uuid references public.profiles(id) on delete restrict,
  add column if not exists handoff_notes text;

do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.early_departure_requests'::regclass
       and contype = 'c'
  loop
    execute format('alter table public.early_departure_requests drop constraint %I', r.conname);
  end loop;
end $$;

update public.early_departure_requests
   set status = 'PENDING'
 where status = 'SUBMITTED';

alter table public.early_departure_requests
  alter column status set default 'PENDING',
  add constraint early_departure_requests_reason_check
    check (char_length(btrim(reason)) between 3 and 500),
  add constraint early_departure_requests_status_check
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')),
  add constraint early_departure_requests_version_check
    check (version > 0),
  add constraint early_departure_requests_state_consistency_check
    check (
      (status = 'PENDING' and reviewed_by is null and reviewed_at is null and review_reason is null
        and cancelled_by is null and cancelled_at is null and cancellation_reason is null
        and completed_at is null and released_by_user_id is null)
      or (status in ('APPROVED', 'REJECTED') and reviewed_by is not null and reviewed_at is not null
        and cancelled_by is null and cancelled_at is null and cancellation_reason is null
        and completed_at is null and released_by_user_id is null)
      or (status = 'COMPLETED' and reviewed_by is not null and reviewed_at is not null
        and cancelled_by is null and cancelled_at is null and cancellation_reason is null
        and completed_at is not null and released_by_user_id is not null)
      or (status = 'CANCELLED' and cancelled_by is not null and cancelled_at is not null
        and char_length(btrim(coalesce(cancellation_reason, ''))) between 3 and 500
        and completed_at is null and released_by_user_id is null)
    );

drop index if exists public.early_departure_one_open_per_student;
create unique index early_departure_one_open_per_student
  on public.early_departure_requests (student_id, school_date)
  where status in ('PENDING', 'APPROVED');

create index if not exists early_departure_requests_date_idx
  on public.early_departure_requests (school_date, status, created_at desc);

create or replace function public.pickup_touch_early_departure_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('REJECTED', 'CANCELLED', 'COMPLETED') then
    raise exception 'early_departure_terminal' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.student_id is distinct from old.student_id
     or new.membership_id is distinct from old.membership_id
     or new.school_date is distinct from old.school_date
     or new.requested_by is distinct from old.requested_by
     or (old.cycle_id is not null and new.cycle_id is distinct from old.cycle_id)
     or new.collector_id is distinct from old.collector_id
     or new.reason is distinct from old.reason
     or new.requested_pickup_at is distinct from old.requested_pickup_at
     or new.created_at is distinct from old.created_at then
    raise exception 'early_departure_identity_immutable' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'early_departure_version_must_increment' using errcode = 'P0001';
  end if;
  if not (
    (old.status = 'PENDING' and new.status in ('APPROVED', 'REJECTED', 'CANCELLED'))
    or (old.status = 'APPROVED' and new.status in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'early_departure_transition_invalid' using errcode = 'P0001';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

alter table public.pickup_events
  drop constraint pickup_events_action_check;
alter table public.pickup_events
  add constraint pickup_events_action_check
  check (action in (
    'CYCLE_PROVISIONED', 'ARRIVAL_ANNOUNCED', 'CHILD_RELEASED',
    'EARLY_DEPARTURE_REQUESTED', 'EARLY_DEPARTURE_REVIEWED',
    'EARLY_DEPARTURE_COMPLETED', 'EARLY_DEPARTURE_CANCELLED',
    'OUTAGE_RECONCILED'
  ));

create or replace function public.provision_pickup_cycles(p_school_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_school_date date := coalesce(p_school_date, (clock_timestamp() at time zone 'Africa/Tunis')::date);
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
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if v_school_date is null then raise exception 'schedule_unavailable' using errcode = 'P0001'; end if;

  perform 1 from public.profiles p
   where p.id = v_actor and p.account_status = 'APPROVED'
   for share;
  if not found then raise exception 'pickup_provision_authority_required' using errcode = 'P0001'; end if;

  select r.role into v_actor_role
    from public.role_assignments r
   where r.user_id = v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1
   for share;
  if not found then raise exception 'pickup_provision_authority_required' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('pickup-cycle-provision:' || v_school_date::text, 0));

  if exists (
    select 1 from public.school_calendar_events e
     where e.category in ('CLOSURE', 'HOLIDAY') and e.status = 'SCHEDULED'
       and e.audience_mode = 'WHOLE_SCHOOL'
       and v_school_date between e.start_date and e.end_date
  ) then
    raise exception 'schedule_unavailable' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_skipped
    from public.students s
   where s.status = 'ACTIVE'
     and (select count(*)
            from public.student_class_memberships m
            join public.school_classes c on c.id = m.class_id and c.academic_year_id = m.academic_year_id
           where m.student_id = s.id
             and m.started_at <= v_school_date
             and (m.ended_at is null or m.ended_at >= v_school_date)
             and (m.status = 'ACTIVE' or m.ended_at is not null)) > 1;

  for v_student in
    select s.id as student_id, m.id as membership_id, m.class_id, m.academic_year_id
      from public.students s
      join public.student_class_memberships m on m.student_id = s.id
      join public.school_classes c on c.id = m.class_id and c.academic_year_id = m.academic_year_id
     where s.status = 'ACTIVE' and not c.is_archived
       and m.started_at <= v_school_date
       and (m.ended_at is null or m.ended_at >= v_school_date)
       and (m.status = 'ACTIVE' or m.ended_at is not null)
       and (
         select count(*) from public.student_class_memberships m2
         join public.school_classes c2 on c2.id = m2.class_id and c2.academic_year_id = m2.academic_year_id
         where m2.student_id = s.id
           and m2.started_at <= v_school_date
           and (m2.ended_at is null or m2.ended_at >= v_school_date)
           and (m2.status = 'ACTIVE' or m2.ended_at is not null)
       ) = 1
     order by m.class_id, s.id
     for share of s, m, c
  loop
    v_schedule := public.pickup_resolve_schedule(v_student.student_id, v_school_date);
    if v_schedule->>'status' <> 'AVAILABLE'
       or (v_schedule->>'membershipId')::uuid is distinct from v_student.membership_id
       or (v_schedule->>'classId')::uuid is distinct from v_student.class_id then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select d.* into v_policy
      from public.dismissal_policies d
     where d.id = (v_schedule->>'dismissalPolicyId')::uuid
       and d.active and d.revision = (v_schedule->>'policyRevision')::integer
     for share;
    if not found then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select m.* into v_membership
      from public.student_class_memberships m
     where m.id = v_student.membership_id and m.student_id = v_student.student_id
       and m.class_id = v_student.class_id and m.academic_year_id = v_student.academic_year_id
       and m.started_at <= v_school_date and (m.ended_at is null or m.ended_at >= v_school_date)
       and (m.status = 'ACTIVE' or m.ended_at is not null)
     for share;
    if not found then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_schedule := public.pickup_resolve_schedule(v_student.student_id, v_school_date);
    if v_schedule->>'status' <> 'AVAILABLE'
       or (v_schedule->>'membershipId')::uuid is distinct from v_membership.id
       or (v_schedule->>'classId')::uuid is distinct from v_membership.class_id
       or (v_schedule->>'dismissalPolicyId')::uuid is distinct from v_policy.id
       or (v_schedule->>'policyRevision')::integer is distinct from v_policy.revision then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_window_count := v_window_count + 1;

    -- Do not provision a normal cycle if the student has already completed an early departure today.
    if exists (
      select 1 from public.early_departure_requests ed
       where ed.student_id = v_student.student_id
         and ed.school_date = v_school_date
         and ed.status = 'COMPLETED'
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_cycle_id := gen_random_uuid();
    insert into public.pickup_cycles(
      cycle_id, student_id, school_date, class_id, academic_year_id, membership_id,
      dismissal_policy_id, policy_revision, state, version, created_at
    ) values (
      v_cycle_id, v_student.student_id, v_school_date, v_membership.class_id,
      v_membership.academic_year_id, v_membership.id, v_policy.id, v_policy.revision,
      'WAITING', 1, v_now
    ) on conflict do nothing
    returning cycle_id into v_cycle_id;

    if v_cycle_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_request_id := v_cycle_id;
    insert into public.pickup_events(
      actor_user_id, actor_role, student_id, cycle_id, class_id, action,
      prior_state, new_state, prior_version, new_version, request_id, occurred_at
    ) values (
      v_actor, v_actor_role, v_student.student_id, v_cycle_id, v_membership.class_id,
      'CYCLE_PROVISIONED', null, 'WAITING', null, 1, v_request_id, v_now
    );
    v_created := v_created + 1;
  end loop;

  if v_window_count = 0 then raise exception 'schedule_unavailable' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'ok', true, 'schoolDate', v_school_date, 'timezone', 'Africa/Tunis',
    'provisionedCount', v_created, 'skippedCount', v_skipped
  );
end;
$$;

-- G5-A + G5-B: Enforce live actor authority BEFORE replay lookup, reject stale cycle dates,
-- and revalidate active schedule/policy/closure while keeping post-window release allowed today.
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
  v_schedule jsonb;
  v_elig record;
  v_register_id uuid;
  v_membership_id uuid;
  v_result jsonb;
  v_revoked boolean := false;
begin
  if p_in_person_verified is distinct from true then
    raise exception 'attestation_required' using errcode = 'P0001';
  end if;
  if p_cycle_id is null then raise exception 'invalid_pickup_request' using errcode = 'P0001'; end if;

  select * into v_cycle from public.pickup_cycles where cycle_id = p_cycle_id for update;
  if not found then raise exception 'pickup_cycle_not_found' using errcode = 'P0001'; end if;
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if p_collector_id is null or p_request_id is null or p_expected_version is null or p_expected_version <= 0 then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'cycleId', p_cycle_id, 'collectorId', p_collector_id,
    'expectedVersion', p_expected_version, 'inPersonVerified', p_in_person_verified,
    'handoffNotes', p_handoff_notes
  );
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode = 'P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')', v_digest_schema)
    into v_hash using convert_to(v_payload::text, 'UTF8'), 'sha256';

  perform pg_advisory_xact_lock(hashtextextended('pickup-request:' || v_actor::text || ':' || p_request_id::text, 0));

  -- G5-B: Live actor approval, role, and revocation checks MUST run before idempotent replay lookup.
  perform 1 from public.profiles p where p.id = v_actor and p.account_status = 'APPROVED' for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select r.role into v_actor_role from public.role_assignments r
   where r.user_id = v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1 for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select rev.is_revoked into v_revoked from public.pickup_release_revocations rev
   where rev.target_user_id = v_actor for share;
  if coalesce(v_revoked, false) then raise exception 'pickup_release_authority_revoked' using errcode = 'P0001'; end if;

  select * into v_saved from public.pickup_requests r
   where r.actor_user_id = v_actor and r.request_id = p_request_id;
  if found then
    if v_saved.operation_type <> 'RELEASE' or v_saved.payload_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed', true);
  end if;

  if v_cycle.state = 'WAITING' then
    v_result := jsonb_build_object('ok', false, 'code', 'arrival_required', 'cycleId', v_cycle.cycle_id,
      'state', v_cycle.state, 'version', v_cycle.version, 'requestId', p_request_id, 'replayed', false);
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'RELEASE', v_hash, v_result);
    return v_result;
  elsif v_cycle.state = 'RELEASED' then
    v_result := jsonb_build_object('ok', false, 'code', 'already_released', 'cycleId', v_cycle.cycle_id,
      'state', v_cycle.state, 'version', v_cycle.version, 'requestId', p_request_id, 'replayed', false);
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'RELEASE', v_hash, v_result);
    return v_result;
  elsif v_cycle.version <> p_expected_version then
    v_result := jsonb_build_object('ok', false, 'code', 'version_conflict', 'cycleId', v_cycle.cycle_id,
      'state', v_cycle.state, 'version', v_cycle.version, 'requestId', p_request_id, 'replayed', false);
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'RELEASE', v_hash, v_result);
    return v_result;
  end if;

  if v_cycle.state <> 'PARENT_ARRIVED' then raise exception 'arrival_required' using errcode = 'P0001'; end if;

  -- G5-A: Reject stale prior-day cycles and invalidated/closed schedules while allowing post-window release today.
  if v_cycle.school_date is distinct from v_school_date then
    raise exception 'cycle_date_mismatch' using errcode = 'P0001';
  end if;
  v_schedule := public.pickup_resolve_schedule(v_cycle.student_id, v_cycle.school_date);
  if v_schedule->>'status' <> 'AVAILABLE'
     or (v_schedule->>'dismissalPolicyId')::uuid is distinct from v_cycle.dismissal_policy_id
     or (v_schedule->>'policyRevision')::integer is distinct from v_cycle.policy_revision
     or (v_schedule->>'membershipId')::uuid is distinct from v_cycle.membership_id
     or (v_schedule->>'classId')::uuid is distinct from v_cycle.class_id then
    raise exception 'schedule_unavailable' using errcode = 'P0001';
  end if;

  perform 1 from public.authorized_pickup_persons person
   where person.id = p_collector_id and person.student_id = v_cycle.student_id
     and person.verified_by is not null and person.verified_at is not null
     and person.valid_from <= v_school_date and person.valid_until >= v_school_date
     and person.revoked_at is null
   for share;
  if not found or v_cycle.collector_id is distinct from p_collector_id then
    raise exception 'collector_invalid' using errcode = 'P0001';
  end if;

  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id, v_cycle.school_date);
  if not coalesce(v_elig.eligible, false)
     or v_elig.membership_id is distinct from v_cycle.membership_id
     or v_elig.class_id is distinct from v_cycle.class_id then
    raise exception 'attendance_ineligible' using errcode = 'P0001';
  end if;
  v_register_id := v_elig.register_id;
  v_membership_id := v_elig.membership_id;

  perform 1 from public.attendance_registers ar
   where ar.id = v_register_id and ar.status = 'SUBMITTED'
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode = 'P0001'; end if;
  perform 1 from public.attendance_entries ae
   where ae.register_id = v_register_id and ae.student_id = v_cycle.student_id
     and ae.membership_id = v_membership_id and ae.mark in ('PRESENT', 'LATE')
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode = 'P0001'; end if;

  select * into v_elig from public.get_pickup_student_eligibility(v_cycle.student_id, v_cycle.school_date);
  if not coalesce(v_elig.eligible, false)
     or v_elig.membership_id is distinct from v_cycle.membership_id
     or v_elig.class_id is distinct from v_cycle.class_id
     or v_elig.register_id is distinct from v_register_id
     or v_elig.attendance_mark not in ('PRESENT', 'LATE') then
    raise exception 'attendance_ineligible' using errcode = 'P0001';
  end if;

  update public.pickup_cycles
     set state = 'RELEASED', version = version + 1,
         release_at = v_now, release_actor_user_id = v_actor
   where cycle_id = p_cycle_id
   returning * into v_cycle;
  v_result := jsonb_build_object('ok', true, 'code', 'pupil_released', 'cycleId', v_cycle.cycle_id,
    'studentId', v_cycle.student_id, 'state', v_cycle.state, 'version', v_cycle.version,
    'requestId', p_request_id, 'occurredAt', v_now, 'replayed', false);
  insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
    values(v_actor, p_request_id, 'RELEASE', v_hash, v_result);
  insert into public.pickup_events(actor_user_id, actor_role, student_id, cycle_id, class_id, action,
    prior_state, new_state, prior_version, new_version, collector_id, request_id, reason, occurred_at)
    values(v_actor, v_actor_role, v_cycle.student_id, v_cycle.cycle_id, v_cycle.class_id, 'CHILD_RELEASED',
      'PARENT_ARRIVED', 'RELEASED', p_expected_version, v_cycle.version, p_collector_id, p_request_id,
      p_handoff_notes, v_now);
  insert into public.notification_outbox(event_type, source_id, payload, created_at)
    values('pickup.child_released', v_cycle.cycle_id, jsonb_build_object(
      'cycleId', v_cycle.cycle_id, 'studentId', v_cycle.student_id, 'classId', v_cycle.class_id,
      'requestId', p_request_id
    ), v_now);
  return v_result;
end;
$$;

drop function if exists public.get_pickup_parent_board();
create function public.get_pickup_parent_board()
returns table (
  cycle_id uuid, student_id uuid, student_label text, class_id uuid, class_label text,
  state text, version integer, school_date date, window_start timestamptz, window_end timestamptz,
  eligible boolean, eligibility_reason text, collectors jsonb,
  arrival_at timestamptz, arrival_actor_label text, collector_label text,
  release_at timestamptz, release_actor_label text,
  can_announce_arrival boolean, can_confirm_release boolean, schedule_available boolean,
  early_departure jsonb
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles p join public.role_assignments r on r.user_id = p.id
    where p.id = v_actor and p.account_status = 'APPROVED' and r.active and r.role = 'PARENT'::public.app_role) then
    raise exception 'pickup_parent_required' using errcode = 'P0001';
  end if;
  return query
  with scoped_cycles as materialized (
    select c.cycle_id, c.student_id, s.full_name as student_name, c.class_id, cl.name as class_name,
      c.state, c.version, c.school_date, c.dismissal_policy_id, c.policy_revision, c.membership_id,
      c.arrival_at, c.arrival_actor_user_id, c.collector_id, c.release_at, c.release_actor_user_id
    from public.pickup_cycles c
    join public.students s on s.id = c.student_id and s.status = 'ACTIVE'
    join public.school_classes cl on cl.id = c.class_id
    where c.school_date = v_date
      and exists(select 1 from public.parent_child_links l
        where l.parent_user_id = v_actor and l.student_id = c.student_id and l.active and l.verified_by is not null)
  )
  select sc.cycle_id, sc.student_id, sc.student_name, sc.class_id, sc.class_name, sc.state, sc.version, sc.school_date,
    case when sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id then ((sc.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis') end,
    case when sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id then ((sc.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis') end,
    coalesce(el.eligible, false), coalesce(el.reason_code, 'eligibility_unavailable'),
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'displayName', p.display_name, 'relationshipLabel', p.relationship_label, 'validUntil', p.valid_until) order by p.display_name, p.id)
      from public.authorized_pickup_persons p where p.student_id = sc.student_id and p.verified_by is not null
       and p.verified_at is not null and p.valid_from <= v_date and p.valid_until >= v_date and p.revoked_at is null), '[]'::jsonb),
    sc.arrival_at, coalesce(arr.full_name, arr.username), coalesce(person.display_name, ''),
    sc.release_at, coalesce(rel.full_name, rel.username),
    (sc.state = 'WAITING' and coalesce(el.eligible, false) and sched.sch->>'status' = 'AVAILABLE'
      and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id
      and clock_timestamp() >= ((sc.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis')
      and clock_timestamp() < ((sc.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis')
      and exists(select 1 from public.authorized_pickup_persons p where p.student_id = sc.student_id
        and p.verified_by is not null and p.verified_at is not null and p.valid_from <= v_date
        and p.valid_until >= v_date and p.revoked_at is null)
      and public.pickup_parent_can_announce_arrival(sc.student_id,
        (select p.id from public.authorized_pickup_persons p where p.student_id = sc.student_id
          and p.verified_by is not null and p.verified_at is not null and p.valid_from <= v_date
          and p.valid_until >= v_date and p.revoked_at is null order by p.display_name, p.id limit 1), v_date)),
    false,
    (sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id),
    ed_proj.early_departure
  from scoped_cycles sc
  left join public.profiles arr on arr.id = sc.arrival_actor_user_id
  left join public.profiles rel on rel.id = sc.release_actor_user_id
  left join public.authorized_pickup_persons person on person.id = sc.collector_id
  cross join lateral (select public.pickup_resolve_schedule(sc.student_id, v_date) as sch) sched
  left join lateral (select e.eligible, e.reason_code from public.get_pickup_student_eligibility(sc.student_id, v_date) e) el on true
  left join lateral (
    select jsonb_build_object(
      'id', ed.id,
      'studentId', ed.student_id,
      'schoolDate', ed.school_date,
      'collectorId', ed.collector_id,
      'collectorLabel', coalesce(ed_col.display_name, ''),
      'reason', ed.reason,
      'requestedPickupAt', ed.requested_pickup_at,
      'status', ed.status,
      'version', ed.version,
      'reviewedAt', ed.reviewed_at,
      'reviewReason', ed.review_reason,
      'completedAt', ed.completed_at,
      'createdAt', ed.created_at
    ) as early_departure
    from public.early_departure_requests ed
    left join public.authorized_pickup_persons ed_col on ed_col.id = ed.collector_id
    where ed.student_id = sc.student_id and ed.school_date = sc.school_date
    order by ed.created_at desc, ed.id desc
    limit 1
  ) ed_proj on true
  order by sc.student_name, sc.cycle_id;
end;
$$;

drop function if exists public.get_pickup_staff_board(uuid);
create function public.get_pickup_staff_board(p_class_id uuid default null)
returns table (
  cycle_id uuid, student_id uuid, student_label text, class_id uuid, class_label text,
  state text, version integer, school_date date, window_start timestamptz, window_end timestamptz,
  eligible boolean, eligibility_reason text, collectors jsonb,
  arrival_at timestamptz, arrival_actor_label text, collector_label text,
  release_at timestamptz, release_actor_label text,
  can_announce_arrival boolean, can_confirm_release boolean, schedule_available boolean,
  early_departure jsonb
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id = p.id
    where p.id = v_actor and p.account_status = 'APPROVED' and r.active
      and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                     'ADMINISTRATIVE_PERSONNEL'::public.app_role, 'TEACHER'::public.app_role)) then
    raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
  end if;
  if p_class_id is not null and not exists(select 1 from public.teacher_class_assignments a
    where a.teacher_user_id = v_actor and a.class_id = p_class_id and a.active)
    and not (public.pickup_actor_is_app_admin() or public.current_user_has_role('MANAGER'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)) then
    raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
  end if;
  return query
  with scoped_cycles as materialized (
    select c.cycle_id, c.student_id, s.full_name as student_name, c.class_id, cl.name as class_name,
      c.state, c.version, c.school_date, c.dismissal_policy_id, c.policy_revision, c.membership_id,
      c.arrival_at, c.arrival_actor_user_id, c.collector_id, c.release_at, c.release_actor_user_id
    from public.pickup_cycles c
    join public.students s on s.id = c.student_id and s.status = 'ACTIVE'
    join public.school_classes cl on cl.id = c.class_id
    where c.school_date = v_date and (p_class_id is null or c.class_id = p_class_id)
      and (public.pickup_actor_is_app_admin() or public.current_user_has_role('MANAGER'::public.app_role)
        or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
        or exists(select 1 from public.teacher_class_assignments a where a.teacher_user_id = v_actor
          and a.class_id = c.class_id and a.active))
  )
  select sc.cycle_id, sc.student_id, sc.student_name, sc.class_id, sc.class_name, sc.state, sc.version, sc.school_date,
    case when sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id then ((sc.school_date + (sched.sch->>'opensAt')::time) at time zone 'Africa/Tunis') end,
    case when sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id then ((sc.school_date + (sched.sch->>'closesAt')::time) at time zone 'Africa/Tunis') end,
    coalesce(el.eligible, false), coalesce(el.reason_code, 'eligibility_unavailable'),
    '[]'::jsonb, sc.arrival_at, coalesce(arr.full_name, arr.username), coalesce(person.display_name, ''),
    sc.release_at, coalesce(rel.full_name, rel.username), false,
    coalesce((sc.state = 'PARENT_ARRIVED' and coalesce(el.eligible, false)
      and el.membership_id = sc.membership_id and el.class_id = sc.class_id
      and public.pickup_actor_can_confirm_release()
      and person.id = sc.collector_id and person.verified_by is not null and person.verified_at is not null
      and person.valid_from <= v_date and person.valid_until >= v_date and person.revoked_at is null), false),
    (sched.sch->>'status' = 'AVAILABLE' and (sched.sch->>'dismissalPolicyId')::uuid = sc.dismissal_policy_id
      and (sched.sch->>'policyRevision')::integer = sc.policy_revision and (sched.sch->>'membershipId')::uuid = sc.membership_id
      and (sched.sch->>'classId')::uuid = sc.class_id),
    ed_proj.early_departure
  from scoped_cycles sc
  left join public.profiles arr on arr.id = sc.arrival_actor_user_id
  left join public.profiles rel on rel.id = sc.release_actor_user_id
  left join public.authorized_pickup_persons person on person.id = sc.collector_id
  cross join lateral (select public.pickup_resolve_schedule(sc.student_id, v_date) as sch) sched
  left join lateral (select e.eligible, e.reason_code, e.membership_id, e.class_id
    from public.get_pickup_student_eligibility(sc.student_id, v_date) e) el on true
  left join lateral (
    select jsonb_build_object(
      'id', ed.id,
      'studentId', ed.student_id,
      'schoolDate', ed.school_date,
      'collectorId', ed.collector_id,
      'collectorLabel', coalesce(ed_col.display_name, ''),
      'reason', ed.reason,
      'requestedPickupAt', ed.requested_pickup_at,
      'status', ed.status,
      'version', ed.version,
      'requestedByLabel', coalesce(ed_req.full_name, ed_req.username),
      'reviewedByLabel', coalesce(ed_rev.full_name, ed_rev.username),
      'reviewedAt', ed.reviewed_at,
      'reviewReason', ed.review_reason,
      'releasedByLabel', coalesce(ed_rel.full_name, ed_rel.username),
      'completedAt', ed.completed_at,
      'handoffNotes', ed.handoff_notes,
      'createdAt', ed.created_at
    ) as early_departure
    from public.early_departure_requests ed
    left join public.authorized_pickup_persons ed_col on ed_col.id = ed.collector_id
    left join public.profiles ed_req on ed_req.id = ed.requested_by
    left join public.profiles ed_rev on ed_rev.id = ed.reviewed_by
    left join public.profiles ed_rel on ed_rel.id = ed.released_by_user_id
    where ed.student_id = sc.student_id and ed.school_date = sc.school_date
    order by ed.created_at desc, ed.id desc
    limit 1
  ) ed_proj on true
  order by sc.class_name, sc.student_name, sc.cycle_id;
end;
$$;

-- Standalone scoped read for today's early departures (supports pre-cycle requests before provision_pickup_cycles runs).
create or replace function public.get_pickup_early_departures(p_class_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_date date := (clock_timestamp() at time zone 'Africa/Tunis')::date;
  v_is_staff boolean := false;
  v_is_release_role boolean := false;
  v_is_teacher boolean := false;
  v_is_parent boolean := false;
  v_items jsonb;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and p.account_status = 'APPROVED'
  ) then
    raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
  end if;

  v_is_release_role := public.pickup_actor_is_app_admin()
    or public.current_user_has_role('MANAGER'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role);
  v_is_teacher := public.current_user_has_role('TEACHER'::public.app_role);
  v_is_parent := public.current_user_has_role('PARENT'::public.app_role);
  v_is_staff := v_is_release_role or v_is_teacher;

  if not v_is_staff and not v_is_parent then
    raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
  end if;

  if p_class_id is not null then
    if not v_is_release_role and v_is_teacher then
      if not exists (
        select 1 from public.teacher_class_assignments a
         where a.teacher_user_id = v_actor and a.class_id = p_class_id and a.active
      ) then
        raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
      end if;
    elsif not v_is_staff then
      raise exception 'insufficient_pickup_scope' using errcode = 'P0001';
    end if;
  end if;

  with scoped_departures as materialized (
    select
      ed.id as ed_id,
      ed.student_id,
      ed.membership_id,
      ed.cycle_id,
      ed.school_date,
      ed.collector_id,
      ed.reason,
      ed.requested_pickup_at,
      ed.status,
      ed.version,
      ed.requested_by,
      ed.reviewed_by,
      ed.reviewed_at,
      ed.review_reason,
      ed.released_by_user_id,
      ed.completed_at,
      ed.handoff_notes,
      ed.created_at,
      s.full_name as student_label,
      m.class_id,
      cl.name as class_label
    from public.early_departure_requests ed
    join public.students s on s.id = ed.student_id and s.status = 'ACTIVE'
    join public.student_class_memberships m on m.id = ed.membership_id
    join public.school_classes cl on cl.id = m.class_id
    where ed.school_date = v_date
      and (p_class_id is null or m.class_id = p_class_id)
      and (
        v_is_release_role
        or (v_is_teacher and exists (
          select 1 from public.teacher_class_assignments a
           where a.teacher_user_id = v_actor and a.class_id = m.class_id and a.active
        ))
        or (v_is_parent and exists (
          select 1 from public.parent_child_links l
           where l.parent_user_id = v_actor and l.student_id = ed.student_id
             and l.active and l.verified_by is not null
        ))
      )
  )
  select coalesce(jsonb_agg(item order by class_label, student_label, created_at desc, ed_id), '[]'::jsonb)
    into v_items
    from (
      select
        sd.ed_id,
        sd.created_at,
        sd.student_label,
        sd.class_label,
        case when v_is_staff then
          jsonb_build_object(
            'id', sd.ed_id,
            'studentId', sd.student_id,
            'studentLabel', sd.student_label,
            'classId', sd.class_id,
            'classLabel', sd.class_label,
            'cycleId', sd.cycle_id,
            'schoolDate', sd.school_date,
            'collectorId', sd.collector_id,
            'collectorLabel', coalesce(col.display_name, ''),
            'reason', sd.reason,
            'requestedPickupAt', sd.requested_pickup_at,
            'status', sd.status,
            'version', sd.version,
            'requestedByLabel', coalesce(req.full_name, req.username),
            'reviewedByLabel', coalesce(rev.full_name, rev.username),
            'reviewedAt', sd.reviewed_at,
            'reviewReason', sd.review_reason,
            'releasedByLabel', coalesce(rel.full_name, rel.username),
            'completedAt', sd.completed_at,
            'handoffNotes', sd.handoff_notes,
            'createdAt', sd.created_at,
            'canReview', (v_is_release_role and sd.status = 'PENDING'),
            'canComplete', (
              v_is_release_role and sd.status = 'APPROVED'
              and public.pickup_actor_can_confirm_release()
              and coalesce(el.eligible, false)
              and el.membership_id = sd.membership_id
              and col.id is not null and col.verified_by is not null and col.verified_at is not null
              and col.valid_from <= v_date and col.valid_until >= v_date and col.revoked_at is null
            )
          )
        else
          jsonb_build_object(
            'id', sd.ed_id,
            'studentId', sd.student_id,
            'studentLabel', sd.student_label,
            'classId', sd.class_id,
            'classLabel', sd.class_label,
            'cycleId', sd.cycle_id,
            'schoolDate', sd.school_date,
            'collectorId', sd.collector_id,
            'collectorLabel', coalesce(col.display_name, ''),
            'reason', sd.reason,
            'requestedPickupAt', sd.requested_pickup_at,
            'status', sd.status,
            'version', sd.version,
            'reviewedAt', sd.reviewed_at,
            'reviewReason', sd.review_reason,
            'completedAt', sd.completed_at,
            'createdAt', sd.created_at,
            'canReview', false,
            'canComplete', false
          )
        end as item
      from scoped_departures sd
      left join public.authorized_pickup_persons col on col.id = sd.collector_id
      left join public.profiles req on req.id = sd.requested_by
      left join public.profiles rev on rev.id = sd.reviewed_by
      left join public.profiles rel on rel.id = sd.released_by_user_id
      left join lateral (
        select e.eligible, e.membership_id
          from public.get_pickup_student_eligibility(sd.student_id, v_date) e
      ) el on true
    ) scoped;

  return coalesce(v_items, '[]'::jsonb);
end;
$$;

create or replace function public.request_early_departure(
  p_student_id uuid,
  p_collector_id uuid,
  p_reason text,
  p_request_id uuid,
  p_requested_pickup_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_school_date date := (v_now at time zone 'Africa/Tunis')::date;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_payload jsonb;
  v_digest_schema text;
  v_hash text;
  v_saved public.pickup_requests%rowtype;
  v_link_id uuid;
  v_elig record;
  v_register_id uuid;
  v_membership_id uuid;
  v_cycle public.pickup_cycles%rowtype;
  v_existing public.early_departure_requests%rowtype;
  v_ed public.early_departure_requests%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if p_student_id is null or p_collector_id is null or p_request_id is null
     or char_length(v_reason) not between 3 and 500 then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles p join public.role_assignments r on r.user_id = p.id
     where p.id = v_actor and p.account_status = 'APPROVED' and r.active and r.role = 'PARENT'::public.app_role
  ) then
    raise exception 'pickup_parent_required' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'action', 'REQUEST',
    'studentId', p_student_id,
    'collectorId', p_collector_id,
    'reason', v_reason,
    'requestedPickupAt', p_requested_pickup_at
  );
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode = 'P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')', v_digest_schema)
    into v_hash using convert_to(v_payload::text, 'UTF8'), 'sha256';

  perform pg_advisory_xact_lock(hashtextextended('pickup-request:' || v_actor::text || ':' || p_request_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('early-departure-student:' || p_student_id::text || ':' || v_school_date::text, 0));

  select l.id into v_link_id
    from public.parent_child_links l
    join public.students s on s.id = l.student_id
   where l.parent_user_id = v_actor and l.student_id = p_student_id
     and l.active and l.verified_by is not null and s.status = 'ACTIVE'
   for share of l;
  if not found then
    raise exception 'pickup_parent_child_link_required' using errcode = 'P0001';
  end if;

  select * into v_saved from public.pickup_requests r
   where r.actor_user_id = v_actor and r.request_id = p_request_id;
  if found then
    if v_saved.operation_type <> 'EARLY_DEPARTURE' or v_saved.payload_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_cycle from public.pickup_cycles c
   where c.student_id = p_student_id and c.school_date = v_school_date
   for share;

  if v_cycle.cycle_id is not null and v_cycle.state = 'RELEASED' then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'already_released', 'studentId', p_student_id,
      'cycleId', v_cycle.cycle_id, 'state', v_cycle.state, 'version', v_cycle.version,
      'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  end if;

  select * into v_existing from public.early_departure_requests ed
   where ed.student_id = p_student_id and ed.school_date = v_school_date
     and ed.status in ('PENDING', 'APPROVED', 'COMPLETED')
   order by ed.created_at desc, ed.id desc
   limit 1
   for share;
  if found then
    v_result := jsonb_build_object(
      'ok', false,
      'code', case when v_existing.status = 'COMPLETED' then 'already_released' else 'early_departure_already_open' end,
      'earlyDepartureId', v_existing.id,
      'studentId', p_student_id,
      'status', v_existing.status,
      'version', v_existing.version,
      'requestId', p_request_id,
      'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  end if;

  perform 1 from public.authorized_pickup_persons person
   where person.id = p_collector_id and person.student_id = p_student_id
     and person.verified_by is not null and person.verified_at is not null
     and person.valid_from <= v_school_date and person.valid_until >= v_school_date
     and person.revoked_at is null
   for share;
  if not found or not public.pickup_parent_can_announce_arrival(p_student_id, p_collector_id, v_school_date) then
    raise exception 'collector_or_parent_not_authorized' using errcode = 'P0001';
  end if;

  select * into v_elig from public.get_pickup_student_eligibility(p_student_id, v_school_date);
  if not coalesce(v_elig.eligible, false) then
    raise exception '%', coalesce(v_elig.reason_code, 'attendance_unavailable') using errcode = 'P0001';
  end if;
  v_register_id := v_elig.register_id;
  v_membership_id := v_elig.membership_id;

  if exists (
    select 1 from public.school_calendar_events e
     where e.category in ('CLOSURE', 'HOLIDAY') and e.status = 'SCHEDULED'
       and v_school_date between e.start_date and e.end_date
       and (
         e.audience_mode = 'WHOLE_SCHOOL'
         or exists (
           select 1 from public.school_calendar_event_targets t
            where t.event_id = e.id and t.class_id = v_elig.class_id
         )
       )
  ) then
    raise exception 'schedule_unavailable' using errcode = 'P0001';
  end if;

  perform 1 from public.attendance_registers ar
   where ar.id = v_register_id and ar.status = 'SUBMITTED' for share;
  if not found then raise exception 'register_not_submitted' using errcode = 'P0001'; end if;

  perform 1 from public.attendance_entries ae
   where ae.register_id = v_register_id and ae.student_id = p_student_id
     and ae.membership_id = v_membership_id and ae.mark in ('PRESENT', 'LATE') for share;
  if not found then raise exception 'attendance_entry_missing_or_conflicting' using errcode = 'P0001'; end if;

  select * into v_elig from public.get_pickup_student_eligibility(p_student_id, v_school_date);
  if not coalesce(v_elig.eligible, false)
     or v_elig.membership_id is distinct from v_membership_id
     or v_elig.register_id is distinct from v_register_id then
    raise exception '%', coalesce(v_elig.reason_code, 'attendance_unavailable') using errcode = 'P0001';
  end if;

  insert into public.early_departure_requests(
    student_id, membership_id, cycle_id, school_date, requested_by, collector_id,
    reason, requested_pickup_at, status, version, created_at, updated_at
  ) values (
    p_student_id, v_membership_id, v_cycle.cycle_id, v_school_date, v_actor, p_collector_id,
    v_reason, p_requested_pickup_at, 'PENDING', 1, v_now, v_now
  )
  returning * into v_ed;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'early_departure_requested',
    'earlyDepartureId', v_ed.id,
    'studentId', v_ed.student_id,
    'cycleId', v_ed.cycle_id,
    'schoolDate', v_ed.school_date,
    'status', v_ed.status,
    'version', v_ed.version,
    'requestId', p_request_id,
    'occurredAt', v_now,
    'replayed', false
  );
  insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
    values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
  insert into public.pickup_events(
    actor_user_id, actor_role, student_id, cycle_id, class_id, action,
    prior_state, new_state, prior_version, new_version, collector_id, request_id, reason, occurred_at
  ) values (
    v_actor, 'PARENT'::public.app_role, v_ed.student_id, v_ed.cycle_id, v_elig.class_id,
    'EARLY_DEPARTURE_REQUESTED', v_cycle.state, v_cycle.state, v_cycle.version, v_cycle.version,
    p_collector_id, p_request_id, v_reason, v_now
  );
  insert into public.notification_outbox(event_type, source_id, payload, created_at)
    values('pickup.early_departure_requested', v_ed.id, jsonb_build_object(
      'earlyDepartureId', v_ed.id, 'studentId', v_ed.student_id, 'classId', v_elig.class_id,
      'cycleId', v_ed.cycle_id, 'requestId', p_request_id
    ), v_now);
  return v_result;
end;
$$;

create or replace function public.review_early_departure(
  p_early_departure_id uuid,
  p_decision text,
  p_request_id uuid,
  p_expected_version integer,
  p_review_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.app_role;
  v_now timestamptz := clock_timestamp();
  v_ed public.early_departure_requests%rowtype;
  v_cycle public.pickup_cycles%rowtype;
  v_membership public.student_class_memberships%rowtype;
  v_review_reason text := nullif(btrim(coalesce(p_review_reason, '')), '');
  v_payload jsonb;
  v_digest_schema text;
  v_hash text;
  v_saved public.pickup_requests%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if p_early_departure_id is null or p_request_id is null or p_expected_version is null or p_expected_version <= 0
     or p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;
  if p_decision = 'REJECTED' and (v_review_reason is null or char_length(v_review_reason) not between 3 and 500) then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;
  if v_review_reason is not null and char_length(v_review_reason) > 500 then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  select * into v_ed from public.early_departure_requests where id = p_early_departure_id for update;
  if not found then raise exception 'early_departure_not_found' using errcode = 'P0001'; end if;

  v_payload := jsonb_build_object(
    'action', 'REVIEW',
    'earlyDepartureId', p_early_departure_id,
    'decision', p_decision,
    'expectedVersion', p_expected_version,
    'reviewReason', v_review_reason
  );
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode = 'P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')', v_digest_schema)
    into v_hash using convert_to(v_payload::text, 'UTF8'), 'sha256';

  perform pg_advisory_xact_lock(hashtextextended('pickup-request:' || v_actor::text || ':' || p_request_id::text, 0));

  perform 1 from public.profiles p where p.id = v_actor and p.account_status = 'APPROVED' for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select r.role into v_actor_role from public.role_assignments r
   where r.user_id = v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1 for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select * into v_saved from public.pickup_requests r
   where r.actor_user_id = v_actor and r.request_id = p_request_id;
  if found then
    if v_saved.operation_type <> 'EARLY_DEPARTURE' or v_saved.payload_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed', true);
  end if;

  if v_ed.status in ('REJECTED', 'CANCELLED', 'COMPLETED') then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'early_departure_terminal', 'earlyDepartureId', v_ed.id,
      'status', v_ed.status, 'version', v_ed.version, 'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  elsif v_ed.version <> p_expected_version or v_ed.status <> 'PENDING' then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'version_conflict', 'earlyDepartureId', v_ed.id,
      'status', v_ed.status, 'version', v_ed.version, 'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  end if;

  select * into v_cycle from public.pickup_cycles c
   where c.student_id = v_ed.student_id and c.school_date = v_ed.school_date
   for share;
  if p_decision = 'APPROVED' and v_cycle.cycle_id is not null and v_cycle.state = 'RELEASED' then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'already_released', 'earlyDepartureId', v_ed.id,
      'cycleId', v_cycle.cycle_id, 'status', v_ed.status, 'version', v_ed.version,
      'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  end if;

  select * into v_membership from public.student_class_memberships m where m.id = v_ed.membership_id;

  update public.early_departure_requests
     set status = p_decision,
         reviewed_by = v_actor,
         reviewed_at = v_now,
         review_reason = v_review_reason,
         version = version + 1
   where id = p_early_departure_id
   returning * into v_ed;

  v_result := jsonb_build_object(
    'ok', true,
    'code', case when p_decision = 'APPROVED' then 'early_departure_approved' else 'early_departure_rejected' end,
    'earlyDepartureId', v_ed.id,
    'studentId', v_ed.student_id,
    'cycleId', v_ed.cycle_id,
    'schoolDate', v_ed.school_date,
    'status', v_ed.status,
    'version', v_ed.version,
    'requestId', p_request_id,
    'occurredAt', v_now,
    'replayed', false
  );
  insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
    values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
  insert into public.pickup_events(
    actor_user_id, actor_role, student_id, cycle_id, class_id, action,
    prior_state, new_state, prior_version, new_version, collector_id, request_id, reason, occurred_at
  ) values (
    v_actor, v_actor_role, v_ed.student_id, v_ed.cycle_id, v_membership.class_id,
    'EARLY_DEPARTURE_REVIEWED', v_cycle.state, v_cycle.state, v_cycle.version, v_cycle.version,
    v_ed.collector_id, p_request_id,
    case when v_review_reason is not null then p_decision || ': ' || v_review_reason else p_decision end,
    v_now
  );
  insert into public.notification_outbox(event_type, source_id, payload, created_at)
    values('pickup.early_departure_reviewed', v_ed.id, jsonb_build_object(
      'earlyDepartureId', v_ed.id, 'studentId', v_ed.student_id, 'decision', p_decision,
      'cycleId', v_ed.cycle_id, 'requestId', p_request_id
    ), v_now);
  return v_result;
end;
$$;

create or replace function public.complete_early_departure_release(
  p_early_departure_id uuid,
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
  v_now timestamptz := clock_timestamp();
  v_school_date date := (v_now at time zone 'Africa/Tunis')::date;
  v_ed public.early_departure_requests%rowtype;
  v_cycle public.pickup_cycles%rowtype;
  v_prior_cycle_state text := null;
  v_prior_cycle_version integer := null;
  v_saved public.pickup_requests%rowtype;
  v_handoff_notes text := nullif(btrim(coalesce(p_handoff_notes, '')), '');
  v_payload jsonb;
  v_digest_schema text;
  v_hash text;
  v_elig record;
  v_register_id uuid;
  v_membership_id uuid;
  v_revoked boolean := false;
  v_result jsonb;
begin
  if p_in_person_verified is distinct from true then
    raise exception 'attestation_required' using errcode = 'P0001';
  end if;
  if p_early_departure_id is null then raise exception 'invalid_pickup_request' using errcode = 'P0001'; end if;

  select * into v_ed from public.early_departure_requests where id = p_early_departure_id for update;
  if not found then raise exception 'early_departure_not_found' using errcode = 'P0001'; end if;

  -- Lock matching same-day cycle before profiles/attendance locks to match release_pupil lock ordering.
  select * into v_cycle from public.pickup_cycles c
   where c.student_id = v_ed.student_id and c.school_date = v_ed.school_date
   for update;
  if found then
    v_prior_cycle_state := v_cycle.state;
    v_prior_cycle_version := v_cycle.version;
  end if;

  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if p_collector_id is null or p_request_id is null or p_expected_version is null or p_expected_version <= 0 then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;
  if v_handoff_notes is not null and char_length(v_handoff_notes) > 500 then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'action', 'COMPLETE',
    'earlyDepartureId', p_early_departure_id,
    'collectorId', p_collector_id,
    'expectedVersion', p_expected_version,
    'inPersonVerified', p_in_person_verified,
    'handoffNotes', v_handoff_notes
  );
  select n.nspname into v_digest_schema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_digest_schema is null then raise exception 'pickup_crypto_unavailable' using errcode = 'P0001'; end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')', v_digest_schema)
    into v_hash using convert_to(v_payload::text, 'UTF8'), 'sha256';

  perform pg_advisory_xact_lock(hashtextextended('pickup-request:' || v_actor::text || ':' || p_request_id::text, 0));

  -- Enforce live approval, role, and revocation status BEFORE idempotent replay lookup.
  perform 1 from public.profiles p where p.id = v_actor and p.account_status = 'APPROVED' for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select r.role into v_actor_role from public.role_assignments r
   where r.user_id = v_actor and r.active
     and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                    'ADMINISTRATIVE_PERSONNEL'::public.app_role)
   order by case r.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 else 3 end
   limit 1 for share;
  if not found then raise exception 'pickup_release_authority_required' using errcode = 'P0001'; end if;

  select rev.is_revoked into v_revoked from public.pickup_release_revocations rev
   where rev.target_user_id = v_actor for share;
  if coalesce(v_revoked, false) then raise exception 'pickup_release_authority_revoked' using errcode = 'P0001'; end if;

  select * into v_saved from public.pickup_requests r
   where r.actor_user_id = v_actor and r.request_id = p_request_id;
  if found then
    if v_saved.operation_type <> 'EARLY_DEPARTURE' or v_saved.payload_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed', true);
  end if;

  if v_ed.status = 'COMPLETED' or (v_cycle.cycle_id is not null and v_cycle.state = 'RELEASED') then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'already_released', 'earlyDepartureId', v_ed.id,
      'cycleId', v_cycle.cycle_id, 'status', v_ed.status, 'version', v_ed.version,
      'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  elsif v_ed.status in ('REJECTED', 'CANCELLED') then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'early_departure_terminal', 'earlyDepartureId', v_ed.id,
      'status', v_ed.status, 'version', v_ed.version, 'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  elsif v_ed.status = 'PENDING' then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'early_departure_not_approved', 'earlyDepartureId', v_ed.id,
      'status', v_ed.status, 'version', v_ed.version, 'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  elsif v_ed.version <> p_expected_version then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'version_conflict', 'earlyDepartureId', v_ed.id,
      'status', v_ed.status, 'version', v_ed.version, 'requestId', p_request_id, 'replayed', false
    );
    insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
      values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
    return v_result;
  end if;

  if v_ed.school_date is distinct from v_school_date then
    raise exception 'cycle_date_mismatch' using errcode = 'P0001';
  end if;

  if p_collector_id is distinct from v_ed.collector_id then
    raise exception 'collector_invalid' using errcode = 'P0001';
  end if;
  perform 1 from public.authorized_pickup_persons person
   where person.id = p_collector_id and person.student_id = v_ed.student_id
     and person.verified_by is not null and person.verified_at is not null
     and person.valid_from <= v_school_date and person.valid_until >= v_school_date
     and person.revoked_at is null
   for share;
  if not found then
    raise exception 'collector_invalid' using errcode = 'P0001';
  end if;

  select * into v_elig from public.get_pickup_student_eligibility(v_ed.student_id, v_ed.school_date);
  if not coalesce(v_elig.eligible, false)
     or v_elig.membership_id is distinct from v_ed.membership_id then
    raise exception 'attendance_ineligible' using errcode = 'P0001';
  end if;
  v_register_id := v_elig.register_id;
  v_membership_id := v_elig.membership_id;

  if exists (
    select 1 from public.school_calendar_events e
     where e.category in ('CLOSURE', 'HOLIDAY') and e.status = 'SCHEDULED'
       and v_school_date between e.start_date and e.end_date
       and (
         e.audience_mode = 'WHOLE_SCHOOL'
         or exists (
           select 1 from public.school_calendar_event_targets t
            where t.event_id = e.id and t.class_id = v_elig.class_id
         )
       )
  ) then
    raise exception 'schedule_unavailable' using errcode = 'P0001';
  end if;

  perform 1 from public.attendance_registers ar
   where ar.id = v_register_id and ar.status = 'SUBMITTED'
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode = 'P0001'; end if;

  perform 1 from public.attendance_entries ae
   where ae.register_id = v_register_id and ae.student_id = v_ed.student_id
     and ae.membership_id = v_membership_id and ae.mark in ('PRESENT', 'LATE')
   for share;
  if not found then raise exception 'attendance_ineligible' using errcode = 'P0001'; end if;

  select * into v_elig from public.get_pickup_student_eligibility(v_ed.student_id, v_ed.school_date);
  if not coalesce(v_elig.eligible, false)
     or v_elig.membership_id is distinct from v_ed.membership_id
     or v_elig.register_id is distinct from v_register_id
     or v_elig.attendance_mark not in ('PRESENT', 'LATE') then
    raise exception 'attendance_ineligible' using errcode = 'P0001';
  end if;

  -- Supersede any open same-day pickup_cycles row atomically; preserve arrival collector if already PARENT_ARRIVED.
  if v_cycle.cycle_id is not null then
    update public.pickup_cycles
       set state = 'RELEASED',
           version = version + 1,
           collector_id = coalesce(v_cycle.collector_id, p_collector_id),
           release_at = v_now,
           release_actor_user_id = v_actor
     where cycle_id = v_cycle.cycle_id
     returning * into v_cycle;
  end if;

  update public.early_departure_requests
     set status = 'COMPLETED',
         cycle_id = coalesce(v_ed.cycle_id, v_cycle.cycle_id),
         completed_at = v_now,
         released_by_user_id = v_actor,
         handoff_notes = v_handoff_notes,
         version = version + 1
   where id = p_early_departure_id
   returning * into v_ed;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'early_departure_completed',
    'earlyDepartureId', v_ed.id,
    'studentId', v_ed.student_id,
    'cycleId', v_cycle.cycle_id,
    'schoolDate', v_ed.school_date,
    'status', v_ed.status,
    'version', v_ed.version,
    'cycleState', v_cycle.state,
    'cycleVersion', v_cycle.version,
    'requestId', p_request_id,
    'occurredAt', v_now,
    'replayed', false
  );
  insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
    values(v_actor, p_request_id, 'EARLY_DEPARTURE', v_hash, v_result);
  insert into public.pickup_events(
    actor_user_id, actor_role, student_id, cycle_id, class_id, action,
    prior_state, new_state, prior_version, new_version, collector_id, request_id, reason, occurred_at
  ) values (
    v_actor, v_actor_role, v_ed.student_id, v_cycle.cycle_id, v_elig.class_id,
    'EARLY_DEPARTURE_COMPLETED', v_prior_cycle_state, v_cycle.state, v_prior_cycle_version, v_cycle.version,
    p_collector_id, p_request_id, v_handoff_notes, v_now
  );
  insert into public.notification_outbox(event_type, source_id, payload, created_at)
    values('pickup.early_departure_completed', v_ed.id, jsonb_build_object(
      'earlyDepartureId', v_ed.id, 'studentId', v_ed.student_id, 'classId', v_elig.class_id,
      'cycleId', v_cycle.cycle_id, 'requestId', p_request_id
    ), v_now);
  return v_result;
end;
$$;

create or replace function public.get_pickup_operation_receipt(p_request_id uuid, p_cycle_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.pickup_requests%rowtype;
  v_cycle uuid;
  v_state text;
  v_version integer;
  v_student uuid;
  v_ed public.early_departure_requests%rowtype;
  v_ed_id uuid;
begin
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if p_request_id is null then raise exception 'invalid_pickup_request' using errcode = 'P0001'; end if;
  select * into v_row from public.pickup_requests r
   where r.actor_user_id = v_actor and r.request_id = p_request_id;
  if not found then return jsonb_build_object('found', false, 'requestId', p_request_id); end if;
  if v_row.operation_type not in ('ARRIVAL', 'RELEASE', 'EARLY_DEPARTURE') then
    raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
  end if;

  if v_row.operation_type = 'EARLY_DEPARTURE' then
    v_ed_id := nullif(v_row.result->>'earlyDepartureId', '')::uuid;
    if v_ed_id is null then raise exception 'pickup_receipt_unavailable' using errcode = 'P0001'; end if;
    select * into v_ed from public.early_departure_requests ed where ed.id = v_ed_id;
    if not found then raise exception 'pickup_receipt_unavailable' using errcode = 'P0001'; end if;
    if p_cycle_id is not null and v_ed.cycle_id is not null and p_cycle_id <> v_ed.cycle_id then
      raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
    end if;
    if v_row.result->>'code' = 'early_departure_requested' then
      if not exists(select 1 from public.parent_child_links l where l.parent_user_id = v_actor
        and l.student_id = v_ed.student_id and l.active and l.verified_by is not null)
        or not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id = p.id
          where p.id = v_actor and p.account_status = 'APPROVED' and r.active and r.role = 'PARENT'::public.app_role) then
        raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
      end if;
    else
      if not exists(select 1 from public.profiles p where p.id = v_actor and p.account_status = 'APPROVED')
        or not exists(select 1 from public.role_assignments r where r.user_id = v_actor and r.active
          and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                         'ADMINISTRATIVE_PERSONNEL'::public.app_role)) then
        raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
      end if;
    end if;
    return jsonb_build_object(
      'found', true, 'requestId', p_request_id, 'operationType', v_row.operation_type,
      'result', v_row.result, 'earlyDepartureId', v_ed.id, 'status', v_ed.status,
      'cycleId', v_ed.cycle_id, 'version', v_ed.version
    );
  end if;

  v_cycle := (v_row.result->>'cycleId')::uuid;
  if p_cycle_id is not null and p_cycle_id <> v_cycle then raise exception 'pickup_receipt_unavailable' using errcode = 'P0001'; end if;
  select c.state, c.version, c.student_id into v_state, v_version, v_student
    from public.pickup_cycles c where c.cycle_id = v_cycle;
  if not found then raise exception 'pickup_receipt_unavailable' using errcode = 'P0001'; end if;

  if v_row.operation_type = 'ARRIVAL' then
    if not exists(select 1 from public.parent_child_links l where l.parent_user_id = v_actor
      and l.student_id = v_student and l.active and l.verified_by is not null)
      or not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id = p.id
        where p.id = v_actor and p.account_status = 'APPROVED' and r.active and r.role = 'PARENT'::public.app_role) then
      raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
    end if;
  else
    if not exists(select 1 from public.profiles p where p.id = v_actor and p.account_status = 'APPROVED')
      or not exists(select 1 from public.role_assignments r where r.user_id = v_actor and r.active
        and r.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role,
                       'ADMINISTRATIVE_PERSONNEL'::public.app_role)) then
      raise exception 'pickup_receipt_unavailable' using errcode = 'P0001';
    end if;
  end if;
  return jsonb_build_object('found', true, 'requestId', p_request_id, 'operationType', v_row.operation_type,
    'result', v_row.result, 'cycleId', v_cycle, 'state', v_state, 'version', v_version);
end;
$$;

revoke all on function public.pickup_touch_early_departure_request() from public, anon, authenticated;
revoke all on function public.provision_pickup_cycles(date) from public, anon;
revoke all on function public.release_pupil(uuid, uuid, uuid, integer, boolean, text) from public, anon;
revoke all on function public.get_pickup_parent_board() from public, anon;
revoke all on function public.get_pickup_staff_board(uuid) from public, anon;
revoke all on function public.get_pickup_early_departures(uuid) from public, anon;
revoke all on function public.request_early_departure(uuid, uuid, text, uuid, timestamptz) from public, anon;
revoke all on function public.review_early_departure(uuid, text, uuid, integer, text) from public, anon;
revoke all on function public.complete_early_departure_release(uuid, uuid, uuid, integer, boolean, text) from public, anon;
revoke all on function public.get_pickup_operation_receipt(uuid, uuid) from public, anon;

grant execute on function public.provision_pickup_cycles(date) to authenticated;
grant execute on function public.release_pupil(uuid, uuid, uuid, integer, boolean, text) to authenticated;
grant execute on function public.get_pickup_parent_board() to authenticated;
grant execute on function public.get_pickup_staff_board(uuid) to authenticated;
grant execute on function public.get_pickup_early_departures(uuid) to authenticated;
grant execute on function public.request_early_departure(uuid, uuid, text, uuid, timestamptz) to authenticated;
grant execute on function public.review_early_departure(uuid, text, uuid, integer, text) to authenticated;
grant execute on function public.complete_early_departure_release(uuid, uuid, uuid, integer, boolean, text) to authenticated;
grant execute on function public.get_pickup_operation_receipt(uuid, uuid) to authenticated;
