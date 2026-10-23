"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { qiblaBearing } from "@/lib/qibla";

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

const PRAYER_LABELS: [keyof PrayerTimes, string][] = [
  ["Fajr", "Subuh"],
  ["Dhuhr", "Dzuhur"],
  ["Asr", "Ashar"],
  ["Maghrib", "Maghrib"],
  ["Isha", "Isya"],
];

// Fallback when location is denied/unavailable — the group is in Bali anyway.
const DENPASAR = { lat: -8.6705, lng: 115.2126 };

type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number };

export default function KiblatPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number; approx: boolean } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassMsg, setCompassMsg] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [prayerError, setPrayerError] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const gotReading = useRef(false);

  // 1) Location (falls back to Denpasar)
  useEffect(() => {
    const applyFallback = (msg: string) => {
      setLocError(msg);
      setCoords({ ...DENPASAR, approx: true });
    };
    if (!("geolocation" in navigator)) {
      applyFallback("HP kamu nggak support lokasi — arah kiblat & jadwal sholat pakai Denpasar.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, approx: false }),
      () => applyFallback("Izin lokasi ditolak — arah kiblat & jadwal sholat pakai Denpasar."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, []);

  // 2) Prayer times for wherever we ended up (Aladhan, method 20 = Kemenag RI)
  useEffect(() => {
    if (!coords) return;
    const controller = new AbortController();
    fetch(`https://api.aladhan.com/v1/timings?latitude=${coords.lat}&longitude=${coords.lng}&method=20`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        const t = json?.data?.timings;
        if (t) setPrayerTimes(t);
        else setPrayerError(true);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setPrayerError(true);
      });
    return () => controller.abort();
  }, [coords]);

  // stop listening to the compass when leaving the page
  useEffect(() => () => cleanupRef.current?.(), []);

  async function enableCompass() {
    setCompassMsg(null);
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!DOE) {
      setCompassMsg("HP ini nggak punya sensor kompas — pakai angka derajat di atas ya.");
      return;
    }
    if (typeof DOE.requestPermission === "function") {
      // iOS: must be asked from a tap
      try {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setCompassMsg("Izin sensor ditolak. Buka ulang halaman ini buat coba lagi.");
          return;
        }
      } catch {
        setCompassMsg("Nggak bisa akses sensor kompas.");
        return;
      }
    }

    // iOS gives a true compass heading via webkitCompassHeading on `deviceorientation`.
    // Android only gives a north-referenced alpha on `deviceorientationabsolute`; plain
    // `deviceorientation` alpha there is relative to how the phone started, which points wrong.
    const useAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = useAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    const handler = (e: Event) => {
      const evt = e as OrientationEvt;
      let h: number | null = null;
      if (typeof evt.webkitCompassHeading === "number") h = evt.webkitCompassHeading;
      else if (evt.alpha != null && (useAbsolute || evt.absolute)) h = (360 - evt.alpha) % 360;
      if (h != null) {
        gotReading.current = true;
        setHeading(h);
      }
    };
    window.addEventListener(eventName, handler, true);
    cleanupRef.current?.();
    cleanupRef.current = () => window.removeEventListener(eventName, handler, true);
    setTimeout(() => {
      if (!gotReading.current) setCompassMsg("Sensor kompas nggak kebaca di HP ini — pakai angka derajat dari utara aja.");
    }, 2500);
  }

  const bearing = coords ? qiblaBearing(coords.lat, coords.lng) : null;
  // the dial (N/S/E/W ring) rotates to the phone's true heading; a mark on the dial sits at the
  // Kaaba's bearing from north, and a fixed arrow always points straight up — when the dial's
  // mark lines up with that fixed arrow, the phone is facing the Kaaba.
  const dialRotation = heading != null ? -heading : 0;
  const qiblaOffset = bearing != null ? bearing - (heading ?? 0) : 0;
  const aligned = heading != null && bearing != null && Math.abs(((qiblaOffset % 360) + 540) % 360 - 180) < 5;

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Link href="/explore" aria-label="Kembali" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
          ←
        </Link>
        <div className="font-bold text-xl">Muslim Friendly</div>
      </div>

      <div className="bg-kb-green text-white rounded-[28px] p-5.5 flex flex-col items-center gap-3">
        <div className="text-xs font-semibold text-kb-lime">Kompas Kiblat</div>
        <div className={`w-[220px] h-[220px] rounded-full relative flex items-center justify-center transition-colors ${aligned ? "bg-[#3C6250]" : "bg-kb-green-light"}`}>
          <div className="absolute inset-2.5 rounded-full border border-[#3C6250]" />

          {/* rotating dial: true U/S/B/T ring, plus a mark at the Kaaba's bearing from north */}
          <div className="absolute inset-0 transition-transform duration-200" style={{ transform: `rotate(${dialRotation}deg)` }}>
            <span className="absolute left-1/2 top-3.5 -translate-x-1/2 text-xs font-extrabold text-[#C9D6C4]">U</span>
            <span className="absolute left-1/2 bottom-3.5 -translate-x-1/2 text-xs font-extrabold text-[#C9D6C4]">S</span>
            <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-extrabold text-[#C9D6C4]">B</span>
            <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-extrabold text-[#C9D6C4]">T</span>
            {bearing != null && (
              <div
                className="absolute left-1/2 bottom-1/2 w-1.5 h-[90px] bg-kb-lime rounded-full origin-bottom"
                style={{ transform: `translateX(-50%) rotate(${bearing}deg)` }}
              />
            )}
          </div>

          {/* fixed reference arrow — always points up; lines up with the dial's mark when facing the Kaaba */}
          {heading != null && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 text-kb-lime text-sm z-20" aria-hidden>
              ▲
            </div>
          )}

          <div className="w-[46px] h-[46px] rounded-full bg-kb-lime text-kb-green flex items-center justify-center text-lg z-10">🕋</div>
        </div>
        <div className="text-[22px] font-extrabold">{bearing != null ? `${Math.round(bearing)}°` : "..."} dari Utara</div>
        <div className="text-[11px] text-[#C9D6C4] text-center">
          {heading != null
            ? aligned
              ? "✓ Udah menghadap kiblat"
              : "Putar badan sampai jarumnya lurus ke atas"
            : "Tanpa kompas: jarum nunjukin arah dari utara (atas = utara)"}
        </div>
        {heading == null && (
          <button type="button" onClick={enableCompass} className="h-10 px-4 rounded-full bg-kb-lime text-kb-ink font-bold text-xs">
            Aktifkan kompas HP
          </button>
        )}
        {compassMsg && <p className="m-0 text-[11px] text-[#C9D6C4] text-center">{compassMsg}</p>}
        {locError && <p className="m-0 text-[11px] text-[#C9D6C4] text-center">{locError}</p>}
      </div>

      <div className="text-[16px] font-bold">Jadwal Sholat {coords?.approx ? "(Denpasar)" : "hari ini"}</div>
      <div className="bg-white rounded-[22px] px-4">
        {prayerTimes ? (
          PRAYER_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#E3E8DA] last:border-0 text-sm">
              <span className="font-semibold">{label}</span>
              <span className="font-bold">{prayerTimes[key]?.slice(0, 5)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-kb-muted py-3">{prayerError ? "Jadwal sholat gagal dimuat — cek koneksi internet." : "Memuat jadwal sholat..."}</p>
        )}
      </div>

      {coords && (
        <a
          href={`https://www.google.com/maps/search/masjid/@${coords.lat},${coords.lng},15z`}
          target="_blank"
          rel="noreferrer"
          className="bg-white rounded-[22px] p-3.5 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-2xl bg-kb-bg flex items-center justify-center shrink-0">🕌</div>
          <div className="flex-1">
            <div className="text-[15px] font-bold">Masjid & mushola terdekat</div>
            <div className="text-xs text-kb-muted">Buka di Google Maps</div>
          </div>
          <span className="text-kb-green font-bold">↗</span>
        </a>
      )}

      <Link href="/explore" className="text-xs font-bold text-kb-green px-1">
        Cari tempat makan halal di Explore →
      </Link>

      <p className="text-[11px] text-kb-muted px-1">
        Arah kiblat dihitung dari lokasi kamu ke Ka&apos;bah. Jadwal sholat dari{" "}
        <a href="https://aladhan.com/" target="_blank" rel="noreferrer" className="underline">
          Aladhan API
        </a>{" "}
        (metode Kemenag RI).
      </p>
    </div>
  );
}
