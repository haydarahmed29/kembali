"use client";

import { supabase } from "./supabase";
import { BALI_BOUNDS } from "./map/config";

/**
 * Place name → coordinates via OpenStreetMap's Nominatim (free, no key). Its usage policy allows
 * at most 1 request per second and asks for results to be cached — so every lookup goes through
 * a single queue spaced 1.1 s apart, and callers save the result to the database.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const SPACING_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

async function nominatimOnce(query: string): Promise<{ lat: number; lng: number } | null> {
  const wait = Math.max(0, lastRequestAt + SPACING_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const [w, s, e, n] = BALI_BOUNDS;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "id",
    viewbox: `${w},${n},${e},${s}`,
    bounded: "1",
    "accept-language": "id",
  });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (!json[0]) return null;
    const lat = Number(json[0].lat);
    const lng = Number(json[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Tries the most specific query first, then looser ones. Results are limited to the Bali area. */
export function geocode(name: string, area?: string | null): Promise<{ lat: number; lng: number } | null> {
  const clean = name.trim();
  if (!clean) return Promise.resolve(null);
  const attempts = [area ? `${clean}, ${area}` : null, clean].filter((q): q is string => !!q);
  const job = queue.then(async () => {
    for (const q of attempts) {
      const hit = await nominatimOnce(q);
      if (hit) return hit;
    }
    return null;
  });
  queue = job.catch(() => null);
  return job;
}

/** Best-effort: find coordinates for an itinerary item and save them. Silent if nothing is found. */
export async function fillItineraryCoords(itemId: string, query: string): Promise<boolean> {
  const hit = await geocode(query);
  if (!hit) return false;
  await supabase.from("itinerary_items").update({ lat: hit.lat, lng: hit.lng }).eq("id", itemId);
  return true;
}
