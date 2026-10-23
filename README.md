# Kem.Bali

> Rencanain bareng, biar Kem.Bali lagi.

PWA trip planner buat solo trip atau group trip ke Bali — dokumen, packing/outfit,
itinerary + voting, budget + split bill, explore tempat wisata (dengan tag halal &
kompas kiblat), dan dashboard admin buat yang jadi planner.

Stack: **Next.js (App Router) + Tailwind v4** di depan, **Supabase** (Auth, Postgres,
Storage, Realtime, Edge Functions) di belakang, deploy ke **Vercel**, kode di **GitHub**.

> Catatan: versi sebelumnya pakai Firebase. Aplikasi ini sekarang pakai Supabase — nggak
> ada fitur push notification lagi (Supabase nggak punya layanan push notif bawaan kayak
> Firebase Cloud Messaging); semua yang lain (realtime update, voting, foto preview link
> akomodasi, dsb) tetap jalan seperti biasa, cukup update di dalam app pas dibuka.

## Setup — sekali aja di awal

### 1. Bikin project Supabase

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → kasih nama (misal `kembali-trip`), pilih region terdekat (misal Singapore), simpan database password-nya di tempat aman.
2. **SQL Editor → New query** → paste seluruh isi `supabase/schema.sql` dari repo ini → **Run**. Ini bikin semua tabel, Row Level Security policies, fungsi RPC (buat join group, voting, dll), realtime, dan storage bucket-nya sekaligus.
3. **Authentication → Providers → Email** → matiin **"Confirm email"**. App ini pakai username, bukan email asli (lihat `lib/usernameAuth.ts`), jadi nggak ada yang bisa klik link konfirmasi — kalau nggak dimatiin, orang nggak bisa langsung login setelah daftar.
4. **Project Settings → API** → salin **Project URL** dan **anon public** key ke `.env.local` (copy dari `.env.local.example`).

### 2. Deploy Edge Function (preview foto link akomodasi)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref-dari-url-dashboard>
supabase functions deploy link-unfurl
```

Fungsi ini butuh akses ke `SUPABASE_SERVICE_ROLE_KEY` buat nulis balik foto/judul ke
tabel `accommodation_options` — Supabase CLI set env ini otomatis saat deploy, nggak perlu
diisi manual.

### 3. Jalanin lokal

```bash
npm install
cp .env.local.example .env.local   # isi sesuai step 1.4
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 4. Deploy ke Vercel

1. Push repo ini ke GitHub punya kamu.
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo itu.
3. Di **Environment Variables**, masukin `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari `.env.local`.
4. Deploy. Vercel otomatis build ulang tiap kali kamu push ke `main`.

### 5. Tes cepat sebelum dibagi ke temen-temen

Bikin 2 akun (misal di HP + laptop), lalu cek:
1. Akun A bikin group → dapet kode `KB-XXXX`. Akun B join pakai kode itu.
2. B usul itinerary → A buka app, muncul di tab Itinerary. A tutup voting → B lihat statusnya "Final".
3. B tempel link Agoda/Traveloka di Akomodasi → beberapa detik kemudian foto muncul.
4. A buka **Dashboard admin** (dari Home/Profil) → angka dokumen & checklist B kebaca.
5. B nyalain **Bagikan lokasi** → nama B muncul di Home A dengan link Maps.

Kalau salah satu nggak jalan, buka Supabase Dashboard → **Table Editor** buat lihat datanya
langsung, atau **Logs → Edge Functions** / **Logs → Postgres** buat lihat error. Row Level
Security yang nolak biasanya muncul sebagai error `new row violates row-level security policy`
di console browser (F12).

## Catatan penting

- **Nggak ada push notification.** Semua update (voting baru, voting ditutup, dokumen,
  packing, budget, pengumuman) cukup muncul di dalam app pas dibuka — nggak ada notif ke
  HP kalau app-nya ketutup.
- **Share lokasi** cuma update selama app-nya lagi kebuka (browser nggak ngizinin web app
  ngambil lokasi di background). Update maksimal sekali per menit.
- **Lupa password**: nggak ada reset lewat email (karena login pakai username). Owner bisa
  reset dari Supabase Dashboard → Authentication → Users (cari `username@kembali.app`),
  atau hapus akunnya biar orangnya daftar ulang.
- **Kompas kiblat & jadwal sholat** (`/kiblat`) butuh izin lokasi dari browser; jadwal
  sholatnya dari [Aladhan API](https://aladhan.com/prayer-times-api) (gratis, publik).
- **Preview foto link akomodasi** (Agoda/Traveloka/Maps) diisi otomatis oleh Edge Function
  `supabase/functions/link-unfurl` yang scrape Open Graph tag dari link-nya — biasanya
  muncul beberapa detik setelah link ditambahin. Sebagian situs booking kadang nolak bot;
  kalau gitu kartunya tetap muncul tanpa foto.
- **Spot wisata di Explore** (`/explore`) harus diisi manual dulu lewat dashboard admin
  (`/admin`) — belum ada data bawaan. Target draft: ~30 spot per kategori per area.
- Lihat `SCHEMA.md` buat peta lengkap tabel Postgres-nya, dan `supabase/schema.sql` buat
  detail Row Level Security + fungsi RPC yang dipakai.

## Struktur halaman

| Route | Isi |
|---|---|
| `/` , `/daftar` | Masuk / daftar (username, bukan email) |
| `/mode` | Pilih solo trip atau join/bikin group |
| `/home` | Dashboard ringkas: countdown, akses cepat, share lokasi |
| `/dokumen` | Tiket & dokumen (upload PDF atau tempel link Drive) |
| `/packing` | 3 tab: Koper/Tas, Outfit (auto sesuai gender), Tambahan (obat & keperluan) |
| `/itinerary` | Rencana harian + voting per slot |
| `/budget` | Catatan biaya + hitung siapa transfer ke siapa |
| `/explore` | Spot wisata per area/kategori, tag halal, usul tempat baru |
| `/akomodasi` | Voting villa/penginapan dengan preview link |
| `/profile` | Kebutuhan pribadi (tetap ada walau keluar group) + keluar group |
| `/history` | Log semua perubahan di group |
| `/kiblat` | Kompas kiblat + jadwal sholat + masjid terdekat |
| `/admin` | Status anggota, pengumuman, kelola spot wisata |
