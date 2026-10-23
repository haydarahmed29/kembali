"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rowToItineraryItem } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useChosenStay } from "@/lib/useChosenStay";
import { useLiveLocations } from "@/lib/useLiveLocations";
import { buildMapsHref } from "@/lib/maps";
import { fillItineraryCoords } from "@/lib/geocode";
import { dayColor, personColor } from "@/lib/map/config";
import TripMapLazy, { type MapFocus, type MapPerson, type MapPlace } from "@/components/map/TripMapLazy";
import MapPickerSheet from "@/components/map/MapPickerSheet";
import type { ItineraryItem } from "@/lib/types";

export default function PetaPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const { originAddress } = useChosenStay(group?.id);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [day, setDay] = useState<number | "all">("all");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [picking, setPicking] = useState<ItineraryItem | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const scopeId = group?.id ?? null;
  const me = useMemo(() => (user ? { uid: user.uid, name: profile?.displayName ?? "Aku" } : null), [user, profile?.displayName]);
  const live = useLiveLocations(group?.id, me);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const q =
        scopeId == null
          ? supabase.from("itinerary_items").select("*").eq("created_by", user.uid).is("group_id", null)
          : supabase.from("itinerary_items").select("*").eq("group_id", scopeId);
      q.order("day").order("time").then(({ data }) => setItems(data ? data.map(rowToItineraryItem) : []));
    };
    load();
    const filter = scopeId == null ? `created_by=eq.${user.uid}` : `group_id=eq.${scopeId}`;
    const channel = supabase
      .channel(`peta-itinerary-${scopeId ?? user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items", filter }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, scopeId]);

  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => a - b);
  const inView = items.filter((i) => day === "all" || i.day === day);
  const located = inView.filter((i) => i.lat != null && i.lng != null);
  const missing = inView.filter((i) => i.lat == null || i.lng == null);

  const places: MapPlace[] = useMemo(() => {
    const counter = new Map<number, number>();
    return located.map((i) => {
      const n = (counter.get(i.day) ?? 0) + 1;
      counter.set(i.day, n);
      const name = i.status === "voting" ? `${i.title} (voting)` : i.title;
      return {
        id: i.id,
        name,
        lat: i.lat!,
        lng: i.lng!,
        label: day === "all" ? `${i.day}.${n}` : String(n),
        color: dayColor(i.day),
        routeGroup: `d${i.day}`,
        subtitle: `Hari ${i.day} · ${i.time}`,
        note: i.location && i.location !== i.title ? i.location : undefined,
        href: buildMapsHref(`${i.lat},${i.lng}`, originAddress),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `located` is derived from these
  }, [items, day, originAddress]);

  const people: MapPerson[] = [
    ...live.others.map((p) => ({ id: p.uid, name: p.name, lat: p.lat, lng: p.lng, color: personColor(p.uid), updatedAt: p.at })),
    ...(live.mine ? [{ id: live.mine.uid, name: live.mine.name, lat: live.mine.lat, lng: live.mine.lng, color: personColor(live.mine.uid), updatedAt: live.mine.at, isMe: true }] : []),
  ];

  async function autoLocateAll() {
    setAutoBusy(true);
    for (const item of missing) {
      await fillItineraryCoords(item.id, item.location || item.title);
    }
    setAutoBusy(false);
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href="/itinerary" aria-label="Kembali ke itinerary" className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold m-0">Peta Trip</h1>
          <div className="text-xs text-kb-muted">{group ? group.name : "Solo trip"} · garis = urutan itinerary</div>
        </div>
      </div>

      {days.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <DayChip active={day === "all"} onClick={() => setDay("all")} label="Semua hari" />
          {days.map((d) => (
            <DayChip key={d} active={day === d} onClick={() => setDay(d)} label={`Hari ${d}`} color={dayColor(d)} />
          ))}
        </div>
      )}

      <div className="-mx-4 h-[58dvh] min-h-[320px] border-y border-kb-border">
        <TripMapLazy className="w-full h-full" places={places} people={people} focus={focus} fitKey={places.map((p) => p.id).join(",")} />
      </div>

      {group ? (
        <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center shrink-0" aria-hidden>
              📍
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold">Bagikan lokasiku</div>
              <div className="text-xs text-kb-muted">
                {live.sharing
                  ? live.mine
                    ? `Live · akurasi ±${live.mine.accuracy} m · cuma jalan selama halaman ini terbuka`
                    : "Nyari sinyal GPS..."
                  : "Mati. Teman cuma lihat kamu kalau ini dinyalain."}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={live.sharing}
              aria-label="Bagikan lokasiku"
              onClick={() => live.toggle(!live.sharing)}
              className={`w-[52px] h-[30px] rounded-full flex items-center p-[3px] shrink-0 transition-colors ${live.sharing ? "bg-kb-green justify-end" : "bg-kb-border justify-start"}`}
            >
              <span className="w-6 h-6 rounded-full bg-kb-lime block" />
            </button>
          </div>
          {live.error && <p className="m-0 text-xs text-red-700 leading-relaxed">{live.error}</p>}

          <div className="border-t border-[#E3E8DA] pt-2 flex flex-col gap-1">
            <div className="text-xs font-bold text-kb-muted">Teman yang lagi share ({live.others.length})</div>
            {live.others.length === 0 && <p className="m-0 text-xs text-kb-muted">Belum ada. Muncul otomatis begitu ada yang nyalain.</p>}
            {live.others.map((p) => (
              <button
                key={p.uid}
                type="button"
                onClick={() => setFocus({ lat: p.lat, lng: p.lng, zoom: 16, key: Date.now() })}
                className="flex items-center gap-2.5 py-1.5 text-left"
              >
                <span className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0" style={{ background: personColor(p.uid) }}>
                  {(p.name[0] ?? "?").toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{p.name}</span>
                  <span className="block text-[11px] text-kb-muted">±{p.accuracy} m · ketuk buat lihat</span>
                </span>
                <span className="text-xs font-bold text-kb-green">Lihat →</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[22px] p-3.5 text-xs text-kb-muted">
          Lokasi teman cuma ada di group trip. Tombol ◎ di peta nunjukin posisi kamu sendiri.
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-kb-muted m-0">
          Itinerary masih kosong.{" "}
          <Link href="/explore" className="font-bold text-kb-green">
            Cari tempat di Explore →
          </Link>
        </p>
      )}

      {missing.length > 0 && (
        <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">Belum ada di peta ({missing.length})</div>
            <button type="button" onClick={autoLocateAll} disabled={autoBusy} className="text-xs font-bold text-kb-green disabled:opacity-60">
              {autoBusy ? "Nyari..." : "Cari otomatis"}
            </button>
          </div>
          {missing.map((i) => (
            <div key={i.id} className="flex items-center gap-2 py-1">
              <span className="text-[11px] font-bold bg-kb-bg px-2 py-1 rounded-lg shrink-0">H{i.day}</span>
              <span className="flex-1 min-w-0 text-sm truncate">{i.title}</span>
              <button type="button" onClick={() => setPicking(i)} className="text-xs font-bold text-kb-green shrink-0">
                📍 Atur
              </button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <MapPickerSheet
          title={`Lokasi "${picking.title}"`}
          query={picking.location || picking.title}
          onClose={() => setPicking(null)}
          onSave={async ({ lat, lng }) => {
            await supabase.from("itinerary_items").update({ lat, lng }).eq("id", picking.id);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

function DayChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-[34px] px-3.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 ${active ? "bg-kb-lime text-kb-ink" : "bg-white text-[#3F4F44]"}`}
    >
      {color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
