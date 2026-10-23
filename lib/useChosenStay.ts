"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { rowToAccommodationOption } from "./mappers";
import type { AccommodationOption } from "./types";

/**
 * The accommodation(s) the group has settled on (owner can mark more than one "chosen" —
 * multi-stay trips split across hotels). Explore uses the address of the first one as the
 * "from here" origin for its maps links; the rest show up on /akomodasi as separate stays.
 */
export function useChosenStay(groupId: string | undefined) {
  const [stays, setStays] = useState<AccommodationOption[]>([]);

  useEffect(() => {
    if (!groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setStays([]);
      return;
    }
    let active = true;
    const load = () =>
      supabase
        .from("accommodation_options")
        .select("*")
        .eq("group_id", groupId)
        .eq("chosen", true)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (active && data) setStays(data.map(rowToAccommodationOption));
        });
    load();

    const channel = supabase
      .channel(`chosen-stay-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_options", filter: `group_id=eq.${groupId}` }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return { stays, originAddress: stays[0]?.address ?? null };
}
