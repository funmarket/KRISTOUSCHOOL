-- G3-A: isolated Pickup schema, immutable audit tables, RLS and browser grants.
-- No arrival/release commands are implemented in this stage.

create table public.dismissal_policies (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  effective_from date not null,
  effective_until date,
  revision integer not null check (revision > 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check (closes_at > opens_at),
  check (effective_until is null or effective_until >= effective_from)
);
create unique index dismissal_policies_scope_revision_key
  on public.dismissal_policies (coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday, revision);
create index dismissal_policies_resolution_idx
  on public.dismissal_policies (weekday, effective_from, effective_until)
  where active;

create table public.pickup_dismissal_policy_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  policy_id uuid not null references public.dismissal_policies(id) on delete restrict,
  action text not null check (action in ('CREATED','REPLACED','DEACTIVATED')),
  prior_revision integer,
  new_revision integer not null check (new_revision > 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  occurred_at timestamptz not null default clock_timestamp()
);

create table public.authorized_pickup_persons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  relationship_label text not null check (char_length(btrim(relationship_label)) between 2 and 80),
  verification_method text not null check (char_length(btrim(verification_method)) between 2 and 80),
  verification_reference text not null check (char_length(btrim(verification_reference)) between 3 and 160),
  verified_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz not null,
  valid_from date not null,
  valid_until date not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default clock_timestamp(),
  check (valid_until >= valid_from),
  check ((revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and char_length(btrim(coalesce(revocation_reason,''))) between 3 and 500))
);
create index authorized_pickup_persons_student_valid_idx
  on public.authorized_pickup_persons (student_id, valid_from, valid_until)
  where revoked_at is null;

create table public.pickup_release_revocations (
  target_user_id uuid primary key references public.profiles(id) on delete restrict,
  is_revoked boolean not null default false,
  version integer not null default 0 check (version >= 0),
  last_actor_user_id uuid references public.profiles(id) on delete restrict,
  last_reason text,
  updated_at timestamptz not null default clock_timestamp(),
  check ((version = 0 and is_revoked = false and last_actor_user_id is null and last_reason is null)
    or (version > 0 and last_actor_user_id is not null and char_length(btrim(coalesce(last_reason,''))) between 3 and 500))
);

create table public.pickup_authority_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('REVOKE_RELEASE','REINSTATE_RELEASE')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  version integer not null check (version > 0),
  effective_at timestamptz not null default clock_timestamp(),
  unique (target_user_id, version)
);

create table public.pickup_cycles (
  cycle_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  school_date date not null,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  membership_id uuid not null references public.student_class_memberships(id) on delete restrict,
  dismissal_policy_id uuid not null references public.dismissal_policies(id) on delete restrict,
  policy_revision integer not null check (policy_revision > 0),
  state text not null default 'WAITING' check (state in ('WAITING','PARENT_ARRIVED','RELEASED')),
  version integer not null default 1 check (version > 0),
  arrival_at timestamptz,
  arrival_actor_user_id uuid references public.profiles(id) on delete restrict,
  collector_id uuid references public.authorized_pickup_persons(id) on delete restrict,
  release_at timestamptz,
  release_actor_user_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check (
    (state='WAITING' and arrival_at is null and arrival_actor_user_id is null and release_at is null and release_actor_user_id is null and collector_id is null)
    or (state='PARENT_ARRIVED' and arrival_at is not null and arrival_actor_user_id is not null and collector_id is not null and release_at is null and release_actor_user_id is null)
    or (state='RELEASED' and release_at is not null and release_actor_user_id is not null and collector_id is not null
      and ((arrival_at is null and arrival_actor_user_id is null)
        or (arrival_at is not null and arrival_actor_user_id is not null)))
  ),
  unique (cycle_id, student_id)
);
create unique index pickup_cycles_one_open_per_student
  on public.pickup_cycles (student_id)
  where state <> 'RELEASED';
-- G3 defines one custody cycle per pupil and Tunis school date. The schema has
-- no second-window identity, so a second same-day cycle cannot be created.
create unique index pickup_cycles_one_per_student_date
  on public.pickup_cycles (student_id, school_date);
create index pickup_cycles_board_idx
  on public.pickup_cycles (school_date, class_id, state, created_at);
create index pickup_cycles_membership_idx
  on public.pickup_cycles (membership_id, school_date desc);

