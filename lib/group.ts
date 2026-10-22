import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./activityLog";
import type { Group } from "./types";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `KB-${code}`;
}

export function normalizeCode(code: string): string {
  const raw = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("KB") ? raw.slice(2) : raw;
  return `KB-${body}`;
}

export async function createGroup(ownerUid: string, name: string) {
  // Codes live in their own `groupCodes/{code}` collection so people who aren't members yet
  // can look a group up by code (security rules don't let non-members read/list `groups`).
  let code = randomCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await getDoc(doc(db, "groupCodes", code));
    if (!existing.exists()) break;
    code = randomCode();
  }

  const groupRef = doc(collection(db, "groups"));
  await setDoc(groupRef, {
    id: groupRef.id,
    code,
    name,
    ownerUid,
    memberUids: [ownerUid],
    startDate: null,
    endDate: null,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "groupCodes", code), { groupId: groupRef.id, ownerUid });
  await updateDoc(doc(db, "users", ownerUid), { groupId: groupRef.id, role: "owner" });
  return { groupId: groupRef.id, code };
}

export async function joinGroupByCode(uid: string, displayName: string, code: string) {
  const codeSnap = await getDoc(doc(db, "groupCodes", normalizeCode(code)));
  if (!codeSnap.exists()) {
    throw new Error("Kode group nggak ketemu. Cek lagi ya.");
  }
  const groupId = codeSnap.data().groupId as string;
  try {
    await updateDoc(doc(db, "groups", groupId), { memberUids: arrayUnion(uid) });
  } catch {
    throw new Error("Group-nya udah nggak aktif. Minta kode baru ke yang bikin trip.");
  }
  await updateDoc(doc(db, "users", uid), { groupId, role: "member" });
  await logActivity({ groupId, actorUid: uid, actorName: displayName, action: "member_joined", message: "gabung ke group" });
  return { groupId };
}

/**
 * Leave the group. Personal data (docs, packing, personal budget/itinerary) isn't tied to the
 * group, so it stays on the user's profile. If the owner leaves, ownership passes to the next
 * member so the group (and its admin dashboard) doesn't end up orphaned.
 */
export async function leaveGroup(uid: string, displayName: string, group: Group) {
  const groupRef = doc(db, "groups", group.id);
  const others = group.memberUids.filter((m) => m !== uid);

  // log first, while we're still a member and allowed to write to the group's log
  await logActivity({ groupId: group.id, actorUid: uid, actorName: displayName, action: "member_left", message: "keluar dari group" });

  if (group.ownerUid === uid) {
    if (others.length === 0) {
      await deleteDoc(groupRef);
    } else {
      await updateDoc(groupRef, { ownerUid: others[0], memberUids: others });
    }
  } else {
    await updateDoc(groupRef, { memberUids: arrayRemove(uid) });
  }
  await updateDoc(doc(db, "users", uid), { groupId: null, role: null });
}

export function isOwner(group: Group | null | undefined, uid: string | undefined): boolean {
  return !!group && !!uid && group.ownerUid === uid;
}
