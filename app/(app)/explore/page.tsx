"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rowToSpot, rowToSpotSubmission } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useChosenStay } from "@/lib/useChosenStay";
import { buildGoogleImagesHref, buildInstagramHref, buildMapsHref, buildPinterestHref, spotMapsQuery } from "@/lib/maps";
import { AREAS, CATEGORIES } from "@/lib/exploreConfig";
import { logActivity } from "@/lib/activityLog";
import { promptDayAndTime } from "@/lib/time";
import { fillItineraryCoords } from "@/lib/geocode";
import type { Spot, SpotSubmission } from "@/lib/types";

function detectPlatform(url: string): "tiktok" | "instagram" | "maps" | "other" {
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/maps\.(google|app\.goo)/.test(url) || /goo\.gl\/maps/.test(url)) return "maps";
  return "other";
}

export default function ExplorePage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const { originAddress } = useChosenStay(group?.id);
  const [area, setArea] = useState(AREAS[0]);
  const [category, setCategory] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<SpotSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Spot[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [favSpots, setFavSpots] = useState<Spot[]>([]);

  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newLinks, setNewLinks] = useState<{ url: string; platform: string }[]>([]);

  useEffect(() => {
    const load = () => {
      let q = supabase.from("spots").select("*").eq("area", area);
      if (category) q = q.eq("category", category);
      q.then(({ data }) => setSpots(data ? data.map(rowToSpot) : []));
    };
    load();

    const channel = supabase
      .channel(`spots-${area}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spots", filter: `area=eq.${area}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [area, category]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // search looks across every area/category, not just the one selected above
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing results when the query is emptied
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      // match name or area, plus any category whose label fits ("cafe", "pantai", "oleh"…).
      // Strip characters that would break PostgREST's or() syntax / act as wildcards.
      const safe = q.replace(/[,()%_*\\]/g, " ").trim();
      const lower = safe.toLowerCase();
      const cats = CATEGORIES.filter((c) => c.label.toLowerCase().includes(lower) || c.slug.includes(lower)).map((c) => c.slug);
      const ors = [`name.ilike.*${safe}*`, `area.ilike.*${safe}*`];
      if (cats.length) ors.push(`category.in.(${cats.join(",")})`);
      supabase
        .from("spots")
        .select("*")
        .or(ors.join(","))
        .order("name")
        .then(({ data }) => {
          setSearchResults(data ? data.map(rowToSpot) : []);
          setSearching(false);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase
        .from("favorites")
        .select("spot_id")
        .eq("uid", user.uid)
        .then(({ data }) => setFavoriteIds(new Set((data ?? []).map((d) => d.spot_id as string))));
    load();

    const channel = supabase
      .channel(`favorites-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites", filter: `uid=eq.${user.uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // "Favoritku" shows favourites from every area, not just the area tab that's selected
  useEffect(() => {
    if (!onlyFavorites) return;
    const ids = [...favoriteIds];
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to fetch
      setFavSpots([]);
      return;
    }
    let active = true;
    supabase
      .from("spots")
      .select("*")
      .in("id", ids)
      .then(({ data }) => { if (active) setFavSpots(data ? data.map(rowToSpot) : []); });
    return () => { active = false; };
  }, [onlyFavorites, favoriteIds]);

  useEffect(() => {
    if (!group) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setSubmissions([]);
      return;
    }
    const load = () =>
      supabase
        .from("spot_submissions")
        .select("*")
        .eq("group_id", group.id)
        .then(({ data }) => setSubmissions(data ? data.map(rowToSpotSubmission) : []));
    load();

    const channel = supabase
      .channel(`spot-submissions-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spot_submissions", filter: `group_id=eq.${group.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group]);

  async function toggleFavorite(spot: Spot) {
    if (!user) return;
    if (favoriteIds.has(spot.id)) {
      await supabase.from("favorites").delete().eq("uid", user.uid).eq("spot_id", spot.id);
    } else {
      await supabase.from("favorites").insert({ uid: user.uid, spot_id: spot.id });
    }
  }

  async function addToItinerary(name: string, coords?: { lat: number | null; lng: number | null }): Promise<boolean> {
    if (!user) return false;
    const when = await promptDayAndTime();
    if (!when) return false;
    const hasCoords = coords?.lat != null && coords?.lng != null;
    const { data: created } = await supabase.from("itinerary_items").insert({
      group_id: group?.id ?? null,
      day: when.day,
      time: when.time,
      title: name,
      location: name,
      // in a group the slot still goes to a vote (with your vote already on it); solo it's final straight away
      status: group ? "voting" : "final",
      options: group ? [{ id: crypto.randomUUID(), label: name, votes: [user.uid], proposedBy: user.uid }] : [],
      lat: hasCoords ? coords!.lat : null, // spot coordinates come along, so it shows on the map right away
      lng: hasCoords ? coords!.lng : null,
      created_by: user.uid,
    }).select("id").single();
    if (created?.id && !hasCoords) fillItineraryCoords(created.id, name); // background lookup
    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "itinerary_update",
        message: `masukin "${name}" ke itinerary Hari ${when.day} jam ${when.time}`,
      });
    }
    setToast(group ? `"${name}" masuk voting Hari ${when.day}, ${when.time}` : `"${name}" masuk itinerary Hari ${when.day}, ${when.time}`);
    return true;
  }

  function addLinkToDraft() {
    if (!newLink.trim()) return;
    setNewLinks((prev) => [...prev, { url: newLink.trim(), platform: detectPlatform(newLink.trim()) }]);
    setNewLink("");
  }

  async function submitNewSpot() {
    if (!user || !group || !newName.trim()) return;
    // include a link still sitting in the input that wasn't added with "+"
    const links = newLink.trim() ? [...newLinks, { url: newLink.trim(), platform: detectPlatform(newLink.trim()) }] : newLinks;
    await supabase.from("spot_submissions").insert({
      group_id: group.id,
      name: newName.trim(),
      category,
      reference_links: links,
      submitted_by: user.uid,
      status: "pending",
    });
    await logActivity({
      groupId: group.id,
      actorUid: user.uid,
      actorName: profile?.displayName ?? "Seseorang",
      action: "spot_submitted",
      message: `mengusulkan tempat baru "${newName.trim()}"`,
    });
    setNewName("");
    setNewLinks([]);
    setNewLink("");
    setToast("Tempat baru dikirim ke group");
  }

  async function proposeSubmission(sub: SpotSubmission) {
    const added = await addToItinerary(sub.name);
    if (added) await supabase.from("spot_submissions").update({ status: "proposed_to_itinerary" }).eq("id", sub.id);
  }

  const isSearching = search.trim().length > 0;
  const mode: "search" | "favorites" | "area" = isSearching ? "search" : onlyFavorites ? "favorites" : "area";
  const source = mode === "search" ? (searchResults ?? []) : mode === "favorites" ? favSpots : spots;

  // favorites first, then most-favorited, then A–Z
  const visibleSpots = source
    .filter((s) => mode !== "search" || !onlyFavorites || favoriteIds.has(s.id))
    .filter((s) => mode !== "favorites" || !category || s.category === category)
    .sort(
      (a, b) =>
        Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) ||
        (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) ||
        a.name.localeCompare(b.name, "id")
    );
  const showArea = mode !== "area";

  return (
    <div className="p-4 flex flex-col gap-3.5">
      {toast && (
        <div role="status" className="fixed left-4 right-4 top-4 mx-auto max-w-[440px] z-30 bg-kb-green text-kb-lime text-sm font-bold rounded-2xl px-4 py-3 shadow-lg">
          ✓ {toast}
        </div>
      )}
      <h1 className="text-xl font-bold m-0">Explore Bali</h1>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/tips" className="bg-kb-green text-white rounded-[18px] px-3 py-2.5 flex items-center gap-2">
          <span className="text-lg" aria-hidden>💡</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-bold">Tips &amp; Panduan</span>
            <span className="block text-[10px] text-[#C9D6C4] truncate">Nusa Penida, Bahasa Bali</span>
          </span>
        </Link>
        <Link href="/kiblat" className="bg-white rounded-[18px] px-3 py-2.5 flex items-center gap-2">
          <span className="text-lg" aria-hidden>🧭</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-bold">Muslim Friendly</span>
            <span className="block text-[10px] text-kb-muted truncate">Kiblat &amp; jadwal sholat</span>
          </span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl px-3.5 h-12 flex items-center gap-2 focus-ring-within">
        <span className="text-kb-muted text-sm" aria-hidden>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari tempat, area, atau kategori…"
          aria-label="Cari tempat"
          className="flex-1 min-w-0 h-full bg-transparent text-sm outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} aria-label="Hapus pencarian" className="text-kb-muted text-sm px-1">
            ✕
          </button>
        )}
      </div>

      {mode === "area" && (
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
      )}

      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setOnlyFavorites((v) => !v)}
          aria-pressed={onlyFavorites}
          className={`h-[34px] px-3.5 rounded-full text-xs font-bold shrink-0 ${onlyFavorites ? "bg-[#FDEEDC] text-[#E8720C]" : "bg-white text-[#3F4F44]"}`}
        >
          ♥ Favoritku
        </button>
        {mode !== "search" && (
          <>
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
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[16px] font-bold truncate">
          {mode === "search" ? `Hasil untuk "${search.trim()}"` : mode === "favorites" ? "Favoritku · semua area" : `Spot di ${area}`}
        </div>
        <div className="text-xs text-kb-muted shrink-0">{searching ? "Nyari..." : `${visibleSpots.length} tempat`}</div>
      </div>

      {!searching && visibleSpots.length === 0 && (
        <p className="text-sm text-kb-muted">
          {mode === "search"
            ? "Gak ketemu. Coba kata lain, misal nama area (Ubud) atau kategori (pantai)."
            : mode === "favorites"
              ? "Belum ada favorit — ketuk ♥ di spot yang kamu suka."
              : "Belum ada data spot di sini — admin bisa tambah lewat dashboard."}
        </p>
      )}

      {visibleSpots.map((spot) => {
        const cat = CATEGORIES.find((c) => c.slug === spot.category);
        const fav = favoriteIds.has(spot.id);
        return (
          <div key={spot.id} className="bg-white rounded-[22px] p-2.5 flex flex-col gap-2.5">
            <div className="flex gap-3 items-center">
              <div className="w-16 h-16 rounded-2xl bg-kb-bg shrink-0 overflow-hidden flex items-center justify-center text-2xl">
                {spot.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote image URLs
                  <img src={spot.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  (cat?.emoji ?? "📍")
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="text-[15px] font-bold leading-snug">{spot.name}</div>
                <div className="text-xs text-kb-muted">
                  {[showArea ? spot.area : null, cat?.label, spot.durationText, spot.ticketPrice].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(spot)}
                aria-label={fav ? "Hapus dari favorit" : "Favoritkan"}
                aria-pressed={fav}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${fav ? "bg-[#FDEEDC] text-[#E8720C]" : "bg-white border border-kb-border text-[#9FB096]"}`}
              >
                ♥
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
                <RefLink href={buildMapsHref(spotMapsQuery(spot.name, spot.area), originAddress)} className="bg-[#E6F0E4] text-kb-green">
                  📍 {originAddress ? "Rute" : "Maps"}
                </RefLink>
                <RefLink href={buildInstagramHref(spot.name, spot.area)} className="bg-[#FBE8F1] text-[#C13584]">
                  IG
                </RefLink>
                <RefLink href={buildPinterestHref(spot.name, spot.area)} className="bg-[#FDE7E9] text-[#E60023]">
                  Pinterest
                </RefLink>
                <RefLink href={buildGoogleImagesHref(spot.name, spot.area)} className="bg-[#E8F0FE] text-[#1A73E8]">
                  Foto
                </RefLink>
              </div>
              <button type="button" onClick={() => addToItinerary(spot.name, spot)} className="h-8 px-3 rounded-xl bg-kb-lime text-kb-ink font-bold text-[11px] shrink-0">
                + Itin
              </button>
            </div>
          </div>
        );
      })}

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

function RefLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`h-8 px-2.5 rounded-xl text-[11px] font-bold flex items-center shrink-0 ${className}`}>
      {children}
    </a>
  );
}
