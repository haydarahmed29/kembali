"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { DEFAULT_BAGS, DEFAULT_SUPPLIES, defaultOutfitCategories } from "@/lib/defaults";
import type { OutfitItem, PackingBag, PackingItem, SuppliesItem } from "@/lib/types";

type Tab = "bags" | "outfit" | "supplies";

export default function PackingPage() {
  const [tab, setTab] = useState<Tab>("bags");

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div>
        <h1 className="text-xl font-bold">Packing & Outfit</h1>
      </div>
      <div className="grid grid-cols-3 gap-1.5 bg-white rounded-[22px] p-1">
        <TabButton active={tab === "bags"} onClick={() => setTab("bags")} label="Koper/Tas" />
        <TabButton active={tab === "outfit"} onClick={() => setTab("outfit")} label="Outfit" />
        <TabButton active={tab === "supplies"} onClick={() => setTab("supplies")} label="Tambahan" />
      </div>

      {tab === "bags" && <BagsTab />}
      {tab === "outfit" && <OutfitTab />}
      {tab === "supplies" && <SuppliesTab />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-[18px] font-bold text-[13px] ${active ? "bg-kb-green text-white" : "text-[#3F4F44]"}`}
    >
      {label}
    </button>
  );
}

// ---------- Koper / Tas ----------

function BagsTab() {
  const { user } = useAuth();
  const [bags, setBags] = useState<PackingBag[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "packingBags"), where("ownerUid", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await Promise.all(
          DEFAULT_BAGS.map((name) =>
            addDoc(collection(db, "packingBags"), { ownerUid: user.uid, groupId: null, name, items: [] })
          )
        );
        return;
      }
      setBags(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PackingBag));
    });
    return () => unsub();
  }, [user]);

  async function addItem(bag: PackingBag) {
    const name = window.prompt("Nama barang:");
    if (!name) return;
    const newItem: PackingItem = { id: crypto.randomUUID(), name, qty: 1, in: false, out: false };
    await updateDoc(doc(db, "packingBags", bag.id), { items: [...bag.items, newItem] });
  }

  async function toggleItem(bag: PackingBag, itemId: string, field: "in" | "out") {
    const items = bag.items.map((it) => (it.id === itemId ? { ...it, [field]: !it[field] } : it));
    await updateDoc(doc(db, "packingBags", bag.id), { items });
  }

  async function addBag() {
    if (!user) return;
    const name = window.prompt("Nama tas baru:");
    if (!name) return;
    await addDoc(collection(db, "packingBags"), { ownerUid: user.uid, groupId: null, name, items: [] });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {bags.map((bag) => (
        <div key={bag.id} className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="font-bold text-[15px]">{bag.name}</div>
            <div className="text-xs text-kb-muted">{bag.items.length} barang</div>
          </div>
          <div className="flex px-0.5 text-xs font-bold text-kb-muted">
            <div className="flex-1">Barang</div>
            <div className="w-12 text-center">In</div>
            <div className="w-12 text-center">Out</div>
          </div>
          {bag.items.map((item) => (
            <div key={item.id} className="flex items-center text-sm border-t border-[#E3E8DA] pt-2">
              <div className="flex-1">
                {item.name} ×{item.qty}
              </div>
              <div className="w-12 flex justify-center">
                <input type="checkbox" checked={item.in} onChange={() => toggleItem(bag, item.id, "in")} className="w-5 h-5 accent-kb-green" />
              </div>
              <div className="w-12 flex justify-center">
                <input type="checkbox" checked={item.out} onChange={() => toggleItem(bag, item.id, "out")} className="w-5 h-5 accent-kb-green" />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addItem(bag)} className="text-xs font-bold text-kb-green text-left pt-1">
            + Tambah barang
          </button>
        </div>
      ))}
      <button type="button" onClick={addBag} className="h-[50px] rounded-2xl border-2 border-dashed border-[#9FB096] text-kb-green font-bold text-sm">
        + Tambah tas
      </button>
    </div>
  );
}

// ---------- Outfit ----------

function OutfitTab() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<OutfitItem[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    const q = query(collection(db, "outfitItems"), where("ownerUid", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await Promise.all(
          defaultOutfitCategories(profile.gender).map((category) =>
            addDoc(collection(db, "outfitItems"), {
              ownerUid: user.uid,
              category,
              name: category,
              qty: 1,
              bag: "Koper besar",
              done: false,
            })
          )
        );
        return;
      }
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OutfitItem));
    });
    return () => unsub();
  }, [user, profile]);

  async function updateQty(item: OutfitItem, delta: number) {
    await updateDoc(doc(db, "outfitItems", item.id), { qty: Math.max(1, item.qty + delta) });
  }
  async function toggleDone(item: OutfitItem) {
    await updateDoc(doc(db, "outfitItems", item.id), { done: !item.done });
  }
  async function duplicate(item: OutfitItem) {
    const { id, ...rest } = item;
    void id;
    await addDoc(collection(db, "outfitItems"), rest);
  }
  async function rename(item: OutfitItem) {
    const next = window.prompt("Nama item:", item.name);
    if (!next) return;
    await updateDoc(doc(db, "outfitItems", item.id), { name: next });
  }
  async function addItemToCategory(category: string) {
    if (!user) return;
    const name = window.prompt(`Tambah item di kategori "${category}":`);
    if (!name) return;
    await addDoc(collection(db, "outfitItems"), { ownerUid: user.uid, category, name, qty: 1, bag: "Koper besar", done: false });
  }

  const byCategory = items.reduce<Record<string, OutfitItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3.5">
      {Object.entries(byCategory).map(([category, catItems]) => (
        <div key={category} className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="font-bold text-[15px]">{category}</div>
          {catItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 border-t border-[#E3E8DA] pt-2.5">
              <input type="checkbox" checked={item.done} onChange={() => toggleDone(item)} className="w-5 h-5 accent-kb-green shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.name}</div>
                <div className="text-xs text-kb-muted">{item.bag}</div>
              </div>
              <div className="flex items-center gap-1.5 bg-kb-bg rounded-xl p-1">
                <button type="button" onClick={() => updateQty(item, -1)} className="w-7 h-7 rounded-lg bg-white font-bold">
                  −
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                <button type="button" onClick={() => updateQty(item, 1)} className="w-7 h-7 rounded-lg bg-white font-bold">
                  +
                </button>
              </div>
              <button type="button" onClick={() => duplicate(item)} className="text-xs text-kb-green font-semibold">
                Copy
              </button>
              <button type="button" onClick={() => rename(item)} className="text-xs text-kb-green font-semibold">
                Rename
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addItemToCategory(category)} className="text-xs font-bold text-kb-green text-left">
            + Tambah item
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Tambahan (obat & keperluan) ----------

function SuppliesTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<SuppliesItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "suppliesItems"), where("ownerUid", "==", user.uid), orderBy("name"));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await Promise.all(
          DEFAULT_SUPPLIES.map((name) => addDoc(collection(db, "suppliesItems"), { ownerUid: user.uid, name, checked: false }))
        );
        return;
      }
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SuppliesItem));
    });
    return () => unsub();
  }, [user]);

  async function toggle(item: SuppliesItem) {
    await updateDoc(doc(db, "suppliesItems", item.id), { checked: !item.checked });
  }
  async function remove(item: SuppliesItem) {
    await deleteDoc(doc(db, "suppliesItems", item.id));
  }
  async function addItem() {
    if (!user) return;
    const name = window.prompt("Tambah keperluan:");
    if (!name) return;
    await addDoc(collection(db, "suppliesItems"), { ownerUid: user.uid, name, checked: false });
  }

  return (
    <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2">
      <div className="text-xs text-kb-muted">
        {items.filter((i) => i.checked).length} dari {items.length} siap
      </div>
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-2.5 text-sm py-1">
          <input type="checkbox" checked={item.checked} onChange={() => toggle(item)} className="w-5 h-5 accent-kb-green" />
          <span className="flex-1">{item.name}</span>
          <button type="button" onClick={() => remove(item)} className="text-xs text-red-700">
            Hapus
          </button>
        </label>
      ))}
      <button type="button" onClick={addItem} className="h-11 rounded-xl border-2 border-dashed border-[#9FB096] text-kb-green font-bold text-sm mt-1">
        + Tambah keperluan
      </button>
    </div>
  );
}
