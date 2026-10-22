"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useGroupMembers } from "@/lib/useGroupMembers";
import { AREAS, CATEGORIES } from "@/lib/exploreConfig";
import type { AccommodationOption, ItineraryItem, SuppliesItem } from "@/lib/types";

export default function AdminPage() {
  const { user } = useAuth();
  const { group } = useGroup();
  const members = useGroupMembers(group?.memberUids);

  const [docsCounts, setDocsCounts] = useState<Record<string, number>>({});
  const [suppliesDone, setSuppliesDone] = useState<Record<string, { done: number; total: number }>>({});
  const [itineraryOpen, setItineraryOpen] = useState<ItineraryItem[]>([]);
  const [accommodations, setAccommodations] = useState<AccommodationOption[]>([]);
  const [announcement, setAnnouncement] = useState("");

  // Spot form
  const [spotName, setSpotName] = useState("");
  const [spotArea, setSpotArea] = useState(AREAS[0]);
  const [spotCategory, setSpotCategory] = useState(CATEGORIES[0].slug);
  const [spotHalal, setSpotHalal] = useState<"halal" | "umum">("halal");

  useEffect(() => {
    if (!group) return;
    const unsub = onSnapshot(query(collection(db, "itineraryItems"), where("groupId", "==", group.id), where("status", "==", "voting")), (snap) =>
      setItineraryOpen(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ItineraryItem))
    );
    const unsubAcc = onSnapshot(query(collection(db, "accommodationOptions"), where("groupId", "==", group.id)), (snap) =>
      setAccommodations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccommodationOption))
    );
    return () => {
      unsub();
      unsubAcc();
    };
  }, [group]);

  useEffect(() => {
    if (!group || members.length === 0) return;
    members.forEach((m) => {
      onSnapshot(query(collection(db, "documents"), where("ownerUid", "==", m.uid)), (snap) => {
        setDocsCounts((prev) => ({ ...prev, [m.uid]: snap.size }));
      });
      onSnapshot(query(collection(db, "suppliesItems"), where("ownerUid", "==", m.uid)), (snap) => {
        const total = snap.size;
        const done = snap.docs.filter((d) => (d.data() as SuppliesItem).checked).length;
        setSuppliesDone((prev) => ({ ...prev, [m.uid]: { done, total } }));
      });
    });
  }, [group, members.map((m) => m.uid).join(",")]);

  async function sendAnnouncement() {
    if (!user || !group || !announcement.trim()) return;
    await addDoc(collection(db, "announcements"), {
      groupId: group.id,
      authorUid: user.uid,
      message: announcement.trim(),
      createdAt: serverTimestamp(),
    });
    setAnnouncement("");
    // TODO: the onAnnouncementCreate Cloud Function pushes this via FCM to the group.
  }

  async function addSpot() {
    if (!spotName.trim()) return;
    await addDoc(collection(db, "spots"), {
      area: spotArea,
      category: spotCategory,
      name: spotName.trim(),
      description: "",
      halal: spotHalal,
      ticketPrice: null,
      durationText: null,
      favoriteCount: 0,
      imageUrl: null,
      mapsUrl: null,
    });
    setSpotName("");
  }

  if (!group) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-kb-muted">Dashboard admin cuma aktif kalau kamu punya group trip aktif.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-kb-bg">
      <div className="max-w-5xl mx-auto p-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{group.name}</h1>
            <div className="text-[13px] text-kb-muted">
              Kode {group.code} · {group.memberUids.length} anggota
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Voting terbuka" value={String(itineraryOpen.length)} highlight />
          <Stat label="Opsi akomodasi" value={String(accommodations.length)} />
          <Stat label="Anggota" value={String(group.memberUids.length)} />
          <Stat label="Owner" value={members.find((m) => m.uid === group.ownerUid)?.displayName ?? "—"} />
        </div>

        <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-3">
          <div className="font-bold text-[15px]">Status anggota</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-kb-muted">
                  <th className="py-2 px-2 font-semibold">Nama</th>
                  <th className="py-2 px-2 font-semibold">Dokumen</th>
                  <th className="py-2 px-2 font-semibold">Keperluan siap</th>
                  <th className="py-2 px-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const supplies = suppliesDone[m.uid];
                  return (
                    <tr key={m.uid} className="border-t border-[#E3E8DA]">
                      <td className="py-3 px-2 font-bold">{m.displayName}</td>
                      <td className="py-3 px-2">{docsCounts[m.uid] ?? 0} file</td>
                      <td className="py-3 px-2">{supplies ? `${supplies.done}/${supplies.total}` : "—"}</td>
                      <td className="py-3 px-2 text-kb-muted">{m.role === "owner" ? "Owner" : "Member"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-5">
          <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-3">
            <div className="font-bold text-[15px]">Kirim pengumuman</div>
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Misal: Kumpul di lobby jam 7!"
              className="h-24 rounded-2xl border border-kb-border p-3 text-sm bg-kb-card resize-none"
            />
            <button type="button" onClick={sendAnnouncement} className="h-11 rounded-2xl bg-kb-green text-kb-lime font-bold text-sm self-start px-5">
              Kirim
            </button>
          </section>

          <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-3">
            <div className="font-bold text-[15px]">Tambah spot wisata</div>
            <input
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              placeholder="Nama tempat"
              className="h-11 rounded-2xl border border-kb-border px-3.5 text-sm bg-kb-card"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={spotArea} onChange={(e) => setSpotArea(e.target.value)} className="h-11 rounded-2xl border border-kb-border px-3 text-sm bg-kb-card">
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select value={spotCategory} onChange={(e) => setSpotCategory(e.target.value)} className="h-11 rounded-2xl border border-kb-border px-3 text-sm bg-kb-card">
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSpotHalal("halal")} className={`h-9 px-3 rounded-full text-xs font-bold ${spotHalal === "halal" ? "bg-[#DCEFDC] text-[#1F6B3A]" : "bg-kb-card text-kb-muted"}`}>
                Halal area
              </button>
              <button type="button" onClick={() => setSpotHalal("umum")} className={`h-9 px-3 rounded-full text-xs font-semibold ${spotHalal === "umum" ? "bg-[#F3E6DD] text-[#8A4B2E]" : "bg-kb-card text-kb-muted"}`}>
                Area umum
              </button>
            </div>
            <button type="button" onClick={addSpot} className="h-11 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm self-start px-5">
              Tambah ke Explore
            </button>
            <p className="m-0 text-[11px] text-kb-muted">
              Target ~30 spot per kategori per area biar Explore kerasa lengkap — isi bertahap aja.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[20px] p-4 flex flex-col gap-1 ${highlight ? "bg-kb-lime" : "bg-white"}`}>
      <span className="text-xs font-semibold text-kb-muted">{label}</span>
      <span className="text-[22px] font-extrabold">{value}</span>
    </div>
  );
}
