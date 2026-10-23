"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rowToExpense } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useGroupMembers, nameFor } from "@/lib/useGroupMembers";
import { settleUp } from "@/lib/settleUp";
import { logActivity } from "@/lib/activityLog";
import { isOwner } from "@/lib/group";
import { parseRupiah } from "@/lib/time";
import type { Expense } from "@/lib/types";

const CATEGORIES: Expense["category"][] = ["transport", "makan", "tiket", "penginapan", "belanja", "lainnya"];

export default function BudgetPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const members = useGroupMembers(group?.memberUids);
  // null = follow the default (group tab when in a group); the group loads after first render
  const [tabChoice, setTabChoice] = useState<"personal" | "group" | null>(null);
  const tab = tabChoice ?? (group ? "group" : "personal");
  const setTab = setTabChoice;
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const q =
        tab === "personal"
          ? supabase.from("expenses").select("*").eq("paid_by", user.uid).is("group_id", null).order("created_at", { ascending: false })
          : supabase.from("expenses").select("*").eq("group_id", group?.id ?? "__none__").order("created_at", { ascending: false });
      q.then(({ data }) => setExpenses(data ? data.map(rowToExpense) : []));
    };
    load();

    const filter = tab === "personal" ? `paid_by=eq.${user.uid}` : `group_id=eq.${group?.id ?? "__none__"}`;
    const channel = supabase
      .channel(`expenses-${tab}-${tab === "personal" ? user.uid : (group?.id ?? "none")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, group?.id, tab]);

  async function addExpense() {
    if (!user) return;
    const title = window.prompt("Untuk apa?");
    if (!title?.trim()) return;
    const amountRaw = window.prompt("Berapa rupiah? (boleh pakai titik, misal 150.000)", "");
    if (amountRaw === null) return;
    const amount = parseRupiah(amountRaw);
    if (!amount) {
      window.alert("Nominalnya belum keisi.");
      return;
    }
    const dayRaw = window.prompt("Hari ke-?", "1");
    if (dayRaw === null) return;
    const day = Math.max(1, Math.round(Number(dayRaw)) || 1);
    const categoryRaw = (window.prompt(`Kategori (${CATEGORIES.join(" / ")}):`, "lainnya") ?? "lainnya").trim().toLowerCase();
    const category = (CATEGORIES as string[]).includes(categoryRaw) ? (categoryRaw as Expense["category"]) : "lainnya";

    const splitAmong = tab === "group" && group ? group.memberUids : [user.uid];
    await supabase.from("expenses").insert({
      group_id: tab === "group" ? (group?.id ?? null) : null,
      day,
      title: title.trim(),
      category,
      amount,
      paid_by: user.uid,
      split_among: splitAmong,
    });

    if (tab === "group" && group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "expense_added",
        message: `menambahkan pengeluaran "${title.trim()}" Rp ${amount.toLocaleString("id-ID")}`,
      });
    }
  }

  async function removeExpense(exp: Expense) {
    if (!window.confirm(`Hapus "${exp.title}" (Rp ${exp.amount.toLocaleString("id-ID")})?`)) return;
    await supabase.from("expenses").delete().eq("id", exp.id);
    if (exp.groupId && group && user) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "expense_added",
        message: `menghapus pengeluaran "${exp.title}" Rp ${exp.amount.toLocaleString("id-ID")}`,
      });
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const perPerson = tab === "group" && group?.memberUids.length ? total / group.memberUids.length : total;
  const transfers = tab === "group" ? settleUp(expenses) : [];

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold">Budget</h1>
        <button type="button" onClick={addExpense} className="h-11 px-3.5 rounded-full bg-kb-green text-kb-lime font-bold text-[13px]">
          + Catat biaya
        </button>
      </div>

      {group && (
        <div className="grid grid-cols-2 gap-1.5 bg-white rounded-[22px] p-1">
          <button type="button" onClick={() => setTab("personal")} className={`h-10 rounded-[18px] font-bold text-sm ${tab === "personal" ? "bg-kb-lime" : "text-[#3F4F44]"}`}>
            Pribadi
          </button>
          <button type="button" onClick={() => setTab("group")} className={`h-10 rounded-[18px] font-bold text-sm ${tab === "group" ? "bg-kb-lime" : "text-[#3F4F44]"}`}>
            Group
          </button>
        </div>
      )}

      <div className="bg-kb-green text-white rounded-[26px] p-4.5 flex flex-col gap-2.5">
        <div className="text-xs font-semibold text-kb-lime">Total pengeluaran {tab === "group" ? "group" : "kamu"}</div>
        <div className="text-[30px] font-extrabold tracking-tight">Rp {total.toLocaleString("id-ID")}</div>
        {tab === "group" && <div className="text-xs text-[#C9D6C4]">≈ Rp {Math.round(perPerson).toLocaleString("id-ID")} / orang</div>}
      </div>

      <div className="text-[16px] font-bold">Pengeluaran</div>
      <div className="bg-white rounded-[22px] px-3.5">
        {expenses.length === 0 && <p className="text-sm text-kb-muted py-3">Belum ada catatan.</p>}
        {expenses.map((exp) => (
          <div key={exp.id} className="flex items-center gap-2.5 py-2.5 border-b border-[#E3E8DA] last:border-0">
            <div className="text-[11px] font-bold bg-kb-bg px-2 py-1 rounded-lg">H{exp.day}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{exp.title}</div>
              <div className="text-[11px] text-kb-muted capitalize">
                {exp.category} · dibayar {nameFor(members, exp.paidBy)} · bagi {exp.splitAmong.length}
              </div>
            </div>
            <div className="text-sm font-bold">{exp.amount.toLocaleString("id-ID")}</div>
            {(exp.paidBy === user?.uid || isOwner(group, user?.uid)) && (
              <button type="button" onClick={() => removeExpense(exp)} aria-label={`Hapus ${exp.title}`} className="text-kb-muted text-sm pl-1">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {tab === "group" && (
        <>
          <div className="text-[16px] font-bold">Biar impas</div>
          <div className="bg-white rounded-[22px] px-3.5">
            {transfers.length === 0 && <p className="text-sm text-kb-muted py-3">Semua udah impas.</p>}
            {transfers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-2.5 border-b border-[#E3E8DA] last:border-0 text-sm">
                <b>{nameFor(members, t.from)}</b>
                <span className="text-kb-muted">→</span>
                <b className="flex-1">{nameFor(members, t.to)}</b>
                <span className="font-bold">Rp {t.amount.toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
