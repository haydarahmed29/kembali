"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { rowToProfile } from "./mappers";
import type { UserProfile } from "./types";

/** Live profiles of every group member (live so shared locations and names stay current). */
export function useGroupMembers(memberUids: string[] | undefined) {
  const [byUid, setByUid] = useState<Record<string, UserProfile>>({});
  const key = memberUids?.join(",") ?? "";

  useEffect(() => {
    const uids = key ? key.split(",") : [];
    if (uids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setByUid({});
      return;
    }

    let active = true;
    supabase
      .from("profiles")
      .select("*")
      .in("id", uids)
      .then(({ data }) => {
        if (!active || !data) return;
        setByUid((prev) => {
          const next = { ...prev };
          for (const row of data) next[row.id] = rowToProfile(row);
          return next;
        });
      });

    const channels = uids.map((uid) =>
      supabase
        .channel(`member-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, (payload) => {
          setByUid((prev) => {
            const next = { ...prev };
            if (payload.eventType === "DELETE") delete next[uid];
            else next[uid] = rowToProfile(payload.new as Record<string, unknown>);
            return next;
          });
        })
        .subscribe()
    );

    return () => {
      active = false;
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [key]);

  const uids = key ? key.split(",") : [];
  return uids.map((uid) => byUid[uid]).filter((m): m is UserProfile => !!m);
}

export function nameFor(members: UserProfile[], uid: string): string {
  return members.find((m) => m.uid === uid)?.displayName ?? uid.slice(0, 6);
}
