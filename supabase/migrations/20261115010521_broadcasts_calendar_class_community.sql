-- KRISTOU SCHOOL — School Broadcasts, Global/Class Calendar & Class Community
-- COM-02, CAL-01/02/03, COM-03, F3-C3
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

-- 1. School-wide Broadcasts (distinct from private class announcements; visible to all 7 approved roles including SCHOOL_STAFF)
create table if not exists public.school_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 2 and 3000),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'URGENT')),
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'REVOKED')),
  audience_scope text not null default 'ALL_SCHOOL' check (
    audience_scope in ('ALL_SCHOOL', 'ALL_CLASSES', 'SELECTED_LEVELS', 'SELECTED_CLASSES', 'PUBLIC_SITE')
  ),
  target_level_codes text[] not null default '{}'::text[],
  target_class_ids uuid[] not null default '{}'::uuid[],
  is_public boolean not null default false,
  published_at timestamptz default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_broadcasts_public_scope_chk check (not is_public or audience_scope = 'PUBLIC_SITE'),
  constraint school_broadcasts_selected_levels_nonempty_chk check (
    audience_scope <> 'SELECTED_LEVELS' or coalesce(array_length(target_level_codes, 1), 0) >= 1
  ),
  constraint school_broadcasts_selected_classes_nonempty_chk check (
    audience_scope <> 'SELECTED_CLASSES' or coalesce(array_length(target_class_ids, 1), 0) >= 1
  )
);

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
      from unnest(v_clean_levels) as code
      where not exists (select 1 from public.school_levels sl where sl.code = code)
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

drop trigger if exists school_broadcasts_validate_targets_trg on public.school_broadcasts;
create trigger school_broadcasts_validate_targets_trg
  before insert or update on public.school_broadcasts
  for each row execute function public.validate_school_broadcast_targets();

-- 2. Canonical School & Class Calendar Events (Africa/Tunis; date-only spans supported)
create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '',
  category text not null default 'EVENT' check (category in ('EXAM', 'TEST', 'EVENT', 'HOLIDAY', 'MEETING', 'CLOSURE', 'ACTIVITY', 'TRIP', 'OTHER')),
  start_date date not null,
  end_date date not null,
  is_all_day boolean not null default true,
  start_time time,
  end_time time,
  timezone text not null default 'Africa/Tunis',
  is_public boolean not null default false,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED', 'RESCHEDULED')),
  cancellation_reason text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.school_calendar_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.school_calendar_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('ATTENDING', 'ACKNOWLEDGED', 'DECLINED')),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- 3. Class Community Subtables
