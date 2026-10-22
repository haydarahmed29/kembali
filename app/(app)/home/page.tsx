"use client";

import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup, daysUntil } from "@/lib/useGroup";

export default function HomePage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();

  const tripDate = group?.startDate ?? profile?.departureDate ?? null;
  const dLeft = daysUntil(tripDate);

  async function toggleShareLocation() {
    if (!user || !profile) return;
    await updateDoc(doc(db, "users", user.uid), { shareLocation: !profile.shareLocation });
  }

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
          <div className="text-xs text-kb-muted">{group ? `Group Trip · ${profile?.role === "owner" ? "Owner" : "Member"}` : "Solo Trip"}</div>
          <div className="text-[17px] font-bold">{group ? group.name : (profile?.displayName ?? "Trip kamu")}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-kb-lime rounded-[22px] p-3.5 flex flex-col gap-0.5">
          <div className="text-xs font-semibold text-[#2D3A1A]">Berangkat</div>
          <div className="text-[28px] font-extrabold tracking-tight">{dLeft !== null ? `H-${dLeft}` : "—"}</div>
          <div className="text-xs text-[#2D3A1A]">{tripDate ?? "Belum diatur"}</div>
        </div>
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
              <div className="text-xs font-bold bg-kb-lime text-kb-ink px-2.5 py-1 rounded-xl">
                Kode {group.code}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <QuickLink href="/dokumen" title="Dokumen" />
              <QuickLink href="/packing" title="Packing" />
              <QuickLink href="/itinerary" title="Voting" />
            </div>
          </div>

          <Link href="/akomodasi" className="bg-white rounded-[22px] p-3.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center text-kb-green shrink-0">🏠</div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="text-xs text-kb-muted">Voting akomodasi</div>
              <div className="text-[15px] font-bold">Lihat & vote pilihan villa</div>
            </div>
          </Link>
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
        </div>
      )}

      <div className="bg-white rounded-[22px] p-3.5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center text-kb-green shrink-0">📍</div>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="text-[15px] font-bold">Bagikan lokasi</div>
          <div className="text-xs text-kb-muted">Cuma anggota group yang bisa lihat</div>
        </div>
        <button
          type="button"
          onClick={toggleShareLocation}
          aria-pressed={profile?.shareLocation}
          className={`w-[52px] h-[30px] rounded-full flex items-center p-[3px] ${profile?.shareLocation ? "bg-kb-green justify-end" : "bg-kb-border justify-start"}`}
        >
          <span className="w-6 h-6 rounded-full bg-kb-lime block" />
        </button>
      </div>
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
