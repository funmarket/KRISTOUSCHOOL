-- KRISTOU SCHOOL — GOV-02 Manager Delegation, Preferences & Notification Inbox Foundation
-- Forward additive migration. Does NOT modify 20261110*–20261113* historical migrations.
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

-- 1. Canonical helper functions (account_status = 'APPROVED' + active role/capability checks)
create or replace function public.is_approved_school_member()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true
    where p.id = auth.uid()
      and p.account_status = 'APPROVED'
  );
$$;

create or replace function public.current_user_has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_assignments ra on ra.user_id = p.id and ra.active = true
    where p.id = auth.uid()
      and p.account_status = 'APPROVED'
      and ra.role = p_role
  );
$$;

create or replace function public.current_user_has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or (
      public.current_user_has_role('MANAGER'::public.app_role)
      and exists (
        select 1
        from public.manager_capability_grants mcg
        where mcg.manager_user_id = auth.uid()
          and mcg.active = true
          and mcg.capability in (p_capability, 'FULL_ACCESS')
      )
    )
  );
$$;

revoke all on function public.is_approved_school_member() from public;
grant execute on function public.is_approved_school_member() to authenticated;
revoke all on function public.current_user_has_role(public.app_role) from public;
grant execute on function public.current_user_has_role(public.app_role) to authenticated;
revoke all on function public.current_user_has_capability(text) from public;
grant execute on function public.current_user_has_capability(text) to authenticated;

-- Reconcile audit log contract cleanly without editing historical 20261113150000*:
-- preserve finite allowlisted actions + require canonical capability for manager delegation logs.
alter table public.account_governance_audit_logs
  add column if not exists capability text;

alter table public.account_governance_audit_logs
  drop constraint if exists account_governance_audit_logs_action_check;

alter table public.account_governance_audit_logs
  add constraint account_governance_audit_logs_action_check check (
    action in (
      'APPROVE',
      'REJECT',
      'SUSPEND',
      'REVOKE',
      'REACTIVATE',
      'APPOINT_PRIVILEGED_ROLE',
      'REVOKE_PRIVILEGED_ROLE',
      'GRANT_MANAGER_CAPABILITY',
      'REVOKE_MANAGER_CAPABILITY'
    )
  );

alter table public.account_governance_audit_logs
  drop constraint if exists account_governance_audit_logs_capability_chk;

alter table public.account_governance_audit_logs
  add constraint account_governance_audit_logs_capability_chk check (
    (
      action in ('GRANT_MANAGER_CAPABILITY', 'REVOKE_MANAGER_CAPABILITY')
      and capability is not null
      and capability in (
        'ACCOUNT_APPROVAL_REVIEW',
        'CLASSES_ROSTER_VIEW',
        'CLASSES_MANAGE',
        'ENROLLMENT_REVIEW',
        'BROADCAST_MANAGE',
        'CALENDAR_MANAGE',
        'CAN_MANAGE_FOOD_MENU',
        'PUBLIC_CONTENT_MANAGE',
        'COMMUNITY_MODERATE',
        'OVERSIGHT:PARENT_HOME',
        'OVERSIGHT:STUDENT_HOME',
        'OVERSIGHT:TEACHER_HOME',
        'OVERSIGHT:SCHOOL_STAFF_HOME',
        'OVERSIGHT:ADMINISTRATIVE_PERSONNEL_HOME',
        'OVERSIGHT:MANAGER_HOME'
      )
    )
    or (
      action not in ('GRANT_MANAGER_CAPABILITY', 'REVOKE_MANAGER_CAPABILITY')
      and capability is null
    )
  );

-- Refresh account detail reader so delegated capabilities and audit log capabilities appear truthfully.
create or replace function public.governance_get_account_detail(
  p_target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_role public.app_role;
  v_account jsonb;
  v_audit jsonb;
begin
  v_caller_role := public.governance_resolve_caller_role(false);
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'fullName', coalesce(p.full_name, p.username),
    'email', p.email,
    'phone', p.phone,
    'emailConfirmed', (u.email_confirmed_at is not null),
    'phoneConfirmed', (u.phone_confirmed_at is not null),
    'requestedRole', p.requested_role::text,
    'accountStatus', p.account_status::text,
    'activeRoles', coalesce(
      (
        select jsonb_agg(r.role::text)
          from public.role_assignments as r
         where r.user_id = p.id
           and r.active = true
      ),
      '[]'::jsonb
    ),
    'capabilities', coalesce(
      (
        select jsonb_agg(mcg.capability order by mcg.capability)
          from public.manager_capability_grants as mcg
         where mcg.manager_user_id = p.id
           and mcg.active = true
      ),
      '[]'::jsonb
    ),
    'staffId', p.staff_id,
    'admissionId', p.admission_id,
    'statusReason', p.status_reason,
    'statusReviewedBy', p.status_reviewed_by,
    'statusReviewedAt', p.status_reviewed_at,
    'governanceVersion', p.governance_version,
    'createdAt', p.created_at
  )
  into v_account
  from public.profiles as p
  left join auth.users as u on u.id = p.id
  where p.id = p_target_user_id;
  if v_account is null then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'actorUserId', l.actor_user_id,
        'actorRole', l.actor_role::text,
        'targetUserId', l.target_user_id,
        'action', l.action,
        'capability', l.capability,
        'previousStatus', l.previous_status::text,
        'resultingStatus', l.resulting_status::text,
        'previousRoles', to_jsonb(l.previous_roles),
        'resultingRoles', to_jsonb(l.resulting_roles),
        'reason', l.reason,
        'idempotencyKey', l.idempotency_key,
        'createdAt', l.created_at
      )
      order by l.created_at desc
    ),
    '[]'::jsonb
  )
  into v_audit
  from public.account_governance_audit_logs as l
  where l.target_user_id = p_target_user_id;
  return jsonb_build_object(
    'account', v_account,
    'auditTrail', v_audit
  );
