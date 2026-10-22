"use client";

import { useEffect, useState } from "react";
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

export default function KiblatPage() {
  const [bearing, setBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous environment check, no external subscription involved
      setLocError("HP kamu nggak support lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setBearing(qiblaBearing(latitude, longitude));
        try {
          const res = await fetch(
            `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=20`
          );
          const json = await res.json();
          setPrayerTimes(json?.data?.timings ?? null);
        } catch {
          // offline or API unreachable — the Denpasar fallback below still shows
        }
      },
      () => setLocError("Izin lokasi ditolak — arah kiblat pakai estimasi Denpasar."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  async function enableCompass() {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE?.requestPermission === "function") {
      const result = await DOE.requestPermission();
      if (result !== "granted") return;
    }
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.addEventListener("deviceorientation", onOrientation as EventListener, true);
  }

  function onOrientation(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
    const h = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
    if (h != null) setHeading(h);
  }

  const needleRotation = bearing != null ? bearing - (heading ?? 0) : 295;

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
        <div className="w-[220px] h-[220px] rounded-full bg-kb-green-light relative flex items-center justify-center">
          <div className="absolute inset-2.5 rounded-full border border-[#3C6250]" />
          <span className="absolute top-3.5 text-xs font-extrabold text-[#C9D6C4]">U</span>
          <span className="absolute bottom-3.5 text-xs font-extrabold text-[#C9D6C4]">S</span>
          <span className="absolute left-3.5 text-xs font-extrabold text-[#C9D6C4]">B</span>
          <span className="absolute right-3.5 text-xs font-extrabold text-[#C9D6C4]">T</span>
          <div
            className="absolute w-1.5 h-[90px] bg-kb-lime rounded-full origin-bottom"
            style={{ transform: `rotate(${needleRotation}deg)`, bottom: "50%" }}
          />
          <div className="w-[46px] h-[46px] rounded-full bg-kb-lime text-kb-green flex items-center justify-center text-lg z-10">🕋</div>
        </div>
        <div className="text-[22px] font-extrabold">{bearing != null ? `${Math.round(bearing)}°` : "..."} dari Utara</div>
        {heading == null && (
          <button type="button" onClick={enableCompass} className="h-10 px-4 rounded-full bg-kb-lime text-kb-ink font-bold text-xs">
            Aktifkan kompas HP
          </button>
        )}
        {locError && <p className="m-0 text-[11px] text-[#C9D6C4] text-center">{locError}</p>}
      </div>

      <div className="text-[16px] font-bold">Jadwal Sholat</div>
      <div className="bg-white rounded-[22px] px-4">
        {prayerTimes ? (
          PRAYER_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#E3E8DA] last:border-0 text-sm">
              <span className="font-semibold">{label}</span>
              <span className="font-bold">{prayerTimes[key]?.slice(0, 5)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-kb-muted py-3">Aktifkan lokasi buat lihat jadwal sholat hari ini.</p>
        )}
      </div>

      <p className="text-[11px] text-kb-muted px-1">
        Arah kiblat dihitung dari lokasi kamu ke Ka&apos;bah. Jadwal sholat dari{" "}
        <a href="https://aladhan.com/" target="_blank" rel="noreferrer" className="underline">
          Aladhan API
        </a>
        .
      </p>
    </div>
  );
}
