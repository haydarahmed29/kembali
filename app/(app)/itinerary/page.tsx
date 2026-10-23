"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rowToItineraryItem } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { isOwner } from "@/lib/group";
import { logActivity } from "@/lib/activityLog";
import { normalizeTime } from "@/lib/time";
import { promptField, promptFields } from "@/lib/promptSheet";
import type { ItineraryItem } from "@/lib/types";

export default function ItineraryPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const scopeId = group?.id ?? null;
  const owner = isOwner(group, user?.uid);
  const myName = profile?.displayName ?? "Seseorang";

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const q =
        scopeId == null
          ? supabase.from("itinerary_items").select("*").eq("created_by", user.uid).is("group_id", null).order("day").order("time")
          : supabase.from("itinerary_items").select("*").eq("group_id", scopeId).order("day").order("time");
      q.then(({ data }) => setItems(data ? data.map(rowToItineraryItem) : []));
    };
    load();

    const filter = scopeId == null ? `created_by=eq.${user.uid}` : `group_id=eq.${scopeId}`;
    const channel = supabase
      .channel(`itinerary-${scopeId == null ? user.uid : scopeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items", filter }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, scopeId]);

  async function addItem() {
    if (!user) return;
    const result = await promptFields(
      [
        { key: "title", label: group ? "Usulan tempat/kegiatan" : "Tempat/kegiatan", placeholder: "misal: Makan malam di Jimbaran" },
        { key: "day", label: "Hari ke-", defaultValue: "1", type: "number" },
        { key: "time", label: "Jam", defaultValue: "10:00", placeholder: "misal 09:30" },
      ],
      { title: group ? "Usulkan tempat/kegiatan" : "Tambah ke itinerary", confirmLabel: "Tambah" }
    );
    if (!result) return;
    const title = result.title.trim();
    const day = Math.max(1, Math.min(30, Math.round(Number(result.day)) || 1));
    const time = normalizeTime(result.time) ?? "10:00";

    // the proposer automatically votes for their own idea
    const option = { id: crypto.randomUUID(), label: title, votes: [user.uid], proposedBy: user.uid };
    await supabase.from("itinerary_items").insert({
      group_id: scopeId,
      day,
      time,
      title,
      location: "",
      status: group ? "voting" : "final",
      options: group ? [option] : [],
      created_by: user.uid,
    });

    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "itinerary_update",
        message: `menambahkan usulan "${title}" jam ${time} di Hari ${day}`,
      });
    }
  }

  async function addOption(item: ItineraryItem) {
    if (!user) return;
    const label = await promptField(`Opsi lain buat Hari ${item.day} jam ${item.time}`);
    if (!label?.trim()) return;
    await supabase.rpc("add_itinerary_option", { p_item_id: item.id, p_label: label.trim() });
    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "itinerary_update",
        message: `nambahin opsi "${label.trim()}" buat Hari ${item.day} jam ${item.time}`,
      });
    }
  }

  async function vote(item: ItineraryItem, optionId: string) {
    if (!user) return;
    const { data: label } = await supabase.rpc("cast_itinerary_vote", { p_item_id: item.id, p_option_id: optionId });
    if (group && label) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "vote_cast",
        message: `vote "${label}" buat Hari ${item.day} jam ${item.time}`,
      });
    }
  }

  async function finalize(item: ItineraryItem, optionId: string) {
    if (!user) return;
    const winner = item.options.find((o) => o.id === optionId);
    if (!winner) return;
    if (!window.confirm(`Tutup voting & pilih "${winner.label}"?`)) return;
    await supabase.rpc("finalize_itinerary", { p_item_id: item.id, p_option_id: optionId });
    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "itinerary_finalize",
        message: `nutup voting Hari ${item.day} jam ${item.time} → "${winner.label}"`,
      });
    }
  }

  async function removeItem(item: ItineraryItem) {
    if (!window.confirm(`Hapus "${item.title}" dari itinerary?`)) return;
    await supabase.from("itinerary_items").delete().eq("id", item.id);
    if (group && user) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "itinerary_update",
        message: `menghapus "${item.title}" (Hari ${item.day} jam ${item.time})`,
      });
    }
  }

  const byDay = items.reduce<Record<number, ItineraryItem[]>>((acc, item) => {
    (acc[item.day] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Itinerary</h1>
        <div className="flex gap-2">
          {group && (
            <Link href="/history" aria-label="Riwayat" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
              🕘
            </Link>
          )}
          <button type="button" onClick={addItem} className="h-11 px-3.5 rounded-full bg-kb-green text-kb-lime font-bold text-[13px]">
            {group ? "+ Usulkan" : "+ Tambah"}
          </button>
        </div>
      </div>

      {Object.keys(byDay).length === 0 && <p className="text-sm text-kb-muted">Belum ada rencana. Tambah yang pertama yuk — atau ambil dari tab Explore.</p>}

      {Object.entries(byDay)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, dayItems]) => (
          <div key={day} className="flex flex-col gap-2.5">
            <div className="text-xs font-bold text-kb-muted">Hari {day}</div>
            {dayItems.map((item) => {
              const canDelete = item.createdBy === user?.uid || owner;
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="w-11 text-[13px] font-bold pt-3.5">{item.time}</div>
                  {item.status === "final" ? (
                    <div className="flex-1 bg-white rounded-[20px] p-3.5 flex items-center gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold">{item.title}</div>
                      </div>
                      {group && <div className="text-[11px] font-bold bg-kb-lime px-2.5 py-1 rounded-[10px]">Final</div>}
                      {canDelete && (
                        <button type="button" onClick={() => removeItem(item)} aria-label={`Hapus ${item.title}`} className="text-kb-muted text-sm">
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 bg-kb-green text-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-kb-lime">
                          Voting · {new Set(item.options.flatMap((o) => o.votes)).size}/{group?.memberUids.length ?? 1} udah vote
                        </div>
                        {canDelete && (
                          <button type="button" onClick={() => removeItem(item)} aria-label="Hapus slot" className="text-[#C9D6C4] text-sm">
                            ✕
                          </button>
                        )}
                      </div>
                      {item.options.map((opt) => {
                        const voted = user ? opt.votes.includes(user.uid) : false;
                        const maxVotes = Math.max(1, ...item.options.map((o) => o.votes.length));
                        return (
                          <div key={opt.id} className={`rounded-2xl p-2.5 flex flex-col gap-1.5 ${voted ? "border-2 border-kb-lime bg-kb-green-light" : "border border-kb-green-light"}`}>
                            <button type="button" onClick={() => vote(item, opt.id)} className="flex justify-between gap-2 w-full text-sm font-bold text-left">
                              <span>{opt.label}</span>
                              <span className="shrink-0">{opt.votes.length} suara</span>
                            </button>
                            <span className="h-1.5 rounded-full bg-kb-green block overflow-hidden">
                              <span className="h-1.5 rounded-full bg-kb-lime block" style={{ width: `${(opt.votes.length / maxVotes) * 100}%` }} />
                            </span>
                            {voted ? <span className="text-[11px] text-[#C9D6C4]">Kamu pilih ini</span> : <span className="text-[11px] text-[#C9D6C4]">Ketuk buat vote</span>}
                            {owner && (
                              <button type="button" onClick={() => finalize(item, opt.id)} className="self-start text-[11px] font-bold text-kb-lime underline">
                                Tutup voting &amp; pilih ini
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => addOption(item)} className="h-9 rounded-xl border border-dashed border-[#9FB49A] text-kb-lime font-bold text-xs">
                        + Opsi lain
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
