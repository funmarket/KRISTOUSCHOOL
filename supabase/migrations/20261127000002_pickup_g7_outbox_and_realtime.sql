-- Pickup G7: Outbox Delivery Worker RPCs, Admin Reconciliation RPCs, and Realtime Sync.
-- Preserves G3-G6 zero direct table access for clients: authenticated users still
-- read only through authorized SECURITY DEFINER RPCs; Realtime events serve purely
-- as invalidation signals to trigger RPC board refreshes.

alter table public.notification_outbox
  add column if not exists delivery_status text not null default 'PENDING',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default clock_timestamp(),
  add column if not exists claimed_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists last_error text,
  add column if not exists provider_message_id text;

update public.notification_outbox
   set delivery_status = 'SENT',
       sent_at = coalesce(sent_at, dispatched_at)
 where dispatched_at is not null
   and delivery_status = 'PENDING';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.notification_outbox'::regclass
       and conname = 'notification_outbox_g7_status_check'
  ) then
    alter table public.notification_outbox
      add constraint notification_outbox_g7_status_check
      check (delivery_status in ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.notification_outbox'::regclass
       and conname = 'notification_outbox_g7_attempt_count_check'
  ) then
    alter table public.notification_outbox
      add constraint notification_outbox_g7_attempt_count_check
      check (attempt_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.notification_outbox'::regclass
       and conname = 'notification_outbox_g7_sent_consistency_check'
  ) then
    alter table public.notification_outbox
      add constraint notification_outbox_g7_sent_consistency_check
      check (delivery_status <> 'SENT' or sent_at is not null);
  end if;
end $$;

create index if not exists notification_outbox_g7_claimable_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where event_type like 'pickup.%'
    and dispatched_at is null
    and delivery_status in ('PENDING', 'RETRY');

create index if not exists notification_outbox_g7_status_idx
  on public.notification_outbox (delivery_status, created_at desc)
  where event_type like 'pickup.%';

alter table public.pickup_events
  drop constraint if exists pickup_events_action_check;
alter table public.pickup_events
  add constraint pickup_events_action_check
  check (action in (
    'CYCLE_PROVISIONED',
    'ARRIVAL_ANNOUNCED',
    'CHILD_RELEASED',
    'EARLY_DEPARTURE_REQUESTED',
    'EARLY_DEPARTURE_REVIEWED',
    'EARLY_DEPARTURE_COMPLETED',
    'EARLY_DEPARTURE_CANCELLED',
    'OUTAGE_RECONCILED',
    'OUTBOX_DELIVERY_FAILED',
    'OUTBOX_RETRY_QUEUED'
  ));

