"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { confirmSheet } from "@/lib/promptSheet";
import { rowToAccommodationOption, rowToItineraryItem, rowToSpot } from "@/lib/mappers";
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
  const [spotMaps, setSpotMaps] = useState("");
  const [spotImage, setSpotImage] = useState("");
  const [spotDuration, setSpotDuration] = useState("");
  const [spotPrice, setSpotPrice] = useState("");

  useEffect(() => {
    if (!group || !owner) return;

    supabase
      .from("itinerary_items")
      .select("*")
      .eq("group_id", group.id)
      .eq("status", "voting")
      .then(({ data }) => data && setItineraryOpen(data.map(rowToItineraryItem)));
    supabase
      .from("accommodation_options")
      .select("*")
      .eq("group_id", group.id)
      .then(({ data }) => data && setAccommodations(data.map(rowToAccommodationOption)));

    const channels = [
      supabase
        .channel(`admin-itin-${group.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items", filter: `group_id=eq.${group.id}` }, () => {
          supabase
            .from("itinerary_items")
            .select("*")
            .eq("group_id", group.id)
            .eq("status", "voting")
            .then(({ data }) => data && setItineraryOpen(data.map(rowToItineraryItem)));
        })
        .subscribe(),
      supabase
        .channel(`admin-accom-${group.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_options", filter: `group_id=eq.${group.id}` }, () => {
          supabase
            .from("accommodation_options")
            .select("*")
            .eq("group_id", group.id)
            .then(({ data }) => data && setAccommodations(data.map(rowToAccommodationOption)));
        })
        .subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [group, owner]);

  useEffect(() => {
    if (!user || !owner) return;
    const load = () =>
      supabase
        .from("spots")
        .select("*")
        .eq("created_by", user.uid)
        .then(({ data }) =>
          data && setMySpots(data.map(rowToSpot).sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)))
        );
    load();
    const channel = supabase
      .channel(`admin-spots-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spots", filter: `created_by=eq.${user.uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, owner]);

  // One set of listeners per member — and they're torn down when the member list changes,
  // so the page doesn't pile up duplicate subscriptions.
  const memberKey = group?.memberUids.join(",") ?? "";
  useEffect(() => {
    if (!owner || !memberKey) return;
    const uids = memberKey.split(",");
    const patch = (uid: string, part: Partial<MemberStats>) =>
      setStats((prev) => ({ ...prev, [uid]: { ...EMPTY_STATS, ...prev[uid], ...part } }));

    const loadDocs = (uid: string) =>
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("owner_uid", uid)
        .then(({ count }) => patch(uid, { docs: count ?? 0 }));
    const loadSupplies = (uid: string) =>
      supabase
        .from("supplies_items")
        .select("checked")
        .eq("owner_uid", uid)
        .then(({ data }) => {
          const rows = (data ?? []) as Pick<SuppliesItem, "checked">[];
          patch(uid, { supplies: { total: rows.length, done: rows.filter((r) => r.checked).length } });
        });
    const loadOutfit = (uid: string) =>
      supabase
        .from("outfit_items")
        .select("done")
        .eq("owner_uid", uid)
        .then(({ data }) => {
          const rows = (data ?? []) as Pick<OutfitItem, "done">[];
          patch(uid, { outfit: { total: rows.length, done: rows.filter((r) => r.done).length } });
        });
    const loadBags = (uid: string) =>
      supabase
        .from("packing_bags")
        .select("items")
        .eq("owner_uid", uid)
        .then(({ data }) => {
          const items = ((data ?? []) as Pick<PackingBag, "items">[]).flatMap((d) => d.items ?? []);
          patch(uid, { bags: { total: items.length, in: items.filter((i) => i.in).length } });
        });

    uids.forEach((uid) => {
      loadDocs(uid);
      loadSupplies(uid);
      loadOutfit(uid);
      loadBags(uid);
    });

    const channels = uids.flatMap((uid) => [
      supabase
        .channel(`admin-docs-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `owner_uid=eq.${uid}` }, () => loadDocs(uid))
        .subscribe(),
      supabase
        .channel(`admin-supplies-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "supplies_items", filter: `owner_uid=eq.${uid}` }, () => loadSupplies(uid))
        .subscribe(),
      supabase
        .channel(`admin-outfit-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "outfit_items", filter: `owner_uid=eq.${uid}` }, () => loadOutfit(uid))
        .subscribe(),
      supabase
        .channel(`admin-bags-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "packing_bags", filter: `owner_uid=eq.${uid}` }, () => loadBags(uid))
        .subscribe(),
    ]);
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [memberKey, owner]);

  async function sendAnnouncement() {
    if (!user || !group || !announcement.trim()) return;
    await supabase.from("announcements").insert({ group_id: group.id, author_uid: user.uid, message: announcement.trim() });
    setAnnouncement("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  async function addSpot() {
    if (!user || !spotName.trim()) return;
    await supabase.from("spots").insert({
      area: spotArea,
      category: spotCategory,
      name: spotName.trim(),
      description: "",
      ticket_price: spotPrice.trim() || null,
      duration_text: spotDuration.trim() || null,
      favorite_count: 0,
      image_url: /^https?:\/\//i.test(spotImage.trim()) ? spotImage.trim() : null,
      maps_url: /^https?:\/\//i.test(spotMaps.trim()) ? spotMaps.trim() : null,
      created_by: user.uid,
    });
    setSpotName("");
    setSpotMaps("");
    setSpotImage("");
    setSpotDuration("");
    setSpotPrice("");
  }

  async function removeSpot(spot: Spot) {
    if (!(await confirmSheet(`Hapus "${spot.name}" dari Explore?`, { confirmLabel: "Hapus", danger: true }))) return;
    await supabase.from("spots").delete().eq("id", spot.id);
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[11px] text-kb-muted">
            Lupa password? Supabase Dashboard → Authentication → Users → cari <code>username@kembali.app</code> → reset/hapus akunnya.
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
              <span className="text-xs text-kb-muted">{sent ? "✓ Terkirim — muncul di Home semua anggota" : "Muncul di Home"}</span>
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
              placeholder="Link Google Maps (biar jaraknya bisa dicek)"
              className="h-11 rounded-2xl border border-kb-border px-3.5 text-sm bg-kb-card"
            />
            <input
              value={spotImage}
              onChange={(e) => setSpotImage(e.target.value)}
              placeholder="Link gambar (opsional)"
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
                      {s.area} · {CATEGORIES.find((c) => c.slug === s.category)?.label ?? s.category}
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
