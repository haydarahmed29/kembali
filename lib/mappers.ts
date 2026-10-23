// Converts Supabase (Postgres, snake_case) rows into the camelCase objects in lib/types.ts.
// Keeps every page component working with the same shapes it always did; only these functions
// (and the insert/update payloads next to each call site) know about the snake_case columns.

import type {
  AccommodationOption,
  ActivityLogEntry,
  Announcement,
  Document,
  Expense,
  Favorite,
  Group,
  ItineraryItem,
  OutfitItem,
  PackingBag,
  Spot,
  SpotSubmission,
  SuppliesItem,
  UserProfile,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function rowToProfile(r: Row): UserProfile {
  return {
    uid: r.id,
    username: r.username,
    displayName: r.display_name,
    gender: r.gender,
    groupId: r.group_id,
    role: r.role,
    departureDate: r.departure_date,
    shareLocation: r.share_location,
    lastLocation: r.last_location ?? null,
    seeded: r.seeded ?? {},
    createdAt: r.created_at,
  };
}

export function rowToGroup(r: Row): Group {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    ownerUid: r.owner_uid,
    memberUids: r.member_uids ?? [],
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
  };
}

export function rowToDocument(r: Row): Document {
  return {
    id: r.id,
    ownerUid: r.owner_uid,
    groupId: r.group_id,
    name: r.name,
    category: r.category,
    sourceType: r.source_type,
    url: r.url,
    storagePath: r.storage_path,
    createdAt: r.created_at,
  };
}

export function rowToPackingBag(r: Row): PackingBag {
  return { id: r.id, ownerUid: r.owner_uid, groupId: r.group_id, name: r.name, items: r.items ?? [] };
}

export function rowToOutfitItem(r: Row): OutfitItem {
  return { id: r.id, ownerUid: r.owner_uid, category: r.category, name: r.name, qty: r.qty, bag: r.bag, done: r.done };
}

export function rowToSuppliesItem(r: Row): SuppliesItem {
  return { id: r.id, ownerUid: r.owner_uid, name: r.name, checked: r.checked };
}

export function rowToItineraryItem(r: Row): ItineraryItem {
  return {
    id: r.id,
    groupId: r.group_id,
    day: r.day,
    time: r.time,
    title: r.title,
    location: r.location,
    status: r.status,
    options: r.options ?? [],
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export function rowToAccommodationOption(r: Row): AccommodationOption {
  return {
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    priceText: r.price_text,
    link: r.link,
    source: r.source,
    imageUrl: r.image_url,
    votes: r.votes ?? [],
    chosen: r.chosen,
    nights: r.nights ?? null,
    address: r.address ?? null,
    proposedBy: r.proposed_by,
    createdAt: r.created_at,
  };
}

export function rowToExpense(r: Row): Expense {
  return {
    id: r.id,
    groupId: r.group_id,
    day: r.day,
    title: r.title,
    category: r.category,
    amount: Number(r.amount),
    paidBy: r.paid_by,
    splitAmong: r.split_among ?? [],
    createdAt: r.created_at,
  };
}

export function rowToSpot(r: Row): Spot {
  return {
    id: r.id,
    area: r.area,
    category: r.category,
    name: r.name,
    description: r.description ?? "",
    ticketPrice: r.ticket_price,
    durationText: r.duration_text,
    favoriteCount: r.favorite_count ?? 0,
    imageUrl: r.image_url,
    mapsUrl: r.maps_url,
    createdBy: r.created_by,
  };
}

export function rowToFavorite(r: Row): Favorite {
  return { uid: r.uid, spotId: r.spot_id };
}

export function rowToSpotSubmission(r: Row): SpotSubmission {
  return {
    id: r.id,
    groupId: r.group_id,
    name: r.name,
    category: r.category,
    referenceLinks: r.reference_links ?? [],
    submittedBy: r.submitted_by,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function rowToActivityLogEntry(r: Row): ActivityLogEntry {
  return {
    id: r.id,
    groupId: r.group_id,
    actorUid: r.actor_uid,
    actorName: r.actor_name,
    action: r.action,
    message: r.message,
    createdAt: r.created_at,
  };
}

export function rowToAnnouncement(r: Row): Announcement {
  return { id: r.id, groupId: r.group_id, authorUid: r.author_uid, message: r.message, createdAt: r.created_at };
}
