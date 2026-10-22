import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { ActivityLogEntry } from "./types";

export async function logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) {
  await addDoc(collection(db, "activityLog"), { ...entry, createdAt: serverTimestamp() });
}
