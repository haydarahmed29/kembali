"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { rowToAccommodationOption } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { isOwner } from "@/lib/group";
import { logActivity } from "@/lib/activityLog";
import type { AccommodationOption } from "@/lib/types";

function detectSource(url: string): AccommodationOption["source"] {
  if (/agoda\./i.test(url)) return "agoda";
  if (/traveloka\./i.test(url)) return "traveloka";
  if (/airbnb\./i.test(url)) return "airbnb";
  if (/maps\.(google|app\.goo)/i.test(url) || /goo\.gl\/maps/i.test(url) || /google\.[a-z.]+\/maps/i.test(url)) return "maps";
  return "other";
}

const SOURCE_STYLE: Record<AccommodationOption["source"], string> = {
  agoda: "bg-[#E8720C]",
  traveloka: "bg-[#1BA0E2]",
  airbnb: "bg-[#FF385C]",
  maps: "bg-[#34A853]",
  other: "bg-kb-green",
};

export default function AkomodasiPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const [options, setOptions] = useState<AccommodationOption[]>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const owner = isOwner(group, user?.uid);

  useEffect(() => {
    if (!group) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dependency goes away, not reacting to an external system
      setOptions([]);
      return;
    }
    const load = () =>
      supabase
        .from("accommodation_options")
        .select("*")
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => data && setOptions(data.map(rowToAccommodationOption)));
    load();

    const channel = supabase
      .channel(`accommodation-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_options", filter: `group_id=eq.${group.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group]);

  async function addOption() {
    const url = link.trim();
    if (!user || !group || !url) return;
    setError(null);
    if (!/^https?:\/\//i.test(url)) {
      setError("Tempel link lengkap yang diawali https:// ya.");
      return;
    }
    const title = window.prompt("Nama villa/penginapan:");
    if (title === null) return; // cancelled
    const priceText = window.prompt("Harga (misal: Rp 3,2 jt / 4 malam):", "") ?? "";
    const name = title.trim() || "Villa";
    const { data } = await supabase
      .from("accommodation_options")
      .insert({
        group_id: group.id,
        title: name,
        price_text: priceText.trim(),
        link: url,
        source: detectSource(url),
        image_url: null, // filled in a few seconds later by the link-unfurl Edge Function
        votes: [user.uid], // the proposer votes for it by default
        chosen: false,
        proposed_by: user.uid,
      })
      .select()
      .single();

    if (data?.id) {
      // best-effort — the card just shows the source badge without a photo if this fails
      supabase.functions.invoke("link-unfurl", { body: { url, optionId: data.id } }).catch(() => {});
    }

    await logActivity({
      groupId: group.id,
      actorUid: user.uid,
      actorName: profile?.displayName ?? "Seseorang",
      action: "accommodation_update",
      message: `menambahkan opsi akomodasi "${name}"`,
    });
    setLink("");
  }

  /** One vote per person: voting here removes your vote from every other option (atomically, via RPC). */
  async function vote(option: AccommodationOption) {
    if (!user || !group) return;
    const already = option.votes.includes(user.uid);
    const { error: voteError } = await supabase.rpc("vote_accommodation", { p_option_id: option.id });
    if (voteError) return;
    if (!already) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "vote_cast",
        message: `vote akomodasi "${option.title}"`,
      });
    }
  }

  async function choose(option: AccommodationOption) {
    if (!user || !group || !owner) return;
    if (!window.confirm(`Tutup voting & tetapkan "${option.title}" sebagai tempat tinggal?`)) return;
    const { error: chooseError } = await supabase.rpc("choose_accommodation", { p_option_id: option.id });
    if (chooseError) return;
    await logActivity({
      groupId: group.id,
      actorUid: user.uid,
      actorName: profile?.displayName ?? "Owner",
      action: "accommodation_update",
      message: `nutup voting akomodasi → "${option.title}"`,
    });
  }

  async function remove(option: AccommodationOption) {
    if (!window.confirm(`Hapus opsi "${option.title}"?`)) return;
    await supabase.from("accommodation_options").delete().eq("id", option.id);
  }

  if (!group) {
    return (
      <div className="p-4">
        <p className="text-sm text-kb-muted">Voting akomodasi cuma ada di group trip.</p>
      </div>
    );
  }

  const votedCount = new Set(options.flatMap((o) => o.votes)).size;
  const chosen = options.find((o) => o.chosen);
  const sorted = [...options].sort((a, b) => Number(!!b.chosen) - Number(!!a.chosen) || b.votes.length - a.votes.length);

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col">
          <div className="font-bold text-[18px]">Mau Tinggal di Mana?</div>
          <div className="text-xs text-kb-muted">
            {chosen ? `Udah fix: ${chosen.title}` : `${votedCount} dari ${group.memberUids.length} udah vote`}
          </div>
        </div>
        <Link href="/history" aria-label="Riwayat" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
          🕘
        </Link>
      </div>

      <div className="bg-kb-lime rounded-2xl px-3.5 py-2.5 text-xs text-[#2D3A1A] leading-relaxed">
        Siapa aja boleh nambah pilihan villa, yang lain tinggal vote (1 orang 1 suara). Kalau udah sepakat, Owner yang tutup voting-nya.
      </div>

      <div className="bg-white rounded-[20px] px-3.5 py-2.5 flex items-center gap-2.5">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          inputMode="url"
          placeholder="Tempel link Agoda / Traveloka / Maps…"
          className="flex-1 min-w-0 h-11 border border-kb-border rounded-2xl px-3.5 text-[13px] bg-kb-card"
        />
        <button type="button" onClick={addOption} className="h-11 px-4 rounded-2xl bg-kb-green text-kb-lime font-bold text-[13px]">
          Tambah
        </button>
      </div>
      {error ? (
        <p className="m-0 -mt-2 text-xs text-red-700 px-1">{error}</p>
      ) : (
        <p className="m-0 -mt-2 text-[11px] text-kb-muted px-1">Foto ke-ambil otomatis dari link-nya (beberapa detik)</p>
      )}

      {sorted.map((opt) => {
        const voted = user ? opt.votes.includes(user.uid) : false;
        const canDelete = opt.proposedBy === user?.uid || owner;
        return (
          <div
            key={opt.id}
            className={`bg-white rounded-[24px] p-3 flex flex-col gap-2.5 ${opt.chosen ? "border-2 border-kb-lime" : voted ? "border-2 border-kb-green" : ""}`}
          >
            <div className="flex gap-3">
              <div className="w-[84px] h-[84px] rounded-2xl bg-kb-bg shrink-0 relative overflow-hidden">
                {opt.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote OG images from arbitrary booking sites; next/image would need every domain whitelisted
                  <img src={opt.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                )}
                <span className={`absolute left-1 bottom-1 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md capitalize ${SOURCE_STYLE[opt.source] ?? SOURCE_STYLE.other}`}>
                  {opt.source === "other" ? "link" : opt.source}
                </span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-[15px] font-bold truncate">{opt.title}</div>
                  {opt.chosen && <span className="text-[10px] font-extrabold bg-kb-lime px-2 py-0.5 rounded-lg shrink-0">FIX</span>}
                </div>
                <div className="text-xs text-kb-muted">{opt.priceText || "Harga belum diisi"}</div>
                <a href={opt.link} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-kb-green">
                  Lihat link ↗
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded bg-kb-bg overflow-hidden">
                <div className="h-2 rounded bg-kb-green" style={{ width: `${(opt.votes.length / Math.max(1, group.memberUids.length)) * 100}%` }} />
              </div>
              <span className="text-xs font-bold">{opt.votes.length} suara</span>
            </div>
            {!chosen && (
              <button
                type="button"
                onClick={() => vote(opt)}
                className={`h-11 rounded-2xl font-bold text-[13px] ${voted ? "bg-kb-green text-kb-lime" : "border border-kb-green text-kb-green"}`}
              >
                {voted ? "✓ Pilihanmu" : "Pilih ini"}
              </button>
            )}
            <div className="flex items-center gap-4 px-1">
              {owner && !opt.chosen && (
                <button type="button" onClick={() => choose(opt)} className="text-[11px] font-bold text-kb-green underline">
                  Tetapkan sebagai pilihan final
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={() => remove(opt)} className="text-[11px] text-kb-muted ml-auto">
                  Hapus
                </button>
              )}
            </div>
          </div>
        );
      })}

      {options.length === 0 && <p className="text-sm text-kb-muted">Belum ada opsi villa. Tempel link di atas buat mulai.</p>}

      {!chosen && options.length > 0 && (
        <div className="text-[11px] text-kb-muted px-1">
          Belum vote: {group.memberUids.filter((uid) => !options.some((o) => o.votes.includes(uid))).length} orang
        </div>
      )}
    </div>
  );
}
