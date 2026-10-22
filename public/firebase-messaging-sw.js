// Firebase Cloud Messaging background handler.
//
// Service workers can't read Next.js env vars, so components/RegisterServiceWorker.tsx passes
// the (public) Firebase config in this script's URL query string — nothing to edit by hand.
// The Firebase bundles are copied from node_modules into /firebase-sw/ by
// scripts/copy-sw-deps.mjs before every dev/build, so their version always matches the app.

importScripts("/firebase-sw/firebase-app-compat.js");
importScripts("/firebase-sw/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  // Initializing messaging is enough: messages sent with a `notification` payload are shown
  // automatically by the SDK, and clicks open `webpush.fcmOptions.link`. (Calling
  // showNotification ourselves here as well is what makes every notification appear twice.)
  firebase.messaging();
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
