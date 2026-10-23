"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rowToAnnouncement } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup, daysUntil } from "@/lib/useGroup";
import { isOwner } from "@/lib/group";
import type { Announcement } from "@/lib/types";

export default function HomePage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  // Personal departure date wins — everyone can fly on a different day.
  const tripDate = profile?.departureDate ?? group?.startDate ?? null;
  const dLeft = daysUntil(tripDate);
  const dToEnd = daysUntil(group?.endDate ?? null);
  const totalDays = tripDate && group?.endDate ? (daysUntil(group.endDate) ?? 0) - (dLeft ?? 0) + 1 : null;
  const countdown = (() => {
    if (dLeft === null) return { label: "Berangkat", big: "—", sub: "Atur tanggal →" };
    if (dLeft > 0) return { label: "Berangkat", big: `H-${dLeft}`, sub: formatDate(tripDate!) };
    if (dToEnd !== null && dToEnd < 0) return { label: "Trip", big: "Selesai 🎉", sub: "Semoga seru ya!" };
    const dayNum = 1 - dLeft;
    return { label: "Lagi di Bali", big: `Hari ke-${dayNum}`, sub: totalDays && totalDays > 0 ? `dari ${totalDays} hari` : formatDate(tripDate!) };
  })();
  const owner = isOwner(group, user?.uid);

  useEffect(() => {
    if (!group) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setAnnouncement(null);
      return;
    }
    let active = true;
    supabase
      .from("announcements")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!active) return;
        setAnnouncement(data && data.length > 0 ? rowToAnnouncement(data[0]) : null);
      });

    const channel = supabase
      .channel(`announcements-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements", filter: `group_id=eq.${group.id}` },
        (payload) => setAnnouncement(rowToAnnouncement(payload.new as Record<string, unknown>))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [group]);


  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          aria-label="Profil"
          className="w-[46px] h-[46px] rounded-full bg-kb-green text-kb-lime flex items-center justify-center font-extrabold"
        >
          {(profile?.displayName ?? "?")[0]?.toUpperCase()}
        </Link>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="text-xs text-kb-muted">{group ? `Group Trip · ${owner ? "Owner" : "Member"}` : "Solo Trip"}</div>
          <div className="text-[17px] font-bold">{group ? group.name : (profile?.displayName ?? "Trip kamu")}</div>
        </div>
        {group && (
          <Link href="/history" aria-label="Riwayat" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
            🕘
          </Link>
        )}
      </div>

      {group && announcement && (
        <div className="bg-kb-lime rounded-[20px] px-3.5 py-3 flex flex-col gap-0.5">
          <div className="text-[11px] font-bold text-[#2D3A1A]">📣 Pengumuman · {formatAgo(announcement.createdAt)}</div>
          <div className="text-sm font-semibold">{announcement.message}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/profile" className="bg-kb-lime rounded-[22px] p-3.5 flex flex-col gap-0.5">
          <div className="text-xs font-semibold text-[#2D3A1A]">{countdown.label}</div>
          <div className={`${countdown.big.length > 8 ? "text-[22px]" : "text-[28px]"} font-extrabold tracking-tight`}>{countdown.big}</div>
          <div className="text-xs text-[#2D3A1A]">{countdown.sub}</div>
        </Link>
        <Link href="/kiblat" className="bg-white rounded-[22px] p-3.5 flex flex-col gap-0.5">
          <div className="text-xs font-semibold text-kb-muted">Jadwal Sholat</div>
          <div className="text-[28px] font-extrabold tracking-tight">🕌</div>
          <div className="text-xs text-kb-muted">Buka Muslim Friendly</div>
        </Link>
      </div>

      {group ? (
        <>
          <div className="bg-kb-green text-white rounded-[26px] p-4.5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="text-xs font-semibold text-kb-lime">Trip Planner</div>
              <div className="text-xs font-bold bg-kb-lime text-kb-ink px-2.5 py-1 rounded-xl">Kode {group.code}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <QuickLink href="/akomodasi" emoji="🏡" title="Penginapan" sub="Vote villa" />
              <QuickLink href="/itinerary" emoji="🗓️" title="Itinerary" sub="Vote jadwal" />
              <QuickLink href="/dokumen" emoji="📄" title="Dokumen" sub="Tiket & booking" />
            </div>
            {owner && (
              <Link href="/admin" className="h-10 rounded-2xl bg-kb-green-light text-kb-lime font-bold text-xs flex items-center justify-center">
                Buka dashboard admin →
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[22px] p-4 flex flex-col gap-2">
          <div className="text-sm font-bold">Solo trip</div>
          <p className="m-0 text-xs text-kb-muted">
            Dokumen, packing, budget, dan itinerary kamu ada di tab-tab bawah. Mau join atau bikin group?{" "}
            <Link href="/mode" className="font-bold text-kb-green">
              Atur di sini
            </Link>
            .
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Link href="/dokumen" className="bg-kb-bg rounded-2xl p-2.5 flex items-center gap-2 text-sm font-bold">
              📄 Dokumen
            </Link>
            <Link href="/itinerary" className="bg-kb-bg rounded-2xl p-2.5 flex items-center gap-2 text-sm font-bold">
              🗓️ Itinerary
            </Link>
          </div>
        </div>
      )}

      <Link href="/peta" className="bg-white rounded-[22px] p-3.5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center shrink-0" aria-hidden>
          🗺️
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold">{group ? "Peta & lokasi teman" : "Peta itinerary"}</div>
          <div className="text-xs text-kb-muted">
            {group ? "Rute itinerary + live location (nyalain manual)" : "Lihat rute itinerary kamu di peta"}
          </div>
        </div>
        <span className="text-kb-green font-bold">→</span>
      </Link>
    </div>
  );
}

function QuickLink({ href, emoji, title, sub }: { href: string; emoji: string; title: string; sub: string }) {
  return (
    <Link href={href} className="bg-kb-green-light rounded-2xl p-2.5 flex flex-col gap-1 text-white">
      <span className="text-lg leading-none" aria-hidden>{emoji}</span>
      <span className="font-bold text-[13px] leading-tight">{title}</span>
      <span className="text-[10px] text-[#C9D6C4] leading-tight">{sub}</span>
    </Link>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatAgo(iso: string | undefined | null) {
  if (!iso) return "baru aja";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "baru aja";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "baru aja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
