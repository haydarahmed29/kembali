"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import { useGroupMembers, nameFor } from "@/lib/useGroupMembers";
import { settleUp } from "@/lib/settleUp";
import { logActivity } from "@/lib/activityLog";
import type { Expense } from "@/lib/types";

const CATEGORIES: Expense["category"][] = ["transport", "makan", "tiket", "penginapan", "belanja", "lainnya"];

export default function BudgetPage() {
  const { user, profile } = useAuth();
  const { group } = useGroup();
  const members = useGroupMembers(group?.memberUids);
  const [tab, setTab] = useState<"personal" | "group">(group ? "group" : "personal");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!user) return;
    const q =
      tab === "personal"
        ? query(collection(db, "expenses"), where("paidBy", "==", user.uid), where("groupId", "==", null), orderBy("createdAt", "desc"))
        : query(collection(db, "expenses"), where("groupId", "==", group?.id ?? "__none__"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)));
    return () => unsub();
  }, [user, group?.id, tab]);

  async function addExpense() {
    if (!user) return;
    const title = window.prompt("Untuk apa?");
    if (!title) return;
    const amount = Number(window.prompt("Berapa rupiah?", "0") ?? "0");
    if (!amount) return;
    const day = Number(window.prompt("Hari ke-?", "1") ?? "1") || 1;
    const category = (window.prompt(`Kategori (${CATEGORIES.join("/")}):`, "lainnya") as Expense["category"]) || "lainnya";

    const splitAmong = tab === "group" && group ? group.memberUids : [user.uid];
    await addDoc(collection(db, "expenses"), {
      groupId: tab === "group" ? group?.id ?? null : null,
      day,
      title,
      category: CATEGORIES.includes(category) ? category : "lainnya",
      amount,
      paidBy: user.uid,
      splitAmong,
      createdAt: new Date(),
    });

    if (tab === "group" && group) {
      await logActivity({
        groupId: group.id,
        actorUid: user.uid,
        actorName: profile?.displayName ?? "Seseorang",
        action: "expense_added",
        message: `menambahkan pengeluaran "${title}" Rp ${amount.toLocaleString("id-ID")}`,
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
