-- KRISTOU SCHOOL — GOV-01: Authoritative Account Governance & Access Control Foundation
-- STATUS: PREPARED — NOT VERIFIED
-- MIGRATION-CHAIN & LIVE DEPENDENCY DISCLOSURE (Section 2):
--   1. The live Supabase project (ofppapwofhovhroyjtkc) records five applied migrations, including
--      `20261112190435 canonical_account_roles`, which narrowed `public.app_role` to the seven
--      canonical roles (`APP_ADMIN`, `MANAGER`, `ADMINISTRATIVE_PERSONNEL`, `TEACHER`, `SCHOOL_STAFF`,
--      `PARENT`, `STUDENT`) and removed `GENERAL_USER`, `PRINCIPAL`, and `EMPLOYEE`.
--   2. The SQL source file for `canonical_account_roles` is not yet committed in `supabase/migrations/`.
--      Do NOT apply this migration to production until F0-R2 non-destructive migration-history
--      reconciliation and isolated local Docker/PostgreSQL `supabase db reset` + pgTAP verification pass.
--   3. This migration never references `GENERAL_USER`, `PRINCIPAL`, or `EMPLOYEE`, preserves the existing
--      active `APP_ADMIN` (School Owner) account, enforces least-privilege grants and RLS, and exposes
--      narrow `SECURITY DEFINER` RPCs that derive the actor exclusively from `auth.uid()`.

do $$ begin
  create type public.account_approval_status as enum (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
    'REVOKED'
  );
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists account_status public.account_approval_status not null default 'PENDING',
  add column if not exists status_reason text,
  add column if not exists status_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists status_reviewed_at timestamptz,
  add column if not exists governance_version integer not null default 1;

alter table public.profiles
  drop constraint if exists profiles_governance_version_check;
alter table public.profiles
  add constraint profiles_governance_version_check check (governance_version >= 1);

-- Backfill existing profiles that already hold an active canonical role assignment (such as the active APP_ADMIN)
update public.profiles as p
   set account_status = 'APPROVED',
       status_reason = coalesce(p.status_reason, 'Existing active role assignment preserved by GOV-01'),
       status_reviewed_at = coalesce(p.status_reviewed_at, now())
 where p.account_status = 'PENDING'
   and exists (
     select 1
       from public.role_assignments as r
      where r.user_id = p.id
        and r.active = true
        and r.role::text in (
          'APP_ADMIN',
          'MANAGER',
          'ADMINISTRATIVE_PERSONNEL',
          'TEACHER',
          'SCHOOL_STAFF',
          'PARENT',
          'STUDENT'
        )
   );

create index if not exists profiles_account_status_created_idx
  on public.profiles (account_status, created_at desc);

create table if not exists public.manager_capability_grants (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (char_length(btrim(capability)) between 3 and 80),
  active boolean not null default true,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (manager_user_id, capability)
);

drop trigger if exists manager_capability_grants_set_updated_at on public.manager_capability_grants;
create trigger manager_capability_grants_set_updated_at
before update on public.manager_capability_grants
for each row execute function public.set_updated_at();

create table if not exists public.account_governance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.app_role not null,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (
    action in (
      'APPROVE',
      'REJECT',
      'SUSPEND',
      'REVOKE',
      'REACTIVATE',
      'APPOINT_PRIVILEGED_ROLE',
      'REVOKE_PRIVILEGED_ROLE'
    )
  ),
  previous_status public.account_approval_status not null,
  resulting_status public.account_approval_status not null,
  previous_roles text[] not null default '{}',
  resulting_roles text[] not null default '{}',
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  idempotency_key text,
  created_at timestamptz not null default clock_timestamp(),
  unique (actor_user_id, idempotency_key)
);

create index if not exists account_governance_audit_target_created_idx
  on public.account_governance_audit_logs (target_user_id, created_at desc);

alter table public.manager_capability_grants enable row level security;
alter table public.account_governance_audit_logs enable row level security;

