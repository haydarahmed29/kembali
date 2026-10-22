"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { createGroup, joinGroupByCode } from "@/lib/group";

export default function ModePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [joinCode, setJoinCode] = useState("");
  const [groupName, setGroupName] = useState("Trip Bali");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  async function handleJoin() {
    if (!user || !joinCode.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await joinGroupByCode(user.uid, profile?.displayName ?? "Seseorang", joinCode);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal join group.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const { code } = await createGroup(user.uid, groupName.trim() || "Trip Bali");
      setCreatedCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bikin group.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueSolo() {
    router.push("/home");
  }

  if (profile?.groupId && !createdCode) {
    return (
      <div className="min-h-dvh flex flex-col p-5 gap-4 justify-center">
        <h1 className="m-0 text-[24px] font-extrabold tracking-tight">Kamu udah di group trip.</h1>
        <p className="m-0 text-sm text-kb-muted">Kalau mau pindah group, keluar dulu dari group sekarang lewat halaman Profil.</p>
        <button type="button" onClick={() => router.push("/home")} className="h-[54px] rounded-full bg-kb-lime text-kb-ink font-bold text-base">
          Ke Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col p-5 gap-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-kb-green text-kb-lime flex items-center justify-center font-extrabold">
          {(profile?.displayName ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[13px] text-kb-muted">Halo,</div>
          <div className="text-lg font-bold">{profile?.displayName ?? "..."}</div>
        </div>
      </div>

      <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Mau ke Bali gimana?</h1>

      <button
        type="button"
        onClick={() => setMode("solo")}
        className={`bg-white rounded-3xl p-4.5 flex items-center gap-3.5 text-left border-2 ${mode === "solo" ? "border-kb-green" : "border-white"}`}
      >
        <div className="w-13 h-13 rounded-2xl bg-kb-bg flex items-center justify-center text-kb-green shrink-0">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="font-bold text-[17px]">Solo Trip</div>
          <div className="text-[13px] text-kb-muted">Rencana pribadi, cuma kamu yang lihat</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setMode("group")}
        className={`rounded-3xl p-4.5 flex flex-col gap-4 text-left ${mode === "group" ? "bg-kb-green text-white" : "bg-white"}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-kb-lime flex items-center justify-center text-kb-green shrink-0">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
              <circle cx="17" cy="9" r="2.8" />
              <path d="M17.5 14.5c2.5.3 4 2 4 4.5" />
            </svg>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="font-bold text-[17px]">Group Trip</div>
            <div className={`text-[13px] ${mode === "group" ? "text-[#C9D6C4]" : "text-kb-muted"}`}>Itinerary & budget bareng temen</div>
          </div>
        </div>
      </button>

      {mode === "group" && (
        <div className="bg-kb-green rounded-3xl p-4.5 flex flex-col gap-4 text-white -mt-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="join-code" className="text-[13px] font-semibold text-kb-lime">
              Punya kode group?
            </label>
            <div className="flex gap-2">
              <input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="KB-7X2Q"
                autoCapitalize="characters"
                autoCorrect="off"
                className="flex-1 min-w-0 h-[50px] rounded-2xl px-4 text-base font-bold tracking-widest bg-kb-green-light text-white placeholder:text-[#9FB49A]"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={loading || !joinCode.trim()}
                className="h-[50px] px-5 rounded-2xl bg-kb-lime text-kb-ink font-bold text-sm disabled:opacity-60"
              >
                {loading ? "..." : "Gabung"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-[#C9D6C4] text-xs">
            <div className="flex-1 h-px bg-kb-green-light" />
            atau
            <div className="flex-1 h-px bg-kb-green-light" />
          </div>

          <div className="bg-kb-green-light rounded-2xl p-3.5 flex flex-col gap-2.5">
            {!createdCode ? (
              <>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nama trip, misal: Bali Squad"
                  className="h-11 rounded-xl px-3.5 bg-kb-green text-white text-sm placeholder:text-[#9FB49A]"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={loading}
                  className="h-11 rounded-xl bg-kb-lime text-kb-ink font-bold text-sm disabled:opacity-60"
                >
                  Bikin group baru
                </button>
              </>
            ) : (
              <>
                <div className="text-[13px] text-[#C9D6C4]">Group dibuat! Bagikan kode ini ke temen-temen:</div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(createdCode).catch(() => {})}
                    className="text-2xl font-extrabold tracking-[4px] text-kb-lime"
                    aria-label="Salin kode"
                  >
                    {createdCode}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/home")}
                    className="h-11 px-4 rounded-xl bg-kb-lime text-kb-ink font-bold text-sm"
                  >
                    Lanjut
                  </button>
                </div>
                <div className="text-[11px] text-[#C9D6C4]">Ketuk kodenya buat salin.</div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex-1" />

      {mode === "solo" && (
        <button type="button" onClick={handleContinueSolo} className="h-[54px] rounded-full bg-kb-lime text-kb-ink font-bold text-base">
          Lanjut
        </button>
      )}
    </div>
  );
}
