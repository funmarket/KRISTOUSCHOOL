-- KRISTOU SCHOOL — daily Teacher/class Attendance; Owner decisions 2026-11-18.
-- Review candidate only. No hosted execution until exact-SQL approval.
-- One class, responsible Teacher and Africa/Tunis date; no teaching blocks.
begin;
create table public.attendance_registers (
 id uuid primary key default gen_random_uuid(),
 academic_year_id uuid not null references public.academic_years(id) on delete restrict,
 class_id uuid not null references public.school_classes(id) on delete restrict,
 teacher_user_id uuid not null references public.profiles(id) on delete restrict,
 school_date date not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED')),
 version integer not null default 1 check(version>0),
 submitted_at timestamptz, submitted_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(academic_year_id,class_id,teacher_user_id,school_date),
 check((status='DRAFT' and submitted_at is null and submitted_by is null) or
       (status='SUBMITTED' and submitted_at is not null and submitted_by is not null))
);
create index attendance_registers_class_date_idx on public.attendance_registers(class_id,school_date desc);
create table public.attendance_entries (
 register_id uuid not null references public.attendance_registers(id) on delete restrict,
 student_id uuid not null references public.students(id) on delete restrict,
 membership_id uuid not null references public.student_class_memberships(id) on delete restrict,
 mark text check(mark in ('PRESENT','ABSENT','LATE','EXCUSED')),
 internal_comment text not null default '' check(char_length(internal_comment)<=1000),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references public.profiles(id) on delete restrict,
 primary key(register_id,student_id)
);
create index attendance_entries_student_idx on public.attendance_entries(student_id,register_id);
create table public.attendance_events (
 id bigint generated always as identity primary key,
 register_id uuid not null references public.attendance_registers(id) on delete restrict,
 register_version integer not null,
 actor_user_id uuid not null references public.profiles(id) on delete restrict,
 responsible_teacher_user_id uuid not null references public.profiles(id) on delete restrict,
 event_type text not null check(event_type in ('DRAFT_SAVED','SUBMITTED','CORRECTED')),
 reason text,
 before_state jsonb not null,
 after_state jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(register_id,register_version)
);
create table public.attendance_requests (
 actor_user_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 payload_hash text not null,
 register_id uuid not null references public.attendance_registers(id) on delete restrict,
 result jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(actor_user_id,request_id)
);
alter table public.attendance_registers enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_requests enable row level security;
revoke all on public.attendance_registers,public.attendance_entries,public.attendance_events,public.attendance_requests from public,anon,authenticated;
revoke all on sequence public.attendance_events_id_seq from public,anon,authenticated;

create function public.attendance_is_office()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_approved_school_member() and
 (public.current_user_has_role('APP_ADMIN'::public.app_role) or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role));
