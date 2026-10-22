"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "./types";

export function useGroupMembers(memberUids: string[] | undefined) {
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!memberUids || memberUids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setMembers([]);
      return;
    }
    let cancelled = false;
    Promise.all(memberUids.map((uid) => getDoc(doc(db, "users", uid)))).then((snaps) => {
      if (cancelled) return;
      setMembers(snaps.filter((s) => s.exists()).map((s) => s.data() as UserProfile));
    });
    return () => {
      cancelled = true;
    };
  }, [memberUids?.join(",")]);

  return members;
}

export function nameFor(members: UserProfile[], uid: string): string {
  return members.find((m) => m.uid === uid)?.displayName ?? uid.slice(0, 6);
}
