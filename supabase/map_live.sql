-- Kem.Bali — peta interaktif + live location
-- Jalankan sekali di Supabase → SQL Editor. Aman dijalankan ulang.

-- 1) Koordinat untuk spot Explore dan item itinerary (null = belum ada di peta)
alter table spots add column if not exists lat double precision;
alter table spots add column if not exists lng double precision;
alter table itinerary_items add column if not exists lat double precision;
alter table itinerary_items add column if not exists lng double precision;

-- 2) Isi/benerin koordinat spot. Spot hasil seed dibuat atas nama akun pertama, jadi
--    update biasa bisa ditolak RLS; RPC ini mengizinkan pembuat spot ATAU owner group mana pun.
create or replace function set_spot_coords(p_spot_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from spots where id = p_spot_id and created_by = auth.uid())
     and not exists (select 1 from groups where owner_uid = auth.uid()) then
    raise exception 'not allowed';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180) then
    raise exception 'invalid coordinates';
  end if;
  update spots set lat = p_lat, lng = p_lng where id = p_spot_id;
end;
$$;
grant execute on function set_spot_coords(uuid, double precision, double precision) to authenticated;

-- 3) Live location: private Realtime channel "trip-live:<group_id>" (Presence).
--    Cuma anggota group itu yang boleh join, kirim, dan nerima posisi.
create or replace function can_use_trip_live(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_group uuid;
begin
  if p_topic is null or p_topic not like 'trip-live:%' then
    return false;
  end if;
  begin
    v_group := substr(p_topic, length('trip-live:') + 1)::uuid;
  exception when others then
    return false;
  end;
  return is_group_member(v_group);
end;
$$;
grant execute on function can_use_trip_live(text) to authenticated;

drop policy if exists trip_live_read on realtime.messages;
create policy trip_live_read on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('presence', 'broadcast') and can_use_trip_live(realtime.topic()));

drop policy if exists trip_live_write on realtime.messages;
create policy trip_live_write on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('presence', 'broadcast') and can_use_trip_live(realtime.topic()));

-- 4) Fitur "Bagikan lokasi" lama (posisi tersimpan di profil) diganti live location di Peta.
--    Hapus posisi lama yang masih tersimpan, demi privasi.
update profiles set share_location = false, last_location = null
  where share_location = true or last_location is not null;