create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 2 and 3000),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'URGENT')),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_role text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_homework_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '',
  due_date date not null,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  teacher_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_documents (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '',
  document_url text not null,
  file_type text not null default 'PDF',
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.class_gallery_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  caption text not null default '',
  image_url text not null,
  is_public boolean not null default false,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.class_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  content text not null check (char_length(btrim(content)) between 1 and 200),
  is_hidden boolean not null default false,
  moderated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.class_questions(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  content text not null check (char_length(btrim(content)) between 1 and 200),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Triggers
drop trigger if exists school_broadcasts_set_updated_at on public.school_broadcasts;
create trigger school_broadcasts_set_updated_at before update on public.school_broadcasts for each row execute function public.set_updated_at();
drop trigger if exists school_calendar_events_set_updated_at on public.school_calendar_events;
create trigger school_calendar_events_set_updated_at before update on public.school_calendar_events for each row execute function public.set_updated_at();

-- Enable RLS & least-privilege grants
alter table public.school_broadcasts enable row level security;
alter table public.school_calendar_events enable row level security;
alter table public.school_calendar_responses enable row level security;
alter table public.class_announcements enable row level security;
alter table public.class_homework_items enable row level security;
alter table public.class_documents enable row level security;
alter table public.class_gallery_items enable row level security;
alter table public.class_questions enable row level security;
alter table public.class_question_replies enable row level security;

revoke all on public.school_broadcasts from anon, authenticated;
revoke all on public.school_calendar_events from anon, authenticated;
revoke all on public.school_calendar_responses from anon, authenticated;
revoke all on public.class_announcements from anon, authenticated;
revoke all on public.class_homework_items from anon, authenticated;
revoke all on public.class_documents from anon, authenticated;
revoke all on public.class_gallery_items from anon, authenticated;
revoke all on public.class_questions from anon, authenticated;
revoke all on public.class_question_replies from anon, authenticated;

grant select on public.school_broadcasts to anon, authenticated;
grant select on public.school_calendar_events to anon, authenticated;
grant select on public.school_calendar_responses to authenticated;
grant select on public.class_announcements to authenticated;
grant select on public.class_homework_items to authenticated;
grant select on public.class_documents to authenticated;
grant select on public.class_gallery_items to anon, authenticated;
grant select on public.class_questions to authenticated;
grant select on public.class_question_replies to authenticated;

drop policy if exists broadcasts_public_select on public.school_broadcasts;
create policy broadcasts_public_select on public.school_broadcasts for select to anon
  using (status = 'PUBLISHED' and audience_scope = 'PUBLIC_SITE' and is_public = true);

drop policy if exists broadcasts_member_select on public.school_broadcasts;
create policy broadcasts_member_select on public.school_broadcasts for select to authenticated
  using (
    (status = 'PUBLISHED' and audience_scope = 'PUBLIC_SITE' and is_public = true)
    or (
      public.is_approved_school_member() and (
        public.current_user_has_role('APP_ADMIN'::public.app_role)
        or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
        or public.current_user_has_capability('BROADCAST_MANAGE')
        or (status = 'PUBLISHED' and audience_scope in ('ALL_SCHOOL', 'PUBLIC_SITE'))
        or (status = 'PUBLISHED' and audience_scope = 'ALL_CLASSES' and exists (
          select 1 from public.school_classes sc
          where sc.is_archived = false and public.can_access_class(sc.id)
        ))
        or (status = 'PUBLISHED' and audience_scope = 'SELECTED_LEVELS' and exists (
          select 1 from public.school_classes sc
          where sc.is_archived = false
            and sc.level_code = any(school_broadcasts.target_level_codes)
            and public.can_access_class(sc.id)
        ))
        or (status = 'PUBLISHED' and audience_scope = 'SELECTED_CLASSES' and exists (
          select 1 from public.school_classes sc
          where sc.is_archived = false
            and sc.id = any(school_broadcasts.target_class_ids)
            and public.can_access_class(sc.id)
        ))
      )
    )
  );

drop policy if exists calendar_public_select on public.school_calendar_events;
create policy calendar_public_select on public.school_calendar_events for select to anon
  using (class_id is null and is_public = true and status <> 'CANCELLED');

drop policy if exists calendar_member_select on public.school_calendar_events;
create policy calendar_member_select on public.school_calendar_events for select to authenticated
  using (
    (class_id is null and is_public = true)
    or (
      public.is_approved_school_member() and (
        class_id is null
        or public.can_access_class(class_id)
      )
    )
  );

drop policy if exists calendar_resp_select on public.school_calendar_responses;
create policy calendar_resp_select on public.school_calendar_responses for select to authenticated
  using (user_id = auth.uid() and public.is_approved_school_member());

drop policy if exists class_ann_select on public.class_announcements;
create policy class_ann_select on public.class_announcements for select to authenticated
  using (public.can_access_class(class_id));

drop policy if exists class_hw_select on public.class_homework_items;
create policy class_hw_select on public.class_homework_items for select to authenticated
  using (public.can_access_class(class_id));

drop policy if exists class_docs_select on public.class_documents;
create policy class_docs_select on public.class_documents for select to authenticated
  using (public.can_access_class(class_id));

drop policy if exists class_gallery_public_select on public.class_gallery_items;
create policy class_gallery_public_select on public.class_gallery_items for select to anon
  using (class_id is null and is_public = true);

drop policy if exists class_gallery_member_select on public.class_gallery_items;
create policy class_gallery_member_select on public.class_gallery_items for select to authenticated
  using ((class_id is null and is_public = true) or (class_id is not null and public.can_access_class(class_id)));

drop policy if exists class_questions_select on public.class_questions;
create policy class_questions_select on public.class_questions for select to authenticated
  using (
    public.can_access_class(class_id)
    and (not is_hidden or public.current_user_has_role('APP_ADMIN'::public.app_role) or public.current_user_has_role('TEACHER'::public.app_role) or public.current_user_has_capability('COMMUNITY_MODERATE'))
  );

drop policy if exists class_question_replies_select on public.class_question_replies;
create policy class_question_replies_select on public.class_question_replies for select to authenticated
  using (
    exists (
      select 1 from public.class_questions q
      where q.id = class_question_replies.question_id and public.can_access_class(q.class_id)
    )
    and not is_hidden
  );

-- 4. RPCs for Broadcasts, Calendar, Class Content & Q&A
drop function if exists public.publish_school_broadcast(text, text, text, text, boolean, uuid[]);
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
      select 1 from unnest(v_levels) as code
      where not exists (select 1 from public.school_levels sl where sl.code = code)
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

revoke all on function public.publish_school_broadcast(text, text, text, text, boolean, uuid[], text[]) from public, anon;
grant execute on function public.publish_school_broadcast(text, text, text, text, boolean, uuid[], text[]) to authenticated;

create or replace function public.upsert_school_calendar_event(
  p_title text,
  p_description text,
  p_category text,
  p_start_date date,
  p_end_date date default null,
  p_class_id uuid default null,
  p_is_all_day boolean default true,
  p_is_public boolean default false
)
returns public.school_calendar_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_end date := coalesce(p_end_date, p_start_date);
  v_row public.school_calendar_events%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if v_end < p_start_date then raise exception 'invalid_date_range' using errcode = 'P0001'; end if;

  if p_class_id is null then
    if not (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CALENDAR_MANAGE')
    ) then
      raise exception 'insufficient_authority' using errcode = 'P0001';
    end if;
  else
    if not (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CALENDAR_MANAGE')
      or (
        public.current_user_has_role('TEACHER'::public.app_role)
        and exists (
          select 1 from public.teacher_class_assignments tca
          where tca.class_id = p_class_id and tca.teacher_user_id = v_uid and tca.active = true
        )
      )
    ) then
      raise exception 'insufficient_authority' using errcode = 'P0001';
    end if;
  end if;

  insert into public.school_calendar_events (
    class_id, title, description, category, start_date, end_date, is_all_day, is_public, created_by
  ) values (
    p_class_id, btrim(p_title), coalesce(btrim(p_description), ''), upper(btrim(coalesce(p_category, 'EVENT'))),
    p_start_date, v_end, coalesce(p_is_all_day, true), (p_class_id is null and coalesce(p_is_public, false)), v_uid
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_school_calendar_event(text, text, text, date, date, uuid, boolean, boolean) from public, anon;
grant execute on function public.upsert_school_calendar_event(text, text, text, date, date, uuid, boolean, boolean) to authenticated;

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

  update public.school_calendar_events
     set status = 'CANCELLED',
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         updated_at = now()
   where id = p_event_id
  returning * into v_row;

  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  return v_row;
end;
$$;

revoke all on function public.cancel_school_calendar_event(uuid, text) from public, anon;
grant execute on function public.cancel_school_calendar_event(uuid, text) to authenticated;

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
  select * into v_ev from public.school_calendar_events where id = p_event_id;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  if v_ev.class_id is not null and not public.can_access_class(v_ev.class_id) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  insert into public.school_calendar_responses (event_id, user_id, response)
  values (p_event_id, v_uid, upper(btrim(p_response)))
  on conflict (event_id, user_id) do update set response = excluded.response, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.respond_to_calendar_event(uuid, text) from public, anon;
grant execute on function public.respond_to_calendar_event(uuid, text) to authenticated;

create or replace function public.create_class_announcement(
  p_class_id uuid,
  p_title text,
  p_body text,
  p_priority text default 'NORMAL'
)
returns public.class_announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_row public.class_announcements%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_capability('COMMUNITY_MODERATE')
    or (
      public.current_user_has_role('TEACHER'::public.app_role)
      and exists (select 1 from public.teacher_class_assignments tca where tca.class_id = p_class_id and tca.teacher_user_id = v_uid and tca.active = true)
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  insert into public.class_announcements (class_id, title, body, priority, author_user_id, author_name, author_role)
  values (p_class_id, btrim(p_title), btrim(p_body), coalesce(p_priority, 'NORMAL'), v_uid, coalesce(v_prof.full_name, v_prof.username), 'Enseignant')
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_class_announcement(uuid, text, text, text) from public, anon;
grant execute on function public.create_class_announcement(uuid, text, text, text) to authenticated;

create or replace function public.create_class_homework(
  p_class_id uuid,
  p_title text,
  p_description text,
  p_due_date date
)
returns public.class_homework_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_row public.class_homework_items%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_capability('COMMUNITY_MODERATE')
    or (
      public.current_user_has_role('TEACHER'::public.app_role)
      and exists (select 1 from public.teacher_class_assignments tca where tca.class_id = p_class_id and tca.teacher_user_id = v_uid and tca.active = true)
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  insert into public.class_homework_items (class_id, title, description, due_date, author_user_id, teacher_name)
  values (p_class_id, btrim(p_title), coalesce(btrim(p_description), ''), p_due_date, v_uid, coalesce(v_prof.full_name, v_prof.username))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_class_homework(uuid, text, text, date) from public, anon;
grant execute on function public.create_class_homework(uuid, text, text, date) to authenticated;

create or replace function public.post_class_question(
  p_class_id uuid,
  p_content text
)
returns public.class_questions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_content, ''));
  v_prof public.profiles%rowtype;
  v_row public.class_questions%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not public.can_access_class(p_class_id) then raise exception 'insufficient_authority' using errcode = 'P0001'; end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 200 then
    raise exception 'question_length_invalid' using errcode = 'P0001';
  end if;

  select * into v_prof from public.profiles where id = v_uid for share;
  if v_prof.account_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member()
     or not public.can_access_class(p_class_id) then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  insert into public.class_questions (class_id, author_user_id, author_name, content)
  values (p_class_id, v_uid, coalesce(v_prof.full_name, v_prof.username), v_clean)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.post_class_question(uuid, text) from public, anon;
grant execute on function public.post_class_question(uuid, text) to authenticated;

create or replace function public.reply_class_question(
  p_question_id uuid,
  p_content text
)
returns public.class_question_replies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_content, ''));
  v_q public.class_questions%rowtype;
  v_prof public.profiles%rowtype;
  v_row public.class_question_replies%rowtype;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  select * into v_q from public.class_questions where id = p_question_id for share;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  if not public.can_access_class(v_q.class_id) then raise exception 'insufficient_authority' using errcode = 'P0001'; end if;
  if v_q.is_hidden and not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('TEACHER'::public.app_role)
    or public.current_user_has_capability('COMMUNITY_MODERATE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 200 then
    raise exception 'reply_length_invalid' using errcode = 'P0001';
  end if;

  select * into v_prof from public.profiles where id = v_uid for share;
  if v_prof.account_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member()
     or not public.can_access_class(v_q.class_id) then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  insert into public.class_question_replies (question_id, author_user_id, author_name, content)
  values (p_question_id, v_uid, coalesce(v_prof.full_name, v_prof.username), v_clean)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.reply_class_question(uuid, text) from public, anon;
grant execute on function public.reply_class_question(uuid, text) to authenticated;

create or replace function public.moderate_class_question(
  p_question_id uuid,
  p_hidden boolean
)
returns public.class_questions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_q public.class_questions%rowtype;
  v_caller_status public.account_approval_status;
begin
  if v_uid is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;

  -- Lock target question first, then share-lock caller profile so concurrent suspension/revocation serializes cleanly
  select * into v_q from public.class_questions where id = p_question_id for update;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;

  select account_status into v_caller_status from public.profiles where id = v_uid for share;
  if v_caller_status is distinct from 'APPROVED'::public.account_approval_status
     or not public.is_approved_school_member() then
    raise exception 'actor_not_approved' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_capability('COMMUNITY_MODERATE')
    or (
      public.current_user_has_role('TEACHER'::public.app_role)
      and exists (
        select 1 from public.teacher_class_assignments tca
        where tca.class_id = v_q.class_id and tca.teacher_user_id = v_uid and tca.active = true
      )
    )
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  update public.class_questions
     set is_hidden = coalesce(p_hidden, true),
         moderated_by = v_uid
   where id = p_question_id
  returning * into v_q;
  return v_q;
end;
$$;

revoke all on function public.moderate_class_question(uuid, boolean) from public, anon;
grant execute on function public.moderate_class_question(uuid, boolean) to authenticated;
