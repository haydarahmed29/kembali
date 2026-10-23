"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Live location for one group trip over a private Supabase Realtime **Presence** channel
 * ("trip-live:<groupId>", members-only via RLS on realtime.messages — see supabase/map_live.sql).
 *
 * Why Presence (not Broadcast): each person's position *is* their presence state, so it's
 * removed automatically when they switch sharing off, close the app or lose connection — no
 * table, no stale rows, no cleanup job. A 4–5 person group sending at most one update per 10 s
 * stays far below the free plan's 20 presence msgs/s and 2M messages/month.
 *
 * Nothing is stored in the database. Sharing always starts OFF and only runs while the page
 * using this hook is open and visible (browsers don't give web apps background location).
 */

export interface LivePerson {
  uid: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: number; // metres
  at: number; // ms epoch of the GPS fix
}

const MIN_INTERVAL_MS = 10_000; // never send more often than this…
const MIN_MOVE_M = 25; // …and only when moved this far,
const HEARTBEAT_MS = 60_000; // or as a keep-alive when standing still

export function useLiveLocations(groupId: string | undefined, me: { uid: string; name: string } | null) {
  const [sharing, setSharing] = useState(false);
  const [others, setOthers] = useState<LivePerson[]>([]);
  const [mine, setMine] = useState<LivePerson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef<LivePerson | null>(null);
  const latest = useRef<LivePerson | null>(null);
  const uid = me?.uid;
  const name = me?.name ?? "Seseorang";

  // Join the trip channel as soon as the page opens, so you can SEE others even with sharing off.
  useEffect(() => {
    if (!groupId || !uid) return;
    const ch = supabase.channel(`trip-live:${groupId}`, { config: { private: true, presence: { key: uid } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<LivePerson>();
      const list: LivePerson[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === uid) continue;
        const newest = metas.reduce<LivePerson | null>((best, m) => (!best || m.at > best.at ? m : best), null);
        if (newest && Number.isFinite(newest.lat) && Number.isFinite(newest.lng)) {
          list.push({ uid: key, name: newest.name, lat: newest.lat, lng: newest.lng, accuracy: newest.accuracy, at: newest.at });
        }
      }
      setOthers(list);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        setError(null);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnected(false);
        setError("Live location belum nyambung. Cek internet — kalau tetap gagal, pastikan file SQL peta sudah dijalankan di Supabase.");
      } else if (status === "CLOSED") {
        setConnected(false);
      }
    });
    channelRef.current = ch;
    return () => {
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      channelRef.current = null;
      setOthers([]);
      setConnected(false);
    };
  }, [groupId, uid]);

  // While sharing is ON: watch GPS, send throttled updates; stop when hidden or switched off.
  useEffect(() => {
    if (!sharing || !uid) return;
    let watchId: number | null = null;

    const send = (force: boolean) => {
      const ch = channelRef.current;
      const pos = latest.current;
      if (!ch || !connected || !pos) return;
      const prev = lastSent.current;
      const now = Date.now();
      if (!force && prev) {
        const elapsed = now - prev.at;
        const moved = distanceM(prev, pos);
        if (elapsed < MIN_INTERVAL_MS) return;
        if (moved < MIN_MOVE_M && elapsed < HEARTBEAT_MS) return;
      }
      const payload = { ...pos, at: now };
      lastSent.current = payload;
      ch.track(payload).catch(() => {});
    };

    const onPosition = (p: GeolocationPosition) => {
      const pos: LivePerson = {
        uid,
        name,
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: Math.round(p.coords.accuracy),
        at: Date.now(),
      };
      latest.current = pos;
      setMine(pos);
      setError(null);
      send(!lastSent.current);
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setError("Izin lokasi ditolak. Buka pengaturan browser → Izin situs → Lokasi → izinkan untuk Kem.Bali, lalu nyalakan lagi.");
        setSharing(false);
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setError("Sinyal GPS belum dapet. Pastikan GPS/Lokasi HP nyala dan coba ke tempat yang lebih terbuka.");
      } else {
        setError("GPS lama banget ngasih posisi — masih dicoba terus...");
      }
    };

    const startWatch = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
    };
    const stopWatch = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // phone locked / app in background: stop GPS and disappear for others (saves battery)
        stopWatch();
        channelRef.current?.untrack().catch(() => {});
        lastSent.current = null;
      } else {
        startWatch();
      }
    };

    startWatch();
    send(true); // resend the last known fix right away if we just (re)connected
    const heartbeat = setInterval(() => send(true), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatch();
      channelRef.current?.untrack().catch(() => {});
      lastSent.current = null;
      latest.current = null;
      setMine(null);
    };
  }, [sharing, connected, uid, name]);

  /** Turn sharing on/off. Checks support and an already-denied permission up front, with a clear message. */
  const toggle = useCallback(async (next: boolean) => {
    if (!next) {
      setSharing(false);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("HP/browser ini nggak support lokasi, jadi nggak bisa bagikan posisi.");
      return;
    }
    try {
      const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (status?.state === "denied") {
        setError("Izin lokasi buat Kem.Bali lagi diblokir. Buka pengaturan browser → Izin situs → Lokasi → izinkan, lalu coba lagi.");
        return;
      }
    } catch {
      // Permissions API missing (older iOS) — the watchPosition error handler covers it
    }
    setError(null);
    setSharing(true);
  }, []);

  return { sharing, toggle, others, mine, error, connected };
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