revoke all on public.manager_capability_grants from public, anon, authenticated;
revoke all on public.account_governance_audit_logs from public, anon, authenticated;

grant select on public.manager_capability_grants to authenticated;
grant select on public.account_governance_audit_logs to authenticated;

drop policy if exists manager_capability_grants_select_self_or_owner on public.manager_capability_grants;
create policy manager_capability_grants_select_self_or_owner
on public.manager_capability_grants
for select
to authenticated
using (
  manager_user_id = auth.uid()
  or exists (
    select 1
      from public.profiles as p
      join public.role_assignments as r
        on r.user_id = p.id
       and r.active = true
     where p.id = auth.uid()
       and p.account_status = 'APPROVED'
       and r.role::text = 'APP_ADMIN'
  )
);

drop policy if exists account_governance_audit_select_owner_or_admin on public.account_governance_audit_logs;
create policy account_governance_audit_select_owner_or_admin
on public.account_governance_audit_logs
for select
to authenticated
using (
  exists (
    select 1
      from public.profiles as p
      join public.role_assignments as r
        on r.user_id = p.id
       and r.active = true
     where p.id = auth.uid()
       and p.account_status = 'APPROVED'
       and r.role::text in ('APP_ADMIN', 'ADMINISTRATIVE_PERSONNEL')
  )
);

-- Helper: resolve the caller's verified governance role or raise a specific exception
create or replace function public.governance_resolve_caller_role(
  p_require_owner boolean default false
)
returns public.app_role
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_status public.account_approval_status;
  v_is_owner boolean := false;
  v_is_admin_personnel boolean := false;
  v_is_manager boolean := false;
  v_has_manager_grant boolean := false;
begin
  if v_caller_id is null then
    raise exception 'actor_unauthenticated' using errcode = 'P0001';
  end if;

  select p.account_status
    into v_status
    from public.profiles as p
   where p.id = v_caller_id;

  if v_status is distinct from 'APPROVED' then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  select
    bool_or(r.role::text = 'APP_ADMIN'),
    bool_or(r.role::text = 'ADMINISTRATIVE_PERSONNEL'),
    bool_or(r.role::text = 'MANAGER')
    into v_is_owner, v_is_admin_personnel, v_is_manager
    from public.role_assignments as r
   where r.user_id = v_caller_id
     and r.active = true;

  if coalesce(v_is_owner, false) then
    return 'APP_ADMIN'::public.app_role;
  end if;

  if p_require_owner then
    raise exception 'owner_only_operation' using errcode = 'P0001';
  end if;

  if coalesce(v_is_admin_personnel, false) then
    return 'ADMINISTRATIVE_PERSONNEL'::public.app_role;
  end if;

  if coalesce(v_is_manager, false) then
    select exists (
      select 1
        from public.manager_capability_grants as g
       where g.manager_user_id = v_caller_id
         and g.capability = 'ACCOUNT_APPROVAL_REVIEW'
         and g.active = true
    ) into v_has_manager_grant;

    if not coalesce(v_has_manager_grant, false) then
      raise exception 'manager_delegation_required' using errcode = 'P0001';
    end if;

    return 'MANAGER'::public.app_role;
  end if;

  raise exception 'insufficient_governance_authority' using errcode = 'P0001';
end;
$$;

revoke all on function public.governance_resolve_caller_role(boolean) from public, anon, authenticated;

-- 1. Actor scope lookup
create or replace function public.governance_get_actor_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_owner_count integer;
  v_pending_count integer;
  v_approved_count integer;
  v_suspended_count integer;
  v_revoked_count integer;
