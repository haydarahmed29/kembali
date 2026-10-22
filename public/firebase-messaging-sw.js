// Firebase Cloud Messaging background handler.
// This runs when the PWA is closed/backgrounded, so it needs its own Firebase config
// (it can't read process.env — these are the same *public* client keys as lib/firebase.ts,
// hardcoded here because service workers can't read Next.js env vars at build time).
// After deploying, replace the placeholders below with your real Firebase config values.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Kem.Bali";
  const options = {
    body: payload.notification?.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
