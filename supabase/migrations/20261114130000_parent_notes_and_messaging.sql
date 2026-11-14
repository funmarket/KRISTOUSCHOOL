-- KRISTOU SCHOOL — Parent Notes (Africa/Tunis 08:00-18:00, 11/day quota) & Operational Messaging
-- F3-C2, COM-04
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

-- 1. Parent Notes
create table if not exists public.parent_notes (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles(id) on delete cascade,
  parent_name text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text not null,
  class_id uuid references public.school_classes(id) on delete set null,
  recipient_teacher_id uuid references public.profiles(id) on delete set null,
  topic text not null check (topic in ('ABSENCE', 'HOMEWORK', 'BEHAVIOR', 'HEALTH', 'PICKUP', 'OTHER')),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  school_day date not null,
  status text not null default 'SENT' check (status in ('SENT', 'READ', 'REPLIED')),
  reply_content text,
  replied_by_user_id uuid references public.profiles(id) on delete set null,
  replied_by_name text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parent_notes_parent_day_idx
  on public.parent_notes (parent_user_id, school_day);

drop trigger if exists parent_notes_set_updated_at on public.parent_notes;
create trigger parent_notes_set_updated_at before update on public.parent_notes
  for each row execute function public.set_updated_at();

alter table public.parent_notes enable row level security;
revoke all on public.parent_notes from anon, authenticated;
grant select on public.parent_notes to authenticated;

drop policy if exists parent_notes_scoped_select on public.parent_notes;
create policy parent_notes_scoped_select on public.parent_notes for select to authenticated
  using (
    public.is_approved_school_member() and (
      (parent_user_id = auth.uid() and exists (
        select 1 from public.parent_child_links pcl
        where pcl.parent_user_id = auth.uid() and pcl.student_id = parent_notes.student_id and pcl.active = true
      ))
      or public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('COMMUNITY_MODERATE')
      or (class_id is not null and exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = parent_notes.class_id and tca.teacher_user_id = auth.uid() and tca.active = true
      ))
    )
  );

create or replace function public.send_parent_note(
  p_student_id uuid,
  p_topic text,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tunis_now timestamp := (now() at time zone 'Africa/Tunis');
  v_tunis_time time := (now() at time zone 'Africa/Tunis')::time;
  v_school_day date := (now() at time zone 'Africa/Tunis')::date;
  v_clean_content text := btrim(coalesce(p_content, ''));
  v_used_count integer;
  v_parent_prof public.profiles%rowtype;
  v_student public.students%rowtype;
  v_class_id uuid;
  v_teacher_id uuid;
  v_note public.parent_notes%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not public.current_user_has_role('PARENT'::public.app_role) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  -- Strictly enforce Africa/Tunis [08:00, 18:00) window
  if v_tunis_time < time '08:00:00' or v_tunis_time >= time '18:00:00' then
    raise exception 'parent_notes_outside_window' using errcode = 'P0001';
  end if;

  if char_length(v_clean_content) < 1 or char_length(v_clean_content) > 1000 then
    raise exception 'invalid_note_content' using errcode = 'P0001';
  end if;

  -- Advisory transaction lock guarantees atomic 11/day quota across concurrent Browser & Telegram requests
  perform pg_advisory_xact_lock(hashtext('parent_note:' || v_uid::text));

  select * into v_parent_prof from public.profiles where id = v_uid for share;
  if v_parent_prof.account_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not public.current_user_has_role('PARENT'::public.app_role) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.parent_child_links pcl
    join public.students st on st.id = pcl.student_id and st.status = 'ACTIVE'
    where pcl.parent_user_id = v_uid and pcl.student_id = p_student_id and pcl.active = true
  ) then
    raise exception 'child_not_linked' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_used_count
  from public.parent_notes
  where parent_user_id = v_uid and school_day = v_school_day;

  if v_used_count >= 11 then
    raise exception 'parent_notes_daily_quota_exceeded' using errcode = 'P0001';
  end if;

  select * into v_student from public.students where id = p_student_id;

  select scm.class_id into v_class_id
  from public.student_class_memberships scm
  where scm.student_id = p_student_id and scm.status = 'ACTIVE'
  limit 1;

  if v_class_id is not null then
    select tca.teacher_user_id into v_teacher_id
    from public.teacher_class_assignments tca
    where tca.class_id = v_class_id and tca.active = true
    order by tca.is_homeroom desc, tca.created_at asc
    limit 1;
  end if;

  insert into public.parent_notes (
    parent_user_id, parent_name, student_id, student_name,
    class_id, recipient_teacher_id, topic, content, school_day, status
  ) values (
    v_uid, coalesce(v_parent_prof.full_name, v_parent_prof.username),
    v_student.id, v_student.full_name,
    v_class_id, v_teacher_id, upper(btrim(p_topic)), v_clean_content, v_school_day, 'SENT'
  ) returning * into v_note;

  if v_teacher_id is not null then
    perform public.enqueue_school_notification(
      v_teacher_id, 'note',
      'New Parent Note Received',
      'A parent note was logged for ' || v_student.full_name || '.',
      'notes', v_note.id::text
    );
  end if;

  return jsonb_build_object(
    'note', row_to_json(v_note)::jsonb,
    'remainingToday', 11 - (v_used_count + 1)
  );
