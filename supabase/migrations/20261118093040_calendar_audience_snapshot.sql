-- KRISTOU SCHOOL — creation-time Calendar audience snapshots.
-- DEPENDS ON PR #21 source migration 20261115213000; hosted mapping 20261117214536.
-- Reviewed exact-SQL candidate. Install only after Owner approves these tested bytes.
-- One event; current membership authorizes access, never creator/snapshot identity.
begin;

do $$
begin
  if pg_get_functiondef('public.respond_to_calendar_event(uuid,text)'::regprocedure) !~* 'for[[:space:]]+update'
     or pg_get_functiondef('public.cancel_school_calendar_event(uuid,text)'::regprocedure) !~* 'for[[:space:]]+update' then
    raise exception 'calendar_cancellation_prerequisite_missing';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='school_calendar_events'
             and policyname not in ('calendar_public_select','calendar_member_select'))
     or exists (select 1 from pg_policies where schemaname='public' and tablename='school_calendar_responses'
                and policyname <> 'calendar_resp_select') then
    raise exception 'unexpected_calendar_policy_requires_review';
  end if;
end;
$$;

lock table public.school_calendar_events in access exclusive mode;
alter table public.school_calendar_events add column audience_mode text;
-- Backfill metadata without rewriting original event/cancellation timestamps.
alter table public.school_calendar_events disable trigger school_calendar_events_set_updated_at;
update public.school_calendar_events
   set audience_mode = case when class_id is null then 'WHOLE_SCHOOL' else 'SINGLE_CLASS' end,
       is_public = (class_id is null and is_public);
alter table public.school_calendar_events enable trigger school_calendar_events_set_updated_at;
alter table public.school_calendar_events
  alter column audience_mode set default 'WHOLE_SCHOOL',
  alter column audience_mode set not null,
  add constraint calendar_audience_mode_check check (audience_mode in ('WHOLE_SCHOOL','SINGLE_CLASS','TEACHER_CLASSES','ALL_MY_CLASSES')),
  add constraint calendar_legacy_anchor_check check (
    (audience_mode='WHOLE_SCHOOL' and class_id is null)
    or (audience_mode<>'WHOLE_SCHOOL' and class_id is not null)
  ),
  add constraint calendar_public_scope_check check (not is_public or audience_mode='WHOLE_SCHOOL');
-- Historical targeted events must not be cascaded away when an anchor class is deleted.
alter table public.school_calendar_events drop constraint school_calendar_events_class_id_fkey;
alter table public.school_calendar_events add constraint school_calendar_events_class_id_fkey
  foreign key (class_id) references public.school_classes(id) on delete restrict;

create table public.school_calendar_event_targets (
  event_id uuid not null references public.school_calendar_events(id) on delete cascade deferrable initially deferred,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  primary key (event_id,class_id)
);
create index calendar_targets_class_event_idx on public.school_calendar_event_targets(class_id,event_id);
insert into public.school_calendar_event_targets(event_id,class_id)
  select id,class_id from public.school_calendar_events where class_id is not null;
-- Finish deferred backfill FK checks before later ALTER/TRIGGER DDL.
set constraints school_calendar_event_targets_event_id_fkey immediate;
set constraints school_calendar_event_targets_event_id_fkey deferred;
alter table public.school_calendar_event_targets enable row level security;
revoke all on public.school_calendar_event_targets from public,anon,authenticated;
-- Anonymous can evaluate the invoker view; no anon target policy means no target rows.
grant select on public.school_calendar_event_targets to anon,authenticated;
create policy calendar_targets_member_select on public.school_calendar_event_targets for select to authenticated
  using (public.can_access_class(class_id));

-- Internal current-access helper: SECURITY DEFINER avoids policy recursion, but
-- approval and current class authority are checked explicitly. No author bypass.
create function public.calendar_can_read_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select case when not public.is_approved_school_member() then false else exists (
    select 1 from public.school_calendar_events e where e.id=p_event_id and (
      e.audience_mode='WHOLE_SCHOOL' or exists (
        select 1 from public.school_calendar_event_targets t
        where t.event_id=e.id and public.can_access_class(t.class_id)
      )
    )
  ) end;
