"use client";

import Link from "next/link";
import { useState } from "react";

const BOAT_ROUTES = [
  {
    from: "Sanur",
    duration: "~45 menit",
    price: "Rp 170rb–215rb (sekali jalan, booking online)",
    note: "Paling banyak jadwalnya (90+ trip/hari). Paling gampang dijangkau dari Sanur, Seminyak, Canggu, Ubud.",
  },
  {
    from: "Kusamba (dekat Padang Bai)",
    duration: "~25–30 menit (tercepat)",
    price: "Rp 150rb–212rb (sekali jalan)",
    note: "Naik dari ponton apung. Paling pas kalau kamu nginep di Amed/Sidemen.",
  },
  {
    from: "Padang Bai",
    duration: "~90 menit (sering telat)",
    price: "~Rp 120rb buat motor + 2 orang",
    note: "Ini ferry roro (buat kendaraan), bukan speedboat. Mobil kudu booking, motor bisa dapet tiket on the spot pagi ~jam 9.",
  },
];

const BOAT_TIPS = [
  "Booking online dulu — harga di loket pelabuhan bisa sampai Rp 250rb, dan trip terakhir sering habis.",
  "Hati-hati calo di pelabuhan yang jual tiket mark-up.",
  "Ada retribusi ~Rp 25rb pas sampai di Nusa Penida.",
  "Cek dulu kalau lagi hari besar (Nyepi, Galungan, Kuningan) — nggak ada kapal pas Nyepi Laut.",
  "Dateng lebih awal, kapal sering berangkat on-time atau malah lebih cepat dari jadwal.",
];

const PHRASES: [string, string][] = [
  ["Om Swastiastu", "Halo / salam (formal, dibales sama)"],
  ["Rahajeng rauh", "Selamat datang"],
  ["Kenken kabare?", "Apa kabar? (santai)"],
  ["Rage sing engken", "Baik-baik aja (balesan santai)"],
  ["Nyen adané?", "Siapa namanya?"],
  ["Tiang uling ...", "Saya dari ..."],
  ["Rahajeng semeng", "Selamat pagi"],
  ["Rahajeng sanja", "Selamat sore"],
  ["Rahajeng wengi", "Selamat malam"],
  ["Rahajeng memargi", "Selamat jalan / hati-hati di jalan"],
  ["Nggih", "Iya"],
  ["Sing / Ten", "Tidak (santai / sopan)"],
  ["Tiang ten ngresep", "Saya nggak ngerti"],
  ["Bise ngomong base Inggris?", "Bisa bahasa Inggris?"],
  ["Pangampura", "Permisi"],
  ["Aji kuda niki?", "Berapa harganya ini?"],
  ["Suksma", "Terima kasih (umum/santai)"],
  ["Matur suksma", "Terima kasih banyak (formal)"],
  ["Ring dija WC?", "Toilet di mana?"],
  ["Nulungin tiang!", "Tolong saya!"],
];

const VIBES = [
  {
    emoji: "🌿",
    title: "Suka alam",
    desc: "Air terjun & spot hijau",
    items: [
      "Tegenungan, Tibumana, Kanto Lampo Waterfall — Ubud (paling deket, bisa sekalian beberapa dalam sehari)",
      "Peguyangan Waterfall & Seganing Waterfall — Nusa Penida (lebih niat, tangga curam tapi worth it)",
      "Pura Ulun Danu Batur — Kintamani (danau + pemandangan Gunung Batur)",
      "Tukad Cepung Waterfall — Ubud (cahaya nembus dari celah tebing, foto bagus siang hari)",
    ],
  },
  {
    emoji: "☕",
    title: "Suka cafe aesthetic",
    desc: "Buat foto & nongkrong",
    items: [
      "The Lawn, Milk & Madu, Crate Cafe — Canggu (konsep outdoor/beach club vibes)",
      "Clear Cafe, Watercress — Ubud (jungle/garden vibes, cocok yang suka hijau-hijau)",
      "The Cashew Tree, Alchemy — Uluwatu (clifftop/surfer vibes)",
      "Akasa Specialty Coffee, Montana Del Cafe — Kintamani (cafe dengan view Gunung Batur, cocok pagi-pagi)",
    ],
  },
  {
    emoji: "🌅",
    title: "Suka sunset",
    desc: "Spot golden hour terbaik",
    items: [
      "Pura Luhur Uluwatu — Uluwatu (sunset clifftop paling ikonik di Bali, plus tari Kecak sore hari)",
      "Melasti Beach, Thomas Beach — Uluwatu (tebing kapur + pantai, lebih santai dari Uluwatu Temple)",
      "Echo Beach, Batu Bolong Beach — Canggu (sunset + ombak surfer, banyak beach bar)",
      "Tanah Lot Temple — Canggu area (pura di atas batu karang, salah satu sunset paling terkenal di Bali)",
    ],
  },
];

