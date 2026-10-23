-- Kem.Bali — Supabase (Postgres) schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run),
-- against a fresh project. Safe to re-run (uses IF NOT EXISTS / OR REPLACE / ON CONFLICT where
-- it matters), except table creation itself — don't run twice against a project that already
-- has data you care about without reviewing it first.
--
-- See SCHEMA.md for the collection-by-collection notes this mirrors (this project used to run
-- on Firestore; this file is the Postgres equivalent, including the security-rule logic).

create extension if not exists pgcrypto;

-- ===========================================================================
-- Tables
-- ===========================================================================

-- One row per signed-up user, 1:1 with auth.users. `group_id: null` = solo trip.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  gender text not null check (gender in ('female', 'male')),
  group_id uuid, -- references groups(id), added below (groups doesn't exist yet)
  role text check (role in ('owner', 'member')),
  departure_date date,
  share_location boolean not null default false,
  last_location jsonb, -- { lat, lng, accuracy, updatedAt }
  seeded jsonb not null default '{}'::jsonb, -- { bags, outfit, supplies }
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. "KB-4M9A", shareable join code
  name text not null,
  owner_uid uuid not null references auth.users(id),
  member_uids uuid[] not null default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

alter table profiles add constraint profiles_group_id_fkey foreign key (group_id) references groups(id) on delete set null;
create index if not exists profiles_group_id_idx on profiles(group_id);

-- Join-code lookup. Readable by anyone signed in (so someone who isn't a member yet can find
-- the group by its code); writing only happens through the create_group() RPC below.
create table if not exists group_codes (
  code text primary key,
  group_id uuid not null references groups(id) on delete cascade,
  owner_uid uuid not null references auth.users(id)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id),
  group_id uuid references groups(id) on delete set null,
  name text not null,
  category text not null check (category in ('tiket', 'penginapan', 'transport', 'lainnya')),
  source_type text not null check (source_type in ('upload', 'drive_link')),
  url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);
create index if not exists documents_owner_idx on documents(owner_uid);
create index if not exists documents_group_idx on documents(group_id);

create table if not exists packing_bags (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id),
  group_id uuid references groups(id) on delete set null,
  name text not null,
  items jsonb not null default '[]'::jsonb, -- [{id, name, qty, in, out}]
  seed_key text, -- internal: lets the default-template seeder avoid duplicates. Ignore elsewhere.
  unique (owner_uid, seed_key)
);
create index if not exists packing_bags_owner_idx on packing_bags(owner_uid);

create table if not exists outfit_items (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id),
  category text not null,
  name text not null,
  qty integer not null default 1,
  bag text not null default 'Koper besar',
  done boolean not null default false,
  order_index integer,
  seed_key text,
  unique (owner_uid, seed_key)
);
create index if not exists outfit_items_owner_idx on outfit_items(owner_uid);

create table if not exists supplies_items (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id),
  name text not null,
  checked boolean not null default false,
  seed_key text,
  unique (owner_uid, seed_key)
);
create index if not exists supplies_items_owner_idx on supplies_items(owner_uid);

create table if not exists itinerary_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  day integer not null,
  time text not null,
  title text not null default '',
  location text not null default '',
  status text not null check (status in ('final', 'voting')),
  options jsonb not null default '[]'::jsonb, -- [{id, label, votes: [uid], proposedBy}]
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists itinerary_group_idx on itinerary_items(group_id, day, time);
create index if not exists itinerary_creator_idx on itinerary_items(created_by);

create table if not exists accommodation_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  price_text text not null default '',
  link text not null,
  source text not null check (source in ('agoda', 'traveloka', 'airbnb', 'maps', 'other')),
  image_url text,
  votes uuid[] not null default '{}',
  chosen boolean not null default false,
  proposed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists accommodation_group_idx on accommodation_options(group_id);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  day integer not null,
  title text not null,
  category text not null check (category in ('transport', 'makan', 'tiket', 'penginapan', 'belanja', 'lainnya')),
  amount numeric not null,
  paid_by uuid not null references auth.users(id),
  split_among uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists expenses_group_idx on expenses(group_id);
