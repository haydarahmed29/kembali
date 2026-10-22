// Firestore data model for Kem.Bali.
// See SCHEMA.md for the collection layout this is based on.

import type { Timestamp } from "firebase/firestore";

export type Gender = "female" | "male";

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  gender: Gender;
  groupId: string | null; // null = solo trip, no group
  role: "owner" | "member" | null;
  departureDate: string | null; // ISO date, personal — used when groupId is null
  shareLocation: boolean;
  lastLocation?: { lat: number; lng: number; accuracy: number; updatedAt: Timestamp } | null; // only while shareLocation is on
  fcmTokens: string[]; // for push notifications
  seeded?: { bags?: boolean; outfit?: boolean; supplies?: boolean }; // default packing templates already created
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  code: string; // e.g. "KB-4M9A", shareable join code
  name: string;
  ownerUid: string;
  memberUids: string[];
  startDate: string | null; // ISO date
  endDate: string | null;
  createdAt: Timestamp;
}

export interface Document {
  id: string;
  ownerUid: string; // who uploaded it
  groupId: string | null; // null = personal document
  name: string;
  category: "tiket" | "penginapan" | "transport" | "lainnya";
  sourceType: "upload" | "drive_link";
  url: string; // storage download URL, or the pasted Drive link
  storagePath?: string | null; // Storage object path for uploads, so deleting the doc can delete the file
  createdAt: Timestamp;
}

export interface PackingBag {
  id: string;
  ownerUid: string;
  groupId: string | null;
  name: string; // "Koper besar", "Tas ransel", ...
  items: PackingItem[];
}

export interface PackingItem {
  id: string;
  name: string;
  qty: number;
  in: boolean; // packed before departure
  out: boolean; // packed again for the way home
}

export interface OutfitItem {
  id: string;
  ownerUid: string;
  category: string; // "Atasan", "Celana panjang", ...
  name: string;
  qty: number;
  bag: string;
  done: boolean;
}

export interface SuppliesItem {
  id: string;
  ownerUid: string;
  name: string; // powerbank, vitamin, obat, ...
  checked: boolean;
}

export interface ItineraryOption {
  id: string;
  label: string; // place name
  votes: string[]; // uids
  proposedBy: string;
}

export interface ItineraryItem {
  id: string;
  groupId: string | null;
  day: number; // 1-based
  time: string; // "10:00"
  title: string; // used when status === "final"
  location: string;
  status: "final" | "voting";
  options: ItineraryOption[]; // used when status === "voting"
  createdBy: string;
  createdAt: Timestamp;
}

export interface AccommodationOption {
  id: string;
  groupId: string;
  title: string;
  priceText: string; // "Rp 3,2 jt / 4 malam"
  link: string; // Agoda / Traveloka / Maps link
  source: "agoda" | "traveloka" | "airbnb" | "maps" | "other";
  imageUrl: string | null; // fetched by the link-unfurl Cloud Function
  votes: string[]; // uids — one vote per member across all options
  chosen?: boolean; // set by the owner when the group settles on this one
  proposedBy: string;
  createdAt: Timestamp;
}

export interface Expense {
  id: string;
  groupId: string | null; // null = personal expense
  day: number;
  title: string;
  category: "transport" | "makan" | "tiket" | "penginapan" | "belanja" | "lainnya";
  amount: number;
  paidBy: string; // uid
  splitAmong: string[]; // uids
  createdAt: Timestamp;
}

export interface SpotCategory {
  slug: string; // "pantai" | "cafe" | "seafood" | "pura" | "air_terjun" | ...
  label: string;
  emoji: string;
}

export interface Spot {
  id: string;
  area: string; // "Canggu", "Uluwatu", ...
  category: string; // SpotCategory.slug
  name: string;
  description: string;
  halal: "halal" | "umum"; // simple tag, not an official certification
  ticketPrice: string | null;
  durationText: string | null;
  favoriteCount: number;
  imageUrl: string | null;
  mapsUrl: string | null;
  createdBy: string;
}

export interface SpotSubmission {
  id: string;
  groupId: string;
  name: string;
  category: string | null;
  halal: "halal" | "non_halal" | null;
  referenceLinks: { url: string; platform: "tiktok" | "instagram" | "maps" | "other" }[];
  submittedBy: string;
  status: "pending" | "proposed_to_itinerary";
  createdAt: Timestamp;
}

export interface Favorite {
  uid: string;
  spotId: string;
}

export interface ActivityLogEntry {
  id: string;
  groupId: string;
  actorUid: string;
  actorName: string;
  action:
    | "itinerary_update"
    | "itinerary_finalize"
    | "vote_cast"
    | "accommodation_update"
    | "spot_submitted"
    | "member_joined"
    | "member_left"
    | "document_uploaded"
    | "expense_added";
  message: string; // human-readable, e.g. "mengubah jam Sunset Tanah Lot dari 15.00 → 16.00"
  createdAt: Timestamp;
}

export interface Announcement {
  id: string;
  groupId: string;
  authorUid: string;
  message: string;
  createdAt: Timestamp;
}
