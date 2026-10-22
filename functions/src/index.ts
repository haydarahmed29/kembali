import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as cheerio from "cheerio";

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ---------------------------------------------------------------------------
// linkUnfurl: given a URL (Agoda / Traveloka / Airbnb / Google Maps / TikTok / IG),
// fetches the page server-side (the client can't — CORS) and scrapes its Open Graph
// tags for a title + image, so the app can show a real preview card.
// Call from the client with: httpsCallable(functions, "linkUnfurl")({ url })
// ---------------------------------------------------------------------------
export const linkUnfurl = onCall({ cors: true }, async (request) => {
  const url = request.data?.url as string | undefined;
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new HttpsError("invalid-argument", "Kasih URL yang valid ya.");
  }

  try {
    const res = await fetch(url, {
      headers: {
        // Many booking sites only return full OG tags to something that looks like a browser.
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
      redirect: "follow",
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").first().text() ||
      null;

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;

    return { title, image, description };
  } catch (err) {
    throw new HttpsError("internal", `Gagal ambil preview: ${(err as Error).message}`);
  }
});

// ---------------------------------------------------------------------------
// Push notifications — only for the two events the user asked to be pinged about:
// a new accommodation option to vote on, and a new itinerary slot opened for voting.
// Everything else (documents, packing, budget, announcements) stays in-app only
// (the /history page + the Firestore listeners already update those live).
// ---------------------------------------------------------------------------

async function sendPushToGroup(groupId: string, excludeUid: string, title: string, body: string, url: string) {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  const memberUids: string[] = groupSnap.data()?.memberUids ?? [];
  const recipients = memberUids.filter((uid) => uid !== excludeUid);
  if (recipients.length === 0) return;

  const userSnaps = await db.getAll(...recipients.map((uid) => db.doc(`users/${uid}`)));
  const tokens = userSnaps.flatMap((snap) => (snap.data()?.fcmTokens as string[] | undefined) ?? []);
  if (tokens.length === 0) return;

  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { fcmOptions: { link: url } },
    data: { url },
  });
}

export const onAccommodationOptionCreate = onDocumentCreated("accommodationOptions/{optionId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  // Fill in the photo/title from the link, if the client hasn't already.
  if (!data.imageUrl && data.link) {
    try {
      const res = await fetch(data.link, {
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      });
      const $ = cheerio.load(await res.text());
      const image = $('meta[property="og:image"]').attr("content") ?? null;
      if (image) await event.data?.ref.update({ imageUrl: image });
    } catch {
      // best-effort — the card just shows the source badge without a photo
    }
  }

  await sendPushToGroup(
    data.groupId,
    data.proposedBy,
    "Opsi villa baru 🏠",
    `${data.title} ditambahin, yuk vote!`,
    "/akomodasi"
  );
});

export const onItineraryVotingCreate = onDocumentCreated("itineraryItems/{itemId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.status !== "voting" || !data.groupId) return;

  const proposedBy = data.options?.[0]?.proposedBy ?? data.createdBy;
  await sendPushToGroup(
    data.groupId,
    proposedBy,
    "Ada yang perlu divoting 🗳️",
    `Hari ${data.day} jam ${data.time}: "${data.title}"`,
    "/itinerary"
  );
});
