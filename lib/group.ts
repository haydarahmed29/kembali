import { supabase } from "./supabase";
import { rowToGroup } from "./mappers";
import type { Group } from "./types";

export function normalizeCode(code: string): string {
  const raw = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("KB") ? raw.slice(2) : raw;
  return `KB-${body}`;
}

export async function createGroup(_ownerUid: string, name: string) {
  const { data, error } = await supabase.rpc("create_group", { p_name: name });
  if (error || !data) throw new Error(error?.message ?? "Gagal bikin group.");
  const group = rowToGroup(data);
  return { groupId: group.id, code: group.code };
}

export async function joinGroupByCode(_uid: string, displayName: string, code: string) {
  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_code: normalizeCode(code),
    p_display_name: displayName,
  });
  if (error || !data) throw new Error(error?.message ?? "Kode group nggak ketemu. Cek lagi ya.");
  const group = rowToGroup(data);
  return { groupId: group.id };
}

/**
 * Leave the group. Personal data (docs, packing, personal budget/itinerary) isn't tied to the
 * group, so it stays on the user's profile. If the owner leaves, ownership passes to the next
 * member so the group (and its admin dashboard) doesn't end up orphaned.
 *
 * Takes the same arguments as before the Supabase migration (uid, displayName, group) only so
 * every existing call site stays unchanged — the server-side leave_group() RPC derives all of
 * it itself from the signed-in session, so none of the three are actually used here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function leaveGroup(_uid: string, _displayName: string, _group: Group) {
  const { error } = await supabase.rpc("leave_group");
  if (error) throw new Error(error.message);
}

export function isOwner(group: Group | null | undefined, uid: string | undefined): boolean {
  return !!group && !!uid && group.ownerUid === uid;
}