create index if not exists expenses_paidby_idx on expenses(paid_by);

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  category text not null,
  name text not null,
  description text not null default '',
  halal text not null check (halal in ('halal', 'umum')),
  ticket_price text,
  duration_text text,
  favorite_count integer not null default 0,
  image_url text,
  maps_url text,
  created_by uuid not null references auth.users(id)
);
create index if not exists spots_area_category_idx on spots(area, category);
create index if not exists spots_created_by_idx on spots(created_by);

create table if not exists favorites (
  uid uuid not null references auth.users(id),
  spot_id uuid not null references spots(id) on delete cascade,
  primary key (uid, spot_id)
);

create table if not exists spot_submissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  category text,
  halal text check (halal in ('halal', 'non_halal')),
  reference_links jsonb not null default '[]'::jsonb, -- [{url, platform}]
  submitted_by uuid not null references auth.users(id),
  status text not null check (status in ('pending', 'proposed_to_itinerary')),
  created_at timestamptz not null default now()
);
create index if not exists spot_submissions_group_idx on spot_submissions(group_id);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_uid uuid not null references auth.users(id),
  actor_name text not null,
  action text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_group_idx on activity_log(group_id, created_at desc);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  author_uid uuid not null references auth.users(id),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_group_idx on announcements(group_id, created_at desc);

-- ===========================================================================
-- Helper functions (used by RLS policies below). SECURITY DEFINER so they can
-- read `groups`/`profiles` to answer "is this person a member/owner/admin" without
-- those tables' own RLS getting in the way — they only ever return a boolean.
-- ===========================================================================

create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_group_id is not null and exists (
    select 1 from groups where id = p_group_id and auth.uid() = any(member_uids)
  );
$$;