$$;
create function public.attendance_can_staff_class(p_class_id uuid,p_teacher_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_approved_school_member() and (public.attendance_is_office() or
 (auth.uid()=p_teacher_user_id and public.current_user_has_role('TEACHER'::public.app_role)
  and exists(select 1 from public.teacher_class_assignments a where a.class_id=p_class_id and a.teacher_user_id=auth.uid() and a.active)));
$$;
create function public.attendance_is_family_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_approved_school_member() and
 ((public.current_user_has_role('PARENT'::public.app_role) and exists(select 1 from public.parent_child_links l where l.student_id=p_student_id and l.parent_user_id=auth.uid() and l.active))
 or (public.current_user_has_role('STUDENT'::public.app_role) and exists(select 1 from public.students s where s.id=p_student_id and s.linked_profile_id=auth.uid())));
$$;
create function public.attendance_can_read_register(p_register_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.attendance_registers r where r.id=p_register_id and
 (public.attendance_can_staff_class(r.class_id,r.teacher_user_id) or
 (r.status='SUBMITTED' and exists(select 1 from public.attendance_entries e where e.register_id=r.id and public.attendance_is_family_student(e.student_id)))));
$$;
create function public.attendance_can_read_entry(p_register_id uuid,p_student_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.attendance_registers r where r.id=p_register_id and
 (public.attendance_can_staff_class(r.class_id,r.teacher_user_id) or
 (r.status='SUBMITTED' and public.attendance_is_family_student(p_student_id) and exists(select 1 from public.attendance_entries e where e.register_id=r.id and e.student_id=p_student_id))));
$$;
create policy attendance_register_select on public.attendance_registers for select to authenticated using(public.attendance_can_read_register(id));
create policy attendance_entry_select on public.attendance_entries for select to authenticated using(public.attendance_can_read_entry(register_id,student_id));
create policy attendance_event_staff_select on public.attendance_events for select to authenticated using(exists(select 1 from public.attendance_registers r where r.id=register_id and public.attendance_can_staff_class(r.class_id,r.teacher_user_id)));
-- Requests are internal idempotency receipts, not a client history/read endpoint.
create policy attendance_request_no_client_select on public.attendance_requests for select to authenticated using(false);
grant select on public.attendance_registers to authenticated;
grant select(register_id,student_id,membership_id,mark) on public.attendance_entries to authenticated;
-- Comments, correction reasons and before/after snapshots only through staff RPCs.

create function public.attendance_keep_audit_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'attendance_history_immutable' using errcode='P0001'; end;
$$;
create trigger attendance_events_immutable before update or delete on public.attendance_events for each row execute function public.attendance_keep_audit_immutable();
create trigger attendance_requests_immutable before update or delete on public.attendance_requests for each row execute function public.attendance_keep_audit_immutable();

-- Canonical membership dates are date values. started_at and ended_at are
-- inclusive eligible dates; non-ACTIVE rows require an explicit ended_at.
-- No subject, synthetic class, calendar event or teaching block controls roster.
create function public.attendance_roster(p_class_id uuid,p_school_date date)
returns table(student_id uuid,membership_id uuid,full_name text,student_code text)
language sql stable security definer set search_path=pg_catalog,public as $$
 select distinct on(s.id) s.id,m.id,s.full_name,s.student_code
 from public.student_class_memberships m join public.students s on s.id=m.student_id
 join public.school_classes c on c.id=m.class_id and c.academic_year_id=m.academic_year_id
 where m.class_id=p_class_id and m.started_at<=p_school_date
 and (m.ended_at is null or m.ended_at>=p_school_date)
 and (m.status='ACTIVE' or m.ended_at is not null)
 order by s.id,m.started_at desc,m.id;
$$;
create function public.attendance_roster_fingerprint(p_class_id uuid,p_school_date date)
returns text language sql stable security definer set search_path=pg_catalog,public as $$
 select md5(coalesce(string_agg(student_id::text||':'||membership_id::text,',' order by student_id),''))
 from public.attendance_roster(p_class_id,p_school_date);
$$;

create function public.get_attendance_register(p_class_id uuid,p_school_date date,p_teacher_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_teacher uuid:=coalesce(p_teacher_user_id,auth.uid()); r public.attendance_registers%rowtype; y uuid; items jsonb;
begin
 if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
 if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
 if not public.attendance_can_staff_class(p_class_id,v_teacher) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 select academic_year_id into y from public.school_classes where id=p_class_id;
 if not found or p_school_date is null then raise exception 'invalid_attendance_context' using errcode='P0001'; end if;
 select * into r from public.attendance_registers where class_id=p_class_id and teacher_user_id=v_teacher and school_date=p_school_date and academic_year_id=y;
 -- Submitted roster is its durable entries; later enrollment must not add
 -- unmarked pupils to already-submitted records or expose another day's roster.
 if r.status='SUBMITTED' then
  select coalesce(jsonb_agg(jsonb_build_object('studentId',e.student_id,'membershipId',e.membership_id,'fullName',s.full_name,'studentCode',s.student_code,'mark',e.mark,'internalComment',e.internal_comment) order by s.full_name,s.id),'[]'::jsonb) into items
  from public.attendance_entries e join public.students s on s.id=e.student_id where e.register_id=r.id;
 else
  select coalesce(jsonb_agg(jsonb_build_object('studentId',s.student_id,'membershipId',s.membership_id,'fullName',s.full_name,'studentCode',s.student_code,'mark',e.mark,'internalComment',coalesce(e.internal_comment,'')) order by s.full_name,s.student_id),'[]'::jsonb) into items
  from public.attendance_roster(p_class_id,p_school_date) s left join public.attendance_entries e on e.register_id=r.id and e.student_id=s.student_id;
 end if;
 return jsonb_build_object('registerId',r.id,'academicYearId',y,'classId',p_class_id,'teacherUserId',v_teacher,'schoolDate',p_school_date,'status',coalesce(r.status,'DRAFT'),'version',coalesce(r.version,0),'rosterFingerprint',public.attendance_roster_fingerprint(p_class_id,p_school_date),'entries',items,'submittedAt',r.submitted_at);
end;
$$;

create function public.save_attendance_register(
 p_class_id uuid,p_school_date date,p_expected_version integer,p_roster_fingerprint text,
 p_request_id uuid,p_entries jsonb,p_submit boolean default false,p_reason text default null,p_teacher_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 uid uuid:=auth.uid(); tid uuid:=coalesce(p_teacher_user_id,auth.uid()); c public.school_classes%rowtype;
 r public.attendance_registers%rowtype; old_state jsonb; result jsonb; req public.attendance_requests%rowtype;
 fingerprint text; payload_hash text; item jsonb; sid uuid; mid uuid; next_version integer;
 staff boolean; changed integer:=0; event_kind text; today date:=(clock_timestamp() at time zone 'Africa/Tunis')::date;
begin
 if uid is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
 if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
 if not public.attendance_can_staff_class(p_class_id,tid) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'attendance_requires_read_committed' using errcode='P0001'; end if;
 if p_request_id is null or p_expected_version is null or p_expected_version<0 or p_roster_fingerprint is null
 or p_school_date is null or p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>100 then
  raise exception 'invalid_attendance_input' using errcode='P0001';
 end if;
 -- Lock existing authority rows in Academics-compatible order before register.
 -- Revocation that starts first wins; writes that acquire authority locks first
 -- linearize before revocation. New register writes serialize by natural key.
 perform id from public.profiles where id in(uid,tid) order by id for share;
 perform user_id from public.role_assignments where user_id in(uid,tid) and active order by user_id,id for share;
 select * into c from public.school_classes where id=p_class_id for share;
 if not found then raise exception 'class_not_found' using errcode='P0001'; end if;
 perform id from public.teacher_class_assignments where class_id=p_class_id and teacher_user_id=tid for share;
 if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
 if not public.attendance_can_staff_class(p_class_id,tid) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 staff:=public.attendance_is_office();
 if not exists(select 1 from public.academic_years y where y.id=c.academic_year_id and p_school_date between y.starts_on and y.ends_on)
 or p_school_date>today then raise exception 'invalid_attendance_date' using errcode='P0001'; end if;
 lock table public.student_class_memberships in share mode;
 perform pg_advisory_xact_lock(hashtextextended('attendance:'||c.academic_year_id||':'||p_class_id||':'||tid||':'||p_school_date,0));
 perform pg_advisory_xact_lock(hashtextextended('attendance-request:'||uid||':'||p_request_id,0));
 -- Revalidate AFTER any wait, including register/request serialization waits.
 if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
 if not public.attendance_can_staff_class(p_class_id,tid) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 payload_hash:=md5(jsonb_build_object('class',p_class_id,'teacher',tid,'date',p_school_date,'version',p_expected_version,'roster',p_roster_fingerprint,'entries',p_entries,'submit',coalesce(p_submit,false),'reason',p_reason)::text);
 select * into req from public.attendance_requests where actor_user_id=uid and request_id=p_request_id;
 if found then
  if req.payload_hash<>payload_hash then raise exception 'idempotency_conflict' using errcode='P0001'; end if;
  return req.result;
 end if;
 select * into r from public.attendance_registers where academic_year_id=c.academic_year_id and class_id=p_class_id and teacher_user_id=tid and school_date=p_school_date for update;
 if not (staff and r.id is not null) and not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_user_id
  join public.role_assignments z on z.user_id=p.id and z.active and z.role='TEACHER'::public.app_role
  where a.class_id=p_class_id and a.teacher_user_id=tid and a.active and p.account_status='APPROVED') then
  raise exception 'teacher_assignment_required' using errcode='P0001';
 end if;
 if c.is_archived and not (staff and r.id is not null) then raise exception 'attendance_class_archived' using errcode='P0001'; end if;
 if coalesce(r.version,0)<>p_expected_version then raise exception 'version_conflict' using errcode='P0001'; end if;
 if r.status='SUBMITTED' and not staff and clock_timestamp() >= ((r.school_date+1)::timestamp at time zone 'Africa/Tunis') then
  raise exception 'attendance_correction_window_closed' using errcode='P0001';
 end if;
 if r.status='SUBMITTED' and nullif(btrim(p_reason),'') is null then raise exception 'correction_reason_required' using errcode='P0001'; end if;
 if p_reason is not null and char_length(p_reason)>1000 then raise exception 'invalid_correction_reason' using errcode='P0001'; end if;
 fingerprint:=public.attendance_roster_fingerprint(p_class_id,p_school_date);
 if r.status<>'SUBMITTED' or r.id is null then
  if p_roster_fingerprint<>fingerprint then raise exception 'roster_conflict' using errcode='P0001'; end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p_entries) e group by e->>'studentId' having count(*)>1) then raise exception 'duplicate_student' using errcode='P0001'; end if;
 old_state:=jsonb_build_object('status',r.status,'version',coalesce(r.version,0),'entries',coalesce((select jsonb_agg(to_jsonb(e) order by student_id) from public.attendance_entries e where e.register_id=r.id),'[]'::jsonb));
 next_version:=coalesce(r.version,0)+1;
 if r.id is null then
  insert into public.attendance_registers(academic_year_id,class_id,teacher_user_id,school_date) values(c.academic_year_id,p_class_id,tid,p_school_date) returning * into r;
 end if;
 if r.status='DRAFT' then
  delete from public.attendance_entries e where e.register_id=r.id and not exists(select 1 from public.attendance_roster(p_class_id,p_school_date) s where s.student_id=e.student_id);
 end if;
 for item in select value from jsonb_array_elements(p_entries) loop
  if jsonb_typeof(item)<>'object' or not(item ? 'studentId') or not(item ? 'mark')
   or (item->>'mark' is not null and item->>'mark' not in ('PRESENT','ABSENT','LATE','EXCUSED'))
   or char_length(coalesce(item->>'internalComment',''))>1000 then raise exception 'invalid_attendance_entry' using errcode='P0001'; end if;
  begin sid:=(item->>'studentId')::uuid; exception when invalid_text_representation then raise exception 'invalid_student_id' using errcode='P0001'; end;
  if r.status='SUBMITTED' then
   if item->>'mark' is null then raise exception 'submitted_mark_required' using errcode='P0001'; end if;
   select membership_id into mid from public.attendance_entries where register_id=r.id and student_id=sid;
  else
   select membership_id into mid from public.attendance_roster(p_class_id,p_school_date) where student_id=sid;
  end if;
  if mid is null then raise exception 'student_not_in_register_roster' using errcode='P0001'; end if;
  insert into public.attendance_entries(register_id,student_id,membership_id,mark,internal_comment,updated_by)
  values(r.id,sid,mid,item->>'mark',coalesce(item->>'internalComment',''),uid)
  on conflict(register_id,student_id) do update set mark=excluded.mark,
   internal_comment=case when item ? 'internalComment' then excluded.internal_comment else attendance_entries.internal_comment end,
   updated_by=uid,updated_at=clock_timestamp();
  changed:=changed+1;
 end loop;
 if coalesce(p_submit,false) and r.status='DRAFT' then
  if not exists(select 1 from public.attendance_roster(p_class_id,p_school_date)) then raise exception 'empty_attendance_roster' using errcode='P0001'; end if;
  if exists(select 1 from public.attendance_roster(p_class_id,p_school_date) s left join public.attendance_entries e on e.register_id=r.id and e.student_id=s.student_id where e.mark is null) then raise exception 'attendance_incomplete' using errcode='P0001'; end if;
  event_kind:='SUBMITTED';
  update public.attendance_registers set status='SUBMITTED',submitted_at=clock_timestamp(),submitted_by=uid where id=r.id;
 else event_kind:=case when r.status='SUBMITTED' then 'CORRECTED' else 'DRAFT_SAVED' end;
 end if;
 update public.attendance_registers set version=next_version,updated_at=clock_timestamp() where id=r.id;
 insert into public.attendance_events(register_id,register_version,actor_user_id,responsible_teacher_user_id,event_type,reason,before_state,after_state)
 values(r.id,next_version,uid,tid,event_kind,nullif(btrim(p_reason),''),old_state,jsonb_build_object('status',(select status from public.attendance_registers where id=r.id),'version',next_version,'entries',(select jsonb_agg(to_jsonb(e) order by student_id) from public.attendance_entries e where register_id=r.id)));
 result:=jsonb_build_object('registerId',r.id,'version',next_version,'status',(select status from public.attendance_registers where id=r.id),'requestId',p_request_id);
 insert into public.attendance_requests(actor_user_id,request_id,payload_hash,register_id,result) values(uid,p_request_id,payload_hash,r.id,result);
 return result;
