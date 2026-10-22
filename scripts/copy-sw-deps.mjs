// Copies the Firebase "compat" bundles the push service worker needs into public/,
// so the service worker always uses the exact same Firebase version as the app
// (no hardcoded CDN version to keep in sync). Runs automatically before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const firebaseDir = dirname(require.resolve("firebase/package.json"));
const outDir = join(root, "public", "firebase-sw");

mkdirSync(outDir, { recursive: true });
for (const file of ["firebase-app-compat.js", "firebase-messaging-compat.js"]) {
  copyFileSync(join(firebaseDir, file), join(outDir, file));
}
console.log("✓ copied Firebase SW bundles to public/firebase-sw/");