export default function TipsPage() {
  const [openSection, setOpenSection] = useState<"boat" | "phrases" | "vibes" | null>("boat");

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <h1 className="text-xl font-bold">Tips &amp; Panduan</h1>
        <Link href="/explore" aria-label="Explore" className="w-11 h-11 rounded-full bg-kb-green text-kb-lime flex items-center justify-center">
          🧭
        </Link>
      </div>
      <p className="m-0 -mt-2 text-xs text-kb-muted">Cara ke Nusa Penida, frasa Bahasa Bali, dan rekomendasi spot sesuai mood kamu.</p>

      {/* ===================== Cara ke Nusa Penida ===================== */}
      <Section title="🚤 Cara ke Nusa Penida" open={openSection === "boat"} onToggle={() => setOpenSection(openSection === "boat" ? null : "boat")}>
        <div className="flex flex-col gap-2.5">
          {BOAT_ROUTES.map((r) => (
            <div key={r.from} className="bg-kb-card rounded-2xl p-3.5 flex flex-col gap-1">
              <div className="font-bold text-sm">Dari {r.from}</div>
              <div className="text-xs text-kb-muted">
                {r.duration} · {r.price}
              </div>
              <div className="text-xs leading-relaxed">{r.note}</div>
            </div>
          ))}
          <div className="bg-kb-lime rounded-2xl px-3.5 py-3 flex flex-col gap-1.5">
            <div className="text-[11px] font-bold text-[#2D3A1A]">Tips praktis</div>
            <ul className="m-0 pl-4 flex flex-col gap-1">
              {BOAT_TIPS.map((t) => (
                <li key={t} className="text-xs text-[#2D3A1A] leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ===================== Frasa Bahasa Bali ===================== */}
      <Section title="🗣️ 20 Frasa Bahasa Bali" open={openSection === "phrases"} onToggle={() => setOpenSection(openSection === "phrases" ? null : "phrases")}>
        <div className="bg-white rounded-2xl overflow-hidden">
          {PHRASES.map(([bali, arti], i) => (
            <div key={bali} className={`flex items-start gap-3 px-3.5 py-2.5 ${i !== 0 ? "border-t border-[#E3E8DA]" : ""}`}>
              <div className="flex-1 text-sm font-bold">{bali}</div>
              <div className="flex-1 text-xs text-kb-muted">{arti}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===================== Rekomendasi sesuai mood ===================== */}
      <Section title="✨ Mau ke mana sesuai mood" open={openSection === "vibes"} onToggle={() => setOpenSection(openSection === "vibes" ? null : "vibes")}>
        <div className="flex flex-col gap-2.5">
          {VIBES.map((v) => (
            <div key={v.title} className="bg-kb-card rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{v.emoji}</span>
                <div>
                  <div className="font-bold text-sm">{v.title}</div>
                  <div className="text-[11px] text-kb-muted">{v.desc}</div>
                </div>
              </div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {v.items.map((it) => (
                  <li key={it} className="text-xs leading-relaxed">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link href="/explore" className="h-11 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm flex items-center justify-center">
            Lihat semua spot di Explore →
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-3">
      <button type="button" onClick={onToggle} className="flex items-center justify-between gap-2 text-left">
        <span className="font-bold text-[15px]">{title}</span>
        <span className="text-kb-muted">{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}