$$;
revoke all on function public.calendar_can_read_event(uuid) from public,anon;
grant execute on function public.calendar_can_read_event(uuid) to authenticated;

drop policy calendar_public_select on public.school_calendar_events;
drop policy calendar_member_select on public.school_calendar_events;
create policy calendar_public_select on public.school_calendar_events for select to anon
  using (audience_mode='WHOLE_SCHOOL' and is_public and status<>'CANCELLED');
create policy calendar_member_select on public.school_calendar_events for select to authenticated
  using (public.calendar_can_read_event(id));
drop policy calendar_resp_select on public.school_calendar_responses;
create policy calendar_resp_select on public.school_calendar_responses for select to authenticated
  using (user_id=auth.uid() and public.calendar_can_read_event(event_id));

-- The existing date-range/order/range pagination can select this view directly.
-- Only target IDs visible through the caller's current class RLS are aggregated.
create view public.school_calendar_event_feed with (security_invoker=true) as
  select e.id,e.class_id,e.title,e.description,e.category,e.start_date,e.end_date,
         e.is_all_day,e.start_time,e.end_time,e.timezone,e.is_public,e.status,e.cancellation_reason,e.audience_mode,
         coalesce((select array_agg(t.class_id order by t.class_id)
                   from public.school_calendar_event_targets t where t.event_id=e.id),'{}'::uuid[]) as target_class_ids
    from public.school_calendar_events e;
revoke all on public.school_calendar_event_feed from public,anon,authenticated;
grant select on public.school_calendar_event_feed to anon,authenticated;

