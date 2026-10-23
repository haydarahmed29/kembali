"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { confirmSheet, alertSheet } from "@/lib/promptSheet";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { isOwner, leaveGroup } from "@/lib/group";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    if (!user || !group) return;
    const ownerNote = isOwner(group, user.uid) && group.memberUids.length > 1 ? " Status owner bakal pindah ke anggota lain." : "";
    if (!(await confirmSheet(`Keluar dari ${group.name}? Data pribadi kamu tetap tersimpan.${ownerNote}`, { confirmLabel: "Keluar", danger: true }))) return;
    setLeaving(true);
    try {
      await leaveGroup(user.uid, profile?.displayName ?? "Seseorang", group);
    } catch {
      await alertSheet("Gagal keluar dari group, coba lagi.");
    } finally {
      setLeaving(false);
    }
  }

  async function changeDepartureDate(value: string) {
    if (!user) return;
    await supabase.from("profiles").update({ departure_date: value || null }).eq("id", user.uid);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <h1 className="text-xl font-bold">Profil</h1>

      <div className="bg-kb-green text-white rounded-[26px] p-4.5 flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-full bg-kb-lime text-kb-green flex items-center justify-center font-extrabold text-[22px] shrink-0">
          {(profile?.displayName ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="font-bold text-[17px]">{profile?.displayName}</div>
          <div className="text-xs text-[#C9D6C4]">@{profile?.username}</div>
          {group && (
            <div className="text-xs text-kb-lime font-semibold mt-0.5">
              Di group {group.name} · {isOwner(group, user?.uid) ? "Owner" : "Member"}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl px-3.5 py-3 text-xs text-[#3F4F44] leading-relaxed">
        Kebutuhan pribadi kamu (packing, dokumen, budget, itinerary) ada di bawah ini. Kalau suatu saat kamu keluar
        dari group, data ini <b>tetap tersimpan di sini</b> — nggak ikut hilang.
      </div>

      <div className="text-[16px] font-bold mt-1">Kebutuhan pribadi</div>
      <div className="grid grid-cols-2 gap-2.5">
        <ProfileLink href="/dokumen" title="Dokumen" />
        <ProfileLink href="/packing" title="Packing" />
        <ProfileLink href="/budget" title="Budget pribadi" />
        <ProfileLink href="/itinerary" title="Itinerary" />
      </div>

      <label className="bg-white rounded-2xl px-3.5 py-3 flex items-center gap-3 text-left">
        <div className="flex-1">
          <div className="text-sm font-bold">Tanggal berangkat</div>
          <div className="text-xs text-kb-muted">Punya kamu sendiri — tiap orang bisa beda</div>
        </div>
        <input
          type="date"
          value={profile?.departureDate ?? ""}
          onChange={(e) => changeDepartureDate(e.target.value)}
          className="h-10 rounded-xl border border-kb-border px-2.5 text-sm bg-kb-card"
        />
      </label>

      {group && isOwner(group, user?.uid) && (
        <Link href="/admin" className="bg-kb-green text-kb-lime rounded-2xl px-3.5 py-3 flex items-center gap-3">
          <div className="flex-1 text-sm font-bold">Dashboard admin</div>
          <span className="text-xs font-bold">Buka →</span>
        </Link>
      )}

      {group && (
        <div className="bg-white rounded-[22px] p-4 flex flex-col gap-2.5 border border-[#EAD9CE]">
          <div className="text-[13px] font-bold text-[#8A2E1E]">Keluar dari group</div>
          <p className="m-0 text-xs text-kb-muted leading-relaxed">
            Dokumen, packing, budget dan itinerary pribadi di atas tetap tersimpan — cuma data group (itinerary bareng,
            voting, budget bareng) yang hilang dari akunmu.
          </p>
          <button type="button" onClick={handleLeave} disabled={leaving} className="h-11 rounded-2xl bg-[#FDEAE4] text-[#8A2E1E] font-bold text-sm disabled:opacity-60">
            {leaving ? "Keluar..." : `Keluar dari ${group.name}`}
          </button>
        </div>
      )}

      <button type="button" onClick={handleSignOut} className="h-11 rounded-2xl text-kb-muted font-semibold text-sm">
        Keluar akun
      </button>
    </div>
  );
}

function ProfileLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="bg-white rounded-[20px] p-3.5 flex flex-col gap-2">
      <div className="text-sm font-bold">{title}</div>
    </Link>
  );
}
