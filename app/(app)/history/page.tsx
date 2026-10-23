"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rowToActivityLogEntry } from "@/lib/mappers";
import { useGroup } from "@/lib/useGroup";
import type { ActivityLogEntry } from "@/lib/types";

export default function HistoryPage() {
  const { group } = useGroup();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    if (!group) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setEntries([]);
      return;
    }
    let active = true;
    supabase
      .from("activity_log")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active || !data) return;
        setEntries(data.map(rowToActivityLogEntry));
      });

    const channel = supabase
      .channel(`activity-log-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `group_id=eq.${group.id}` },
        (payload) => setEntries((prev) => [rowToActivityLogEntry(payload.new as Record<string, unknown>), ...prev])
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [group]);

  if (!group) {
    return (
      <div className="p-4">
        <p className="text-sm text-kb-muted">Riwayat cuma ada di group trip.</p>
      </div>
    );
  }

  const groups = groupByDay(entries);

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <h1 className="text-xl font-bold">Riwayat Revisi</h1>
      <p className="m-0 -mt-2 text-xs text-kb-muted">Itinerary &amp; Voting · {group.name}</p>

      {entries.length === 0 && <p className="text-sm text-kb-muted">Belum ada aktivitas.</p>}

      {groups.map(([label, dayEntries]) => (
        <div key={label} className="flex flex-col gap-2">
          <div className="text-xs font-bold text-kb-muted px-1">{label}</div>
          {dayEntries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-[18px] p-3.5 flex flex-col gap-1">
              <div className="text-[13px] leading-relaxed">
                <b>{entry.actorName}</b> {entry.message}
              </div>
              <div className="text-[11px] text-kb-muted">{formatTime(entry.createdAt)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(entries: ActivityLogEntry[]): [string, ActivityLogEntry[]][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map<string, ActivityLogEntry[]>();
  for (const entry of entries) {
    const date = entry.createdAt ? new Date(entry.createdAt) : new Date();
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
    const label = diffDays === 0 ? "Hari ini" : diffDays === 1 ? "Kemarin" : date.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(entry);
  }
  return [...map.entries()];
}
