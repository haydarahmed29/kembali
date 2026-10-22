"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "./types";

/** Live profiles of every group member (live so shared locations and names stay current). */
export function useGroupMembers(memberUids: string[] | undefined) {
  const [byUid, setByUid] = useState<Record<string, UserProfile>>({});
  const key = memberUids?.join(",") ?? "";

  useEffect(() => {
    const uids = key ? key.split(",") : [];
    const unsubs = uids.map((uid) =>
      onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          setByUid((prev) => {
            const next = { ...prev };
            if (snap.exists()) next[uid] = snap.data() as UserProfile;
            else delete next[uid];
            return next;
          });
        },
        () => {
          // no permission (e.g. they just left the group) — just drop them from the list
          setByUid((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  const uids = key ? key.split(",") : [];
  return uids.map((uid) => byUid[uid]).filter((m): m is UserProfile => !!m);
}

export function nameFor(members: UserProfile[], uid: string): string {
  return members.find((m) => m.uid === uid)?.displayName ?? uid.slice(0, 6);
}
