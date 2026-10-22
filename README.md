# Kem.Bali

> Rencanain bareng, biar Kem.Bali lagi.

PWA trip planner buat solo trip atau group trip ke Bali — dokumen, packing/outfit,
itinerary + voting, budget + split bill, explore tempat wisata (dengan tag halal &
kompas kiblat), dan dashboard admin buat yang jadi planner.

Stack: **Next.js (App Router) + Tailwind v4** di depan, **Firebase** (Auth, Firestore,
Storage, Cloud Functions, Cloud Messaging) di belakang, deploy ke **Vercel**, kode di
**GitHub**.

## Setup — sekali aja di awal

### 1. Bikin project Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → kasih nama (misal `kembali-trip`).
2. **Build → Authentication → Get started** → aktifkan sign-in method **Email/Password**.
   (App ini pakai username, bukan email — lihat `lib/usernameAuth.ts` buat tahu kenapa.)
3. **Build → Firestore Database → Create database** → mulai di **production mode**, pilih region **`asia-southeast2` (Jakarta)**. Cloud Functions di `functions/src/index.ts` di-set ke region yang sama — kalau kamu pilih region lain, ganti juga `region` di `setGlobalOptions` biar trigger-nya bisa ke-deploy.
4. **Build → Storage → Get started** → mulai di production mode juga.
5. **Build → Cloud Messaging** → di tab **Web configuration**, klik **Generate key pair** di bagian *Web Push certificates* → ini jadi `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
6. **Project settings (ikon gerigi) → General → Your apps → Add app → Web** → daftarin app, nanti keluar config object. Salin nilai-nilainya ke `.env.local` (copy dari `.env.local.example`). Service worker push otomatis dapet config yang sama — nggak ada file yang perlu diedit manual.
7. **Upgrade ke paket Blaze** (Project settings → Usage and billing). Ini wajib buat pakai Cloud Functions dan upload file ke Storage, tapi di skala 4-5 user biaya aktualnya tetap Rp0 — cukup pasang budget alert di billing kalau mau tenang.

### 2. Install Firebase CLI & deploy rules + functions

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # pilih project yang baru dibuat, kasih alias "default"

# deploy security rules (CLI-nya compile rules dulu & nolak kalau ada yang salah)
firebase deploy --only firestore:rules,firestore:indexes,storage

# deploy Cloud Functions (link-preview buat Agoda/Traveloka/Maps + push notification voting)
cd functions && npm install && cd ..
firebase deploy --only functions
```

### 3. Jalanin lokal

```bash
npm install
cp .env.local.example .env.local   # isi sesuai step 1.6
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 4. Deploy ke Vercel

1. Push repo ini ke GitHub punya kamu.
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo itu.
3. Di **Environment Variables**, masukin semua `NEXT_PUBLIC_FIREBASE_*` dari `.env.local`.
4. Deploy. Vercel otomatis build ulang tiap kali kamu push ke `main`.

### 5. Tes cepat sebelum dibagi ke temen-temen

Bikin 2 akun (misal di HP + laptop), lalu cek:
1. Akun A bikin group → dapet kode `KB-XXXX`. Akun B join pakai kode itu.
2. B usul itinerary → A dapet notif (kalau udah aktifin notif di Profil). A tutup voting → B dapet notif.
3. B tempel link Agoda/Traveloka di Akomodasi → beberapa detik kemudian foto muncul.
4. A buka **Dashboard admin** (dari Home/Profil) → angka dokumen & checklist B kebaca.
5. B nyalain **Bagikan lokasi** → nama B muncul di Home A dengan link Maps.

Kalau salah satu nggak jalan, buka Firebase Console → Firestore → **Rules → Rules Playground** buat liat aturan mana yang nolak, atau cek **Functions → Logs**. Index Firestore butuh beberapa menit setelah deploy sebelum aktif.

## Catatan penting

- **Push notification di iPhone cuma jalan kalau PWA-nya udah di-"Add to Home Screen"**
  (iOS 16.4+, keterbatasan dari Apple). Tiap orang harus ketuk **Notifikasi voting →
  Aktifkan** di Profil sekali per HP. Push cuma dikirim pas voting dibuka (opsi villa baru,
  slot itinerary baru) dan pas voting ditutup — sisanya (dokumen, packing, budget,
  pengumuman) cukup muncul di dalam app.
- **Share lokasi** cuma update selama app-nya lagi kebuka (browser nggak ngizinin web app
  ngambil lokasi di background). Update maksimal sekali per menit.
- **Lupa password**: nggak ada reset lewat email (karena login pakai username). Owner bisa
  hapus akunnya di Firebase Console → Authentication (cari `username@kembali.app`), terus
  orangnya daftar ulang.
- **Kompas kiblat & jadwal sholat** (`/kiblat`) butuh izin lokasi dari browser; jadwal
  sholatnya dari [Aladhan API](https://aladhan.com/prayer-times-api) (gratis, publik).
- **Preview foto link akomodasi** (Agoda/Traveloka/Maps) diisi otomatis oleh
  `functions/src/index.ts` (`onAccommodationOptionCreate`) yang scrape Open Graph tag
  dari link-nya — biasanya muncul beberapa detik setelah link ditambahin. Sebagian situs
  booking kadang nolak bot; kalau gitu kartunya tetap muncul tanpa foto.
- **Spot wisata di Explore** (`/explore`) harus diisi manual dulu lewat dashboard admin
  (`/admin`) — belum ada data bawaan. Target draft: ~30 spot per kategori per area.
- Lihat `SCHEMA.md` buat peta lengkap koleksi Firestore-nya.

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
