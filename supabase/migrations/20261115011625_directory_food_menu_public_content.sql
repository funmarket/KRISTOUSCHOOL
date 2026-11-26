-- KRISTOU SCHOOL — Public Directory, La Toque Gourmande Food Menu & School Public Content
-- PUB-01, PUB-02, PUB-03
-- STATUS: AUTHORED IN SOURCE — NOT YET EXECUTED ON HOSTED PROJECT.

create table if not exists public.directory_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('TEACHER', 'ADMIN')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  photo_url text not null default '/assets/kristou-logo.png',
  bio text not null default '',
  tags text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  sort_order integer not null default 10,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menu_weeks (
  id uuid primary key default gen_random_uuid(),
  week_range text not null check (char_length(btrim(week_range)) between 3 and 120),
  week_start date,
  week_end date,
  provider_name text not null default 'La Toque Gourmande',
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menu_days (
  id uuid primary key default gen_random_uuid(),
  menu_week_id uuid not null references public.food_menu_weeks(id) on delete cascade,
  day_order integer not null check (day_order between 1 and 7),
  day_label text not null,
  starter text not null default '',
  main_dish text not null,
  side_dish text not null default '',
  dessert text not null default '',
  notes text,
  unique (menu_week_id, day_order)
);

create table if not exists public.school_public_content (
  slug text primary key,
  title_ar text not null,
  title_fr text not null,
  title_en text not null,
  body_ar text not null,
  body_fr text not null,
  body_en text not null,
  is_published boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists directory_entries_set_updated_at on public.directory_entries;
create trigger directory_entries_set_updated_at before update on public.directory_entries for each row execute function public.set_updated_at();
drop trigger if exists food_menu_weeks_set_updated_at on public.food_menu_weeks;
create trigger food_menu_weeks_set_updated_at before update on public.food_menu_weeks for each row execute function public.set_updated_at();
drop trigger if exists school_public_content_set_updated_at on public.school_public_content;
create trigger school_public_content_set_updated_at before update on public.school_public_content for each row execute function public.set_updated_at();

alter table public.directory_entries enable row level security;
alter table public.food_menu_weeks enable row level security;
alter table public.food_menu_days enable row level security;
alter table public.school_public_content enable row level security;

revoke all on public.directory_entries from anon, authenticated;
revoke all on public.food_menu_weeks from anon, authenticated;
revoke all on public.food_menu_days from anon, authenticated;
revoke all on public.school_public_content from anon, authenticated;

grant select on public.directory_entries to anon, authenticated;
grant select on public.food_menu_weeks to anon, authenticated;
grant select on public.food_menu_days to anon, authenticated;
grant select on public.school_public_content to anon, authenticated;

drop policy if exists directory_public_select on public.directory_entries;
create policy directory_public_select on public.directory_entries for select to anon
  using (is_published = true);

drop policy if exists directory_member_select on public.directory_entries;
create policy directory_member_select on public.directory_entries for select to authenticated
  using (
    is_published = true
    or (public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
    ))
  );

drop policy if exists food_menu_weeks_select on public.food_menu_weeks;
drop policy if exists food_menu_weeks_public_select on public.food_menu_weeks;
create policy food_menu_weeks_public_select on public.food_menu_weeks for select to anon
  using (status = 'PUBLISHED');

drop policy if exists food_menu_weeks_member_select on public.food_menu_weeks;
create policy food_menu_weeks_member_select on public.food_menu_weeks for select to authenticated
  using (
    status = 'PUBLISHED'
    or (public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('CAN_MANAGE_FOOD_MENU')
      or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
    ))
  );

drop policy if exists food_menu_days_select on public.food_menu_days;
drop policy if exists food_menu_days_public_select on public.food_menu_days;
create policy food_menu_days_public_select on public.food_menu_days for select to anon
  using (
    exists (
      select 1 from public.food_menu_weeks w
      where w.id = food_menu_days.menu_week_id
        and w.status = 'PUBLISHED'
    )
  );

drop policy if exists food_menu_days_member_select on public.food_menu_days;
create policy food_menu_days_member_select on public.food_menu_days for select to authenticated
  using (
    exists (
      select 1 from public.food_menu_weeks w
      where w.id = food_menu_days.menu_week_id
        and (
          w.status = 'PUBLISHED'
          or (public.is_approved_school_member() and (
            public.current_user_has_role('APP_ADMIN'::public.app_role)
            or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
            or public.current_user_has_capability('CAN_MANAGE_FOOD_MENU')
            or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
          ))
        )
    )
  );

