-- Forward correction for Supabase direct default function EXECUTE grants.
-- Keep anonymous enrollment/inquiry intake and authenticated domain RPCs intact.
-- Do not alter database-wide defaults or historical migrations.
revoke all on function public.is_approved_school_member() from public, anon;
revoke all on function public.current_user_has_role(public.app_role) from public, anon;
revoke all on function public.current_user_has_capability(text) from public, anon;
revoke all on function public.can_access_class(uuid) from public, anon;

-- Enforce canonical level validation on writes through the table trigger too.
create or replace function public.validate_school_broadcast_targets()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_clean_levels text[];
  v_clean_classes uuid[];
begin
  new.audience_scope := upper(btrim(coalesce(new.audience_scope, 'ALL_SCHOOL')));

  if new.is_public and new.audience_scope <> 'PUBLIC_SITE' then
    raise exception 'targeted_broadcast_cannot_be_public' using errcode = 'P0001';
  end if;

  if new.audience_scope = 'SELECTED_LEVELS' then
    select coalesce(
      array_agg(distinct upper(btrim(lvl)) order by upper(btrim(lvl))),
      '{}'::text[]
    )
    into v_clean_levels
    from unnest(coalesce(new.target_level_codes, '{}'::text[])) as lvl
    where nullif(btrim(lvl), '') is not null;

    if coalesce(array_length(v_clean_levels, 1), 0) = 0 then
      raise exception 'target_levels_required' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from unnest(v_clean_levels) as requested_level(target_code)
      where not exists (
        select 1 from public.school_levels sl
        where sl.code = requested_level.target_code
      )
    ) then
      raise exception 'invalid_target_levels' using errcode = 'P0001';
    end if;

    new.target_level_codes := v_clean_levels;
    new.target_class_ids := '{}'::uuid[];
  elsif new.audience_scope = 'SELECTED_CLASSES' then
    select coalesce(
      array_agg(distinct cid),
      '{}'::uuid[]
    )
    into v_clean_classes
    from unnest(coalesce(new.target_class_ids, '{}'::uuid[])) as cid
    where cid is not null;

    if coalesce(array_length(v_clean_classes, 1), 0) = 0 then
      raise exception 'target_classes_required' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from unnest(v_clean_classes) as cid
      where not exists (
        select 1 from public.school_classes sc
        where sc.id = cid and sc.is_archived = false
      )
    ) then
      raise exception 'invalid_target_classes' using errcode = 'P0001';
    end if;

    new.target_class_ids := v_clean_classes;
    new.target_level_codes := '{}'::text[];
  else
    new.target_level_codes := '{}'::text[];
    new.target_class_ids := '{}'::uuid[];
  end if;

  return new;
end;
$$;

-- Trigger execution does not require these API callers to execute the function directly.
revoke all on function public.validate_school_broadcast_targets() from public, anon, authenticated;