create table public.pickup_requests (
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  operation_type text not null check (operation_type in ('ARRIVAL','RELEASE','EARLY_DEPARTURE','RECONCILIATION')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (actor_user_id, request_id)
);

create table public.pickup_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.app_role not null,
  student_id uuid not null references public.students(id) on delete restrict,
  cycle_id uuid references public.pickup_cycles(cycle_id) on delete restrict,
  class_id uuid references public.school_classes(id) on delete restrict,
  action text not null check (action in (
    'ARRIVAL_ANNOUNCED','CHILD_RELEASED','EARLY_DEPARTURE_REQUESTED',
    'EARLY_DEPARTURE_REVIEWED','EARLY_DEPARTURE_CANCELLED','OUTAGE_RECONCILED'
  )),
  prior_state text check (prior_state is null or prior_state in ('WAITING','PARENT_ARRIVED','RELEASED')),
  new_state text check (new_state is null or new_state in ('WAITING','PARENT_ARRIVED','RELEASED')),
  prior_version integer check (prior_version is null or prior_version > 0),
  new_version integer check (new_version is null or new_version > 0),
  collector_id uuid references public.authorized_pickup_persons(id) on delete restrict,
  request_id uuid not null,
  reason text,
  occurred_at timestamptz not null default clock_timestamp()
);
create index pickup_events_student_time_idx on public.pickup_events (student_id, occurred_at desc, id desc);
create index pickup_events_cycle_time_idx on public.pickup_events (cycle_id, occurred_at, id);

create table public.early_departure_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  membership_id uuid not null references public.student_class_memberships(id) on delete restrict,
  cycle_id uuid references public.pickup_cycles(cycle_id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  collector_id uuid not null references public.authorized_pickup_persons(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','APPROVED','REJECTED','CANCELLED','COMPLETED')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_reason text,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status='SUBMITTED' and reviewed_by is null and reviewed_at is null and cancelled_by is null and cancelled_at is null)
    or (status in ('APPROVED','REJECTED','COMPLETED') and reviewed_by is not null and reviewed_at is not null and cancelled_by is null and cancelled_at is null)
    or (status='CANCELLED' and cancelled_by is not null and cancelled_at is not null
      and char_length(btrim(coalesce(cancellation_reason,''))) between 3 and 500)
  )
);
create unique index early_departure_one_open_per_student
  on public.early_departure_requests(student_id)
  where status in ('SUBMITTED','APPROVED');

create table public.pickup_audit_export_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  from_at timestamptz not null,
  until_at timestamptz not null,
  student_id uuid references public.students(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  exported_event_count integer not null check (exported_event_count >= 0),
  exported_at timestamptz not null default clock_timestamp(),
  check (until_at >= from_at)
);

create table public.pickup_person_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  authorized_person_id uuid not null references public.authorized_pickup_persons(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  action text not null check (action in ('REGISTERED','REVOKED')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  occurred_at timestamptz not null default clock_timestamp()
);

create or replace function public.pickup_immutable_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'pickup_audit_immutable' using errcode = 'P0001';
end;
$$;

create trigger pickup_events_immutable
before update or delete on public.pickup_events
for each row execute function public.pickup_immutable_audit_row();
create trigger pickup_requests_immutable
before update or delete on public.pickup_requests
for each row execute function public.pickup_immutable_audit_row();
create trigger pickup_authority_audit_immutable
before update or delete on public.pickup_authority_audit_logs
for each row execute function public.pickup_immutable_audit_row();
create trigger pickup_audit_export_immutable
before update or delete on public.pickup_audit_export_logs
for each row execute function public.pickup_immutable_audit_row();
create trigger pickup_person_audit_immutable
before update or delete on public.pickup_person_audit_logs
for each row execute function public.pickup_immutable_audit_row();
create trigger pickup_policy_audit_immutable
before update or delete on public.pickup_dismissal_policy_audit_logs
for each row execute function public.pickup_immutable_audit_row();

create or replace function public.pickup_protect_cycle_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.state = 'RELEASED' then
    raise exception 'pickup_cycle_terminal' using errcode = 'P0001';
  end if;
  if new.cycle_id is distinct from old.cycle_id
     or new.student_id is distinct from old.student_id
     or new.school_date is distinct from old.school_date
     or new.class_id is distinct from old.class_id
     or new.academic_year_id is distinct from old.academic_year_id
     or new.membership_id is distinct from old.membership_id
     or new.dismissal_policy_id is distinct from old.dismissal_policy_id
     or new.policy_revision is distinct from old.policy_revision
     or new.created_at is distinct from old.created_at then
    raise exception 'pickup_cycle_identity_immutable' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'pickup_cycle_version_must_increment' using errcode = 'P0001';
  end if;
  if not (
    (old.state='WAITING' and new.state in ('PARENT_ARRIVED','RELEASED'))
    or (old.state='PARENT_ARRIVED' and new.state='RELEASED')
  ) then
    raise exception 'pickup_cycle_transition_invalid' using errcode = 'P0001';
  end if;
  if old.state='PARENT_ARRIVED'
     and (new.arrival_at is distinct from old.arrival_at
       or new.arrival_actor_user_id is distinct from old.arrival_actor_user_id
       or new.collector_id is distinct from old.collector_id) then
    raise exception 'pickup_arrival_evidence_immutable' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger pickup_cycles_identity_and_transition
before update on public.pickup_cycles
for each row execute function public.pickup_protect_cycle_identity();

create or replace function public.pickup_validate_new_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.state<>'WAITING' or new.version<>1
     or new.arrival_at is not null or new.arrival_actor_user_id is not null
     or new.collector_id is not null or new.release_at is not null
     or new.release_actor_user_id is not null then
    raise exception 'pickup_cycle_must_start_waiting' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.student_class_memberships m
    where m.id=new.membership_id and m.student_id=new.student_id
      and m.class_id=new.class_id and m.academic_year_id=new.academic_year_id
      and m.started_at<=new.school_date
      and (m.ended_at is null or m.ended_at>=new.school_date)
      and (m.status='ACTIVE' or m.ended_at is not null)
  ) then
    raise exception 'pickup_cycle_membership_mismatch' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.dismissal_policies d
    where d.id=new.dismissal_policy_id and d.revision=new.policy_revision
      and d.active and d.weekday=extract(dow from new.school_date)::smallint
      and d.effective_from<=new.school_date
      and (d.effective_until is null or d.effective_until>=new.school_date)
      and (d.class_id is null or d.class_id=new.class_id)
  ) then
    raise exception 'pickup_cycle_policy_mismatch' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger pickup_cycles_validate_insert
