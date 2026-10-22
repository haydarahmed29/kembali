"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useGroupMembers } from "@/lib/useGroupMembers";
import { isOwner } from "@/lib/group";
import { AREAS, CATEGORIES } from "@/lib/exploreConfig";
import type { AccommodationOption, ItineraryItem, OutfitItem, PackingBag, Spot, SuppliesItem } from "@/lib/types";

interface MemberStats {
  docs: number;
  supplies: { done: number; total: number };
  outfit: { done: number; total: number };
  bags: { in: number; total: number };
}

const EMPTY_STATS: MemberStats = { docs: 0, supplies: { done: 0, total: 0 }, outfit: { done: 0, total: 0 }, bags: { in: 0, total: 0 } };

export default function AdminPage() {
  const { user } = useAuth();
  const { group, loading } = useGroup();
  const members = useGroupMembers(group?.memberUids);
  const owner = isOwner(group, user?.uid);

  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const [itineraryOpen, setItineraryOpen] = useState<ItineraryItem[]>([]);
  const [accommodations, setAccommodations] = useState<AccommodationOption[]>([]);
  const [mySpots, setMySpots] = useState<Spot[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [sent, setSent] = useState(false);

  // Spot form
  const [spotName, setSpotName] = useState("");
  const [spotArea, setSpotArea] = useState(AREAS[0]);
  const [spotCategory, setSpotCategory] = useState(CATEGORIES[0].slug);
  const [spotHalal, setSpotHalal] = useState<"halal" | "umum">("halal");
  const [spotMaps, setSpotMaps] = useState("");
  const [spotDuration, setSpotDuration] = useState("");
  const [spotPrice, setSpotPrice] = useState("");

  useEffect(() => {
    if (!group || !owner) return;
    const unsubs = [
      onSnapshot(query(collection(db, "itineraryItems"), where("groupId", "==", group.id), where("status", "==", "voting")), (snap) =>
        setItineraryOpen(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ItineraryItem))
      ),
      onSnapshot(query(collection(db, "accommodationOptions"), where("groupId", "==", group.id)), (snap) =>
        setAccommodations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccommodationOption))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [group, owner]);

  useEffect(() => {
    if (!user || !owner) return;
    return onSnapshot(query(collection(db, "spots"), where("createdBy", "==", user.uid)), (snap) =>
      setMySpots(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Spot).sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)))
    );
  }, [user, owner]);

  // One set of listeners per member — and they're torn down when the member list changes,
  // so the page doesn't pile up duplicate subscriptions.
  const memberKey = group?.memberUids.join(",") ?? "";
  useEffect(() => {
    if (!owner || !memberKey) return;
    const uids = memberKey.split(",");
    const patch = (uid: string, part: Partial<MemberStats>) =>
      setStats((prev) => ({ ...prev, [uid]: { ...EMPTY_STATS, ...prev[uid], ...part } }));
    const ignore = () => {};

    const unsubs = uids.flatMap((uid) => [
      onSnapshot(query(collection(db, "documents"), where("ownerUid", "==", uid)), (snap) => patch(uid, { docs: snap.size }), ignore),
      onSnapshot(
        query(collection(db, "suppliesItems"), where("ownerUid", "==", uid)),
        (snap) => patch(uid, { supplies: { total: snap.size, done: snap.docs.filter((d) => (d.data() as SuppliesItem).checked).length } }),
        ignore
      ),
      onSnapshot(
        query(collection(db, "outfitItems"), where("ownerUid", "==", uid)),
        (snap) => patch(uid, { outfit: { total: snap.size, done: snap.docs.filter((d) => (d.data() as OutfitItem).done).length } }),
        ignore
      ),
      onSnapshot(
        query(collection(db, "packingBags"), where("ownerUid", "==", uid)),
        (snap) => {
          const items = snap.docs.flatMap((d) => (d.data() as PackingBag).items ?? []);
          patch(uid, { bags: { total: items.length, in: items.filter((i) => i.in).length } });
        },
        ignore
      ),
    ]);
    return () => unsubs.forEach((u) => u());
  }, [memberKey, owner]);

  async function sendAnnouncement() {
    if (!user || !group || !announcement.trim()) return;
    await addDoc(collection(db, "announcements"), {
      groupId: group.id,
      authorUid: user.uid,
      message: announcement.trim(),
      createdAt: serverTimestamp(),
    });
    setAnnouncement("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  async function addSpot() {
    if (!user || !spotName.trim()) return;
    await addDoc(collection(db, "spots"), {
      area: spotArea,
      category: spotCategory,
      name: spotName.trim(),
      description: "",
      halal: spotHalal,
      ticketPrice: spotPrice.trim() || null,
      durationText: spotDuration.trim() || null,
      favoriteCount: 0,
      imageUrl: null,
      mapsUrl: /^https?:\/\//i.test(spotMaps.trim()) ? spotMaps.trim() : null,
      createdBy: user.uid,
    });
    setSpotName("");
    setSpotMaps("");
    setSpotDuration("");
    setSpotPrice("");
  }

  async function removeSpot(spot: Spot) {
    if (!window.confirm(`Hapus "${spot.name}" dari Explore?`)) return;
    await deleteDoc(doc(db, "spots", spot.id));
  }

  if (loading) {
    return <div className="p-6 text-sm text-kb-muted">Memuat...</div>;
  }

  if (!group || !owner) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col gap-3">
        <p className="text-sm text-kb-muted">Dashboard admin cuma bisa dibuka sama owner group trip.</p>
        <Link href="/home" className="text-sm font-bold text-kb-green">
          ← Balik ke Home
        </Link>
      </div>
    );
  }

  const countsByAreaCategory = mySpots.reduce<Record<string, number>>((acc, s) => {
    const k = `${s.area}|${s.category}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-kb-bg z-30">
      <div className="max-w-5xl mx-auto p-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{group.name}</h1>
            <div className="text-[13px] text-kb-muted">
              Kode {group.code} · {group.memberUids.length} anggota
            </div>
          </div>
          <Link href="/home" className="h-10 px-4 rounded-full bg-white font-bold text-sm flex items-center">
            ← Keluar dashboard
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Voting itinerary terbuka" value={String(itineraryOpen.length)} highlight />
          <Stat label="Opsi akomodasi" value={String(accommodations.length)} />
          <Stat label="Akomodasi fix" value={accommodations.find((a) => a.chosen)?.title ?? "Belum"} />
          <Stat label="Spot di Explore" value={String(mySpots.length)} />
        </div>

        <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-3">
          <div className="font-bold text-[15px]">Status anggota</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-kb-muted">
                  <th className="py-2 px-2 font-semibold">Nama</th>
                  <th className="py-2 px-2 font-semibold">Berangkat</th>
                  <th className="py-2 px-2 font-semibold">Dokumen</th>
                  <th className="py-2 px-2 font-semibold">Koper (in)</th>
                  <th className="py-2 px-2 font-semibold">Outfit</th>
                  <th className="py-2 px-2 font-semibold">Keperluan</th>
                  <th className="py-2 px-2 font-semibold">Lokasi</th>
                  <th className="py-2 px-2 font-semibold">Notif</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const s = stats[m.uid] ?? EMPTY_STATS;
                  return (
                    <tr key={m.uid} className="border-t border-[#E3E8DA]">
                      <td className="py-3 px-2">
                        <div className="font-bold">{m.displayName}</div>
                        <div className="text-[11px] text-kb-muted">
                          @{m.username} · {m.uid === group.ownerUid ? "Owner" : "Member"}
                        </div>
                      </td>
                      <td className="py-3 px-2">{m.departureDate ?? "—"}</td>
                      <td className="py-3 px-2">{s.docs} file</td>
                      <td className="py-3 px-2">{s.bags.total ? `${s.bags.in}/${s.bags.total}` : "—"}</td>
                      <td className="py-3 px-2">{s.outfit.total ? `${s.outfit.done}/${s.outfit.total}` : "—"}</td>
                      <td className="py-3 px-2">{s.supplies.total ? `${s.supplies.done}/${s.supplies.total}` : "—"}</td>
                      <td className="py-3 px-2">
                        {m.shareLocation && m.lastLocation ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${m.lastLocation.lat},${m.lastLocation.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-kb-green"
                          >
                            Maps ↗
                          </a>
                        ) : (
                          <span className="text-kb-muted">Off</span>
                        )}
                      </td>
                      <td className="py-3 px-2">{m.fcmTokens?.length ? "✓" : <span className="text-kb-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[11px] text-kb-muted">
            Lupa password? Firebase Console → Authentication → cari <code>username@kembali.app</code> → reset/hapus akunnya.
          </p>
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
            <div className="flex items-center gap-3">
              <button type="button" onClick={sendAnnouncement} className="h-11 rounded-2xl bg-kb-green text-kb-lime font-bold text-sm px-5">
                Kirim
              </button>
              <span className="text-xs text-kb-muted">{sent ? "✓ Terkirim — muncul di Home semua anggota" : "Muncul di Home (tanpa push notif)"}</span>
            </div>
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
                    {c.label} ({countsByAreaCategory[`${spotArea}|${c.slug}`] ?? 0}/30)
                  </option>
                ))}
              </select>
            </div>
            <input
              value={spotMaps}
              onChange={(e) => setSpotMaps(e.target.value)}
              placeholder="Link Google Maps (opsional)"
              className="h-11 rounded-2xl border border-kb-border px-3.5 text-sm bg-kb-card"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={spotDuration}
                onChange={(e) => setSpotDuration(e.target.value)}
                placeholder="Durasi, misal 2 jam"
                className="h-11 rounded-2xl border border-kb-border px-3.5 text-sm bg-kb-card"
              />
              <input
                value={spotPrice}
                onChange={(e) => setSpotPrice(e.target.value)}
                placeholder="Tiket, misal Rp 50rb"
                className="h-11 rounded-2xl border border-kb-border px-3.5 text-sm bg-kb-card"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSpotHalal("halal")} className={`h-9 px-3 rounded-full text-xs font-bold ${spotHalal === "halal" ? "bg-[#DCEFDC] text-[#1F6B3A]" : "bg-kb-card text-kb-muted"}`}>
                ✓ Halal
              </button>
              <button type="button" onClick={() => setSpotHalal("umum")} className={`h-9 px-3 rounded-full text-xs font-semibold ${spotHalal === "umum" ? "bg-[#F3E6DD] text-[#8A4B2E]" : "bg-kb-card text-kb-muted"}`}>
                Non-halal / umum
              </button>
            </div>
            <button type="button" onClick={addSpot} className="h-11 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm self-start px-5">
              Tambah ke Explore
            </button>
            <p className="m-0 text-[11px] text-kb-muted">Target ~30 spot per kategori per area — angka di dropdown kategori nunjukin progresnya.</p>
          </section>
        </div>

        {mySpots.length > 0 && (
          <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-2">
            <div className="font-bold text-[15px]">Spot yang udah ditambah ({mySpots.length})</div>
            <div className="flex flex-col max-h-[360px] overflow-y-auto">
              {mySpots.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-t border-[#E3E8DA] text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{s.name}</div>
                    <div className="text-[11px] text-kb-muted">
                      {s.area} · {CATEGORIES.find((c) => c.slug === s.category)?.label ?? s.category} · {s.halal === "halal" ? "Halal" : "Umum"}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeSpot(s)} className="text-xs text-red-700">
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[20px] p-4 flex flex-col gap-1 min-w-0 ${highlight ? "bg-kb-lime" : "bg-white"}`}>
      <span className="text-xs font-semibold text-kb-muted">{label}</span>
      <span className="text-[22px] font-extrabold truncate">{value}</span>
    </div>
  );
}
