"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { DEFAULT_BAGS, DEFAULT_SUPPLIES, defaultOutfitCategories } from "@/lib/defaults";
import type { OutfitItem, PackingBag, PackingItem, SuppliesItem, UserProfile } from "@/lib/types";

type Tab = "bags" | "outfit" | "supplies";
type SeedKind = "bags" | "outfit" | "supplies";

/**
 * Fill in the default template the first time a user opens a tab — and only once.
 * - waits for a server-confirmed empty result (a cached empty snapshot isn't proof)
 * - uses fixed doc IDs, so two tabs/devices racing can't create duplicates
 * - records `seeded.<kind>` on the profile, so deleting every item doesn't bring the template back
 */
async function seedOnce(
  snap: QuerySnapshot,
  uid: string,
  profile: UserProfile | null,
  kind: SeedKind,
  collectionName: string,
  rows: Record<string, unknown>[],
  inFlight: RefObject<boolean>
) {
  if (!snap.empty || snap.metadata.fromCache || !profile || profile.seeded?.[kind] || inFlight.current) return;
  inFlight.current = true;
  try {
    const batch = writeBatch(db);
    rows.forEach((row, i) => batch.set(doc(db, collectionName, `${uid}_${kind}_${i}`), row));
    batch.update(doc(db, "users", uid), { [`seeded.${kind}`]: true });
    await batch.commit();
  } finally {
    inFlight.current = false;
  }
}

/** Ref that always holds the latest value, so snapshot callbacks read the current profile without resubscribing. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

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
  const profileRef = useLatest(profile);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "packingBags"), where("ownerUid", "==", user.uid));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setBags(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PackingBag).sort((a, b) => a.id.localeCompare(b.id)));
      seedOnce(
        snap,
        user.uid,
        profileRef.current,
        "bags",
        "packingBags",
        DEFAULT_BAGS.map((name) => ({ ownerUid: user.uid, groupId: null, name, items: [] })),
        seeding
      ).catch(() => {});
    });
  }, [user, profileRef]);

  async function addItem(bag: PackingBag) {
    const name = window.prompt("Nama barang:");
    if (!name?.trim()) return;
    const newItem: PackingItem = { id: crypto.randomUUID(), name: name.trim(), qty: 1, in: false, out: false };
    await updateDoc(doc(db, "packingBags", bag.id), { items: [...bag.items, newItem] });
  }

  async function toggleItem(bag: PackingBag, itemId: string, field: "in" | "out") {
    const items = bag.items.map((it) => (it.id === itemId ? { ...it, [field]: !it[field] } : it));
    await updateDoc(doc(db, "packingBags", bag.id), { items });
  }

  async function removeItem(bag: PackingBag, itemId: string) {
    await updateDoc(doc(db, "packingBags", bag.id), { items: bag.items.filter((it) => it.id !== itemId) });
  }

  async function renameBag(bag: PackingBag) {
    const name = window.prompt("Nama tas:", bag.name);
    if (!name?.trim()) return;
    await updateDoc(doc(db, "packingBags", bag.id), { name: name.trim() });
  }

  async function removeBag(bag: PackingBag) {
    if (!window.confirm(`Hapus "${bag.name}" beserta isinya?`)) return;
    await deleteDoc(doc(db, "packingBags", bag.id));
  }

  async function addBag() {
    if (!user) return;
    const name = window.prompt("Nama tas baru:");
    if (!name?.trim()) return;
    await addDoc(collection(db, "packingBags"), { ownerUid: user.uid, groupId: null, name: name.trim(), items: [] });
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
  const profileRef = useLatest(profile);
  const gender = profile?.gender;

  useEffect(() => {
    if (!user || !gender) return;
    const q = query(collection(db, "outfitItems"), where("ownerUid", "==", user.uid));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OutfitItem));
      seedOnce(
        snap,
        user.uid,
        profileRef.current,
        "outfit",
        "outfitItems",
        defaultOutfitCategories(gender).map((category, i) => ({
          ownerUid: user.uid,
          category,
          name: category,
          qty: 1,
          bag: "Koper besar",
          done: false,
          order: i,
        })),
        seeding
      ).catch(() => {});
    });
  }, [user, gender, profileRef]);

  async function updateQty(item: OutfitItem, delta: number) {
    await updateDoc(doc(db, "outfitItems", item.id), { qty: Math.max(1, item.qty + delta) });
  }
  async function toggleDone(item: OutfitItem) {
    await updateDoc(doc(db, "outfitItems", item.id), { done: !item.done });
  }
  async function duplicate(item: OutfitItem) {
    const { id, ...rest } = item;
    void id;
    await addDoc(collection(db, "outfitItems"), { ...rest, done: false });
  }
  async function rename(item: OutfitItem) {
    const next = window.prompt("Nama item:", item.name);
    if (!next?.trim()) return;
    await updateDoc(doc(db, "outfitItems", item.id), { name: next.trim() });
  }
  async function remove(item: OutfitItem) {
    await deleteDoc(doc(db, "outfitItems", item.id));
  }
  async function addItemToCategory(category: string) {
    if (!user) return;
    const name = window.prompt(`Tambah item di kategori "${category}":`);
    if (!name?.trim()) return;
    await addDoc(collection(db, "outfitItems"), { ownerUid: user.uid, category, name: name.trim(), qty: 1, bag: "Koper besar", done: false });
  }
  async function addCategory() {
    if (!user) return;
    const category = window.prompt("Nama kategori baru (misal: Baju renang):");
    if (!category?.trim()) return;
    await addDoc(collection(db, "outfitItems"), { ownerUid: user.uid, category: category.trim(), name: category.trim(), qty: 1, bag: "Koper besar", done: false });
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
  const profileRef = useLatest(profile);

  useEffect(() => {
    if (!user) return;
    // sorted client-side, so this query needs no composite index
    const q = query(collection(db, "suppliesItems"), where("ownerUid", "==", user.uid));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SuppliesItem).sort((a, b) => a.name.localeCompare(b.name, "id")));
      seedOnce(
        snap,
        user.uid,
        profileRef.current,
        "supplies",
        "suppliesItems",
        DEFAULT_SUPPLIES.map((name) => ({ ownerUid: user.uid, name, checked: false })),
        seeding
      ).catch(() => {});
    });
  }, [user, profileRef]);

  async function toggle(item: SuppliesItem) {
    await updateDoc(doc(db, "suppliesItems", item.id), { checked: !item.checked });
  }
  async function remove(item: SuppliesItem) {
    await deleteDoc(doc(db, "suppliesItems", item.id));
  }
  async function addItem() {
    if (!user) return;
    const name = window.prompt("Tambah keperluan:");
    if (!name?.trim()) return;
    await addDoc(collection(db, "suppliesItems"), { ownerUid: user.uid, name: name.trim(), checked: false });
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
