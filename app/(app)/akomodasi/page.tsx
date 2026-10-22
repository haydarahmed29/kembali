"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { logActivity } from "@/lib/activityLog";
import type { AccommodationOption } from "@/lib/types";

function detectSource(url: string): AccommodationOption["source"] {
  if (/agoda\.com/.test(url)) return "agoda";
  if (/traveloka\.com/.test(url)) return "traveloka";
  if (/maps\.(google|app\.goo)/.test(url) || /goo\.gl\/maps/.test(url)) return "maps";
  return "other";
}

export default function AkomodasiPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [options, setOptions] = useState<AccommodationOption[]>([]);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (!group) return;
    const q = query(collection(db, "accommodationOptions"), where("groupId", "==", group.id), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setOptions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccommodationOption)));
    return () => unsub();
  }, [group]);

  async function addOption() {
    if (!user || !group || !link.trim()) return;
    const title = window.prompt("Nama villa/penginapan:") ?? "Villa";
    const priceText = window.prompt("Harga (misal: Rp 3,2 jt / 4 malam):") ?? "";
    await addDoc(collection(db, "accommodationOptions"), {
      groupId: group.id,
      title,
      priceText,
      link: link.trim(),
      source: detectSource(link.trim()),
      imageUrl: null, // filled in later by the linkUnfurl Cloud Function
      votes: [],
      proposedBy: user.uid,
      createdAt: serverTimestamp(),
    });
    await logActivity({
      groupId: group.id,
      actorUid: user.uid,
      actorName: profile?.displayName ?? "Seseorang",
      action: "accommodation_update",
      message: `menambahkan opsi akomodasi "${title}"`,
    });
    setLink("");
  }

  async function vote(option: AccommodationOption) {
    if (!user) return;
    const votes = options.find((o) => o.id === option.id)?.votes ?? [];
    const already = votes.includes(user.uid);
    const next = already ? votes.filter((v) => v !== user.uid) : [...votes, user.uid];
    await updateDoc(doc(db, "accommodationOptions", option.id), { votes: next });
  }

  if (!group) {
    return (
      <div className="p-4">
        <p className="text-sm text-kb-muted">Voting akomodasi cuma ada di group trip.</p>
      </div>
    );
  }

  const votedCount = new Set(options.flatMap((o) => o.votes)).size;

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col">
          <div className="font-bold text-[18px]">Mau Tinggal di Mana?</div>
          <div className="text-xs text-kb-muted">
            {votedCount} dari {group.memberUids.length} udah vote
          </div>
        </div>
        <Link href="/history" aria-label="Riwayat" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
          🕘
        </Link>
      </div>

      <div className="bg-kb-lime rounded-2xl px-3.5 py-2.5 text-xs text-[#2D3A1A] leading-relaxed">
        Siapa aja boleh update pilihan villa di bawah, nanti yang lain tinggal vote. Kalau udah sepakat, Owner yang finalize.
      </div>

      <div className="bg-white rounded-[20px] px-3.5 py-2.5 flex items-center gap-2.5">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Tempel link Agoda / Traveloka / Maps…"
          className="flex-1 min-w-0 h-11 border border-kb-border rounded-2xl px-3.5 text-[13px] bg-kb-card"
        />
        <button type="button" onClick={addOption} className="h-11 px-4 rounded-2xl bg-kb-green text-kb-lime font-bold text-[13px]">
          Tambah
        </button>
      </div>
      <p className="m-0 -mt-2 text-[11px] text-kb-muted px-1">Foto &amp; harga ke-ambil otomatis dari link-nya</p>

      {options.map((opt) => {
        const voted = user ? opt.votes.includes(user.uid) : false;
        return (
          <div key={opt.id} className={`bg-white rounded-[24px] p-3 flex flex-col gap-2.5 ${voted ? "border-2 border-kb-green" : ""}`}>
            <div className="flex gap-3">
              <div className="w-[84px] h-[84px] rounded-2xl bg-kb-bg shrink-0 relative overflow-hidden">
                {opt.imageUrl && <img src={opt.imageUrl} alt="" className="w-full h-full object-cover" />}
                <span className="absolute left-1 bottom-1 bg-kb-green text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md capitalize">{opt.source}</span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="text-[15px] font-bold truncate">{opt.title}</div>
                <div className="text-xs text-kb-muted">{opt.priceText}</div>
                <a href={opt.link} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-kb-green">
                  Lihat link ↗
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded bg-kb-bg overflow-hidden">
                <div
                  className="h-2 rounded bg-kb-green"
                  style={{ width: `${(opt.votes.length / Math.max(1, group.memberUids.length)) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold">{opt.votes.length} suara</span>
            </div>
            <button
              type="button"
              onClick={() => vote(opt)}
              className={`h-11 rounded-2xl font-bold text-[13px] ${voted ? "bg-kb-green text-kb-lime" : "border border-kb-green text-kb-green"}`}
            >
              {voted ? "✓ Pilihanmu" : "Pilih ini"}
            </button>
          </div>
        );
      })}

      {options.length === 0 && <p className="text-sm text-kb-muted">Belum ada opsi villa. Tempel link di atas buat mulai.</p>}

      <div className="text-[11px] text-kb-muted px-1">
        Belum vote: {group.memberUids.filter((uid) => !options.some((o) => o.votes.includes(uid))).length} orang
      </div>
    </div>
  );
}
