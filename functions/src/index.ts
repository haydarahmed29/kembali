import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as cheerio from "cheerio";

// Same region as the Firestore database you pick in the console (Jakarta). Change both together.
setGlobalOptions({ region: "asia-southeast2", maxInstances: 5 });

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ---------------------------------------------------------------------------
// Link preview (Open Graph) — Agoda / Traveloka / Airbnb / Google Maps / TikTok / IG.
// Fetched server-side because the browser can't (CORS). Best-effort: some booking sites
// block bots, in which case the card just shows the source badge without a photo.
// ---------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

interface Preview {
  title: string | null;
  image: string | null;
  description: string | null;
}

function isPublicHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // don't let the function be pointed at internal addresses
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i.test(url.hostname)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return null;
    if (url.hostname === "metadata.google.internal") return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchPreview(rawUrl: string): Promise<Preview> {
  const url = isPublicHttpUrl(rawUrl);
  if (!url) throw new Error("URL tidak valid");

  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  // only read the first ~1.5 MB — OG tags are in <head>
  const html = (await res.text()).slice(0, 1_500_000);
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).attr("content")?.trim() || null;

  const title = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || $("title").first().text().trim() || null;
  const rawImage = meta('meta[property="og:image"]') || meta('meta[property="og:image:url"]') || meta('meta[name="twitter:image"]');
  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(rawImage, res.url || url.toString()).toString(); // resolve relative/protocol-relative URLs
    } catch {
      image = null;
    }
  }
  const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');
  return { title, image, description };
}

// Call from the client with: httpsCallable(functions, "linkUnfurl")({ url })
export const linkUnfurl = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Masuk dulu ya.");
  const url = request.data?.url as string | undefined;
  if (!url || !isPublicHttpUrl(url)) throw new HttpsError("invalid-argument", "Kasih URL yang valid ya.");
  try {
    return await fetchPreview(url);
  } catch (err) {
    throw new HttpsError("internal", `Gagal ambil preview: ${(err as Error).message}`);
  }
});

// ---------------------------------------------------------------------------
// Push notifications — only for the events picked for push: a vote opening and a vote closing.
// Everything else (documents, packing, budget, announcements) stays in-app only.
// ---------------------------------------------------------------------------

async function sendPushToGroup(groupId: string, excludeUid: string | null, title: string, body: string, path: string) {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  const memberUids: string[] = groupSnap.data()?.memberUids ?? [];
  const recipients = memberUids.filter((uid) => uid !== excludeUid);
  if (recipients.length === 0) return;

  const userSnaps = await db.getAll(...recipients.map((uid) => db.doc(`users/${uid}`)));
  const tokenOwners = new Map<string, string>(); // token -> uid
  for (const snap of userSnaps) {
    for (const token of (snap.data()?.fcmTokens as string[] | undefined) ?? []) tokenOwners.set(token, snap.id);
  }
  const tokens = [...tokenOwners.keys()];
  if (tokens.length === 0) return;

  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: { icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" },
      fcmOptions: { link: path },
    },
    data: { url: path },
  });

  // Drop tokens for devices that uninstalled the app / revoked permission, so the list doesn't grow forever.
  const stale = res.responses
    .map((r, i) => ({ r, token: tokens[i] }))
    .filter(({ r }) =>
      ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(r.error?.code ?? "")
    );
  await Promise.all(
    stale.map(({ token }) => db.doc(`users/${tokenOwners.get(token)}`).update({ fcmTokens: FieldValue.arrayRemove(token) }).catch(() => {}))
  );
}

// New accommodation option → fill in its photo, then ping the group to vote.
export const onAccommodationOptionCreate = onDocumentCreated("accommodationOptions/{optionId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  if (!data.imageUrl && data.link) {
    try {
      const preview = await fetchPreview(data.link);
      const patch: Record<string, string> = {};
      if (preview.image) patch.imageUrl = preview.image;
      // the user may have left the name blank ("Villa") — use the listing's real name instead
      if (preview.title && (!data.title || data.title === "Villa")) patch.title = preview.title.slice(0, 120);
      if (Object.keys(patch).length) await event.data?.ref.update(patch);
    } catch {
      // best-effort — the card just shows the source badge without a photo
    }
  }

  await sendPushToGroup(data.groupId, data.proposedBy, "Opsi villa baru 🏠", `${data.title} ditambahin, yuk vote!`, "/akomodasi");
});

// Owner settles on a place → tell everyone the accommodation vote is closed.
export const onAccommodationChosen = onDocumentUpdated("accommodationOptions/{optionId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.chosen === true || after.chosen !== true) return;
  await sendPushToGroup(after.groupId, null, "Voting villa ditutup ✅", `Fix nginep di ${after.title}`, "/akomodasi");
});

// New itinerary slot open for voting.
export const onItineraryVotingCreate = onDocumentCreated("itineraryItems/{itemId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.status !== "voting" || !data.groupId) return;
  await sendPushToGroup(data.groupId, data.createdBy, "Ada yang perlu divoting 🗳️", `Hari ${data.day} jam ${data.time}: "${data.title}"`, "/itinerary");
});

// Itinerary vote closed by the owner.
export const onItineraryVotingClosed = onDocumentUpdated("itineraryItems/{itemId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || !after.groupId || before.status !== "voting" || after.status !== "final") return;
  await sendPushToGroup(after.groupId, null, "Voting ditutup ✅", `Hari ${after.day} jam ${after.time}: ${after.title}`, "/itinerary");
});
