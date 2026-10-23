"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rowToDocument } from "@/lib/mappers";
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
    const load = () => {
      const q =
        tab === "personal"
          ? supabase.from("documents").select("*").eq("owner_uid", user.uid).is("group_id", null).order("created_at", { ascending: false })
          : supabase.from("documents").select("*").eq("group_id", group?.id ?? "__none__").order("created_at", { ascending: false });
      q.then(({ data }) => setDocs(data ? data.map(rowToDocument) : []));
    };
    load();

    const filter = tab === "personal" ? `owner_uid=eq.${user.uid}` : `group_id=eq.${group?.id ?? "__none__"}`;
    const channel = supabase
      .channel(`documents-${tab}-${tab === "personal" ? user.uid : (group?.id ?? "none")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, group?.id, tab]);

  async function handleAddDriveLink() {
    const link = driveLink.trim();
    if (!user || !link) return;
    if (!/^https?:\/\//i.test(link)) {
      window.alert("Link-nya harus diawali https:// ya.");
      return;
    }
    const name = window.prompt("Nama dokumen (misal: Tiket pesawat berangkat):", "Dokumen baru");
    if (name === null) return;
    await supabase.from("documents").insert({
      owner_uid: user.uid,
      group_id: tab === "group" ? (group?.id ?? null) : null,
      name: name.trim() || "Dokumen baru",
      category: "lainnya",
      source_type: "drive_link",
      url: link,
      storage_path: null,
    });
    setDriveLink("");
  }

  async function handleUpload(file: File) {
    if (!user) return;
    if (file.type !== "application/pdf") {
      window.alert("Cuma bisa upload file PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      window.alert("Maksimal 20 MB per file.");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${user.uid}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      await supabase.from("documents").insert({
        owner_uid: user.uid,
        group_id: tab === "group" ? (group?.id ?? null) : null,
        name: file.name.replace(/\.pdf$/i, ""),
        category: "tiket",
        source_type: "upload",
        url: urlData.publicUrl,
        storage_path: path,
      });
    } catch {
      window.alert("Upload gagal. Cek koneksi lalu coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const next = window.prompt("Nama dokumen baru:", currentName);
    if (!next || !next.trim()) return;
    await supabase.from("documents").update({ name: next.trim() }).eq("id", id);
  }

  async function handleDelete(d: Document) {
    if (!window.confirm(`Hapus "${d.name}"?`)) return;
    await supabase.from("documents").delete().eq("id", d.id);
    if (d.storagePath) {
      // also free up the PDF in Storage; ignore if it's already gone
      await supabase.storage.from("documents").remove([d.storagePath]).catch(() => {});
    }
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
            {d.ownerUid === user?.uid && (
            <>
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
                handleDelete(d);
              }}
              aria-label="Hapus"
              className="w-10 h-10 rounded-xl bg-kb-bg flex items-center justify-center text-red-700"
            >
              ✕
            </button>
            </>
            )}
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
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow picking the same file again later
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
