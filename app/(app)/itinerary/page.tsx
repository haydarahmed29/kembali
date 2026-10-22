"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { logActivity } from "@/lib/activityLog";
import type { ItineraryItem, ItineraryOption } from "@/lib/types";

export default function ItineraryPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const scopeId = group?.id ?? null;

  useEffect(() => {
    if (!user) return;
    const q =
      scopeId == null
        ? query(collection(db, "itineraryItems"), where("createdBy", "==", user.uid), where("groupId", "==", null), orderBy("day"), orderBy("time"))
        : query(collection(db, "itineraryItems"), where("groupId", "==", scopeId), orderBy("day"), orderBy("time"));
    const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ItineraryItem)));
    return () => unsub();
  }, [user, scopeId]);

  async function addItem() {
    if (!user) return;
    const title = window.prompt("Usulan tempat/kegiatan:");
    if (!title) return;
    const time = window.prompt("Jam (misal 10:00):", "10:00") ?? "10:00";
    const day = Number(window.prompt("Hari ke-?", "1") ?? "1") || 1;

    const option: ItineraryOption = { id: crypto.randomUUID(), label: title, votes: group ? [] : [user.uid], proposedBy: user.uid };
    await addDoc(collection(db, "itineraryItems"), {
      groupId: scopeId,
      day,
      time,
      title,
      location: "",
      status: group ? "voting" : "final",
      options: group ? [option] : [],
      createdBy: user.uid,
      createdAt: new Date(),
    });

    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "itinerary_update",
        message: `menambahkan usulan "${title}" jam ${time} di Hari ${day}`,
      });
    }
  }

  async function vote(item: ItineraryItem, optionId: string) {
    if (!user) return;
    const options = item.options.map((opt) => {
      const votes = opt.votes.filter((v) => v !== user.uid);
      if (opt.id === optionId) votes.push(user.uid);
      return { ...opt, votes };
    });
    await updateDoc(doc(db, "itineraryItems", item.id), { options });
    if (group) {
      const label = options.find((o) => o.id === optionId)?.label ?? "";
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "vote_cast",
        message: `vote "${label}" buat Hari ${item.day} jam ${item.time}`,
      });
    }
  }

  async function finalize(item: ItineraryItem, optionId: string) {
    if (!user) return;
    const winner = item.options.find((o) => o.id === optionId);
    if (!winner) return;
    await updateDoc(doc(db, "itineraryItems", item.id), { status: "final", title: winner.label });
    if (group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Owner",
        action: "itinerary_finalize",
        message: `finalize voting Hari ${item.day} jam ${item.time} → "${winner.label}"`,
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
            + Usulkan
          </button>
        </div>
      </div>

      {Object.keys(byDay).length === 0 && <p className="text-sm text-kb-muted">Belum ada rencana. Tambah yang pertama yuk.</p>}

      {Object.entries(byDay)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, dayItems]) => (
          <div key={day} className="flex flex-col gap-2.5">
            <div className="text-xs font-bold text-kb-muted">Hari {day}</div>
            {dayItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-11 text-[13px] font-bold pt-3.5">{item.time}</div>
                {item.status === "final" ? (
                  <div className="flex-1 bg-white rounded-[20px] p-3.5 flex items-center gap-2.5">
                    <div className="flex-1">
                      <div className="text-[15px] font-bold">{item.title}</div>
                    </div>
                    <div className="text-[11px] font-bold bg-kb-lime px-2.5 py-1 rounded-[10px]">Final</div>
                  </div>
                ) : (
                  <div className="flex-1 bg-kb-green text-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
                    <div className="text-xs font-bold text-kb-lime">
                      Voting · {item.options.reduce((n, o) => Math.max(n, o.votes.length), 0)} suara tertinggi
                    </div>
                    {item.options.map((opt) => {
                      const voted = user ? opt.votes.includes(user.uid) : false;
                      const maxVotes = Math.max(1, ...item.options.map((o) => o.votes.length));
                      return (
                        <div key={opt.id} className={`rounded-2xl p-2.5 flex flex-col gap-1.5 ${voted ? "border-2 border-kb-lime bg-kb-green-light" : "border border-kb-green-light"}`}>
                          <button type="button" onClick={() => vote(item, opt.id)} className="flex justify-between w-full text-sm font-bold text-left">
                            <span>{opt.label}</span>
                            <span>{opt.votes.length} suara</span>
                          </button>
                          <span className="h-1.5 rounded-full bg-kb-green block overflow-hidden">
                            <span className="h-1.5 rounded-full bg-kb-lime block" style={{ width: `${(opt.votes.length / maxVotes) * 100}%` }} />
                          </span>
                          {voted && <span className="text-[11px] text-[#C9D6C4]">Kamu pilih ini</span>}
                          {profile?.role === "owner" && (
                            <button type="button" onClick={() => finalize(item, opt.id)} className="self-start text-[11px] font-bold text-kb-lime underline">
                              Finalize pilihan ini
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
