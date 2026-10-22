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
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthProvider";
import { useGroup } from "@/lib/useGroup";
import type { Document } from "@/lib/types";

export default function DokumenPage() {
  const { user } = useAuth();
  const { group } = useGroup();
  const [tab, setTab] = useState<"personal" | "group">("personal");
  const [docs, setDocs] = useState<Document[]>([]);
  const [driveLink, setDriveLink] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q =
      tab === "personal"
        ? query(collection(db, "documents"), where("ownerUid", "==", user.uid), where("groupId", "==", null), orderBy("createdAt", "desc"))
        : query(collection(db, "documents"), where("groupId", "==", group?.id ?? "__none__"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setDocs(snap.docs.map((d) => d.data() as Document)),
      () => setDocs([])
    );
    return () => unsub();
  }, [user, group?.id, tab]);

  async function handleAddDriveLink() {
    if (!user || !driveLink.trim()) return;
    await addDoc(collection(db, "documents"), {
      ownerUid: user.uid,
      groupId: tab === "group" ? group?.id ?? null : null,
      name: "Dokumen baru",
      category: "lainnya",
      sourceType: "drive_link",
      url: driveLink.trim(),
      createdAt: serverTimestamp(),
    });
    setDriveLink("");
  }

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const path = `documents/${user.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "documents"), {
        ownerUid: user.uid,
        groupId: tab === "group" ? group?.id ?? null : null,
        name: file.name.replace(/\.pdf$/i, ""),
        category: "tiket",
        sourceType: "upload",
        url,
        createdAt: serverTimestamp(),
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const next = window.prompt("Nama dokumen baru:", currentName);
    if (!next || !next.trim()) return;
    await updateDoc(doc(db, "documents", id), { name: next.trim() });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus dokumen ini?")) return;
    await deleteDoc(doc(db, "documents", id));
  }

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <h1 className="text-xl font-bold">Dokumen</h1>

      {group && (
        <div className="grid grid-cols-2 gap-1.5 bg-white rounded-[22px] p-1">
          <TabButton active={tab === "personal"} onClick={() => setTab("personal")} label="Pribadi" />
          <TabButton active={tab === "group"} onClick={() => setTab("group")} label="Group" />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {docs.length === 0 && <p className="text-sm text-kb-muted">Belum ada dokumen.</p>}
        {docs.map((d) => (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="bg-white rounded-[20px] p-3 flex items-center gap-3"
          >
            <div className="w-[42px] h-[42px] rounded-xl bg-kb-green text-kb-lime flex items-center justify-center text-[11px] font-extrabold shrink-0">
              {d.sourceType === "upload" ? "PDF" : "LINK"}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="text-sm font-bold truncate">{d.name}</div>
              <div className="text-xs text-kb-muted capitalize">
                {d.category} · {d.sourceType === "upload" ? "tersimpan di storage" : "link Google Drive"}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleRename(d.id, d.name);
              }}
              aria-label="Ubah nama"
              className="w-10 h-10 rounded-xl bg-kb-bg flex items-center justify-center"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleDelete(d.id);
              }}
              aria-label="Hapus"
              className="w-10 h-10 rounded-xl bg-kb-bg flex items-center justify-center text-red-700"
            >
              ✕
            </button>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="h-[52px] rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm flex items-center justify-center cursor-pointer">
          {uploading ? "Mengupload..." : "+ Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
        <button type="button" onClick={() => setDriveLink((v) => (v ? v : " "))} className="h-[52px] rounded-2xl border border-kb-green text-kb-green font-bold text-sm">
          Tempel link Drive
        </button>
      </div>
      {driveLink && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={driveLink.trim()}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="flex-1 h-12 rounded-2xl border border-kb-border px-4 text-sm bg-kb-card"
          />
          <button type="button" onClick={handleAddDriveLink} className="h-12 px-4 rounded-2xl bg-kb-green text-white font-bold text-sm">
            Simpan
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-[18px] font-bold text-sm ${active ? "bg-kb-lime text-kb-ink" : "text-[#3F4F44]"}`}
    >
      {label}
    </button>
  );
}
