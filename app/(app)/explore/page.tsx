"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { AREAS, CATEGORIES } from "@/lib/exploreConfig";
import { logActivity } from "@/lib/activityLog";
import type { Spot, SpotSubmission } from "@/lib/types";

function detectPlatform(url: string): "tiktok" | "instagram" | "maps" | "other" {
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/maps\.(google|app\.goo)/.test(url) || /goo\.gl\/maps/.test(url)) return "maps";
  return "other";
}

export default function ExplorePage() {
  const { user } = useAuth();
  const { group } = useGroup();
  const [area, setArea] = useState(AREAS[0]);
  const [category, setCategory] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<SpotSubmission[]>([]);

  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newLinks, setNewLinks] = useState<{ url: string; platform: string }[]>([]);
  const [newHalal, setNewHalal] = useState<"halal" | "non_halal" | null>(null);

  useEffect(() => {
    const q = category
      ? query(collection(db, "spots"), where("area", "==", area), where("category", "==", category))
      : query(collection(db, "spots"), where("area", "==", area));
    const unsub = onSnapshot(q, (snap) => setSpots(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Spot)));
    return () => unsub();
  }, [area, category]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "favorites"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => setFavoriteIds(new Set(snap.docs.map((d) => d.data().spotId as string))));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!group) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setSubmissions([]);
      return;
    }
    const q = query(collection(db, "spotSubmissions"), where("groupId", "==", group.id));
    const unsub = onSnapshot(q, (snap) => setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SpotSubmission)));
    return () => unsub();
  }, [group]);

  async function toggleFavorite(spot: Spot) {
    if (!user) return;
    const favId = `${user.uid}_${spot.id}`;
    if (favoriteIds.has(spot.id)) {
      await deleteDoc(doc(db, "favorites", favId));
    } else {
      await setDoc(doc(db, "favorites", favId), { uid: user.uid, spotId: spot.id });
    }
  }

  async function addToItinerary(name: string) {
    if (!user) return;
    const day = Number(window.prompt("Masukin ke hari ke-?", "1") ?? "1") || 1;
    const time = window.prompt("Jam berapa?", "10:00") ?? "10:00";
    await addDoc(collection(db, "itineraryItems"), {
      groupId: group?.id ?? null,
      day,
      time,
      title: name,
      location: name,
      status: group ? "voting" : "final",
      options: group ? [{ id: crypto.randomUUID(), label: name, votes: [], proposedBy: user.uid }] : [],
      createdBy: user.uid,
      createdAt: new Date(),
    });
  }

  function addLinkToDraft() {
    if (!newLink.trim()) return;
    setNewLinks((prev) => [...prev, { url: newLink.trim(), platform: detectPlatform(newLink.trim()) }]);
    setNewLink("");
  }

  async function submitNewSpot() {
    if (!user || !group || !newName.trim()) return;
    await addDoc(collection(db, "spotSubmissions"), {
      groupId: group.id,
      name: newName.trim(),
      category,
      halal: newHalal,
      referenceLinks: newLinks,
      submittedBy: user.uid,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    await logActivity({
      groupId: group.id,
      actorUid: user.uid,
      actorName: "Seseorang",
      action: "spot_submitted",
      message: `mengusulkan tempat baru "${newName.trim()}"`,
    });
    setNewName("");
    setNewLinks([]);
    setNewHalal(null);
  }

  async function proposeSubmission(sub: SpotSubmission) {
    await updateDoc(doc(db, "spotSubmissions", sub.id), { status: "proposed_to_itinerary" });
    await addToItinerary(sub.name);
  }

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <h1 className="text-xl font-bold">Explore Bali</h1>
        <Link href="/kiblat" aria-label="Muslim Friendly" className="w-11 h-11 rounded-full bg-kb-green text-kb-lime flex items-center justify-center shrink-0">
          🧭
        </Link>
      </div>

      <Link href="/kiblat" className="bg-kb-green rounded-[18px] px-3.5 py-3 flex items-center gap-2.5 text-white">
        <div className="flex-1 text-[13px] font-bold">Muslim Friendly · Kompas Kiblat &amp; Jam Sholat</div>
        <span className="text-kb-lime">→</span>
      </Link>

      <div className="flex gap-2 overflow-x-auto">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={`h-10 px-4 rounded-full font-bold text-[13px] shrink-0 ${a === area ? "bg-kb-lime" : "bg-white text-[#3F4F44]"}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`h-[34px] px-3.5 rounded-full text-xs font-bold shrink-0 ${category === null ? "border-[1.5px] border-kb-green bg-white" : "bg-white text-[#3F4F44]"}`}
        >
          Semua kategori
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCategory(c.slug)}
            className={`h-[34px] px-3.5 rounded-full text-xs font-semibold shrink-0 ${category === c.slug ? "border-[1.5px] border-kb-green bg-white" : "bg-white text-[#3F4F44]"}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-[16px] font-bold">Spot di {area}</div>
        <div className="text-xs text-kb-muted">{spots.length} tempat</div>
      </div>

      {spots.length === 0 && <p className="text-sm text-kb-muted">Belum ada data spot di sini — admin bisa tambah lewat dashboard.</p>}

      {spots.map((spot) => (
        <div key={spot.id} className="bg-white rounded-[22px] p-2.5 flex gap-3 items-center">
          <div className="w-20 h-20 rounded-2xl bg-kb-bg shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="text-[15px] font-bold">{spot.name}</div>
            <div className="text-xs text-kb-muted">{spot.durationText ?? "—"}</div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg self-start ${spot.halal === "halal" ? "bg-[#DCEFDC] text-[#1F6B3A]" : "bg-[#F3E6DD] text-[#8A4B2E]"}`}>
              {spot.halal === "halal" ? "Halal area" : "Area wisata umum"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleFavorite(spot)}
              aria-label="Favoritkan"
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${favoriteIds.has(spot.id) ? "bg-[#FDEEDC] text-[#E8720C]" : "bg-white border border-kb-border text-[#9FB096]"}`}
            >
              ♥
            </button>
            <button type="button" onClick={() => addToItinerary(spot.name)} className="h-9 px-3 rounded-xl bg-kb-lime text-kb-ink font-bold text-[11px]">
              + Itin
            </button>
          </div>
        </div>
      ))}

      {group && (
        <>
          <div className="text-[16px] font-bold mt-1">Tempat belum ada di sini?</div>
          <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
            <p className="m-0 text-xs text-kb-muted leading-relaxed">
              Belum ketemu tempatnya? Tambahin manual, kasih link referensi (TikTok, Instagram, Maps) — bisa lebih dari satu. Anggota lain bisa lihat sebelum ikut usulin.
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama tempat"
              className="h-[46px] border border-kb-border rounded-2xl px-3.5 text-sm bg-kb-card"
            />
            <div className="flex gap-2">
              <input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Tempel link TikTok/IG/Maps…"
                className="flex-1 min-w-0 h-[46px] border border-kb-border rounded-2xl px-3.5 text-[13px] bg-kb-card"
              />
              <button type="button" onClick={addLinkToDraft} aria-label="Tambah link" className="w-[46px] h-[46px] rounded-2xl bg-kb-green text-kb-lime font-extrabold text-lg">
                +
              </button>
            </div>
            {newLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newLinks.map((l, i) => (
                  <span key={i} className="bg-kb-bg rounded-xl px-2.5 py-1.5 text-xs font-semibold">
                    {l.platform} link {i + 1}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewHalal("halal")}
                className={`h-9 px-3 rounded-full text-xs font-bold ${newHalal === "halal" ? "bg-[#DCEFDC] text-[#1F6B3A]" : "bg-kb-card text-kb-muted"}`}
              >
                ✓ Halal
              </button>
              <button
                type="button"
                onClick={() => setNewHalal("non_halal")}
                className={`h-9 px-3 rounded-full text-xs font-semibold ${newHalal === "non_halal" ? "bg-[#F3E6DD] text-[#8A4B2E]" : "bg-kb-card text-kb-muted"}`}
              >
                Non-halal
              </button>
            </div>
            <button type="button" onClick={submitNewSpot} className="h-12 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm">
              Kirim ke group
            </button>
          </div>

          {submissions
            .filter((s) => s.status === "pending")
            .map((sub) => (
              <div key={sub.id} className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
                <div className="text-sm font-bold">{sub.name}</div>
                <div className="flex gap-2 overflow-x-auto">
                  {sub.referenceLinks.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer" className="shrink-0 bg-kb-bg rounded-xl px-3 py-2 text-xs font-semibold">
                      {l.platform} ↗
                    </a>
                  ))}
                </div>
                <button type="button" onClick={() => proposeSubmission(sub)} className="h-11 rounded-2xl border border-kb-green text-kb-green font-bold text-[13px]">
                  Usulkan ke itinerary
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
