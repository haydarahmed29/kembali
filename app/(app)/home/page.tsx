"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup, daysUntil } from "@/lib/useGroup";
import { useGroupMembers } from "@/lib/useGroupMembers";
import { isOwner } from "@/lib/group";
import type { Announcement } from "@/lib/types";

export default function HomePage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const members = useGroupMembers(group?.memberUids);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  // Personal departure date wins — everyone can fly on a different day.
  const tripDate = profile?.departureDate ?? group?.startDate ?? null;
  const dLeft = daysUntil(tripDate);
  const owner = isOwner(group, user?.uid);

  useEffect(() => {
    if (!group) return;
    const q = query(collection(db, "announcements"), where("groupId", "==", group.id), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(
      q,
      (snap) => setAnnouncement(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Announcement)),
      () => setAnnouncement(null)
    );
  }, [group]);

  async function toggleShareLocation() {
    if (!user || !profile) return;
    const next = !profile.shareLocation;
    setLocError(null);
    if (next) {
      // ask for permission right away (on the tap) so iOS shows the prompt
      if (!("geolocation" in navigator)) {
        setLocError("HP/browser ini nggak support lokasi.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async () => {
          await updateDoc(doc(db, "users", user.uid), { shareLocation: true });
        },
        () => setLocError("Izin lokasi ditolak. Aktifkan di pengaturan browser dulu ya."),
        { enableHighAccuracy: true, timeout: 15_000 }
      );
    } else {
      await updateDoc(doc(db, "users", user.uid), { shareLocation: false, lastLocation: null });
    }
  }

  const sharingFriends = members.filter((m) => m.uid !== user?.uid && m.shareLocation && m.lastLocation);

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
          <div className="text-xs font-semibold text-[#2D3A1A]">Berangkat</div>
          <div className="text-[28px] font-extrabold tracking-tight">
            {dLeft === null ? "—" : dLeft > 0 ? `H-${dLeft}` : dLeft === 0 ? "Hari ini!" : "Lagi trip"}
          </div>
          <div className="text-xs text-[#2D3A1A]">{tripDate ? formatDate(tripDate) : "Atur tanggal →"}</div>
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
              <QuickLink href="/dokumen" title="Dokumen" />
              <QuickLink href="/akomodasi" title="Villa" />
              <QuickLink href="/itinerary" title="Voting" />
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
          <Link href="/dokumen" className="text-xs font-bold text-kb-green">
            Buka dokumen →
          </Link>
        </div>
      )}

      {group && (
        <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center text-kb-green shrink-0">📍</div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="text-[15px] font-bold">Bagikan lokasi</div>
              <div className="text-xs text-kb-muted">Cuma anggota group yang bisa lihat · update pas app dibuka</div>
            </div>
            <button
              type="button"
              onClick={toggleShareLocation}
              aria-pressed={!!profile?.shareLocation}
              aria-label="Bagikan lokasi"
              className={`w-[52px] h-[30px] rounded-full flex items-center p-[3px] shrink-0 ${profile?.shareLocation ? "bg-kb-green justify-end" : "bg-kb-border justify-start"}`}
            >
              <span className="w-6 h-6 rounded-full bg-kb-lime block" />
            </button>
          </div>
          {locError && <p className="m-0 text-xs text-red-700">{locError}</p>}

          {sharingFriends.length > 0 && (
            <div className="flex flex-col border-t border-[#E3E8DA] pt-1">
              {sharingFriends.map((m) => (
                <a
                  key={m.uid}
                  href={`https://www.google.com/maps/search/?api=1&query=${m.lastLocation!.lat},${m.lastLocation!.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-kb-green text-kb-lime flex items-center justify-center text-xs font-extrabold shrink-0">
                    {m.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{m.displayName}</div>
                    <div className="text-[11px] text-kb-muted">
                      {formatAgo(m.lastLocation!.updatedAt)} · akurasi ±{m.lastLocation!.accuracy} m
                    </div>
                  </div>
                  <span className="text-xs font-bold text-kb-green">Maps ↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="bg-kb-green-light rounded-2xl p-2.5 flex flex-col gap-0.5 text-white">
      <span className="font-bold text-sm">{title}</span>
    </Link>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatAgo(ts: Timestamp | undefined | null) {
  if (!ts?.toDate) return "baru aja";
  const mins = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (mins < 1) return "baru aja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return ts.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
