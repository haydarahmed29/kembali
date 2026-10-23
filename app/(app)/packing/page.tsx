"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rowToOutfitItem, rowToPackingBag, rowToSuppliesItem } from "@/lib/mappers";
import { useAuth } from "@/lib/AuthProvider";
import { defaultOutfitCategories } from "@/lib/defaults";
import { promptField } from "@/lib/promptSheet";
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
  const { user, profile } = useAuth();
  const [bags, setBags] = useState<PackingBag[]>([]);
  const seeding = useRef(false);
  const alreadySeeded = !!profile?.seeded?.bags;

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase
        .from("packing_bags")
        .select("*")
        .eq("owner_uid", user.uid)
        .then(({ data }) => {
          const rows = data ? data.map(rowToPackingBag).sort((a, b) => a.id.localeCompare(b.id)) : [];
          setBags(rows);
          if (rows.length === 0 && !alreadySeeded && !seeding.current) {
            seeding.current = true;
            supabase.rpc("seed_packing_bags").then(() => {
              seeding.current = false;
            });
          }
        });
    load();

    const channel = supabase
      .channel(`packing-bags-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "packing_bags", filter: `owner_uid=eq.${user.uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, alreadySeeded]);

  async function addItem(bag: PackingBag) {
    const name = await promptField("Nama barang");
    if (!name?.trim()) return;
    const newItem: PackingItem = { id: crypto.randomUUID(), name: name.trim(), qty: 1, in: false, out: false };
    await supabase.from("packing_bags").update({ items: [...bag.items, newItem] }).eq("id", bag.id);
  }

  async function toggleItem(bag: PackingBag, itemId: string, field: "in" | "out") {
    const items = bag.items.map((it) => (it.id === itemId ? { ...it, [field]: !it[field] } : it));
    await supabase.from("packing_bags").update({ items }).eq("id", bag.id);
  }

  async function removeItem(bag: PackingBag, itemId: string) {
    await supabase
      .from("packing_bags")
      .update({ items: bag.items.filter((it) => it.id !== itemId) })
      .eq("id", bag.id);
  }

  async function renameBag(bag: PackingBag) {
    const name = await promptField("Nama tas", bag.name);
    if (!name?.trim()) return;
    await supabase.from("packing_bags").update({ name: name.trim() }).eq("id", bag.id);
  }

  async function removeBag(bag: PackingBag) {
    if (!window.confirm(`Hapus "${bag.name}" beserta isinya?`)) return;
    await supabase.from("packing_bags").delete().eq("id", bag.id);
  }

  async function addBag() {
    if (!user) return;
    const name = await promptField("Nama tas baru");
    if (!name?.trim()) return;
    await supabase.from("packing_bags").insert({ owner_uid: user.uid, group_id: null, name: name.trim(), items: [] });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {bags.map((bag) => (
        <div key={bag.id} className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => renameBag(bag)} className="font-bold text-[15px] text-left">
              {bag.name}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-xs text-kb-muted">
                {bag.items.filter((i) => i.in).length}/{bag.items.length} masuk
              </div>
              <button type="button" onClick={() => removeBag(bag)} aria-label={`Hapus ${bag.name}`} className="text-xs text-red-700">
                Hapus
              </button>
            </div>
          </div>
          <div className="flex px-0.5 text-xs font-bold text-kb-muted">
            <div className="flex-1">Barang</div>
            <div className="w-12 text-center">In</div>
            <div className="w-12 text-center">Out</div>
            <div className="w-6" />
          </div>
          {bag.items.map((item) => (
            <div key={item.id} className="flex items-center text-sm border-t border-[#E3E8DA] pt-2">
              <div className="flex-1 min-w-0 truncate">
                {item.name} ×{item.qty}
              </div>
              <div className="w-12 flex justify-center">
                <input type="checkbox" aria-label={`${item.name} masuk tas (berangkat)`} checked={item.in} onChange={() => toggleItem(bag, item.id, "in")} className="w-5 h-5 accent-kb-green" />
              </div>
              <div className="w-12 flex justify-center">
                <input type="checkbox" aria-label={`${item.name} masuk tas (pulang)`} checked={item.out} onChange={() => toggleItem(bag, item.id, "out")} className="w-5 h-5 accent-kb-green" />
              </div>
              <button type="button" onClick={() => removeItem(bag, item.id)} aria-label={`Hapus ${item.name}`} className="w-6 text-kb-muted">
                ✕
              </button>
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
  const seeding = useRef(false);
  const gender = profile?.gender;
  const alreadySeeded = !!profile?.seeded?.outfit;

  useEffect(() => {
    if (!user || !gender) return;
    const load = () =>
      supabase
        .from("outfit_items")
        .select("*")
        .eq("owner_uid", user.uid)
        .then(({ data }) => {
          const rows = data ? data.map(rowToOutfitItem) : [];
          setItems(rows);
          if (rows.length === 0 && !alreadySeeded && !seeding.current) {
            seeding.current = true;
            supabase.rpc("seed_outfit_items").then(() => {
              seeding.current = false;
            });
          }
        });
    load();

    const channel = supabase
      .channel(`outfit-items-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outfit_items", filter: `owner_uid=eq.${user.uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, gender, alreadySeeded]);

  async function updateQty(item: OutfitItem, delta: number) {
    await supabase.from("outfit_items").update({ qty: Math.max(1, item.qty + delta) }).eq("id", item.id);
  }
  async function toggleDone(item: OutfitItem) {
    await supabase.from("outfit_items").update({ done: !item.done }).eq("id", item.id);
  }
  async function duplicate(item: OutfitItem) {
    await supabase.from("outfit_items").insert({ owner_uid: item.ownerUid, category: item.category, name: item.name, qty: item.qty, bag: item.bag, done: false });
  }
  async function rename(item: OutfitItem) {
    const next = await promptField("Nama item", item.name);
    if (!next?.trim()) return;
    await supabase.from("outfit_items").update({ name: next.trim() }).eq("id", item.id);
  }
  async function remove(item: OutfitItem) {
    await supabase.from("outfit_items").delete().eq("id", item.id);
  }
  async function addItemToCategory(category: string) {
    if (!user) return;
    const name = await promptField(`Tambah item di kategori "${category}"`);
    if (!name?.trim()) return;
    await supabase.from("outfit_items").insert({ owner_uid: user.uid, category, name: name.trim(), qty: 1, bag: "Koper besar", done: false });
  }
  async function addCategory() {
    if (!user) return;
    const category = await promptField("Nama kategori baru (misal: Baju renang)");
    if (!category?.trim()) return;
    await supabase.from("outfit_items").insert({ owner_uid: user.uid, category: category.trim(), name: category.trim(), qty: 1, bag: "Koper besar", done: false });
  }

  // keep the template order (Atasan, Celana panjang, ...) with user-added categories after it
  const template = gender ? defaultOutfitCategories(gender) : [];
  const byCategory = items.reduce<Record<string, OutfitItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});
  const categories = Object.keys(byCategory).sort((a, b) => {
    const ia = template.indexOf(a);
    const ib = template.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div className="flex flex-col gap-3.5">
      {categories.map((category) => (
        <div key={category} className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <div className="font-bold text-[15px]">{category}</div>
          {byCategory[category].map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-t border-[#E3E8DA] pt-2.5">
              <input type="checkbox" aria-label={`${item.name} siap`} checked={item.done} onChange={() => toggleDone(item)} className="w-5 h-5 accent-kb-green shrink-0" />
              <button type="button" onClick={() => rename(item)} className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold truncate">{item.name}</div>
                <div className="text-xs text-kb-muted">{item.bag}</div>
              </button>
              <div className="flex items-center gap-1 bg-kb-bg rounded-xl p-1">
                <button type="button" aria-label="Kurangi" onClick={() => updateQty(item, -1)} className="w-7 h-7 rounded-lg bg-white font-bold">
                  −
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                <button type="button" aria-label="Tambah" onClick={() => updateQty(item, 1)} className="w-7 h-7 rounded-lg bg-white font-bold">
                  +
                </button>
              </div>
              <button type="button" onClick={() => duplicate(item)} className="text-xs text-kb-green font-semibold">
                Copy
              </button>
              <button type="button" onClick={() => remove(item)} aria-label={`Hapus ${item.name}`} className="text-xs text-kb-muted">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addItemToCategory(category)} className="text-xs font-bold text-kb-green text-left">
            + Tambah item
          </button>
        </div>
      ))}
      <button type="button" onClick={addCategory} className="h-[50px] rounded-2xl border-2 border-dashed border-[#9FB096] text-kb-green font-bold text-sm">
        + Tambah kategori
      </button>
      <p className="m-0 text-[11px] text-kb-muted px-1">Ketuk nama item buat rename.</p>
    </div>
  );
}

// ---------- Tambahan (obat & keperluan) ----------

function SuppliesTab() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<SuppliesItem[]>([]);
  const seeding = useRef(false);
  const alreadySeeded = !!profile?.seeded?.supplies;

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase
        .from("supplies_items")
        .select("*")
        .eq("owner_uid", user.uid)
        .then(({ data }) => {
          const rows = data ? data.map(rowToSuppliesItem).sort((a, b) => a.name.localeCompare(b.name, "id")) : [];
          setItems(rows);
          if (rows.length === 0 && !alreadySeeded && !seeding.current) {
            seeding.current = true;
            supabase.rpc("seed_supplies_items").then(() => {
              seeding.current = false;
            });
          }
        });
    load();

    const channel = supabase
      .channel(`supplies-items-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplies_items", filter: `owner_uid=eq.${user.uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, alreadySeeded]);

  async function toggle(item: SuppliesItem) {
    await supabase.from("supplies_items").update({ checked: !item.checked }).eq("id", item.id);
  }
  async function remove(item: SuppliesItem) {
    await supabase.from("supplies_items").delete().eq("id", item.id);
  }
  async function addItem() {
    if (!user) return;
    const name = await promptField("Tambah keperluan");
    if (!name?.trim()) return;
    await supabase.from("supplies_items").insert({ owner_uid: user.uid, name: name.trim(), checked: false });
  }

  return (
    <div className="bg-white rounded-[22px] p-3.5 flex flex-col gap-2">
      <div className="text-xs text-kb-muted">
        {items.filter((i) => i.checked).length} dari {items.length} siap
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2.5 text-sm py-1">
          <label className="flex-1 flex items-center gap-2.5">
            <input type="checkbox" checked={item.checked} onChange={() => toggle(item)} className="w-5 h-5 accent-kb-green" />
            <span className="flex-1">{item.name}</span>
          </label>
          <button type="button" onClick={() => remove(item)} className="text-xs text-red-700">
            Hapus
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="h-11 rounded-xl border-2 border-dashed border-[#9FB096] text-kb-green font-bold text-sm mt-1">
        + Tambah keperluan
      </button>
    </div>
  );
}
