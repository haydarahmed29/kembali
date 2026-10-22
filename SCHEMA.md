# Kem.Bali — Firestore schema

Flat top-level collections (no nesting) so queries stay simple. `groupId: null` means
"personal" — it's how solo-trip data and a group member's own stuff stay separate from
the group's shared data.

| Collection             | Key fields                                                             | Notes |
|-------------------------|--------------------------------------------------------------------------|-------|
| `usernames/{username}`  | `uid`                                                                    | Lookup used at signup (availability check) and nowhere else. |
| `users/{uid}`            | `username`, `displayName`, `gender`, `groupId`, `role`, `departureDate`, `shareLocation`, `fcmTokens[]` | `groupId: null` = solo. |
| `groups/{groupId}`       | `code`, `name`, `ownerUid`, `memberUids[]`, `startDate`, `endDate`        | `code` is the shareable join code (`KB-XXXX`). |
| `documents/{id}`         | `ownerUid`, `groupId`, `name`, `category`, `sourceType`, `url`           | `sourceType`: `upload` (Firebase Storage) or `drive_link`. |
| `packingBags/{id}`       | `ownerUid`, `name`, `items[]`                                            | `items[]`: `{id, name, qty, in, out}`. Always personal. |
| `outfitItems/{id}`       | `ownerUid`, `category`, `name`, `qty`, `bag`, `done`                     | Seeded per-gender on first visit (see `lib/defaults.ts`). |
| `suppliesItems/{id}`     | `ownerUid`, `name`, `checked`                                            | The "Tambahan" (obat & keperluan) checklist, seeded with 22 defaults. |
| `itineraryItems/{id}`    | `groupId`, `day`, `time`, `title`, `status`, `options[]`, `createdBy`    | `status: "voting"` uses `options[]` (`{id, label, votes[], proposedBy}`); `status: "final"` uses `title` directly. |
| `accommodationOptions/{id}` | `groupId`, `title`, `priceText`, `link`, `source`, `imageUrl`, `votes[]`, `proposedBy` | `imageUrl`/title filled in by the `linkUnfurl`-adjacent Cloud Function trigger. |
| `expenses/{id}`          | `groupId`, `day`, `title`, `category`, `amount`, `paidBy`, `splitAmong[]`| Settle-up math lives client-side in `lib/settleUp.ts`. |
| `spots/{id}`             | `area`, `category`, `name`, `halal`, `ticketPrice`, `durationText`, `imageUrl` | Curated from `/admin`. Target ~30 per category per area. |
| `favorites/{uid_spotId}` | `uid`, `spotId`                                                          | Doc id is `${uid}_${spotId}` so a favorite can't be duplicated. |
| `spotSubmissions/{id}`   | `groupId`, `name`, `category`, `halal`, `referenceLinks[]`, `submittedBy`, `status` | Member-submitted places not yet in `spots`, with TikTok/IG/Maps reference links. |
| `activityLog/{id}`       | `groupId`, `actorUid`, `actorName`, `action`, `message`                 | Powers `/history`. Append-only. |
| `announcements/{id}`     | `groupId`, `authorUid`, `message`                                        | Sent from `/admin`. |

See `firestore.rules` for who can read/write what, and `firestore.indexes.json` for the
composite indexes the queries above need (Firestore will also just give you the exact
`firebase deploy` error + a direct link to create any index it's missing).
