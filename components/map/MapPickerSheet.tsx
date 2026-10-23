"use client";

import { useState } from "react";
import TripMapLazy from "./TripMapLazy";
import { geocode } from "@/lib/geocode";
import { BALI_CENTER } from "@/lib/map/config";

interface Props {
  title: string;
  /** Pre-filled search text (usually the place name). */
  query: string;
  area?: string | null;
  initial?: { lat: number; lng: number } | null;
  onSave: (p: { lat: number; lng: number }) => void | Promise<void>;
  onClose: () => void;
}

/** Full-screen "where is this place?" picker: search OpenStreetMap, or tap/drag the red pin. */
export default function MapPickerSheet({ title, query, area, initial, onSave, onClose }: Props) {
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [text, setText] = useState(query);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(initial ? null : "Cari dulu, atau ketuk peta di lokasi tempatnya.");

  async function search() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    const hit = await geocode(text, area);
    setBusy(false);
    if (hit) setPick(hit);
    else setMsg("Nggak ketemu di OpenStreetMap. Geser peta & ketuk lokasi tempatnya langsung.");
  }

  async function save() {
    if (!pick) return;
    setBusy(true);
    await onSave(pick);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-kb-bg flex flex-col max-w-[480px] mx-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="p-4 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
            ←
          </button>
          <div className="font-bold text-[17px] leading-tight">{title}</div>
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Nama tempat…"
            className="flex-1 min-w-0 h-11 border border-kb-border rounded-2xl px-3.5 text-sm bg-white"
          />
          <button type="button" onClick={search} disabled={busy} className="h-11 px-4 rounded-2xl bg-kb-green text-kb-lime font-bold text-[13px] disabled:opacity-60">
            {busy ? "..." : "Cari"}
          </button>
        </div>
        {msg && <p className="m-0 text-xs text-kb-muted">{msg}</p>}
      </div>
      <TripMapLazy
        className="flex-1 min-h-0"
        pick={pick}
        onPick={(p) => {
          setPick(p);
          setMsg(null);
        }}
        focus={pick ? null : { lat: BALI_CENTER[1], lng: BALI_CENTER[0], zoom: 9.5, key: 0 }}
      />
      <div className="p-4 flex gap-2.5 bg-white">
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-2xl bg-kb-card text-kb-muted font-bold text-sm">
          Batal
        </button>
        <button type="button" onClick={save} disabled={!pick || busy} className="flex-1 h-12 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm disabled:opacity-50">
          Simpan titik ini
        </button>
      </div>
    </div>
  );
}