drop policy if exists public_content_select on public.school_public_content;
drop policy if exists public_content_public_select on public.school_public_content;
create policy public_content_public_select on public.school_public_content for select to anon
  using (is_published = true);

drop policy if exists public_content_member_select on public.school_public_content;
create policy public_content_member_select on public.school_public_content for select to authenticated
  using (
    is_published = true
    or (public.is_approved_school_member() and (
      public.current_user_has_role('APP_ADMIN'::public.app_role)
      or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
      or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
    ))
  );

-- Editor RPCs
create or replace function public.upsert_directory_entry(
  p_id uuid default null,
  p_entry_type text default 'TEACHER',
  p_display_name text default '',
  p_title text default '',
  p_bio text default '',
  p_tags text[] default '{}'::text[],
  p_languages text[] default '{}'::text[],
  p_photo_url text default '/assets/kristou-logo.png',
  p_is_published boolean default true
)
returns public.directory_entries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.directory_entries%rowtype;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.directory_entries (entry_type, display_name, title, bio, tags, languages, photo_url, is_published, created_by)
    values (upper(btrim(p_entry_type)), btrim(p_display_name), btrim(p_title), coalesce(btrim(p_bio), ''), coalesce(p_tags, '{}'::text[]), coalesce(p_languages, '{}'::text[]), coalesce(nullif(btrim(p_photo_url), ''), '/assets/kristou-logo.png'), coalesce(p_is_published, true), auth.uid())
    returning * into v_row;
  else
    update public.directory_entries
       set entry_type = upper(btrim(p_entry_type)),
           display_name = btrim(p_display_name),
           title = btrim(p_title),
           bio = coalesce(btrim(p_bio), ''),
           tags = coalesce(p_tags, '{}'::text[]),
           languages = coalesce(p_languages, '{}'::text[]),
           photo_url = coalesce(nullif(btrim(p_photo_url), ''), photo_url),
           is_published = coalesce(p_is_published, true),
           updated_at = now()
     where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_directory_entry(uuid, text, text, text, text, text[], text[], text, boolean) from public, anon;
grant execute on function public.upsert_directory_entry(uuid, text, text, text, text, text[], text[], text, boolean) to authenticated;

create or replace function public.save_food_menu_week(
  p_week_range text,
  p_days jsonb,
  p_publish boolean default true
)
returns public.food_menu_weeks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_week public.food_menu_weeks%rowtype;
  v_day jsonb;
  v_idx integer := 0;
begin
  if auth.uid() is null then raise exception 'actor_unauthenticated' using errcode = 'P0001'; end if;
  if not public.is_approved_school_member() then raise exception 'actor_not_approved' using errcode = 'P0001'; end if;
  if not (
    public.current_user_has_role('APP_ADMIN'::public.app_role)
    or public.current_user_has_role('ADMINISTRATIVE_PERSONNEL'::public.app_role)
    or public.current_user_has_capability('CAN_MANAGE_FOOD_MENU')
    or public.current_user_has_capability('PUBLIC_CONTENT_MANAGE')
  ) then
    raise exception 'insufficient_authority' using errcode = 'P0001';
  end if;

  if coalesce(p_publish, true) then
    update public.food_menu_weeks set status = 'ARCHIVED' where status = 'PUBLISHED';
  end if;

  insert into public.food_menu_weeks (week_range, status, created_by)
  values (btrim(p_week_range), case when coalesce(p_publish, true) then 'PUBLISHED' else 'DRAFT' end, auth.uid())
  returning * into v_week;

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    v_idx := v_idx + 1;
    insert into public.food_menu_days (menu_week_id, day_order, day_label, starter, main_dish, side_dish, dessert, notes)
    values (
      v_week.id,
      v_idx,
      coalesce(v_day ->> 'day', 'Day ' || v_idx),
      coalesce(v_day ->> 'starter', ''),
      coalesce(v_day ->> 'main', ''),
      coalesce(v_day ->> 'side', ''),
      coalesce(v_day ->> 'dessert', ''),
      nullif(coalesce(v_day ->> 'notes', ''), '')
    );
  end loop;

  return v_week;
end;
$$;

revoke all on function public.save_food_menu_week(text, jsonb, boolean) from public, anon;
grant execute on function public.save_food_menu_week(text, jsonb, boolean) to authenticated;