end;
$$;

create function public.list_student_attendance(p_student_id uuid,p_from_date date,p_to_date date)
returns table(register_id uuid,class_id uuid,teacher_user_id uuid,school_date date,mark text)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode='P0001'; end if;
 if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode='P0001'; end if;
 if p_from_date is null or p_to_date is null or p_to_date<p_from_date or p_to_date-p_from_date>366 then raise exception 'invalid_date_range' using errcode='P0001'; end if;
 if not(public.attendance_is_office() or public.attendance_is_family_student(p_student_id) or
   (public.current_user_has_role('TEACHER'::public.app_role) and exists(select 1 from public.student_class_memberships m join public.teacher_class_assignments a on a.class_id=m.class_id and a.active and a.teacher_user_id=auth.uid() where m.student_id=p_student_id and m.status='ACTIVE'))) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 return query select r.id,r.class_id,r.teacher_user_id,r.school_date,e.mark from public.attendance_registers r join public.attendance_entries e on e.register_id=r.id
 where e.student_id=p_student_id and r.status='SUBMITTED' and r.school_date between p_from_date and p_to_date
 and public.attendance_can_read_entry(r.id,e.student_id) order by r.school_date desc,r.id;
end;
$$;
create function public.list_attendance_audit(p_register_id uuid)
returns setof public.attendance_events language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.attendance_registers r where r.id=p_register_id and public.attendance_can_staff_class(r.class_id,r.teacher_user_id)) then raise exception 'insufficient_authority' using errcode='P0001'; end if;
 return query select * from public.attendance_events where register_id=p_register_id order by register_version;