before insert on public.pickup_cycles
for each row execute function public.pickup_validate_new_cycle();

create or replace function public.pickup_touch_early_departure_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('REJECTED','CANCELLED','COMPLETED') then
    raise exception 'early_departure_terminal' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id or new.student_id is distinct from old.student_id
     or new.membership_id is distinct from old.membership_id
     or new.requested_by is distinct from old.requested_by
     or (old.cycle_id is not null and new.cycle_id is distinct from old.cycle_id)
     or new.collector_id is distinct from old.collector_id
     or new.reason is distinct from old.reason or new.created_at is distinct from old.created_at then
    raise exception 'early_departure_identity_immutable' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'early_departure_version_must_increment' using errcode = 'P0001';
  end if;
  if not (
    (old.status='SUBMITTED' and new.status in ('APPROVED','REJECTED','CANCELLED'))
    or (old.status='APPROVED' and new.status in ('COMPLETED','CANCELLED'))
  ) then
    raise exception 'early_departure_transition_invalid' using errcode = 'P0001';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger early_departure_requests_transition
before update on public.early_departure_requests
for each row execute function public.pickup_touch_early_departure_request();

alter table public.dismissal_policies enable row level security;
alter table public.authorized_pickup_persons enable row level security;
alter table public.pickup_release_revocations enable row level security;
alter table public.pickup_authority_audit_logs enable row level security;
alter table public.pickup_cycles enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.pickup_events enable row level security;
alter table public.early_departure_requests enable row level security;
alter table public.pickup_audit_export_logs enable row level security;
alter table public.pickup_person_audit_logs enable row level security;
alter table public.pickup_dismissal_policy_audit_logs enable row level security;

revoke all on public.dismissal_policies, public.authorized_pickup_persons,
  public.pickup_release_revocations, public.pickup_authority_audit_logs,
  public.pickup_cycles, public.pickup_requests, public.pickup_events,
  public.early_departure_requests, public.pickup_audit_export_logs,
  public.pickup_person_audit_logs from public, anon, authenticated;
revoke all on public.pickup_dismissal_policy_audit_logs from public, anon, authenticated;
revoke all on sequence public.pickup_events_id_seq, public.pickup_authority_audit_logs_id_seq,
  public.pickup_audit_export_logs_id_seq, public.pickup_person_audit_logs_id_seq,
  public.pickup_dismissal_policy_audit_logs_id_seq
  from public, anon, authenticated;
revoke all on function public.pickup_immutable_audit_row() from public, anon, authenticated;
revoke all on function public.pickup_protect_cycle_identity() from public, anon, authenticated;
revoke all on function public.pickup_touch_early_departure_request() from public, anon, authenticated;
revoke all on function public.pickup_validate_new_cycle() from public, anon, authenticated;
