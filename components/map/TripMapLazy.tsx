"use client";

import dynamic from "next/dynamic";

/**
 * maplibre-gl touches `window`/WebGL on import, so it must never be prerendered — and loading it
 * lazily keeps its ~800 KB out of every other page's bundle.
 */
const TripMapLazy = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-kb-card animate-pulse" />,
});

export default TripMapLazy;
export type { MapPlace, MapPerson, MapFocus } from "./TripMap";