alter table public.pickup_cycles replica identity full;
alter table public.early_departure_requests replica identity full;
alter table public.pickup_release_revocations replica identity full;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'pickup_cycles',
      'early_departure_requests',
      'pickup_release_revocations'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.claim_pickup_outbox_batch(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_row public.notification_outbox%rowtype;
  v_student_id uuid;
  v_class_id uuid;
  v_cycle_id uuid;
  v_ed_id uuid;
  v_source record;
  v_student_label text;
  v_class_label text;
  v_recipients jsonb;
  v_items jsonb := '[]'::jsonb;
begin
  for v_row in
    with claimable as (
      select o.id
        from public.notification_outbox o
       where o.event_type like 'pickup.%'
         and o.dispatched_at is null
         and (
           (o.delivery_status in ('PENDING', 'RETRY') and o.next_attempt_at <= v_now)
           or (o.delivery_status = 'PROCESSING' and o.claimed_at < v_now - interval '5 minutes')
         )
       order by o.next_attempt_at asc, o.created_at asc, o.id asc
       limit v_limit
       for update skip locked
    )
    update public.notification_outbox target
       set delivery_status = 'PROCESSING',
           claimed_at = v_now
      from claimable
     where target.id = claimable.id
     returning target.*
  loop
    v_student_id := case
      when coalesce(v_row.payload->>'studentId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'studentId')::uuid
      else null
    end;
    v_class_id := case
      when coalesce(v_row.payload->>'classId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'classId')::uuid
      else null
    end;
    v_cycle_id := case
      when coalesce(v_row.payload->>'cycleId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'cycleId')::uuid
      else null
    end;
    v_ed_id := case
      when coalesce(v_row.payload->>'earlyDepartureId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'earlyDepartureId')::uuid
      else null
    end;

    if v_cycle_id is null and v_row.source_id is not null then
      select c.cycle_id, c.student_id, c.class_id
        into v_source
        from public.pickup_cycles c
       where c.cycle_id = v_row.source_id;
      if found then
        v_cycle_id := v_source.cycle_id;
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
      end if;
    end if;
    if v_ed_id is not null
       and (v_student_id is null or v_class_id is null or v_cycle_id is null) then
      select ed.student_id, m.class_id, ed.cycle_id
        into v_source
        from public.early_departure_requests ed
        join public.student_class_memberships m on m.id = ed.membership_id
       where ed.id = v_ed_id;
      if found then
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
        v_cycle_id := coalesce(v_cycle_id, v_source.cycle_id);
      end if;
    end if;

    v_student_label := null;
    if v_student_id is not null then
      select left(s.full_name, 120) into v_student_label
        from public.students s
       where s.id = v_student_id;
    end if;

    v_class_label := null;
    if v_class_id is not null then
      select left(cl.name, 120) into v_class_label
        from public.school_classes cl
       where cl.id = v_class_id;
    end if;

    if v_row.event_type in ('pickup.arrival_announced', 'pickup.early_departure_requested') then
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
        into v_recipients
        from (
          select distinct on (ti.telegram_user_id)
            p.id as "userId",
            ra.role::text as "role",
            case
              when up.language in ('ar', 'fr', 'en', 'es', 'de', 'pt') then up.language
              when ti.language_code in ('ar', 'fr', 'en', 'es', 'de', 'pt') then ti.language_code
              else 'en'
            end as "language",
            ti.telegram_user_id as "telegramUserId"
          from public.telegram_identities ti
          join public.profiles p on p.id = ti.user_id and p.account_status = 'APPROVED'
          join public.role_assignments ra on ra.user_id = p.id and ra.active
          left join public.user_preferences up on up.user_id = p.id
          where (
            ra.role in ('APP_ADMIN'::public.app_role, 'MANAGER'::public.app_role, 'ADMINISTRATIVE_PERSONNEL'::public.app_role)
            or (
              ra.role = 'TEACHER'::public.app_role
              and v_class_id is not null
              and exists (
                select 1 from public.teacher_class_assignments tca
                 where tca.teacher_user_id = p.id
                   and tca.class_id = v_class_id
                   and tca.active
              )
            )
          )
          order by ti.telegram_user_id,
            case ra.role when 'APP_ADMIN' then 1 when 'MANAGER' then 2 when 'ADMINISTRATIVE_PERSONNEL' then 3 else 4 end
        ) r;
    else
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
        into v_recipients
        from (
          select distinct on (ti.telegram_user_id)
            p.id as "userId",
            'PARENT' as "role",
            case
              when up.language in ('ar', 'fr', 'en', 'es', 'de', 'pt') then up.language
              when ti.language_code in ('ar', 'fr', 'en', 'es', 'de', 'pt') then ti.language_code
              else 'en'
            end as "language",
            ti.telegram_user_id as "telegramUserId"
          from public.parent_child_links pcl
          join public.profiles p on p.id = pcl.parent_user_id and p.account_status = 'APPROVED'
          join public.role_assignments ra on ra.user_id = p.id and ra.active and ra.role = 'PARENT'::public.app_role
          join public.telegram_identities ti on ti.user_id = p.id
          left join public.user_preferences up on up.user_id = p.id
          where v_student_id is not null
            and pcl.student_id = v_student_id
            and pcl.active
            and pcl.verified_by is not null
          order by ti.telegram_user_id, p.id
        ) r;
    end if;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_row.id,
        'eventType', v_row.event_type,
        'sourceId', v_row.source_id,
        'attemptCount', v_row.attempt_count,
        'createdAt', v_row.created_at,
        'studentLabel', v_student_label,
        'classLabel', v_class_label,
        'decision', nullif(v_row.payload->>'decision', ''),
        'recipients', coalesce(v_recipients, '[]'::jsonb)
      )
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'claimedAt', v_now,
    'items', v_items
  );
end;
$$;

create or replace function public.acknowledge_pickup_outbox_delivery(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.notification_outbox%rowtype;
  v_next_attempt integer;
  v_backoff_seconds integer;
  v_clean_error text;
  v_clean_provider_id text := nullif(left(btrim(coalesce(p_provider_message_id, '')), 160), '');
  v_student_id uuid;
  v_cycle_id uuid;
  v_class_id uuid;
  v_request_id uuid;
  v_actor_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_source record;
begin
  if p_outbox_id is null or p_succeeded is null then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  select * into v_row
    from public.notification_outbox o
   where o.id = p_outbox_id
     and o.event_type like 'pickup.%'
   for update;
  if not found then
    raise exception 'outbox_item_not_found' using errcode = 'P0001';
  end if;

  if v_row.delivery_status = 'SENT' then
    return jsonb_build_object(
      'ok', true,
      'id', v_row.id,
      'deliveryStatus', v_row.delivery_status,
      'attemptCount', v_row.attempt_count,
      'sentAt', v_row.sent_at,
      'alreadySent', true
    );
  end if;

  if p_succeeded then
    update public.notification_outbox
       set delivery_status = 'SENT',
           sent_at = v_now,
           dispatched_at = coalesce(dispatched_at, v_now),
           provider_message_id = coalesce(v_clean_provider_id, provider_message_id),
           last_error = null,
           claimed_at = null
     where id = p_outbox_id
     returning * into v_row;

    return jsonb_build_object(
      'ok', true,
      'id', v_row.id,
      'deliveryStatus', v_row.delivery_status,
      'attemptCount', v_row.attempt_count,
      'sentAt', v_row.sent_at,
      'providerMessageId', v_row.provider_message_id
    );
  end if;

  v_next_attempt := v_row.attempt_count + 1;
  v_clean_error := coalesce(nullif(left(btrim(coalesce(p_error, '')), 500), ''), 'delivery_failed');

  if v_next_attempt >= 5 then
    update public.notification_outbox
       set delivery_status = 'FAILED',
           attempt_count = v_next_attempt,
           last_error = v_clean_error,
           claimed_at = null
     where id = p_outbox_id
     returning * into v_row;

    v_student_id := case
      when coalesce(v_row.payload->>'studentId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'studentId')::uuid
      else null
    end;
    v_cycle_id := case
      when coalesce(v_row.payload->>'cycleId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'cycleId')::uuid
      else null
    end;
    v_class_id := case
      when coalesce(v_row.payload->>'classId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row.payload->>'classId')::uuid
      else null
    end;
    v_request_id := coalesce(
      case
        when coalesce(v_row.payload->>'requestId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_row.payload->>'requestId')::uuid
        else null
      end,
      v_row.id
    );

    if v_cycle_id is not null and not exists (select 1 from public.pickup_cycles c where c.cycle_id = v_cycle_id) then
      v_cycle_id := null;
    end if;
    if v_cycle_id is null and v_row.source_id is not null then
      select c.cycle_id, c.student_id, c.class_id
        into v_source
        from public.pickup_cycles c
       where c.cycle_id = v_row.source_id;
      if found then
        v_cycle_id := v_source.cycle_id;
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
      end if;
    end if;
    if v_row.source_id is not null
       and (v_student_id is null or v_class_id is null or v_cycle_id is null) then
      select ed.student_id, m.class_id, ed.cycle_id
        into v_source
        from public.early_departure_requests ed
        join public.student_class_memberships m on m.id = ed.membership_id
       where ed.id = v_row.source_id;
      if found then
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
        v_cycle_id := coalesce(v_cycle_id, v_source.cycle_id);
      end if;
    end if;

    if v_actor_user_id is null then
      select pe.actor_user_id, pe.actor_role
        into v_actor_user_id, v_actor_role
        from public.pickup_events pe
       where pe.request_id = v_request_id
       order by pe.id desc
       limit 1;
    end if;
    if v_actor_user_id is null then
      select p.id, ra.role
        into v_actor_user_id, v_actor_role
        from public.role_assignments ra
        join public.profiles p on p.id = ra.user_id and p.account_status = 'APPROVED'
       where ra.active and ra.role = 'APP_ADMIN'::public.app_role
       order by ra.created_at asc, p.id asc
       limit 1;
    elsif v_actor_role is null then
      select ra.role into v_actor_role
        from public.role_assignments ra
       where ra.user_id = v_actor_user_id and ra.active
       order by ra.created_at asc
       limit 1;
    end if;

    if v_student_id is not null
       and v_actor_user_id is not null
       and v_actor_role is not null
       and exists (select 1 from public.students s where s.id = v_student_id) then
      insert into public.pickup_events (
        actor_user_id, actor_role, student_id, cycle_id, class_id,
        action, request_id, reason, occurred_at
      ) values (
        v_actor_user_id, v_actor_role, v_student_id, v_cycle_id, v_class_id,
        'OUTBOX_DELIVERY_FAILED', v_request_id, v_clean_error, v_now
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'id', v_row.id,
      'deliveryStatus', v_row.delivery_status,
      'attemptCount', v_row.attempt_count,
      'lastError', v_row.last_error
    );
  end if;

  v_backoff_seconds := (power(2, least(v_next_attempt, 6))::integer) * 30;
  update public.notification_outbox
     set delivery_status = 'RETRY',
         attempt_count = v_next_attempt,
         next_attempt_at = v_now + make_interval(secs => v_backoff_seconds),
         last_error = v_clean_error,
         claimed_at = null
   where id = p_outbox_id
   returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'deliveryStatus', v_row.delivery_status,
    'attemptCount', v_row.attempt_count,
    'nextAttemptAt', v_row.next_attempt_at,
    'lastError', v_row.last_error
  );
end;
$$;

create or replace function public.get_pickup_outbox_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_summary record;
  v_recent_failures jsonb;
begin
  if v_actor is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;

  perform 1
    from public.profiles p
    join public.role_assignments r on r.user_id = p.id
   where p.id = v_actor
     and p.account_status = 'APPROVED'
     and r.active
     and r.role = 'APP_ADMIN'::public.app_role;
  if not found then
    raise exception 'pickup_app_admin_required' using errcode = 'P0001';
  end if;

  select
    count(*) filter (where delivery_status = 'PENDING')::integer as pending_count,
    count(*) filter (where delivery_status = 'RETRY')::integer as retry_count,
    count(*) filter (where delivery_status = 'PROCESSING')::integer as processing_count,
    count(*) filter (where delivery_status = 'SENT')::integer as sent_count,
    count(*) filter (where delivery_status = 'FAILED')::integer as failed_count,
    count(*)::integer as total_count,
    min(created_at) filter (where delivery_status in ('PENDING', 'RETRY', 'PROCESSING')) as oldest_pending_at,
    max(sent_at) filter (where delivery_status = 'SENT') as last_sent_at
    into v_summary
    from public.notification_outbox
   where event_type like 'pickup.%';

  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
    into v_recent_failures
    from (
      select
        o.id,
        o.event_type as "eventType",
        o.attempt_count as "attemptCount",
        o.last_error as "lastError",
        o.created_at as "createdAt"
      from public.notification_outbox o
      where o.event_type like 'pickup.%'
        and o.delivery_status = 'FAILED'
      order by o.created_at desc, o.id desc
      limit 5
    ) f;

  return jsonb_build_object(
    'ok', true,
    'pendingCount', coalesce(v_summary.pending_count, 0),
    'retryCount', coalesce(v_summary.retry_count, 0),
    'processingCount', coalesce(v_summary.processing_count, 0),
    'sentCount', coalesce(v_summary.sent_count, 0),
    'failedCount', coalesce(v_summary.failed_count, 0),
    'totalCount', coalesce(v_summary.total_count, 0),
    'oldestPendingAt', v_summary.oldest_pending_at,
    'lastSentAt', v_summary.last_sent_at,
    'recentFailures', v_recent_failures
  );
end;
$$;

create or replace function public.retry_failed_pickup_notifications(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_payload jsonb;
  v_digest_schema text;
  v_hash text;
  v_saved public.pickup_requests%rowtype;
  v_retried record;
  v_retried_count integer := 0;
  v_student_id uuid;
  v_cycle_id uuid;
  v_class_id uuid;
  v_result jsonb;
  v_source record;
begin
  if v_actor is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if p_request_id is null then
    raise exception 'invalid_pickup_request' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pickup-request:' || v_actor::text || ':' || p_request_id::text, 0));

  perform 1
    from public.profiles p
   where p.id = v_actor
     and p.account_status = 'APPROVED'
   for share;
  if not found then
    raise exception 'pickup_app_admin_required' using errcode = 'P0001';
  end if;

  perform 1
    from public.role_assignments r
   where r.user_id = v_actor
     and r.active
     and r.role = 'APP_ADMIN'::public.app_role
   for share;
  if not found then
    raise exception 'pickup_app_admin_required' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object('action', 'RETRY_FAILED_OUTBOX');
  select n.nspname into v_digest_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgcrypto';
  if v_digest_schema is null then
    raise exception 'pickup_crypto_unavailable' using errcode = 'P0001';
  end if;
  execute format('select encode(%I.digest($1, $2), ''hex'')', v_digest_schema)
    into v_hash using convert_to(v_payload::text, 'UTF8'), 'sha256';

  select * into v_saved
    from public.pickup_requests r
   where r.actor_user_id = v_actor
     and r.request_id = p_request_id;
  if found then
    if v_saved.operation_type <> 'RECONCILIATION' or v_saved.payload_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_saved.result || jsonb_build_object('replayed', true);
  end if;

  for v_retried in
    update public.notification_outbox
       set delivery_status = 'PENDING',
           attempt_count = 0,
           next_attempt_at = v_now,
           claimed_at = null,
           last_error = null
     where event_type like 'pickup.%'
       and delivery_status = 'FAILED'
     returning id, event_type, source_id, payload
  loop
    v_retried_count := v_retried_count + 1;

    v_student_id := case
      when coalesce(v_retried.payload->>'studentId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_retried.payload->>'studentId')::uuid
      else null
    end;
    v_cycle_id := case
      when coalesce(v_retried.payload->>'cycleId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_retried.payload->>'cycleId')::uuid
      else null
    end;
    v_class_id := case
      when coalesce(v_retried.payload->>'classId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_retried.payload->>'classId')::uuid
      else null
    end;

    if v_cycle_id is not null and not exists (select 1 from public.pickup_cycles c where c.cycle_id = v_cycle_id) then
      v_cycle_id := null;
    end if;
    if v_cycle_id is null and v_retried.source_id is not null then
      select c.cycle_id, c.student_id, c.class_id
        into v_source
        from public.pickup_cycles c
       where c.cycle_id = v_retried.source_id;
      if found then
        v_cycle_id := v_source.cycle_id;
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
      end if;
    end if;
    if v_retried.source_id is not null
       and (v_student_id is null or v_class_id is null or v_cycle_id is null) then
      select ed.student_id, m.class_id, ed.cycle_id
        into v_source
        from public.early_departure_requests ed
        join public.student_class_memberships m on m.id = ed.membership_id
       where ed.id = v_retried.source_id;
      if found then
        v_student_id := coalesce(v_student_id, v_source.student_id);
        v_class_id := coalesce(v_class_id, v_source.class_id);
        v_cycle_id := coalesce(v_cycle_id, v_source.cycle_id);
      end if;
    end if;

    if v_student_id is not null and exists (select 1 from public.students s where s.id = v_student_id) then
      insert into public.pickup_events (
        actor_user_id, actor_role, student_id, cycle_id, class_id,
        action, request_id, reason, occurred_at
      ) values (
        v_actor, 'APP_ADMIN'::public.app_role, v_student_id, v_cycle_id, v_class_id,
        'OUTBOX_RETRY_QUEUED', p_request_id, v_retried.event_type, v_now
      );
    end if;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'outbox_retry_queued',
    'retriedCount', v_retried_count,
    'requestId', p_request_id,
    'occurredAt', v_now,
    'replayed', false
  );
  insert into public.pickup_requests(actor_user_id, request_id, operation_type, payload_hash, result)
    values(v_actor, p_request_id, 'RECONCILIATION', v_hash, v_result);
  return v_result;
end;
$$;

revoke all on function public.claim_pickup_outbox_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_pickup_outbox_batch(integer) to service_role;

revoke all on function public.acknowledge_pickup_outbox_delivery(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.acknowledge_pickup_outbox_delivery(uuid, boolean, text, text) to service_role;

revoke all on function public.get_pickup_outbox_summary() from public, anon;
grant execute on function public.get_pickup_outbox_summary() to authenticated;

revoke all on function public.retry_failed_pickup_notifications(uuid) from public, anon;
grant execute on function public.retry_failed_pickup_notifications(uuid) to authenticated;