end;
$$;

revoke all on function public.send_parent_note(uuid, text, text) from public, anon;
grant execute on function public.send_parent_note(uuid, text, text) to authenticated;

create or replace function public.reply_parent_note(
  p_note_id uuid,
  p_reply_content text
)
returns public.parent_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_note public.parent_notes%rowtype;
  v_clean text := btrim(coalesce(p_reply_content, ''));
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 1000 then
    raise exception 'invalid_reply_content' using errcode = 'P0001';
  end if;

  select * into v_note from public.parent_notes where id = p_note_id for update;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;

  select account_status into v_prof.account_status from public.profiles where id = v_uid for share;
  if v_prof.account_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('COMMUNITY_MODERATE')
    or (
      v_note.class_id is not null
      and public.current_user_has_role('TEACHER'::public.app_role)
      and exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = v_note.class_id and tca.teacher_user_id = v_uid and tca.active = true
      )
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_prof from public.profiles where id = v_uid;

  update public.parent_notes
     set reply_content = v_clean,
         status = 'REPLIED',
         replied_by_user_id = v_uid,
         replied_by_name = coalesce(v_prof.full_name, v_prof.username),
         replied_at = now(),
         updated_at = now()
   where id = p_note_id
  returning * into v_note;

  perform public.enqueue_school_notification(
    v_note.parent_user_id, 'note',
    'School Reply to Parent Note',
    'The school replied to your note for ' || v_note.student_name || '.',
    'notes', v_note.id::text
  );

  return v_note;
end;
$$;

revoke all on function public.reply_parent_note(uuid, text) from public, anon;
grant execute on function public.reply_parent_note(uuid, text) to authenticated;

-- 2. Operational Short Messages (COM-04 — max 200 chars, no student private DMs!)
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '' check (char_length(subject) <= 140),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  last_message_preview text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread boolean not null default false,
  unique (thread_id, user_id)
);

