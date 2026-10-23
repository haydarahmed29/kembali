"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { rowToGroup } from "./mappers";
import type { Group } from "./types";
import { useAuth } from "./AuthProvider";

export function useGroup() {
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const groupId = profile?.groupId ?? null;

  useEffect(() => {
    if (!groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setGroup(null);
      setLoading(false);
      return;
    }
    let active = true;

    supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setGroup(data ? rowToGroup(data) : null);
        setLoading(false);
      });

    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === "DELETE") setGroup(null);
        else setGroup(rowToGroup(payload.new as Record<string, unknown>));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

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
