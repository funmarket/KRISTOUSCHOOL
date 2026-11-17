-- KRISTOU SCHOOL — Packet D: serialize RSVP and calendar cancellation.
-- Forward-only: replaces exactly the two existing CAL-01 functions. The caller,
-- approval, class-scope, RSVP values, return types and function grants stay as-is.
-- Apply only after isolated PostgreSQL tests; this file has NOT been run on hosted Supabase.
-- Both operations lock school_calendar_events(id) FOR UPDATE before their
-- first event-state decision. At READ COMMITTED, the waiter sees the committed
-- status when the first transaction releases the lock.

create or replace function public.respond_to_calendar_event(
  p_event_id uuid,
  p_response text
)
returns public.school_calendar_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.school_calendar_events%rowtype;
  v_row public.school_calendar_responses%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;

  -- Deliberately lock the SAME parent row as cancellation, before checking
  -- status, class access or writing the RSVP. This prevents TOCTOU insertion
  -- after cancellation in another concurrent transaction.
  select * into v_ev
    from public.school_calendar_events
   where id = p_event_id
   for update;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  if v_ev.class_id is not null and not public.can_access_class(v_ev.class_id) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;
  if v_ev.status = 'CANCELLED' then
    raise exception 'calendar_event_cancelled' using errcode = 'P0001';
  end if;

  -- The existing unique(event_id,user_id) ensures same-user retries update
  -- rather than create an additional response. DB constraint retains exactly
  -- ATTENDING / ACKNOWLEDGED / DECLINED.
  insert into public.school_calendar_responses (event_id, user_id, response)
  values (p_event_id, v_uid, upper(btrim(p_response)))
  on conflict (event_id, user_id) do update set response = excluded.response, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.respond_to_calendar_event(uuid, text) from public, anon;
grant execute on function public.respond_to_calendar_event(uuid, text) to authenticated;

create or replace function public.cancel_school_calendar_event(
  p_event_id uuid,
  p_reason text
)
returns public.school_calendar_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.school_calendar_events%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CALENDAR_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  -- Same event-row lock and ordering as the response RPC: one serialization
  -- point. Repeated cancellation is idempotent, preserving the first reason
  -- and update timestamp instead of producing a second logical cancellation.
  select * into v_row
    from public.school_calendar_events
   where id = p_event_id
   for update;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  if v_row.status = 'CANCELLED' then return v_row; end if;

  update public.school_calendar_events
     set status = 'CANCELLED',
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         updated_at = now()
   where id = p_event_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.cancel_school_calendar_event(uuid, text) from public, anon;
grant execute on function public.cancel_school_calendar_event(uuid, text) to authenticated;
