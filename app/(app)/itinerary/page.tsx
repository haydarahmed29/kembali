"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { isOwner } from "@/lib/group";
import { logActivity } from "@/lib/activityLog";
import { promptDayAndTime } from "@/lib/time";
import type { ItineraryItem, ItineraryOption } from "@/lib/types";

export default function ItineraryPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const scopeId = group?.id ?? null;
  const owner = isOwner(group, user?.uid);
  const myName = profile?.displayName ?? "Seseorang";

  useEffect(() => {
    if (!user) return;
    const q =
      scopeId == null
        ? query(collection(db, "itineraryItems"), where("createdBy", "==", user.uid), where("groupId", "==", null), orderBy("day"), orderBy("time"))
        : query(collection(db, "itineraryItems"), where("groupId", "==", scopeId), orderBy("day"), orderBy("time"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ItineraryItem)),
      () => setItems([])
    );
  }, [user, scopeId]);

  async function addItem() {
    if (!user) return;
    const title = window.prompt(group ? "Usulan tempat/kegiatan:" : "Tempat/kegiatan:");
    if (!title?.trim()) return;
    const when = promptDayAndTime();
    if (!when) return;

    // the proposer automatically votes for their own idea
    const option: ItineraryOption = { id: crypto.randomUUID(), label: title.trim(), votes: [user.uid], proposedBy: user.uid };
    await addDoc(collection(db, "itineraryItems"), {
      groupId: scopeId,
      day: when.day,
      time: when.time,
      title: title.trim(),
      location: "",
      status: group ? "voting" : "final",
      options: group ? [option] : [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: myName,
        action: "itinerary_update",
        message: `menambahkan usulan "${title.trim()}" jam ${when.time} di Hari ${when.day}`,
      });
    }
  }

  async function addOption(item: ItineraryItem) {
    if (!user) return;
    const label = window.prompt(`Opsi lain buat Hari ${item.day} jam ${item.time}:`);
    if (!label?.trim()) return;
    const ref = doc(db, "itineraryItems", item.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const current = (snap.data().options ?? []) as ItineraryOption[];
      // adding an option also moves your vote to it
      const options = current.map((o) => ({ ...o, votes: o.votes.filter((v) => v !== user.uid) }));
      options.push({ id: crypto.randomUUID(), label: label.trim(), votes: [user.uid], proposedBy: user.uid });
      tx.update(ref, { options });
    });
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
    const ref = doc(db, "itineraryItems", item.id);
    // transaction so two people voting at the same moment don't overwrite each other's vote
    const label = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists() || snap.data().status !== "voting") return null;
      const options = ((snap.data().options ?? []) as ItineraryOption[]).map((opt) => {
        const votes = opt.votes.filter((v) => v !== user.uid);
        if (opt.id === optionId) votes.push(user.uid);
        return { ...opt, votes };
      });
      tx.update(ref, { options });
      return options.find((o) => o.id === optionId)?.label ?? "";
    });
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
    await updateDoc(doc(db, "itineraryItems", item.id), { status: "final", title: winner.label });
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
    await deleteDoc(doc(db, "itineraryItems", item.id));
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