end;
$$;

revoke all on function public.governance_get_account_detail(uuid) from public, anon;
grant execute on function public.governance_get_account_detail(uuid) to authenticated;

-- 2. GOV-02 Owner-Only Manager Capability Delegation RPCs
create or replace function public.governance_list_manager_grants()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_managers jsonb;
  v_grants jsonb;
begin
  if auth.uid() is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not public.current_user_has_role('APP_ADMIN'::public.app_role) then
    raise exception 'owner_only_operation' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'fullName', coalesce(p.full_name, p.username),
    'email', p.email,
    'accountStatus', p.account_status,
    'governanceVersion', p.governance_version
  ) order by coalesce(p.full_name, p.username)), '[]'::jsonb)
  into v_managers
  from public.profiles p
  join public.role_assignments ra on ra.user_id = p.id and ra.active = true and ra.role = 'MANAGER'::public.app_role
  where p.account_status = 'APPROVED';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', mcg.id,
    'managerUserId', mcg.manager_user_id,
    'managerUsername', p.username,
    'managerFullName', coalesce(p.full_name, p.username),
    'capability', mcg.capability,
    'active', mcg.active,
    'grantedBy', mcg.granted_by,
    'grantedAt', mcg.created_at,
    'updatedAt', mcg.updated_at
  ) order by mcg.updated_at desc), '[]'::jsonb)
  into v_grants
  from public.manager_capability_grants mcg
  join public.profiles p on p.id = mcg.manager_user_id;

  return jsonb_build_object(
    'managers', v_managers,
    'grants', v_grants
  );
end;
$$;

create or replace function public.governance_set_manager_capability(
  p_manager_user_id uuid,
  p_capability text,
  p_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_clean_cap text := upper(btrim(coalesce(p_capability, '')));
  v_target_profile public.profiles%rowtype;
  v_prev_roles text[];
  v_grant_id uuid;
  v_audit_id uuid;
  v_allowed_caps text[] := array[
    'ACCOUNT_APPROVAL_REVIEW',
    'CLASSES_ROSTER_VIEW',
    'CLASSES_MANAGE',
    'ENROLLMENT_REVIEW',
    'BROADCAST_MANAGE',
    'CALENDAR_MANAGE',
    'CAN_MANAGE_FOOD_MENU',
    'PUBLIC_CONTENT_MANAGE',
    'COMMUNITY_MODERATE',
    'OVERSIGHT:PARENT_HOME',
    'OVERSIGHT:STUDENT_HOME',
    'OVERSIGHT:TEACHER_HOME',
    'OVERSIGHT:SCHOOL_STAFF_HOME',
    'OVERSIGHT:ADMINISTRATIVE_PERSONNEL_HOME',
    'OVERSIGHT:MANAGER_HOME'
  ];
begin
  if v_actor_id is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not public.current_user_has_role('APP_ADMIN'::public.app_role) then
    raise exception 'owner_only_operation' using errcode = 'P0001';
  end if;
  if p_active is null then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if v_clean_reason is null or char_length(v_clean_reason) < 3 or char_length(v_clean_reason) > 500 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if not (v_clean_cap = any(v_allowed_caps)) then
    raise exception 'invalid_capability' using errcode = 'P0001';
  end if;

  select * into v_target_profile
  from public.profiles
  where id = p_manager_user_id
  for update;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;
  if v_target_profile.account_status <> 'APPROVED' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(ra.role::text order by ra.role::text), array[]::text[])
    into v_prev_roles
    from public.role_assignments ra
   where ra.user_id = p_manager_user_id
     and ra.active = true;

  if not ('MANAGER' = any(v_prev_roles)) then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  insert into public.manager_capability_grants (manager_user_id, capability, active, granted_by)
  values (p_manager_user_id, v_clean_cap, p_active, v_actor_id)
  on conflict (manager_user_id, capability) do update set
    active = excluded.active,
    granted_by = excluded.granted_by,
    updated_at = now()
  returning id into v_grant_id;

  update public.profiles
     set governance_version = governance_version + 1,
         updated_at = now()
   where id = p_manager_user_id;

  insert into public.account_governance_audit_logs (
    actor_user_id, actor_role, target_user_id, action, capability,
    previous_status, resulting_status, previous_roles, resulting_roles, reason
  )
  values (
    v_actor_id, 'APP_ADMIN'::public.app_role, p_manager_user_id,
    case when p_active then 'GRANT_MANAGER_CAPABILITY' else 'REVOKE_MANAGER_CAPABILITY' end,
    v_clean_cap,
    v_target_profile.account_status, v_target_profile.account_status,
    v_prev_roles, v_prev_roles,
    v_clean_reason
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'grantId', v_grant_id,
    'managerUserId', p_manager_user_id,
    'capability', v_clean_cap,
    'active', p_active,
    'auditLogId', v_audit_id
  );
