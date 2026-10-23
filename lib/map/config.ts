/**
 * Everything the map needs to know about *where tiles come from* lives here, so switching to an
 * offline source later is a one-file change:
 *   - Option A: cache tiles.openfreemap.org responses for BALI_BOUNDS in a Service Worker
 *     (Cache Storage / IndexedDB) and keep MAP_STYLE_URL as is.
 *   - Option B: extract Bali to a .pmtiles file (Supabase Storage, free tier), register the
 *     `pmtiles` protocol with maplibre, and point MAP_STYLE_URL at a style that uses it.
 * Nothing else in the app references tile URLs directly.
 */

/** OpenFreeMap "Liberty" — free, no API key, no billing. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const BALI_CENTER: [number, number] = [115.092, -8.3405]; // [lng, lat]
export const BALI_ZOOM = 10;

/** [west, south, east, north] — Bali plus Nusa Penida/Lembongan; the area to pre-cache for offline later. */
export const BALI_BOUNDS: [number, number, number, number] = [114.4, -8.95, 115.75, -8.05];

/** Colour per itinerary day for markers and route lines (cycles after 6 days). */
export const DAY_COLORS = ["#1E3A2A", "#E8720C", "#1A73E8", "#C13584", "#0F9D58", "#8E44AD"];

export function dayColor(day: number): string {
  return DAY_COLORS[(Math.max(1, day) - 1) % DAY_COLORS.length];
}

/** Stable colour per person for live-location markers. */
const PERSON_COLORS = ["#E8720C", "#1A73E8", "#C13584", "#0F9D58", "#8E44AD", "#D93025", "#00897B", "#5D4037"];
export function personColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}