begin
  v_caller_role := public.governance_resolve_caller_role(false);

  select count(*)::integer
    into v_owner_count
    from public.profiles as p
    join public.role_assignments as r
      on r.user_id = p.id
     and r.active = true
   where p.account_status = 'APPROVED'
     and r.role::text = 'APP_ADMIN';

  select
    count(*) filter (where account_status = 'PENDING')::integer,
    count(*) filter (where account_status = 'APPROVED')::integer,
    count(*) filter (where account_status = 'SUSPENDED')::integer,
    count(*) filter (where account_status = 'REVOKED')::integer
    into v_pending_count, v_approved_count, v_suspended_count, v_revoked_count
    from public.profiles;

  return jsonb_build_object(
    'actorUserId', v_caller_id,
    'actorRole', v_caller_role::text,
    'accountStatus', 'APPROVED',
    'canReviewOrdinaryAccounts', true,
    'canAppointPrivilegedRoles', (v_caller_role::text = 'APP_ADMIN'),
    'assignableRoles', jsonb_build_array('ADMINISTRATIVE_PERSONNEL', 'TEACHER', 'SCHOOL_STAFF', 'PARENT', 'STUDENT'),
    'activeOwnerCount', coalesce(v_owner_count, 0),
    'pendingCount', coalesce(v_pending_count, 0),
    'approvedCount', coalesce(v_approved_count, 0),
    'suspendedCount', coalesce(v_suspended_count, 0),
    'revokedCount', coalesce(v_revoked_count, 0)
  );
end;
$$;

revoke all on function public.governance_get_actor_scope() from public, anon;
grant execute on function public.governance_get_actor_scope() to authenticated;

-- 2. Paginated pending accounts list
create or replace function public.governance_list_pending_accounts(
  p_limit integer default 25,
  p_offset integer default 0,
  p_requested_role public.app_role default null,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_total integer;
  v_items jsonb;
begin
  v_caller_role := public.governance_resolve_caller_role(false);

  with matching as (
    select
      p.id,
      p.username,
      coalesce(p.full_name, p.username) as full_name,
      p.email,
      p.phone,
      (u.email_confirmed_at is not null) as email_confirmed,
      (u.phone_confirmed_at is not null) as phone_confirmed,
      p.requested_role::text as requested_role,
      p.account_status::text as account_status,
      p.staff_id,
      p.admission_id,
      p.status_reason,
      p.status_reviewed_by,
      p.status_reviewed_at,
      p.governance_version,
      p.created_at,
      coalesce(
        array(
          select r.role::text
            from public.role_assignments as r
           where r.user_id = p.id
             and r.active = true
        ),
        '{}'::text[]
      ) as active_roles
    from public.profiles as p
    left join auth.users as u on u.id = p.id
    where p.account_status = 'PENDING'
      and (p_requested_role is null or p.requested_role = p_requested_role)
      and (
        v_search is null
        or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
        or lower(p.username) like '%' || v_search || '%'
        or lower(coalesce(p.email, '')) like '%' || v_search || '%'
      )
    order by p.created_at desc
  )
  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'username', m.username,
          'fullName', m.full_name,
          'email', m.email,
          'phone', m.phone,
          'emailConfirmed', m.email_confirmed,
          'phoneConfirmed', m.phone_confirmed,
          'requestedRole', m.requested_role,
          'accountStatus', m.account_status,
          'activeRoles', to_jsonb(m.active_roles),
          'capabilities', '[]'::jsonb,
          'staffId', m.staff_id,
          'admissionId', m.admission_id,
          'statusReason', m.status_reason,
          'statusReviewedBy', m.status_reviewed_by,
          'statusReviewedAt', m.status_reviewed_at,
          'governanceVersion', m.governance_version,
          'createdAt', m.created_at,
          'actionableByCaller', (
            v_caller_role::text = 'APP_ADMIN'
            or (
              m.id <> v_caller_id
              and m.requested_role not in ('APP_ADMIN', 'MANAGER')
              and not ('APP_ADMIN' = any(m.active_roles))
              and not ('MANAGER' = any(m.active_roles))
            )
          )
        )
      ),
      '[]'::jsonb
    )
    into v_total, v_items
    from (
      select * from matching limit v_limit offset v_offset
    ) as m;

  select count(*)::integer
    into v_total
    from public.profiles as p
   where p.account_status = 'PENDING'
     and (p_requested_role is null or p.requested_role = p_requested_role)
     and (
       v_search is null
       or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
       or lower(p.username) like '%' || v_search || '%'
       or lower(coalesce(p.email, '')) like '%' || v_search || '%'
     );

  return jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