create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  content text not null check (char_length(btrim(content)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.message_threads enable row level security;
alter table public.thread_participants enable row level security;
alter table public.thread_messages enable row level security;

revoke all on public.message_threads from anon, authenticated;
revoke all on public.thread_participants from anon, authenticated;
revoke all on public.thread_messages from anon, authenticated;

grant select on public.message_threads to authenticated;
grant select on public.thread_participants to authenticated;
grant select on public.thread_messages to authenticated;

-- Authoritative private policy function (COM-04; full abuse/history policy remains tracked under DG-17).
-- Internal helper only (revoked from public/anon/authenticated) so callers cannot probe third-party pairs.
create or replace function public.can_users_direct_message(
  p_sender_id uuid,
  p_recipient_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sender_status public.account_approval_status;
  v_recipient_status public.account_approval_status;
  v_sender_roles text[];
  v_recipient_roles text[];
  v_sender_is_office boolean;
  v_recipient_is_office boolean;
  v_sender_is_parent boolean;
  v_recipient_is_parent boolean;
  v_sender_is_teacher boolean;
  v_recipient_is_teacher boolean;
  v_has_class_link boolean;
begin
  if p_sender_id is null or p_recipient_id is null or p_sender_id = p_recipient_id then
    return false;
  end if;

  select p.account_status into v_sender_status from public.profiles p where p.id = p_sender_id;
  select p.account_status into v_recipient_status from public.profiles p where p.id = p_recipient_id;
  if v_sender_status is distinct from 'APPROVED'::public.account_approval_status
     or v_recipient_status is distinct from 'APPROVED'::public.account_approval_status then
    return false;
  end if;

  select coalesce(array_agg(ra.role::text), '{}'::text[])
    into v_sender_roles
    from public.role_assignments ra
   where ra.user_id = p_sender_id and ra.active = true;

  select coalesce(array_agg(ra.role::text), '{}'::text[])
    into v_recipient_roles
    from public.role_assignments ra
   where ra.user_id = p_recipient_id and ra.active = true;

  if coalesce(array_length(v_sender_roles, 1), 0) = 0
     or coalesce(array_length(v_recipient_roles, 1), 0) = 0 then
    return false;
  end if;

  -- Strictly exclude private student DMs
  if 'STUDENT' = any(v_sender_roles) or 'STUDENT' = any(v_recipient_roles) then
    return false;
  end if;

  v_sender_is_office := (v_sender_roles && array['APP_ADMIN', 'ADMINISTRATIVE_PERSONNEL', 'MANAGER']::text[]);
  v_recipient_is_office := (v_recipient_roles && array['APP_ADMIN', 'ADMINISTRATIVE_PERSONNEL', 'MANAGER']::text[]);
  if v_sender_is_office or v_recipient_is_office then
    return true;
  end if;

  v_sender_is_parent := ('PARENT' = any(v_sender_roles));
  v_recipient_is_parent := ('PARENT' = any(v_recipient_roles));
  v_sender_is_teacher := ('TEACHER' = any(v_sender_roles));
  v_recipient_is_teacher := ('TEACHER' = any(v_recipient_roles));

  if v_sender_is_parent and v_recipient_is_teacher then
    select exists (
      select 1
      from public.parent_child_links pcl
      join public.students st on st.id = pcl.student_id and st.status = 'ACTIVE'
      join public.student_class_memberships scm on scm.student_id = pcl.student_id and scm.status = 'ACTIVE'
      join public.teacher_class_assignments tca on tca.class_id = scm.class_id and tca.active = true
      where pcl.parent_user_id = p_sender_id
        and pcl.active = true
        and tca.teacher_user_id = p_recipient_id
    ) into v_has_class_link;
    return coalesce(v_has_class_link, false);
  end if;

  if v_sender_is_teacher and v_recipient_is_parent then
    select exists (
      select 1
      from public.parent_child_links pcl
      join public.students st on st.id = pcl.student_id and st.status = 'ACTIVE'
      join public.student_class_memberships scm on scm.student_id = pcl.student_id and scm.status = 'ACTIVE'
      join public.teacher_class_assignments tca on tca.class_id = scm.class_id and tca.active = true
      where pcl.parent_user_id = p_recipient_id
        and pcl.active = true
        and tca.teacher_user_id = p_sender_id
    ) into v_has_class_link;
    return coalesce(v_has_class_link, false);
  end if;

  -- Deny Parent<->Parent, Parent<->SchoolStaff, SchoolStaff<->Parent
  if v_sender_is_parent or v_recipient_is_parent then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.can_users_direct_message(uuid, uuid) from public, anon, authenticated;

-- Non-recursive SECURITY DEFINER membership helper (resolves 42P17 recursion on thread_participants).
-- Derives caller exclusively from auth.uid(); exposes no arbitrary participant lookup/mutation.
-- Historical access policy (docs/CANONICAL_MODEL.md Invariant 13 & Family / DG-17):
--   Historical messages remain preserved in DB, while active thread reads & replies fail closed unless the
--   caller is APPROVED, non-STUDENT, a participant, and maintains a valid current messaging relationship.
create or replace function public.can_access_message_thread(p_thread_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_thread_id is null then
    return false;
  end if;
  if not public.is_approved_school_member() then
    return false;
  end if;
  if public.current_user_has_role('STUDENT'::public.app_role) then
    return false;
  end if;
  if not exists (
    select 1 from public.thread_participants tp_self
    where tp_self.thread_id = p_thread_id and tp_self.user_id = v_uid
  ) then
    return false;
  end if;
  return exists (
    select 1
    from public.thread_participants tp_other
    where tp_other.thread_id = p_thread_id
      and tp_other.user_id <> v_uid
      and public.can_users_direct_message(v_uid, tp_other.user_id)
  );
end;
$$;

revoke all on function public.can_access_message_thread(uuid) from public, anon;
grant execute on function public.can_access_message_thread(uuid) to authenticated;

drop policy if exists message_threads_participant_select on public.message_threads;
create policy message_threads_participant_select on public.message_threads for select to authenticated
  using (public.can_access_message_thread(id));

drop policy if exists thread_participants_select on public.thread_participants;
create policy thread_participants_select on public.thread_participants for select to authenticated
  using (public.can_access_message_thread(thread_id));

drop policy if exists thread_messages_select on public.thread_messages;
create policy thread_messages_select on public.thread_messages for select to authenticated
  using (public.can_access_message_thread(thread_id));

create or replace function public.list_approved_message_recipients()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if public.current_user_has_role('STUDENT'::public.app_role) then
    raise exception 'students_cannot_direct_message' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'fullName', coalesce(p.full_name, p.username),
    'role', ra.role::text
  ) order by coalesce(p.full_name, p.username)), '[]'::jsonb)
  into v_res
  from public.profiles p
  join public.role_assignments ra on ra.user_id = p.id and ra.active = true
  where p.id <> v_uid
    and public.can_users_direct_message(v_uid, p.id);

  return v_res;
end;
$$;

revoke all on function public.list_approved_message_recipients() from public, anon;
grant execute on function public.list_approved_message_recipients() to authenticated;

create or replace function public.send_operational_message(
  p_recipient_user_id uuid,
  p_subject text,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_content, ''));
  v_sender public.profiles%rowtype;
  v_thread_id uuid;
  v_msg public.thread_messages%rowtype;
  v_first_lock uuid;
  v_second_lock uuid;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if public.current_user_has_role('STUDENT'::public.app_role) then
    raise exception 'students_cannot_direct_message' using errcode = 'P0001';
  end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 200 then
    raise exception 'message_length_invalid' using errcode = 'P0001';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_uid then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;

  -- Lock sender and recipient profiles in deterministic UUID order to prevent concurrent suspension races
  v_first_lock := least(v_uid, p_recipient_user_id);
  v_second_lock := greatest(v_uid, p_recipient_user_id);
  perform 1 from public.profiles where id = v_first_lock for share;
  perform 1 from public.profiles where id = v_second_lock for share;

  if not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if not public.can_users_direct_message(v_uid, p_recipient_user_id) then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;

  select * into v_sender from public.profiles where id = v_uid;

  insert into public.message_threads (subject, created_by_user_id, last_message_preview)
  values (left(btrim(coalesce(p_subject, '')), 140), v_uid, left(v_clean, 120))
  returning id into v_thread_id;

  insert into public.thread_participants (thread_id, user_id, unread) values
    (v_thread_id, v_uid, false),
    (v_thread_id, p_recipient_user_id, true);

  insert into public.thread_messages (thread_id, sender_user_id, sender_name, content)
  values (v_thread_id, v_uid, coalesce(v_sender.full_name, v_sender.username), v_clean)
  returning * into v_msg;

  perform public.enqueue_school_notification(
    p_recipient_user_id, 'message',
    'New School Message',
    'You received a short operational message from ' || coalesce(v_sender.full_name, v_sender.username) || '.',
    'messages', v_thread_id::text
  );

  return jsonb_build_object('threadId', v_thread_id, 'message', row_to_json(v_msg)::jsonb);
