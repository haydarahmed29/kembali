"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BALI_CENTER, BALI_ZOOM, MAP_STYLE_URL } from "@/lib/map/config";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Short text inside the pin, e.g. the order number "1", "2"… */
  label?: string;
  color?: string;
  /** Places sharing a routeGroup are joined by a line, in array order (e.g. one group per day). */
  routeGroup?: string;
  subtitle?: string; // "Hari 1 · 09:00"
  note?: string;
  href?: string; // "Rute ↗" link in the popup
}

export interface MapPerson {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  updatedAt: number; // ms epoch
  isMe?: boolean;
}

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  /** Change this to fly again to the same spot. */
  key: number;
}

interface Props {
  places?: MapPlace[];
  people?: MapPerson[];
  showRoute?: boolean;
  focus?: MapFocus | null;
  /** Pin-picking mode: shows a draggable pin, tapping the map moves it. */
  pick?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  /** Re-fit the view to all places whenever this string changes. */
  fitKey?: string;
  className?: string;
}

const ROUTE_SOURCE = "kb-route";

export default function TripMap({ places = [], people = [], showRoute = true, focus, pick, onPick, fitKey, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const placeMarkers = useRef<maplibregl.Marker[]>([]);
  const personMarkers = useRef(new Map<string, maplibregl.Marker>());
  const pickMarker = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // create the map once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: BALI_CENTER,
      zoom: BALI_ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showAccuracyCircle: false }),
      "top-right"
    );
    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "kb-route-line",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-opacity": 0.85, "line-dasharray": [2, 1.5] },
      });
      map.resize(); // the container may have changed size while the style was loading
      setLoaded(true);
    });
    map.on("error", () => {
      if (!map.isStyleLoaded()) setFailed(true);
    });
    map.on("click", (e) => onPickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;
    const people = personMarkers.current;
    return () => {
      people.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // destination pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    placeMarkers.current.forEach((m) => m.remove());
    placeMarkers.current = places.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", p.name);
      el.className =
        "min-w-8 h-8 px-1.5 rounded-full border-2 border-white text-white text-[12px] font-extrabold flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]";
      el.style.background = p.color ?? "#1E3A2A";
      el.textContent = p.label ?? "•";
      return new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: "240px" }).setDOMContent(placePopup(p)))
        .addTo(map);
    });
  }, [places]);

  // route lines between destinations, per routeGroup, in the given order
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const groups = new Map<string, MapPlace[]>();
    if (showRoute) {
      for (const p of places) {
        if (!p.routeGroup) continue;
        if (!groups.has(p.routeGroup)) groups.set(p.routeGroup, []);
        groups.get(p.routeGroup)!.push(p);
      }
    }
    source.setData({
      type: "FeatureCollection",
      features: [...groups.values()]
        .filter((g) => g.length > 1)
        .map((g) => ({
          type: "Feature" as const,
          properties: { color: g[0].color ?? "#1E3A2A" },
          geometry: { type: "LineString" as const, coordinates: g.map((p) => [p.lng, p.lat]) },
        })),
    });
  }, [places, showRoute, loaded]);

  // fit the view to all destinations when the set changes (not on every live-location update);
  // waits for the style to load, otherwise the first fit is computed against a not-yet-sized map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || places.length === 0) return;
    if (places.length === 1) {
      map.easeTo({ center: [places[0].lng, places[0].lat], zoom: 14 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    places.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 80 }, maxZoom: 14 }); // right: clear of the zoom buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when fitKey changes (or once the map is ready)
  }, [fitKey, loaded]);

  // live people: move existing markers instead of recreating them, so updates are smooth
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const p of people) {
      seen.add(p.id);
      const existing = personMarkers.current.get(p.id);
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
        existing.getPopup()?.setDOMContent(personPopup(p));
        continue;
      }
      const el = document.createElement("div");
      el.className = `w-9 h-9 rounded-full border-[3px] text-white text-[13px] font-extrabold flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.35)] ${p.isMe ? "border-kb-lime" : "border-white"}`;
      el.style.background = p.color;
      el.textContent = (p.name[0] ?? "?").toUpperCase();
      el.setAttribute("aria-label", p.name);
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setDOMContent(personPopup(p)))
        .addTo(map);
      personMarkers.current.set(p.id, marker);
    }
    for (const [id, marker] of personMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        personMarkers.current.delete(id);
      }
    }
  }, [people]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly only when the caller bumps focus.key
  }, [focus?.key, loaded]);

  // pin-picking marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pick) {
      pickMarker.current?.remove();
      pickMarker.current = null;
      return;
    }
    if (!pickMarker.current) {
      pickMarker.current = new maplibregl.Marker({ color: "#D93025", draggable: true })
        .setLngLat([pick.lng, pick.lat])
        .addTo(map);
      pickMarker.current.on("dragend", () => {
        const ll = pickMarker.current?.getLngLat();
        if (ll) onPickRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      map.easeTo({ center: [pick.lng, pick.lat], zoom: Math.max(map.getZoom(), 14) });
    } else {
      pickMarker.current.setLngLat([pick.lng, pick.lat]);
    }
  }, [pick]);

  return (
    <div className={`relative kb-map ${className ?? ""}`}>
      {/* explicit w/h: maplibre-gl.css sets `.maplibregl-map { position: relative }`, which cancels `inset-0` */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-kb-card/90 p-6 text-center text-sm text-kb-muted">
          Peta gagal dimuat. Cek koneksi internet, lalu buka ulang halaman ini.
        </div>
      )}
    </div>
  );
}

// Popups are built with DOM APIs (textContent), never innerHTML: names and notes are user input.
function placePopup(p: MapPlace): HTMLElement {
  const box = document.createElement("div");
  box.className = "flex flex-col gap-0.5 pr-3";
  const title = document.createElement("div");
  title.className = "text-sm font-bold text-kb-ink";
  title.textContent = p.name;
  box.append(title);
  if (p.subtitle) {
    const sub = document.createElement("div");
    sub.className = "text-xs text-kb-muted";
    sub.textContent = p.subtitle;
    box.append(sub);
  }
  if (p.note) {
    const note = document.createElement("div");
    note.className = "text-xs text-[#3F4F44]";
    note.textContent = p.note;
    box.append(note);
  }
  if (p.href) {
    const a = document.createElement("a");
    a.href = p.href;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "text-xs font-bold text-kb-green mt-1";
    a.textContent = "Rute ↗";
    box.append(a);
  }
  return box;
}

function personPopup(p: MapPerson): HTMLElement {
  const box = document.createElement("div");
  box.className = "flex flex-col";
  const name = document.createElement("div");
  name.className = "text-sm font-bold text-kb-ink";
  name.textContent = p.isMe ? `${p.name} (kamu)` : p.name;
  const when = document.createElement("div");
  when.className = "text-xs text-kb-muted";
  const secs = Math.max(0, Math.round((Date.now() - p.updatedAt) / 1000));
  when.textContent = secs < 15 ? "barusan" : secs < 60 ? `${secs} dtk lalu` : `${Math.round(secs / 60)} mnt lalu`;
  box.append(name, when);
  return box;
}
