"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db } from "./firebase";
import { serviceWorkerUrl } from "@/components/RegisterServiceWorker";

export type PushResult = "granted" | "denied" | "unsupported" | "error";

/**
 * Ask for notification permission and register this device for push (FCM).
 * Call this from a button the user taps — browsers require a user gesture before the
 * permission prompt, and on iPhone the app must already be installed via
 * "Add to Home Screen" (iOS 16.4+) or push isn't available at all.
 */
export async function enablePushNotifications(uid: string): Promise<PushResult> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  if (!(await isSupported().catch(() => false))) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const registration =
      (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register(serviceWorkerUrl(), { scope: "/" }));
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return "error";
    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
    return "granted";
  } catch (err) {
    console.error("Push registration failed", err);
    return "error";
  }
}