revoke all on function public.governance_list_pending_accounts(integer, integer, public.app_role, text) from public, anon;
grant execute on function public.governance_list_pending_accounts(integer, integer, public.app_role, text) to authenticated;

-- 3. Restricted account directory read
create or replace function public.governance_list_account_directory(
  p_limit integer default 25,
  p_offset integer default 0,
  p_status public.account_approval_status default null,
  p_role public.app_role default null,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_total integer;
  v_items jsonb;
begin
  v_caller_role := public.governance_resolve_caller_role(false);

  with matching as (
    select
      p.id,
      p.username,
      coalesce(p.full_name, p.username) as full_name,
      p.email,
      p.phone,
      (u.email_confirmed_at is not null) as email_confirmed,
      (u.phone_confirmed_at is not null) as phone_confirmed,
      p.requested_role::text as requested_role,
      p.account_status::text as account_status,
      p.staff_id,
      p.admission_id,
      p.status_reason,
      p.status_reviewed_by,
      p.status_reviewed_at,
      p.governance_version,
      p.created_at,
      coalesce(
        array(
          select r.role::text
            from public.role_assignments as r
           where r.user_id = p.id
             and r.active = true
        ),
        '{}'::text[]
      ) as active_roles
    from public.profiles as p
    left join auth.users as u on u.id = p.id
    where (p_status is null or p.account_status = p_status)
      and (
        p_role is null
        or p.requested_role = p_role
        or exists (
          select 1
            from public.role_assignments as r2
           where r2.user_id = p.id
             and r2.active = true
             and r2.role = p_role
        )
      )
      and (
        v_search is null
        or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
        or lower(p.username) like '%' || v_search || '%'
        or lower(coalesce(p.email, '')) like '%' || v_search || '%'
      )
    order by p.created_at desc
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'username', m.username,
          'fullName', m.full_name,
          'email', m.email,
          'phone', m.phone,
          'emailConfirmed', m.email_confirmed,
          'phoneConfirmed', m.phone_confirmed,
          'requestedRole', m.requested_role,
          'accountStatus', m.account_status,
          'activeRoles', to_jsonb(m.active_roles),
          'capabilities', '[]'::jsonb,
          'staffId', m.staff_id,
          'admissionId', m.admission_id,
          'statusReason', m.status_reason,
          'statusReviewedBy', m.status_reviewed_by,
          'statusReviewedAt', m.status_reviewed_at,
          'governanceVersion', m.governance_version,
          'createdAt', m.created_at,
          'actionableByCaller', (
            v_caller_role::text = 'APP_ADMIN'
            or (
              m.id <> v_caller_id
              and m.requested_role not in ('APP_ADMIN', 'MANAGER')
              and not ('APP_ADMIN' = any(m.active_roles))
              and not ('MANAGER' = any(m.active_roles))
            )
          )
        )
      ),
      '[]'::jsonb
    )
    into v_items
    from (
      select * from matching limit v_limit offset v_offset
    ) as m;

  select count(*)::integer
    into v_total
    from public.profiles as p
   where (p_status is null or p.account_status = p_status)
     and (
       p_role is null
       or p.requested_role = p_role
       or exists (
         select 1
           from public.role_assignments as r2
          where r2.user_id = p.id
            and r2.active = true
            and r2.role = p_role
       )
     )
     and (
       v_search is null
       or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
       or lower(p.username) like '%' || v_search || '%'
       or lower(coalesce(p.email, '')) like '%' || v_search || '%'
     );

  return jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

revoke all on function public.governance_list_account_directory(integer, integer, public.account_approval_status, public.app_role, text) from public, anon;
grant execute on function public.governance_list_account_directory(integer, integer, public.account_approval_status, public.app_role, text) to authenticated;