end;
$$;
-- Internal helpers are not user-callable. Only row-policy predicates and the
-- four typed API endpoints are callable by ordinary authenticated sessions.
revoke all on function public.attendance_is_office() from public,anon,authenticated;
revoke all on function public.attendance_can_staff_class(uuid,uuid) from public,anon,authenticated;
revoke all on function public.attendance_is_family_student(uuid) from public,anon,authenticated;
revoke all on function public.attendance_roster(uuid,date) from public,anon,authenticated;
revoke all on function public.attendance_roster_fingerprint(uuid,date) from public,anon,authenticated;
revoke all on function public.attendance_keep_audit_immutable() from public,anon,authenticated;
revoke all on function public.attendance_can_read_register(uuid) from public,anon;
revoke all on function public.attendance_can_read_entry(uuid,uuid) from public,anon;
grant execute on function public.attendance_can_read_register(uuid),public.attendance_can_read_entry(uuid,uuid) to authenticated;
revoke all on function public.get_attendance_register(uuid,date,uuid) from public,anon;
revoke all on function public.save_attendance_register(uuid,date,integer,text,uuid,jsonb,boolean,text,uuid) from public,anon;
revoke all on function public.list_student_attendance(uuid,date,date) from public,anon;
revoke all on function public.list_attendance_audit(uuid) from public,anon;
grant execute on function public.get_attendance_register(uuid,date,uuid),public.save_attendance_register(uuid,date,integer,text,uuid,jsonb,boolean,text,uuid),public.list_student_attendance(uuid,date,date),public.list_attendance_audit(uuid) to authenticated;
commit;
