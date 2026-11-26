-- Class Management: configured years, stored capacity and independent creation permission.
-- Forward migration. No data seeds, class/roster changes or hosted installation implied.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Narrow governance override, not another role/capability store.
create table public.class_creation_permissions (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  denied boolean not null,
  version integer not null check (version > 0),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.class_creation_permissions enable row level security;
revoke all on public.class_creation_permissions from public, anon, authenticated;
-- Intentionally no client table policies/grants: self and Owner use scoped RPC projections.

alter table public.account_governance_audit_logs
  drop constraint account_governance_audit_logs_action_check;
alter table public.account_governance_audit_logs
  add constraint account_governance_audit_logs_action_check check (action in (
    'APPROVE','REJECT','SUSPEND','REVOKE','REACTIVATE','APPOINT_PRIVILEGED_ROLE',
    'REVOKE_PRIVILEGED_ROLE','GRANT_MANAGER_CAPABILITY','REVOKE_MANAGER_CAPABILITY',
    'DENY_CLASS_CREATION','RESTORE_CLASS_CREATION'
  ));
-- Existing capability constraint remains unchanged; these two actions carry capability=NULL.

create function private.class_creation_permission(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public
as $$
  with actor as (
    select p.account_status,
      exists(select 1 from public.role_assignments r where r.user_id=p.id and r.active and r.role='APP_ADMIN') as owner,
      exists(select 1 from public.role_assignments r where r.user_id=p.id and r.active
        and r.role in ('MANAGER','ADMINISTRATIVE_PERSONNEL','TEACHER')) as eligible,
      coalesce(c.denied,false) as denied, coalesce(c.version,0) as version
    from public.profiles p left join public.class_creation_permissions c on c.user_id=p.id
    where p.id=p_user_id
  )
  select coalesce((select jsonb_build_object(
    'canCreate',account_status='APPROVED' and (owner or (eligible and not denied)),
    'reasonCode',case
      when account_status<>'APPROVED' then 'account_not_approved'
      when owner then 'owner_authority'
      when not eligible then 'role_not_eligible'
      when denied then 'owner_denied'
      else 'role_default' end,
    'version',version
  ) from actor),jsonb_build_object('canCreate',false,'reasonCode','actor_not_found','version',0));
$$;
revoke all on function private.class_creation_permission(uuid) from public, anon, authenticated;

create function public.get_my_class_creation_permission()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  return jsonb_build_object('userId',auth.uid()) || private.class_creation_permission(auth.uid());
end;
$$;
revoke all on function public.get_my_class_creation_permission() from public, anon, authenticated;
grant execute on function public.get_my_class_creation_permission() to authenticated;

create function public.list_academic_years()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
  if not exists(select 1 from public.role_assignments r where r.user_id=auth.uid() and r.active
    and r.role in ('APP_ADMIN','MANAGER','ADMINISTRATIVE_PERSONNEL','TEACHER')) then
    raise exception 'insufficient_authority' using errcode='P0001';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',y.id,'code',y.code,'label',y.label,
    'startsOn',y.starts_on,'endsOn',y.ends_on,'isActive',y.is_active)
    order by y.is_active desc,y.starts_on desc,y.id),'[]'::jsonb) from public.academic_years y);
end;
$$;
revoke all on function public.list_academic_years() from public, anon, authenticated;
grant execute on function public.list_academic_years() to authenticated;

