"use client";

import { useEffect, useRef } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthProvider";

const MIN_INTERVAL_MS = 60_000; // write at most once a minute — enough to find each other, easy on battery/quota

/**
 * While the user has "Bagikan lokasi" switched on and the app is open, keep their
 * position on their user doc so groupmates can see it on Home. Browsers don't allow
 * background location for web apps, so this only updates while the app is open.
 */
export function useLocationSharing() {
  const { user, profile } = useAuth();
  const lastWrite = useRef(0);
  const sharing = !!profile?.shareLocation;
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !sharing || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastWrite.current < MIN_INTERVAL_MS) return;
        lastWrite.current = now;
        updateDoc(doc(db, "users", uid), {
          lastLocation: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            updatedAt: serverTimestamp(),
          },
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [uid, sharing]);
}