-- Deferred constraints enforce a complete audience at transaction end. Creation
-- inserts normalized targets BEFORE their deferred-FK event, then inserts the
-- event. That allows immutable targets without a mutable 'unsealed' state flag.
create function public.calendar_assert_audience(p_event_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.school_calendar_events%rowtype; n bigint; has_anchor boolean;
begin
  select * into e from public.school_calendar_events where id=p_event_id;
  if not found then return; end if;
  select count(*),coalesce(bool_or(class_id=e.class_id),false) into n,has_anchor
    from public.school_calendar_event_targets where event_id=e.id;
  if (e.audience_mode='WHOLE_SCHOOL' and n<>0)
     or (e.audience_mode<>'WHOLE_SCHOOL' and (n=0 or not has_anchor))
     or (e.audience_mode='SINGLE_CLASS' and n<>1) then
    raise exception 'calendar_audience_inconsistent' using errcode='23514';
  end if;
end;
$$;
create function public.calendar_check_audience_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_table_name='school_calendar_events' then
    perform public.calendar_assert_audience(new.id);
  else
    if tg_op='DELETE' then perform public.calendar_assert_audience(old.event_id);
    else perform public.calendar_assert_audience(new.event_id); end if;
  end if;
  return null;
end;
$$;
create constraint trigger calendar_event_complete_audience after insert or update on public.school_calendar_events
  deferrable initially deferred for each row execute function public.calendar_check_audience_trigger();
create constraint trigger calendar_targets_complete_audience after insert or delete on public.school_calendar_event_targets
  deferrable initially deferred for each row execute function public.calendar_check_audience_trigger();

create function public.calendar_keep_audience_immutable()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_table_name='school_calendar_events' then
    if new.class_id is distinct from old.class_id or new.audience_mode<>old.audience_mode then
      raise exception 'calendar_audience_immutable' using errcode='23514';
    end if;
    return new;
  end if;
  if tg_op='UPDATE'
     or (tg_op='INSERT' and exists (select 1 from public.school_calendar_events where id=new.event_id))
     or (tg_op='DELETE' and exists (select 1 from public.school_calendar_events where id=old.event_id)) then
    raise exception 'calendar_audience_immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger calendar_event_immutable_audience before update on public.school_calendar_events
  for each row execute function public.calendar_keep_audience_immutable();
create trigger calendar_targets_immutable before insert or update or delete on public.school_calendar_event_targets
  for each row execute function public.calendar_keep_audience_immutable();
revoke all on function public.calendar_assert_audience(uuid) from public,anon,authenticated;
revoke all on function public.calendar_check_audience_trigger() from public,anon,authenticated;
revoke all on function public.calendar_keep_audience_immutable() from public,anon,authenticated;

create function public.create_school_calendar_event(
  p_title text,p_description text,p_category text,p_start_date date,p_end_date date default null,
  p_audience_mode text default 'WHOLE_SCHOOL',p_class_id uuid default null,p_teacher_user_id uuid default null,
  p_is_all_day boolean default true,p_is_public boolean default false
)
returns public.school_calendar_events language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_uid uuid:=auth.uid(); v_teacher uuid; v_id uuid:=gen_random_uuid();
  v_mode text:=upper(btrim(p_audience_mode)); v_category text:=upper(btrim(coalesce(p_category,'EVENT')));
  v_end date:=coalesce(p_end_date,p_start_date); v_manage boolean; v_classes uuid[]:='{}';
  v_row public.school_calendar_events%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 160 or p_start_date is null then
    raise exception 'invalid_event_input' using errcode='P0001';
  end if;
  if v_end<p_start_date then raise exception 'invalid_date_range' using errcode='P0001'; end if;
  if v_category not in ('EXAM','TEST','EVENT','HOLIDAY','MEETING','CLOSURE','ACTIVITY','TRIP','OTHER') then
    raise exception 'invalid_event_category' using errcode='P0001';
  end if;
  if v_mode is null or v_mode not in ('WHOLE_SCHOOL','SINGLE_CLASS','TEACHER_CLASSES','ALL_MY_CLASSES') then
    raise exception 'invalid_audience_mode' using errcode='P0001';
  end if;
  if v_mode<>'WHOLE_SCHOOL' then
    if current_setting('transaction_isolation')<>'read committed' then
      raise exception 'calendar_requires_read_committed' using errcode='P0001';
    end if;
    -- Freeze eligible class state and the whole assignment set, including insert
    -- phantoms. These SHARE locks last to transaction end and block ordinary
    -- Academics INSERT/UPDATE/DELETE writers without adding another owner.
    lock table public.school_classes,public.teacher_class_assignments in share mode;
  end if;
  -- Re-read caller authority after any lock wait under READ COMMITTED.
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
  v_manage:=public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CALENDAR_MANAGE');
  if v_mode='WHOLE_SCHOOL' then
    if p_class_id is not null or p_teacher_user_id is not null then
      raise exception 'invalid_audience_parameters' using errcode='P0001';
    end if;
    if not v_manage then raise exception 'insufficient_authority' using errcode='P0001'; end if;
  else
    if coalesce(p_is_public,false) then raise exception 'targeted_event_cannot_be_public' using errcode='P0001'; end if;
    if v_mode='SINGLE_CLASS' then
      if p_class_id is null or p_teacher_user_id is not null then
        raise exception 'invalid_audience_parameters' using errcode='P0001';
      end if;
      if not exists(select 1 from public.school_classes where id=p_class_id and not is_archived) then
        raise exception 'class_not_found' using errcode='P0001';
      end if;
      if not (v_manage or (public.current_user_has_role('TEACHER'::public.app_role) and exists(
        select 1 from public.teacher_class_assignments where teacher_user_id=v_uid and class_id=p_class_id and active
      ))) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
      v_classes:=array[p_class_id];
    else
      if p_class_id is not null then raise exception 'invalid_audience_parameters' using errcode='P0001'; end if;
      if v_mode='TEACHER_CLASSES' then
        if not v_manage then raise exception 'insufficient_authority' using errcode='P0001'; end if;
        v_teacher:=p_teacher_user_id;
      else
        if p_teacher_user_id is not null then raise exception 'invalid_audience_parameters' using errcode='P0001'; end if;
        if not public.current_user_has_role('TEACHER'::public.app_role) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
        v_teacher:=v_uid;
      end if;
      if v_teacher is null or not exists(
        select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id
        where p.id=v_teacher and p.account_status='APPROVED' and r.active and r.role='TEACHER'::public.app_role
      ) then raise exception 'invalid_teacher_account' using errcode='P0001'; end if;
      select coalesce(array_agg(distinct t.class_id order by t.class_id),'{}'::uuid[]) into v_classes
        from public.teacher_class_assignments t join public.school_classes c on c.id=t.class_id
        where t.teacher_user_id=v_teacher and t.active and not c.is_archived;
      if cardinality(v_classes)=0 then raise exception 'calendar_no_eligible_classes' using errcode='P0001'; end if;
    end if;
  end if;
  insert into public.school_calendar_event_targets(event_id,class_id) select v_id,unnest(v_classes);
  insert into public.school_calendar_events(id,class_id,title,description,category,start_date,end_date,is_all_day,is_public,created_by,audience_mode)
    values(v_id,v_classes[1],btrim(p_title),coalesce(btrim(p_description),''),v_category,p_start_date,v_end,
           coalesce(p_is_all_day,true),coalesce(p_is_public,false),v_uid,v_mode) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_school_calendar_event(text,text,text,date,date,text,uuid,uuid,boolean,boolean) from public,anon;
grant execute on function public.create_school_calendar_event(text,text,text,date,date,text,uuid,uuid,boolean,boolean) to authenticated;

-- Deliberate compatibility: old callers still create one class or whole school;
-- a class caller's ineffective public flag remains coerced false as before.
create or replace function public.upsert_school_calendar_event(
  p_title text,p_description text,p_category text,p_start_date date,p_end_date date default null,
  p_class_id uuid default null,p_is_all_day boolean default true,p_is_public boolean default false
)
returns public.school_calendar_events language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  return public.create_school_calendar_event(p_title,p_description,p_category,p_start_date,p_end_date,
    case when p_class_id is null then 'WHOLE_SCHOOL' else 'SINGLE_CLASS' end,p_class_id,null,p_is_all_day,
    case when p_class_id is null then coalesce(p_is_public,false) else false end);
end;
$$;
revoke all on function public.upsert_school_calendar_event(text,text,text,date,date,uuid,boolean,boolean) from public,anon;
grant execute on function public.upsert_school_calendar_event(text,text,text,date,date,uuid,boolean,boolean) to authenticated;

-- Extend PR21's response authority to normalized targets. Keep SAME event-row
-- FOR UPDATE serialization with the unchanged cancellation RPC and status guard.
create or replace function public.respond_to_calendar_event(p_event_id uuid,p_response text)
returns public.school_calendar_responses language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid(); v_ev public.school_calendar_events%rowtype; v_row public.school_calendar_responses%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
  select * into v_ev from public.school_calendar_events where id=p_event_id for update;
  if not found then raise exception 'target_not_found' using errcode='P0001'; end if;
  if not public.calendar_can_read_event(p_event_id) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
  if v_ev.status='CANCELLED' then raise exception 'calendar_event_cancelled' using errcode='P0001'; end if;
  insert into public.school_calendar_responses(event_id,user_id,response)
    values(p_event_id,v_uid,upper(btrim(p_response)))
    on conflict(event_id,user_id) do update set response=excluded.response,updated_at=now() returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.respond_to_calendar_event(uuid,text) from public,anon;
grant execute on function public.respond_to_calendar_event(uuid,text) to authenticated;
-- cancel_school_calendar_event remains exactly PR21: lock, idempotence, reason/time.
commit;