create function public.governance_list_class_creation_permissions(p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.current_user_has_role('APP_ADMIN') then raise exception 'owner_only_operation' using errcode='P0001'; end if;
  if p_limit is null or p_limit<1 or p_limit>200 or p_offset is null or p_offset<0 then
    raise exception 'invalid_pagination' using errcode='P0001';
  end if;
  return (select coalesce(jsonb_agg(row_data order by user_id),'[]'::jsonb) from (
    select p.id as user_id, jsonb_build_object('userId',p.id,'fullName',p.full_name,'username',p.username,
      'accountStatus',p.account_status,
      'roles',(select jsonb_agg(r.role order by r.role) from public.role_assignments r where r.user_id=p.id and r.active),
      'overrideDenied',coalesce(c.denied,false),'changeReason',c.reason,'changedAt',c.changed_at)
      || private.class_creation_permission(p.id) as row_data
    from public.profiles p left join public.class_creation_permissions c on c.user_id=p.id
    where exists(select 1 from public.role_assignments r where r.user_id=p.id and r.active
      and r.role in ('APP_ADMIN','MANAGER','ADMINISTRATIVE_PERSONNEL','TEACHER'))
    order by p.id limit p_limit offset p_offset
  ) page);
end;
$$;
revoke all on function public.governance_list_class_creation_permissions(integer,integer) from public, anon, authenticated;
grant execute on function public.governance_list_class_creation_permissions(integer,integer) to authenticated;

create function public.governance_set_class_creation_permission(
  p_target_user_id uuid,p_allowed boolean,p_reason text,p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_previous public.class_creation_permissions%rowtype;
  v_roles text[];
  v_version integer;
  v_audit uuid;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'class_creation_requires_read_committed' using errcode='P0001'; end if;
  if v_actor is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.current_user_has_role('APP_ADMIN') then raise exception 'owner_only_operation' using errcode='P0001'; end if;
  if p_target_user_id is null or p_allowed is null or p_expected_version is null or p_expected_version<0 then
    raise exception 'invalid_permission_input' using errcode='P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'reason_required' using errcode='P0001'; end if;

  -- Canonical lock order: sorted profiles -> sorted role rows -> individual override -> audit.
  -- Taking the target profile UPDATE lock also serializes the first (absent-row) denial with create.
  perform 1 from public.profiles p where p.id in (v_actor,p_target_user_id) order by p.id for update;
  perform 1 from public.role_assignments r where r.user_id in (v_actor,p_target_user_id) order by r.id for share;
  if not public.current_user_has_role('APP_ADMIN') then raise exception 'owner_only_operation' using errcode='P0001'; end if;
  select * into v_target from public.profiles where id=p_target_user_id;
  if not found then raise exception 'target_not_found' using errcode='P0001'; end if;
  select coalesce(array_agg(r.role::text order by r.role),array[]::text[]) into v_roles
    from public.role_assignments r where r.user_id=p_target_user_id and r.active;
  if 'APP_ADMIN'=any(v_roles) then raise exception 'owner_authority_retained' using errcode='P0001'; end if;
  if not v_roles && array['MANAGER','ADMINISTRATIVE_PERSONNEL','TEACHER']::text[] then
    raise exception 'invalid_target_role' using errcode='P0001'; end if;
  select * into v_previous from public.class_creation_permissions where user_id=p_target_user_id for update;
  v_version := coalesce(v_previous.version,0);
  if v_version<>p_expected_version then raise exception 'version_conflict' using errcode='P0001'; end if;
  if coalesce(v_previous.denied,false) = not p_allowed then
    return jsonb_build_object('userId',p_target_user_id,'changed',false) || private.class_creation_permission(p_target_user_id);
  end if;
  insert into public.class_creation_permissions(user_id,denied,version,changed_by,reason)
    values(p_target_user_id,not p_allowed,v_version+1,v_actor,btrim(p_reason))
    on conflict(user_id) do update set denied=excluded.denied,version=excluded.version,
      changed_by=excluded.changed_by,reason=excluded.reason,changed_at=clock_timestamp();
  update public.profiles set governance_version=governance_version+1,updated_at=clock_timestamp() where id=p_target_user_id;
  insert into public.account_governance_audit_logs(actor_user_id,actor_role,target_user_id,action,
    previous_status,resulting_status,previous_roles,resulting_roles,reason,capability)
    values(v_actor,'APP_ADMIN',p_target_user_id,case when p_allowed then 'RESTORE_CLASS_CREATION' else 'DENY_CLASS_CREATION' end,
      v_target.account_status,v_target.account_status,v_roles,v_roles,btrim(p_reason),null) returning id into v_audit;
  return jsonb_build_object('userId',p_target_user_id,'changed',true,'auditLogId',v_audit)
    || private.class_creation_permission(p_target_user_id);
end;
$$;
revoke all on function public.governance_set_class_creation_permission(uuid,boolean,text,integer) from public, anon, authenticated;
grant execute on function public.governance_set_class_creation_permission(uuid,boolean,text,integer) to authenticated;

create or replace function public.create_school_class(
  p_academic_year_code text,p_level_code text,p_name text,p_capacity integer default 28,p_room_label text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.account_approval_status;
  v_permission jsonb;
  v_year uuid;
  v_class public.school_classes%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'class_creation_requires_read_committed' using errcode='P0001'; end if;
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  select account_status into v_status from public.profiles where id=v_uid for share;
  if v_status is distinct from 'APPROVED' then raise exception 'actor_not_approved' using errcode='P0001'; end if;
  perform 1 from public.role_assignments r where r.user_id=v_uid order by r.id for share;
  v_permission := private.class_creation_permission(v_uid);
  if not (v_permission->>'canCreate')::boolean then
    raise exception 'insufficient_authority' using errcode='P0001', detail='class_creation_denied'; end if;
  select id into v_year from public.academic_years where code=btrim(coalesce(p_academic_year_code,'2026-2027')) for share;
  if v_year is null then raise exception 'invalid_academic_year' using errcode='P0001'; end if;
  insert into public.school_classes(academic_year_id,level_code,name,capacity,room_label,created_by)
    values(v_year,upper(btrim(p_level_code)),btrim(p_name),coalesce(p_capacity,28),nullif(btrim(coalesce(p_room_label,'')),''),v_uid)
    returning * into v_class;
  return jsonb_build_object('id',v_class.id,'name',v_class.name,'levelCode',v_class.level_code);
end;
$$;
revoke all on function public.create_school_class(text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.create_school_class(text,text,text,integer,text) to authenticated;

-- Preserve installed roster authorization and all existing fields; add only stored capacity.
CREATE OR REPLACE FUNCTION public.list_school_classes_with_rosters()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_school_wide boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;

  v_school_wide := (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CLASSES_ROSTER_VIEW')
    or public.current_user_has_capability('CLASSES_MANAGE')
  );

  if not v_school_wide and not (
    public.current_user_has_role('TEACHER'::public.app_role)
    and exists (
      select 1 from public.teacher_class_assignments tca
      where tca.teacher_user_id = v_uid and tca.active = true
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'name', sc.name,
      'level', coalesce(sl.label_fr, sc.level_code),
      'levelCode', sc.level_code,
      'academicYear', ay.code,
      'roomLabel', sc.room_label,
      'capacity', sc.capacity,
      'homeroomTeacherName', (
        select coalesce(p.full_name, p.username)
        from public.teacher_class_assignments tca
        join public.profiles p on p.id = tca.teacher_user_id
        where tca.class_id = sc.id and tca.active = true
        order by tca.is_homeroom desc, tca.created_at asc
        limit 1
      ),
      'activeStudentCount', (
        select count(*)::integer
        from public.student_class_memberships scm
        where scm.class_id = sc.id and scm.status = 'ACTIVE'
      ),
      'roster', coalesce((
        select jsonb_agg(jsonb_build_object(
          'studentId', st.id,
          'studentCode', st.student_code,
          'fullName', st.full_name,
          'enrollmentStatus', scm.status,
          'enrolledAt', scm.started_at,
          'primaryGuardianName', (
            select coalesce(gp.full_name, gp.username)
            from public.parent_child_links pcl
            join public.profiles gp on gp.id = pcl.parent_user_id
            where pcl.student_id = st.id and pcl.active = true
            order by pcl.created_at asc
            limit 1
          )
        ) order by st.full_name)
        from public.student_class_memberships scm
        join public.students st on st.id = scm.student_id
        where scm.class_id = sc.id and scm.status = 'ACTIVE'
      ), '[]'::jsonb)
    ) order by sl.sort_order, sc.name
  ), '[]'::jsonb)
  into v_result
  from public.school_classes sc
  join public.academic_years ay on ay.id = sc.academic_year_id
  join public.school_levels sl on sl.code = sc.level_code
  where sc.is_archived = false
    and (
      v_school_wide
      or exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = sc.id and tca.teacher_user_id = v_uid and tca.active = true
      )
    );

  return v_result;
end;
$function$;

revoke all on function public.list_school_classes_with_rosters() from public, anon;
grant execute on function public.list_school_classes_with_rosters() to authenticated;
notify pgrst, 'reload schema';
commit;
