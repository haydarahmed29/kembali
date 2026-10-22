"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { Group } from "./types";
import { useAuth } from "./AuthProvider";

export function useGroup() {
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setGroup(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "groups", profile.groupId), (snap) => {
      setGroup(snap.exists() ? (snap.data() as Group) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [profile?.groupId]);

  return { group, loading };
}

export function daysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
