import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `KB-${code}`;
}

export async function createGroup(ownerUid: string, name: string) {
  let code = randomCode();
  // make sure the code isn't already taken (very unlikely, but cheap to check)
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDocs(query(collection(db, "groups"), where("code", "==", code)));
    if (existing.empty) break;
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
  await updateDoc(doc(db, "users", ownerUid), { groupId: groupRef.id, role: "owner" });
  return { groupId: groupRef.id, code };
}

export async function joinGroupByCode(uid: string, code: string) {
  const normalized = code.trim().toUpperCase();
  const snap = await getDocs(query(collection(db, "groups"), where("code", "==", normalized)));
  if (snap.empty) {
    throw new Error("Kode group nggak ketemu. Cek lagi ya.");
  }
  const groupDoc = snap.docs[0];
  await updateDoc(groupDoc.ref, { memberUids: arrayUnion(uid) });
  await updateDoc(doc(db, "users", uid), { groupId: groupDoc.id, role: "member" });
  return { groupId: groupDoc.id };
}

export async function leaveGroup(uid: string, groupId: string) {
  const { arrayRemove } = await import("firebase/firestore");
  await updateDoc(doc(db, "groups", groupId), { memberUids: arrayRemove(uid) });
  await updateDoc(doc(db, "users", uid), { groupId: null, role: null });
}