end;
$$;

create or replace function public.reply_operational_thread(
  p_thread_id uuid,
  p_content text
)
returns public.thread_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_content, ''));
  v_sender public.profiles%rowtype;
  v_msg public.thread_messages%rowtype;
  v_locked_thread_id uuid;
  v_other record;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if public.current_user_has_role('STUDENT'::public.app_role) then
    raise exception 'students_cannot_direct_message' using errcode = 'P0001';
  end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 200 then
    raise exception 'message_length_invalid' using errcode = 'P0001';
  end if;

  select id into v_locked_thread_id from public.message_threads where id = p_thread_id for update;
  if not found then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  select * into v_sender from public.profiles where id = v_uid for share;
  if v_sender.account_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;
  if public.current_user_has_role('STUDENT'::public.app_role) then
    raise exception 'students_cannot_direct_message' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.thread_participants tp
    where tp.thread_id = p_thread_id and tp.user_id = v_uid
  ) or not exists (
    select 1 from public.thread_participants tp_other
    where tp_other.thread_id = p_thread_id
      and tp_other.user_id <> v_uid
      and public.can_users_direct_message(v_uid, tp_other.user_id)
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  insert into public.thread_messages (thread_id, sender_user_id, sender_name, content)
  values (p_thread_id, v_uid, coalesce(v_sender.full_name, v_sender.username), v_clean)
  returning * into v_msg;

  update public.message_threads
     set last_message_preview = left(v_clean, 120), updated_at = now()
   where id = p_thread_id;

  update public.thread_participants
     set unread = true
   where thread_id = p_thread_id and user_id <> v_uid;

  for v_other in
    select tp.user_id from public.thread_participants tp
    where tp.thread_id = p_thread_id and tp.user_id <> v_uid
  loop
    perform public.enqueue_school_notification(
      v_other.user_id, 'message',
      'New Thread Reply',
      'You received a short reply from ' || coalesce(v_sender.full_name, v_sender.username) || '.',
      'messages', p_thread_id::text
    );
  end loop;

  return v_msg;
end;
$$;

revoke all on function public.send_operational_message(uuid, text, text) from public, anon;
grant execute on function public.send_operational_message(uuid, text, text) to authenticated;
revoke all on function public.reply_operational_thread(uuid, text) from public, anon;
grant execute on function public.reply_operational_thread(uuid, text) to authenticated;
