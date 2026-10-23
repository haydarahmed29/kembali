"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { geocode } from "@/lib/geocode";
import { CATEGORIES } from "@/lib/exploreConfig";
import MapPickerSheet from "@/components/map/MapPickerSheet";

interface Row {
  id: string;
  name: string;
  area: string;
  category: string;
}

/**
 * Owner-only tool: give every Explore spot coordinates so it can appear on the map.
 * "Isi otomatis" asks OpenStreetMap one spot per ~1 s (its usage policy); misses can be pinned by hand.
 */
export default function SpotCoordsSection() {
  const [missing, setMissing] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; found: number; of: number } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    const [{ data: rows, error: e }, { count }] = await Promise.all([
      supabase.from("spots").select("id,name,area,category").is("lat", null).order("area").order("name"),
      supabase.from("spots").select("id", { count: "exact", head: true }),
    ]);
    if (e) {
      setError("Kolom koordinat belum ada — jalankan dulu file SQL peta (map_live.sql) di Supabase.");
      return;
    }
    setError(null);
    setMissing((rows ?? []) as Row[]);
    setTotal(count ?? 0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  async function save(spot: Row, lat: number, lng: number) {
    const { error: e } = await supabase.rpc("set_spot_coords", { p_spot_id: spot.id, p_lat: lat, p_lng: lng });
    return !e;
  }

  async function runAuto() {
    const todo = missing.filter((s) => !failed.has(s.id));
    if (todo.length === 0) return;
    cancelled.current = false;
    setRunning(true);
    let found = 0;
    const newFailed = new Set(failed);
    for (let i = 0; i < todo.length; i++) {
      if (cancelled.current) break;
      const s = todo[i];
      const hit = await geocode(s.name, s.area);
      if (hit && (await save(s, hit.lat, hit.lng))) found++;
      else newFailed.add(s.id);
      setProgress({ done: i + 1, found, of: todo.length });
    }
    setFailed(newFailed);
    setRunning(false);
    await load();
  }

  const located = total - missing.length;
  const pending = missing.filter((s) => !failed.has(s.id));
  const misses = missing.filter((s) => failed.has(s.id));

  return (
    <section className="bg-white rounded-3xl p-4.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-[15px]">Koordinat spot (buat peta)</div>
          <div className="text-xs text-kb-muted">
            {located}/{total} spot udah punya titik di peta
          </div>
        </div>
        {running ? (
          <button type="button" onClick={() => (cancelled.current = true)} className="h-10 px-4 rounded-2xl bg-kb-card text-kb-muted font-bold text-sm">
            Berhenti
          </button>
        ) : (
          pending.length > 0 && (
            <button type="button" onClick={runAuto} className="h-10 px-4 rounded-2xl bg-kb-green text-kb-lime font-bold text-sm">
              Isi otomatis ({pending.length})
            </button>
          )
        )}
      </div>
      {error && <p className="m-0 text-xs text-red-700">{error}</p>}
      {progress && (
        <div className="flex flex-col gap-1">
          <div className="h-2 rounded bg-kb-bg overflow-hidden">
            <div className="h-2 bg-kb-green rounded" style={{ width: `${(progress.done / progress.of) * 100}%` }} />
          </div>
          <div className="text-xs text-kb-muted">
            {progress.done}/{progress.of} dicek · {progress.found} ketemu
            {running ? " · ~1 detik per spot, biarin halaman ini kebuka" : " · selesai"}
          </div>
        </div>
      )}
      <p className="m-0 text-[11px] text-kb-muted">
        Pakai OpenStreetMap (gratis). Hasil otomatis kadang meleset sedikit — cek di Peta, dan pasang pin manual buat yang nggak ketemu.
      </p>
      {misses.length > 0 && (
        <div className="flex flex-col max-h-[300px] overflow-y-auto">
          <div className="text-xs font-bold text-kb-muted pb-1">Nggak ketemu otomatis ({misses.length})</div>
          {misses.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-t border-[#E3E8DA] text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{s.name}</div>
                <div className="text-[11px] text-kb-muted">
                  {s.area} · {CATEGORIES.find((c) => c.slug === s.category)?.label ?? s.category}
                </div>
              </div>
              <button type="button" onClick={() => setPicking(s)} className="text-xs font-bold text-kb-green shrink-0">
                📍 Pasang pin
              </button>
            </div>
          ))}
        </div>
      )}
      {picking && (
        <MapPickerSheet
          title={`Lokasi "${picking.name}"`}
          query={picking.name}
          area={picking.area}
          onClose={() => setPicking(null)}
          onSave={async ({ lat, lng }) => {
            if (await save(picking, lat, lng)) {
              setFailed((f) => {
                const n = new Set(f);
                n.delete(picking.id);
                return n;
              });
              setPicking(null);
              await load();
            }
          }}
        />
      )}
    </section>
  );
}