end;
$$;

revoke all on function public.governance_list_manager_grants() from public, anon;
grant execute on function public.governance_list_manager_grants() to authenticated;
revoke all on function public.governance_set_manager_capability(uuid, text, boolean, text) from public, anon;
grant execute on function public.governance_set_manager_capability(uuid, text, boolean, text) to authenticated;

-- 3. User Preferences (PUB-04)
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'fr' check (language in ('ar', 'fr', 'en')),
  theme text not null default 'light' check (theme in ('light', 'pitch-black')),
  notification_sound text not null default 'Kristou Bell' check (notification_sound in ('Kristou Bell', 'Soft Chime', 'Classroom Bell', 'Gentle Pop', 'Silent')),
  sound_muted boolean not null default false,
  vibration_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;

drop policy if exists user_preferences_own_select on public.user_preferences;
create policy user_preferences_own_select on public.user_preferences for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_preferences_own_insert on public.user_preferences;
create policy user_preferences_own_insert on public.user_preferences for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_preferences_own_update on public.user_preferences;
create policy user_preferences_own_update on public.user_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.upsert_my_preferences(
  p_language text default null,
  p_theme text default null,
  p_notification_sound text default null,
  p_sound_muted boolean default null,
  p_vibration_enabled boolean default null
)
returns public.user_preferences
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;

  insert into public.user_preferences (
    user_id, language, theme, notification_sound, sound_muted, vibration_enabled
  ) values (
    v_uid,
    coalesce(nullif(p_language, ''), 'fr'),
    coalesce(nullif(p_theme, ''), 'light'),
    coalesce(nullif(p_notification_sound, ''), 'Kristou Bell'),
    coalesce(p_sound_muted, false),
    coalesce(p_vibration_enabled, true)
  )
  on conflict (user_id) do update set
    language = coalesce(nullif(p_language, ''), public.user_preferences.language),
    theme = coalesce(nullif(p_theme, ''), public.user_preferences.theme),
    notification_sound = coalesce(nullif(p_notification_sound, ''), public.user_preferences.notification_sound),
    sound_muted = coalesce(p_sound_muted, public.user_preferences.sound_muted),
    vibration_enabled = coalesce(p_vibration_enabled, public.user_preferences.vibration_enabled),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_my_preferences(text, text, text, boolean, boolean) from public, anon;
grant execute on function public.upsert_my_preferences(text, text, text, boolean, boolean) to authenticated;

-- 4. Durable Notification Inbox & Outbox (COM-01)
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('pickup', 'note', 'announcement', 'message', 'calendar', 'system')),
  title text not null,
  body text not null,
  target_tab text,
  target_ref_id text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_recipient_created_idx
  on public.user_notifications (recipient_user_id, is_read, created_at desc);

alter table public.notification_outbox enable row level security;
alter table public.user_notifications enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own on public.user_notifications for select to authenticated
  using (recipient_user_id = auth.uid() and public.is_approved_school_member());

create or replace function public.enqueue_school_notification(
  p_recipient_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_target_tab text default null,
  p_target_ref_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  insert into public.user_notifications (
    recipient_user_id, category, title, body, target_tab, target_ref_id
  ) values (
    p_recipient_user_id, p_category, left(btrim(p_title), 140), left(btrim(p_body), 280), p_target_tab, p_target_ref_id
  ) returning id into v_id;

  insert into public.notification_outbox (event_type, source_id, payload, dispatched_at)
  values ('notification:' || p_category, v_id, jsonb_build_object('recipientUserId', p_recipient_user_id), now());

  return v_id;
end;
$$;

revoke all on function public.enqueue_school_notification(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.mark_user_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  update public.user_notifications
     set is_read = true,
         read_at = coalesce(read_at, now())
   where id = p_notification_id
     and recipient_user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.mark_all_user_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;
  update public.user_notifications
     set is_read = true,
         read_at = coalesce(read_at, now())
   where recipient_user_id = auth.uid()
     and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_user_notification_read(uuid) from public, anon;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;
revoke all on function public.mark_all_user_notifications_read() from public, anon;
grant execute on function public.mark_all_user_notifications_read() to authenticated;
