-- Forward correction for published broadcast-level validation.
-- Preserve the existing RPC signature, authorization, publication policy and grants.
-- Qualify the requested level to avoid resolving both operands to school_levels.code.

create or replace function public.publish_school_broadcast(
  p_title text,
  p_body text,
  p_priority text default 'NORMAL',
  p_audience_scope text default 'ALL_SCHOOL',
  p_is_public boolean default false,
  p_target_class_ids uuid[] default '{}'::uuid[],
  p_target_level_codes text[] default '{}'::text[]
)
returns public.school_broadcasts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_row public.school_broadcasts%rowtype;
  v_scope text := upper(btrim(coalesce(p_audience_scope, 'ALL_SCHOOL')));
  v_priority text := upper(btrim(coalesce(p_priority, 'NORMAL')));
  v_levels text[] := '{}'::text[];
  v_classes uuid[] := '{}'::uuid[];
  v_is_public boolean := coalesce(p_is_public, false);
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('BROADCAST_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if v_scope not in ('ALL_SCHOOL', 'ALL_CLASSES', 'SELECTED_LEVELS', 'SELECTED_CLASSES', 'PUBLIC_SITE') then
    raise exception 'invalid_audience_scope' using errcode = 'P0001';
  end if;
  if v_priority not in ('NORMAL', 'URGENT') then
    raise exception 'invalid_priority' using errcode = 'P0001';
  end if;
  if v_is_public and v_scope <> 'PUBLIC_SITE' then
    raise exception 'targeted_broadcast_cannot_be_public' using errcode = 'P0001';
  end if;
  if v_scope = 'PUBLIC_SITE' then
    v_is_public := true;
  end if;

  if v_scope = 'SELECTED_LEVELS' then
    select coalesce(
      array_agg(distinct upper(btrim(lvl)) order by upper(btrim(lvl))),
      '{}'::text[]
    )
    into v_levels
    from unnest(coalesce(p_target_level_codes, '{}'::text[])) as lvl
    where nullif(btrim(lvl), '') is not null;

    if coalesce(array_length(v_levels, 1), 0) = 0 then
      raise exception 'target_levels_required' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from unnest(v_levels) as requested_level(target_code)
      where not exists (
        select 1 from public.school_levels sl
        where sl.code = requested_level.target_code
      )
    ) then
      raise exception 'invalid_target_levels' using errcode = 'P0001';
    end if;
  elsif v_scope = 'SELECTED_CLASSES' then
    select coalesce(array_agg(distinct cid), '{}'::uuid[])
    into v_classes
    from unnest(coalesce(p_target_class_ids, '{}'::uuid[])) as cid
    where cid is not null;

    if coalesce(array_length(v_classes, 1), 0) = 0 then
      raise exception 'target_classes_required' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from unnest(v_classes) as cid
      where not exists (select 1 from public.school_classes sc where sc.id = cid and sc.is_archived = false)
    ) then
      raise exception 'invalid_target_classes' using errcode = 'P0001';
    end if;
  end if;

  select * into v_prof from public.profiles where id = v_uid;

  insert into public.school_broadcasts (
    title, body, priority, status, audience_scope, target_level_codes, target_class_ids, is_public,
    published_at, created_by, author_name, author_role
  ) values (
    btrim(p_title), btrim(p_body), v_priority, 'PUBLISHED',
    v_scope, v_levels, v_classes, v_is_public,
    now(), v_uid, coalesce(v_prof.full_name, v_prof.username), 'Administration'
  ) returning * into v_row;

  return v_row;
end;
$$;