create or replace function is_group_owner(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_group_id is not null and exists (
    select 1 from groups where id = p_group_id and owner_uid = auth.uid()
  );
$$;

-- True when the signed-in user is the owner (admin) of the group that `p_uid` is in.
-- Lets the planner's /admin dashboard see everyone's personal checklists/docs.
create or replace function is_admin_of(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles pr join groups g on g.id = pr.group_id
    where pr.id = p_uid and g.owner_uid = auth.uid()
  );
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table profiles enable row level security;
create policy profiles_select on profiles for select
  using (id = auth.uid() or (group_id is not null and is_group_member(group_id)));
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table groups enable row level security;
create policy groups_select on groups for select using (auth.uid() = any(member_uids));
create policy groups_insert on groups for insert
  with check (owner_uid = auth.uid() and member_uids = array[auth.uid()]);
create policy groups_update on groups for update using (owner_uid = auth.uid());
create policy groups_delete on groups for delete using (owner_uid = auth.uid());
-- Joining/leaving a group changes `member_uids` for someone who (by definition) isn't yet, or
-- is about to stop being, included in the `groups_select`/`groups_update` policies above — so
-- those go through the create_group/join_group_by_code/leave_group RPCs (SECURITY DEFINER)
-- further down instead of a direct client update.

alter table group_codes enable row level security;
create policy group_codes_select on group_codes for select using (auth.uid() is not null);
-- insert only via create_group() RPC.

alter table documents enable row level security;
create policy documents_select on documents for select
  using (owner_uid = auth.uid() or (group_id is not null and is_group_member(group_id)) or is_admin_of(owner_uid));
create policy documents_insert on documents for insert
  with check (owner_uid = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy documents_update on documents for update using (owner_uid = auth.uid());
create policy documents_delete on documents for delete using (owner_uid = auth.uid());

alter table packing_bags enable row level security;
create policy packing_bags_select on packing_bags for select using (owner_uid = auth.uid() or is_admin_of(owner_uid));
create policy packing_bags_insert on packing_bags for insert with check (owner_uid = auth.uid());
create policy packing_bags_update on packing_bags for update using (owner_uid = auth.uid());
create policy packing_bags_delete on packing_bags for delete using (owner_uid = auth.uid());

alter table outfit_items enable row level security;
create policy outfit_items_select on outfit_items for select using (owner_uid = auth.uid() or is_admin_of(owner_uid));
create policy outfit_items_insert on outfit_items for insert with check (owner_uid = auth.uid());
create policy outfit_items_update on outfit_items for update using (owner_uid = auth.uid());
create policy outfit_items_delete on outfit_items for delete using (owner_uid = auth.uid());

alter table supplies_items enable row level security;
create policy supplies_items_select on supplies_items for select using (owner_uid = auth.uid() or is_admin_of(owner_uid));
create policy supplies_items_insert on supplies_items for insert with check (owner_uid = auth.uid());
create policy supplies_items_update on supplies_items for update using (owner_uid = auth.uid());
create policy supplies_items_delete on supplies_items for delete using (owner_uid = auth.uid());

alter table itinerary_items enable row level security;
create policy itinerary_select on itinerary_items for select
  using ((group_id is null and created_by = auth.uid()) or (group_id is not null and is_group_member(group_id)));
create policy itinerary_insert on itinerary_items for insert
  with check (created_by = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy itinerary_update on itinerary_items for update
  using ((group_id is null and created_by = auth.uid()) or (group_id is not null and is_group_member(group_id)));
create policy itinerary_delete on itinerary_items for delete
  using (created_by = auth.uid() or (group_id is not null and is_group_owner(group_id)));
-- Voting/adding-an-option/finalizing go through RPCs below (atomic jsonb read-modify-write).

alter table accommodation_options enable row level security;
create policy accommodation_select on accommodation_options for select using (is_group_member(group_id));
create policy accommodation_insert on accommodation_options for insert
  with check (proposed_by = auth.uid() and is_group_member(group_id));
create policy accommodation_delete on accommodation_options for delete
  using (proposed_by = auth.uid() or is_group_owner(group_id));
-- No update policy: votes/chosen/image only change via vote_accommodation(), choose_accommodation()
-- (RPCs below) and the link-unfurl Edge Function (service role) — never a direct client update.

alter table expenses enable row level security;
create policy expenses_select on expenses for select
  using ((group_id is null and paid_by = auth.uid()) or (group_id is not null and is_group_member(group_id)));
create policy expenses_insert on expenses for insert
  with check (paid_by = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy expenses_update on expenses for update
  using (paid_by = auth.uid() or (group_id is not null and is_group_owner(group_id)));
create policy expenses_delete on expenses for delete
  using (paid_by = auth.uid() or (group_id is not null and is_group_owner(group_id)));

alter table spots enable row level security;
create policy spots_select on spots for select using (auth.uid() is not null);
create policy spots_insert on spots for insert with check (created_by = auth.uid());
create policy spots_update on spots for update using (created_by = auth.uid());
create policy spots_delete on spots for delete using (created_by = auth.uid());

alter table favorites enable row level security;
create policy favorites_select on favorites for select using (uid = auth.uid());
create policy favorites_insert on favorites for insert with check (uid = auth.uid());
create policy favorites_delete on favorites for delete using (uid = auth.uid());

alter table spot_submissions enable row level security;
create policy spot_submissions_select on spot_submissions for select using (is_group_member(group_id));
create policy spot_submissions_update on spot_submissions for update using (is_group_member(group_id));
create policy spot_submissions_insert on spot_submissions for insert
  with check (submitted_by = auth.uid() and is_group_member(group_id));
create policy spot_submissions_delete on spot_submissions for delete
  using (submitted_by = auth.uid() or is_group_owner(group_id));

alter table activity_log enable row level security;
create policy activity_log_select on activity_log for select using (is_group_member(group_id));
create policy activity_log_insert on activity_log for insert
  with check (actor_uid = auth.uid() and is_group_member(group_id));

alter table announcements enable row level security;
create policy announcements_select on announcements for select using (is_group_member(group_id));
create policy announcements_insert on announcements for insert
  with check (author_uid = auth.uid() and is_group_owner(group_id));
create policy announcements_delete on announcements for delete using (is_group_owner(group_id));

-- ===========================================================================
-- RPC functions — for anything that needs to read-modify-write atomically
-- (the Postgres equivalent of the app's old Firestore transactions/batches), or
-- that needs to touch a row the caller isn't normally allowed to write directly
-- (joining a group, voting, seeding default checklists).
-- ===========================================================================

-- Pre-signup availability check. SECURITY DEFINER + granted to `anon` because this runs
-- before the person has an account (no auth.uid() yet).
create or replace function username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(p_username));
$$;

create or replace function create_group(p_name text)
returns groups
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_group groups;
  v_attempt int;
  v_char_idx int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  for v_attempt in 1..8 loop
    v_code := 'KB-';
    for v_char_idx in 1..4 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from group_codes where code = v_code);
  end loop;

  insert into groups (code, name, owner_uid, member_uids)
  values (v_code, p_name, v_uid, array[v_uid])
  returning * into v_group;

  insert into group_codes (code, group_id, owner_uid) values (v_code, v_group.id, v_uid);
  update profiles set group_id = v_group.id, role = 'owner' where id = v_uid;

  return v_group;
end;
$$;

create or replace function join_group_by_code(p_code text, p_display_name text)
returns groups
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group groups;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select group_id into v_group_id from group_codes where code = p_code;
  if v_group_id is null then
    raise exception 'Kode group nggak ketemu. Cek lagi ya.';
  end if;

  update groups set member_uids = array_append(member_uids, v_uid)
    where id = v_group_id and not (v_uid = any(member_uids))
    returning * into v_group;

  if v_group is null then
    select * into v_group from groups where id = v_group_id;
    if v_group is null then
      raise exception 'Group-nya udah nggak aktif. Minta kode baru ke yang bikin trip.';
    end if;
    -- already a member (double submit) — fall through and just sync the profile.
  end if;

  update profiles set group_id = v_group_id, role = 'member' where id = v_uid;
  insert into activity_log (group_id, actor_uid, actor_name, action, message)
    values (v_group_id, v_uid, coalesce(p_display_name, 'Seseorang'), 'member_joined', 'gabung ke group');

  return v_group;
end;
$$;

create or replace function leave_group()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group groups;
  v_display_name text;
  v_others uuid[];
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select g.* into v_group from groups g join profiles p on p.group_id = g.id where p.id = v_uid;
  if v_group is null then return; end if;

  select display_name into v_display_name from profiles where id = v_uid;
  insert into activity_log (group_id, actor_uid, actor_name, action, message)
    values (v_group.id, v_uid, coalesce(v_display_name, 'Seseorang'), 'member_left', 'keluar dari group');

  if v_group.owner_uid = v_uid then
    v_others := array_remove(v_group.member_uids, v_uid);
    if array_length(v_others, 1) is null then
      delete from groups where id = v_group.id;
    else
      update groups set owner_uid = v_others[1], member_uids = v_others where id = v_group.id;
    end if;
  else
    update groups set member_uids = array_remove(member_uids, v_uid) where id = v_group.id;
  end if;

  update profiles set group_id = null, role = null where id = v_uid;
end;
$$;

-- Moves the caller's vote onto `p_option_id` (removing it from every other option first).
-- Returns the label voted for, or null if the item isn't open for voting.
create or replace function cast_itinerary_vote(p_item_id uuid, p_option_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_options jsonb;
  v_new jsonb;
  v_label text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select options into v_options from itinerary_items where id = p_item_id and status = 'voting' for update;
  if v_options is null then return null; end if;

  select jsonb_agg(
    case when (opt->>'id') = p_option_id::text then
      jsonb_set(opt, '{votes}',
        (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(opt->'votes') v where v <> v_uid::text)
          || to_jsonb(v_uid::text))
    else
      jsonb_set(opt, '{votes}',
        (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(opt->'votes') v where v <> v_uid::text))
    end
  ) into v_new
  from jsonb_array_elements(v_options) opt;

  update itinerary_items set options = v_new where id = p_item_id;
  select opt->>'label' into v_label from jsonb_array_elements(v_new) opt where (opt->>'id') = p_option_id::text;
  return v_label;
end;
$$;

-- Adds a new voting option and moves the caller's vote onto it.
create or replace function add_itinerary_option(p_item_id uuid, p_label text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_options jsonb;
  v_cleared jsonb;
  v_new_option jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select options into v_options from itinerary_items where id = p_item_id for update;
  if v_options is null then raise exception 'item not found'; end if;

  select jsonb_agg(jsonb_set(opt, '{votes}',
    (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(opt->'votes') v where v <> v_uid::text)))
  into v_cleared
  from jsonb_array_elements(v_options) opt;

  v_new_option := jsonb_build_object(
    'id', gen_random_uuid()::text, 'label', p_label, 'votes', jsonb_build_array(v_uid::text), 'proposedBy', v_uid::text
  );

  update itinerary_items set options = coalesce(v_cleared, '[]'::jsonb) || jsonb_build_array(v_new_option) where id = p_item_id;
end;
$$;

-- Owner (or any group member, matching the app's previous permission model) closes voting.
create or replace function finalize_itinerary(p_item_id uuid, p_option_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_label text;
begin
  select opt->>'label' into v_label
  from itinerary_items, jsonb_array_elements(options) opt
  where id = p_item_id and (opt->>'id') = p_option_id::text;

  if v_label is null then raise exception 'option not found'; end if;

  update itinerary_items set status = 'final', title = v_label where id = p_item_id;
  return v_label;
end;
$$;

-- One vote per person across every option in the group: voting here removes your vote from
-- every other option first.
create or replace function vote_accommodation(p_option_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_already boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select group_id, (v_uid = any(votes)) into v_group_id, v_already from accommodation_options where id = p_option_id;
  if v_group_id is null then raise exception 'option not found'; end if;

  update accommodation_options set votes = array_remove(votes, v_uid)
    where group_id = v_group_id and v_uid = any(votes);

  if not coalesce(v_already, false) then
    update accommodation_options set votes = array_append(votes, v_uid) where id = p_option_id;
  end if;
end;
$$;

create or replace function choose_accommodation(p_option_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid;
  v_owner uuid;
begin
  select group_id into v_group_id from accommodation_options where id = p_option_id;
  if v_group_id is null then raise exception 'option not found'; end if;
  select owner_uid into v_owner from groups where id = v_group_id;
  if v_owner is distinct from auth.uid() then raise exception 'only the group owner can choose'; end if;

  update accommodation_options set chosen = (id = p_option_id) where group_id = v_group_id;
end;
$$;

-- Default-template seeders. Idempotent (checks + records profiles.seeded.<kind>), so calling
-- them again after the user already has items (or has deleted them all) is a no-op.
create or replace function seed_packing_bags()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_seeded boolean;
  v_names text[] := array['Koper besar', 'Tas ransel', 'Tas tenteng'];
  v_name text;
  i int := 0;
begin
  if v_uid is null then return; end if;
  select (seeded->>'bags')::boolean into v_seeded from profiles where id = v_uid;
  if coalesce(v_seeded, false) then return; end if;
  foreach v_name in array v_names loop
    insert into packing_bags (owner_uid, group_id, name, items, seed_key)
    values (v_uid, null, v_name, '[]'::jsonb, 'bags_' || i)
    on conflict (owner_uid, seed_key) do nothing;
    i := i + 1;
  end loop;
  update profiles set seeded = jsonb_set(coalesce(seeded, '{}'::jsonb), '{bags}', 'true') where id = v_uid;
end;
$$;

create or replace function seed_outfit_items()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_seeded boolean;
  v_gender text;
  v_categories text[];
  v_cat text;
  i int := 0;
begin
  if v_uid is null then return; end if;
  select (seeded->>'outfit')::boolean, gender into v_seeded, v_gender from profiles where id = v_uid;
  if coalesce(v_seeded, false) then return; end if;

  if v_gender = 'female' then
    v_categories := array['Atasan','Celana panjang','Jaket','Kaos kaki','Baju tidur','Sepatu jalan','Sendal','Celana dalam','Bra','Topi','Kacamata'];
  else
    v_categories := array['Atasan','Celana panjang','Jaket','Kaos kaki','Baju tidur','Sepatu jalan','Sendal','Celana dalam','Topi','Kacamata'];
  end if;

  foreach v_cat in array v_categories loop
    insert into outfit_items (owner_uid, category, name, qty, bag, done, order_index, seed_key)
    values (v_uid, v_cat, v_cat, 1, 'Koper besar', false, i, 'outfit_' || i)
    on conflict (owner_uid, seed_key) do nothing;
    i := i + 1;
  end loop;
  update profiles set seeded = jsonb_set(coalesce(seeded, '{}'::jsonb), '{outfit}', 'true') where id = v_uid;
end;
$$;

create or replace function seed_supplies_items()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_seeded boolean;
  v_names text[] := array[
    'Powerbank','Charger HP','Kabel USB-C','Earphone/TWS','Adapter colokan','Obat pribadi','Vitamin',
    'Obat anti mabuk','Obat diare','Plester','Minyak angin / kayu putih','Hand sanitizer','Masker',
    'Sunscreen SPF 50','After sun lotion','Tissue kering','Tissue basah','Kantong plastik',
    'Lotion anti nyamuk','Kacamata hitam','Dry bag','Sikat & odol travel size'
  ];
  v_name text;
  i int := 0;
begin
  if v_uid is null then return; end if;
  select (seeded->>'supplies')::boolean into v_seeded from profiles where id = v_uid;
  if coalesce(v_seeded, false) then return; end if;
  foreach v_name in array v_names loop
    insert into supplies_items (owner_uid, name, checked, seed_key)
    values (v_uid, v_name, false, 'supplies_' || i)
    on conflict (owner_uid, seed_key) do nothing;
    i := i + 1;
  end loop;
  update profiles set seeded = jsonb_set(coalesce(seeded, '{}'::jsonb), '{supplies}', 'true') where id = v_uid;
end;
$$;

grant execute on function username_available(text) to anon, authenticated;
grant execute on function create_group(text) to authenticated;
grant execute on function join_group_by_code(text, text) to authenticated;
grant execute on function leave_group() to authenticated;
grant execute on function cast_itinerary_vote(uuid, uuid) to authenticated;
grant execute on function add_itinerary_option(uuid, text) to authenticated;
grant execute on function finalize_itinerary(uuid, uuid) to authenticated;
grant execute on function vote_accommodation(uuid) to authenticated;
grant execute on function choose_accommodation(uuid) to authenticated;
grant execute on function seed_packing_bags() to authenticated;
grant execute on function seed_outfit_items() to authenticated;
grant execute on function seed_supplies_items() to authenticated;

-- ===========================================================================
-- Realtime — lets the app subscribe to live changes (replaces Firestore's onSnapshot).
-- ===========================================================================

alter publication supabase_realtime add table
  profiles, groups, documents, packing_bags, outfit_items, supplies_items, itinerary_items,
  accommodation_options, expenses, spots, favorites, spot_submissions, activity_log, announcements;

-- ===========================================================================
-- Storage — ticket/document PDFs. Equivalent to the old storage.rules: each user uploads into
-- their own folder (`{uid}/{filename}`). The bucket is public, like Firebase Storage's default
-- download URL — the URL itself (an unguessable path under a random uid) is the access control,
-- matching what this app already relied on; only the uploader/owner can write or delete.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', true, 20971520, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy documents_storage_select on storage.objects for select using (bucket_id = 'documents');
create policy documents_storage_insert on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy documents_storage_delete on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
