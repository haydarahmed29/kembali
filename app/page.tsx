"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usernameToFakeEmail } from "@/lib/usernameAuth";
import { useAuth } from "@/lib/AuthProvider";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // already signed in (e.g. opening the installed app from the Home Screen) → straight in
  useEffect(() => {
    if (!authLoading && user) router.replace("/home");
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToFakeEmail(username),
        password,
      });
      if (signInError) throw signInError;
      router.push("/home");
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "";
      setError(
        /rate limit|too many/i.test(message)
          ? "Kebanyakan coba. Tunggu sebentar lalu coba lagi."
          : /network|fetch/i.test(message)
            ? "Koneksi internet bermasalah."
            : "Username atau password salah."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col p-4 gap-4">
      <div className="flex-1 bg-kb-green rounded-[32px] p-7 flex flex-col justify-between text-white relative overflow-hidden min-h-[260px]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[14px] bg-kb-lime text-kb-green flex items-center justify-center font-extrabold text-xl">K</div>
          <div className="font-extrabold text-xl tracking-tight">Kem.Bali</div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="self-start bg-kb-green-light text-kb-lime text-[13px] font-semibold px-3.5 py-2 rounded-full">
            Trip planner buat rame-rame
          </div>
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            Rencanain bareng,
            <br />
            biar <span className="text-kb-lime">Kem.Bali</span> lagi.
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-[28px] p-5 flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1.5 bg-kb-bg rounded-[22px] p-1">
          <div className="h-10 rounded-[18px] bg-kb-green text-white flex items-center justify-center font-bold text-sm">Masuk</div>
          <Link href="/daftar" className="h-10 rounded-[18px] text-[#3F4F44] flex items-center justify-center font-semibold text-sm">
            Daftar
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-[13px] font-semibold text-[#3F4F44]">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoCapitalize="none"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="rani.bali"
              className="h-12 border border-kb-border rounded-2xl px-4 text-[15px] bg-kb-card"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pw" className="text-[13px] font-semibold text-[#3F4F44]">
              Password
            </label>
            <input
              id="pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="h-12 border border-kb-border rounded-2xl px-4 text-[15px] bg-kb-card"
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-[52px] rounded-full bg-kb-lime text-kb-ink font-bold text-base disabled:opacity-60"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
          <p className="text-center text-[13px] text-kb-muted">
            Belum punya akun?{" "}
            <Link href="/daftar" className="font-bold">
              Daftar di sini
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