-- 4. Single account governance detail + audit trail
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
    'capabilities', '[]'::jsonb,
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

-- 5. Transactional account lifecycle review (APPROVE, REJECT, SUSPEND, REVOKE, REACTIVATE)
create or replace function public.governance_review_account(
  p_target_user_id uuid,
  p_decision text,
  p_assigned_role public.app_role default null,
  p_reason text default null,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_target public.profiles%rowtype;
  v_email_confirmed boolean := false;
  v_phone_confirmed boolean := false;
  v_prev_roles text[];
  v_target_has_priv boolean := false;
  v_effective_role public.app_role;
  v_next_status public.account_approval_status;
  v_next_roles text[];
  v_owner_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_idem text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing_audit public.account_governance_audit_logs%rowtype;
  v_audit_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_caller_role := public.governance_resolve_caller_role(false);

  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if v_idem is not null then
    select *
      into v_existing_audit
      from public.account_governance_audit_logs as l
     where l.actor_user_id = v_caller_id
       and l.idempotency_key = v_idem;

    if found then
      select * into v_target from public.profiles where id = v_existing_audit.target_user_id;
      return jsonb_build_object(
        'targetUserId', v_existing_audit.target_user_id,
        'accountStatus', v_existing_audit.resulting_status::text,
        'activeRoles', to_jsonb(v_existing_audit.resulting_roles),
        'governanceVersion', coalesce(v_target.governance_version, 1),
        'auditLogId', v_existing_audit.id,
        'reviewedAt', v_existing_audit.created_at
      );
    end if;
  end if;

  select *
    into v_target
    from public.profiles as p
   where p.id = p_target_user_id
   for update;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  select
    coalesce(array_agg(r.role::text order by r.role::text), '{}'::text[]),
    bool_or(r.role::text in ('APP_ADMIN', 'MANAGER'))
    into v_prev_roles, v_target_has_priv
    from public.role_assignments as r
   where r.user_id = v_target.id
     and r.active = true;

  v_effective_role := coalesce(p_assigned_role, v_target.requested_role);

  if v_caller_role::text <> 'APP_ADMIN' then
    if v_target.id = v_caller_id then
      raise exception 'self_governance_denied' using errcode = 'P0001';
    end if;

    if coalesce(v_target_has_priv, false)
       or v_target.requested_role::text in ('APP_ADMIN', 'MANAGER')
       or v_effective_role::text in ('APP_ADMIN', 'MANAGER') then
      raise exception 'privileged_target_requires_owner' using errcode = 'P0001';
    end if;
  end if;

  -- Prevent general APPROVE / REACTIVATE from becoming an alternative privileged-role appointment path
  -- without the required explicit confirmation (even when caller is APP_ADMIN).
  if p_decision in ('APPROVE', 'REACTIVATE')
     and (
       v_effective_role::text in ('APP_ADMIN', 'MANAGER')
       or coalesce(v_target_has_priv, false)
     ) then
    raise exception 'explicit_confirmation_required' using errcode = 'P0001';
  end if;

  if p_expected_version is null or v_target.governance_version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  select
    (u.email_confirmed_at is not null),
    (u.phone_confirmed_at is not null)
    into v_email_confirmed, v_phone_confirmed
    from auth.users as u
   where u.id = v_target.id;

  if p_decision in ('APPROVE', 'REACTIVATE') and not (coalesce(v_email_confirmed, false) or coalesce(v_phone_confirmed, false)) then
    raise exception 'contact_not_confirmed' using errcode = 'P0001';
  end if;

  if p_decision in ('SUSPEND', 'REVOKE', 'REJECT')
     and v_target.account_status = 'APPROVED'
     and ('APP_ADMIN' = any(v_prev_roles)) then
    perform pg_advisory_xact_lock(hashtext('kristou_school_owner_governance_lock'));

    perform 1
      from public.profiles as p2
      join public.role_assignments as r2
        on r2.user_id = p2.id
       and r2.active = true
     where p2.account_status = 'APPROVED'
       and r2.role::text = 'APP_ADMIN'
     order by p2.id
     for update of p2, r2;

    select count(*)::integer
      into v_owner_count
      from public.profiles as p2
      join public.role_assignments as r2
        on r2.user_id = p2.id
       and r2.active = true
     where p2.account_status = 'APPROVED'
       and r2.role::text = 'APP_ADMIN';

    if coalesce(v_owner_count, 0) <= 1 then
      raise exception 'last_owner_protection' using errcode = 'P0001';
    end if;
  end if;

  if p_decision in ('APPROVE', 'REACTIVATE') then
    v_next_status := 'APPROVED';
    v_next_roles := array[v_effective_role::text];

    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and role <> v_effective_role;

    insert into public.role_assignments (user_id, role, active, assigned_by)
    values (v_target.id, v_effective_role, true, v_caller_id)
    on conflict (user_id, role) do update
      set active = true,
          assigned_by = excluded.assigned_by,
          updated_at = v_now;
  elsif p_decision = 'REJECT' then
    v_next_status := 'REJECTED';
    v_next_roles := '{}'::text[];
    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and active = true;
  elsif p_decision = 'SUSPEND' then
    v_next_status := 'SUSPENDED';
    v_next_roles := '{}'::text[];
    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and active = true;
  elsif p_decision = 'REVOKE' then
    v_next_status := 'REVOKED';
    v_next_roles := '{}'::text[];
    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and active = true;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.profiles
     set account_status = v_next_status,
         requested_role = v_effective_role,
         status_reason = v_reason,
         status_reviewed_by = v_caller_id,
         status_reviewed_at = v_now,
         governance_version = v_target.governance_version + 1,
         updated_at = v_now
   where id = v_target.id;

  insert into public.account_governance_audit_logs (
    actor_user_id,
    actor_role,
    target_user_id,
    action,
    previous_status,
    resulting_status,
    previous_roles,
    resulting_roles,
    reason,
    idempotency_key,
    created_at
  ) values (
    v_caller_id,
    v_caller_role,
    v_target.id,
    p_decision,
    v_target.account_status,
    v_next_status,
    v_prev_roles,
    v_next_roles,
    v_reason,
    v_idem,
    v_now
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'targetUserId', v_target.id,
    'accountStatus', v_next_status::text,
    'activeRoles', to_jsonb(v_next_roles),
    'governanceVersion', v_target.governance_version + 1,
    'auditLogId', v_audit_id,
    'reviewedAt', v_now
  );
end;
$$;

revoke all on function public.governance_review_account(uuid, text, public.app_role, text, integer, text) from public, anon;
grant execute on function public.governance_review_account(uuid, text, public.app_role, text, integer, text) to authenticated;

-- 6. Owner-only privileged role appointment (MANAGER / APP_ADMIN) with last-Owner protection
create or replace function public.governance_appoint_privileged_role(
  p_target_user_id uuid,
  p_role public.app_role,
  p_action text,
  p_reason text,
  p_expected_version integer,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_target public.profiles%rowtype;
  v_email_confirmed boolean := false;
  v_phone_confirmed boolean := false;
  v_prev_roles text[];
  v_next_roles text[];
  v_next_status public.account_approval_status;
  v_owner_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_audit_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_caller_role := public.governance_resolve_caller_role(true);

  if not coalesce(p_confirmed, false) then
    raise exception 'explicit_confirmation_required' using errcode = 'P0001';
  end if;

  if p_role is null or p_role::text not in ('APP_ADMIN', 'MANAGER') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  if p_action is null or p_action not in ('GRANT', 'REVOKE') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select *
    into v_target
    from public.profiles as p
   where p.id = p_target_user_id
   for update;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  if p_expected_version is null or v_target.governance_version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(r.role::text order by r.role::text), '{}'::text[])
    into v_prev_roles
    from public.role_assignments as r
   where r.user_id = v_target.id
     and r.active = true;

  select
    (u.email_confirmed_at is not null),
    (u.phone_confirmed_at is not null)
    into v_email_confirmed, v_phone_confirmed
    from auth.users as u
   where u.id = v_target.id;

  if p_action = 'GRANT' and not (coalesce(v_email_confirmed, false) or coalesce(v_phone_confirmed, false)) then
    raise exception 'contact_not_confirmed' using errcode = 'P0001';
  end if;

  if (
       (p_action = 'REVOKE' and p_role::text = 'APP_ADMIN')
       or (p_action = 'GRANT' and p_role::text = 'MANAGER')
     )
     and v_target.account_status = 'APPROVED'
     and ('APP_ADMIN' = any(v_prev_roles)) then
    perform pg_advisory_xact_lock(hashtext('kristou_school_owner_governance_lock'));

    perform 1
      from public.profiles as p2
      join public.role_assignments as r2
        on r2.user_id = p2.id
       and r2.active = true
     where p2.account_status = 'APPROVED'
       and r2.role::text = 'APP_ADMIN'
     order by p2.id
     for update of p2, r2;

    select count(*)::integer
      into v_owner_count
      from public.profiles as p2
      join public.role_assignments as r2
        on r2.user_id = p2.id
       and r2.active = true
     where p2.account_status = 'APPROVED'
       and r2.role::text = 'APP_ADMIN';

    if coalesce(v_owner_count, 0) <= 1 then
      raise exception 'last_owner_protection' using errcode = 'P0001';
    end if;
  end if;

  if p_action = 'GRANT' then
    v_next_status := 'APPROVED';
    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and role::text in ('APP_ADMIN', 'MANAGER')
       and role <> p_role;

    insert into public.role_assignments (user_id, role, active, assigned_by)
    values (v_target.id, p_role, true, v_caller_id)
    on conflict (user_id, role) do update
      set active = true,
          assigned_by = excluded.assigned_by,
          updated_at = v_now;
  else
    update public.role_assignments
       set active = false,
           updated_at = v_now
     where user_id = v_target.id
       and role = p_role;
  end if;

  select coalesce(array_agg(r.role::text order by r.role::text), '{}'::text[])
    into v_next_roles
    from public.role_assignments as r
   where r.user_id = v_target.id
     and r.active = true;

  if p_action = 'REVOKE' then
    if coalesce(array_length(v_next_roles, 1), 0) = 0 then
      v_next_status := 'REVOKED';
    else
      v_next_status := v_target.account_status;
    end if;
  end if;

  update public.profiles
     set account_status = v_next_status,
         status_reason = v_reason,
         status_reviewed_by = v_caller_id,
         status_reviewed_at = v_now,
         governance_version = v_target.governance_version + 1,
         updated_at = v_now
   where id = v_target.id;

  insert into public.account_governance_audit_logs (
    actor_user_id,
    actor_role,
    target_user_id,
    action,
    previous_status,
    resulting_status,
    previous_roles,
    resulting_roles,
    reason,
    created_at
  ) values (
    v_caller_id,
    v_caller_role,
    v_target.id,
    case when p_action = 'GRANT' then 'APPOINT_PRIVILEGED_ROLE' else 'REVOKE_PRIVILEGED_ROLE' end,
    v_target.account_status,
    v_next_status,
    v_prev_roles,
    v_next_roles,
    v_reason,
    v_now
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'targetUserId', v_target.id,
    'accountStatus', v_next_status::text,
    'activeRoles', to_jsonb(v_next_roles),
    'governanceVersion', v_target.governance_version + 1,
    'auditLogId', v_audit_id,
    'reviewedAt', v_now
  );
end;
$$;

revoke all on function public.governance_appoint_privileged_role(uuid, public.app_role, text, text, integer, boolean) from public, anon;
grant execute on function public.governance_appoint_privileged_role(uuid, public.app_role, text, text, integer, boolean) to authenticated;
