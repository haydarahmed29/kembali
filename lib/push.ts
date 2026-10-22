"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db } from "./firebase";

/**
 * Ask for notification permission and register this device for push (FCM).
 * Call this from a button the user taps (e.g. in onboarding or Profile) — browsers
 * require a user gesture before the permission prompt, and iOS additionally requires
 * the PWA to already be installed via "Add to Home Screen" before this will work at all.
 */
export async function enablePushNotifications(uid: string): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
  }
  return "granted";
}
