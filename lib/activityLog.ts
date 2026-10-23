import { supabase } from "./supabase";
import type { ActivityLogEntry } from "./types";

export async function logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) {
  await supabase.from("activity_log").insert({
    group_id: entry.groupId,
    actor_uid: entry.actorUid,
    actor_name: entry.actorName,
    action: entry.action,
    message: entry.message,
  });
}
