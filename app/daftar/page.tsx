"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isValidUsername, normalizeUsername, usernameToFakeEmail } from "@/lib/usernameAuth";
import type { Gender } from "@/lib/types";

export default function DaftarPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("female");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUsername(username);
    if (!isValidUsername(username)) {
      setError("Username 3-24 karakter, huruf kecil/angka/titik/garis bawah aja.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);
    try {
      const { data: available, error: checkError } = await supabase.rpc("username_available", {
        p_username: normalized,
      });
      if (checkError) throw checkError;
      if (!available) {
        setError("Username udah dipakai, coba yang lain.");
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: usernameToFakeEmail(normalized),
        password,
      });
      if (signUpError) throw signUpError;
      const uid = signUpData.user?.id;
      if (!uid) throw new Error("Gagal daftar, coba lagi.");

      const { error: insertError } = await supabase.from("profiles").insert({
        id: uid,
        username: normalized,
        display_name: displayName.trim() || normalized,
        gender,
        group_id: null,
        role: null,
        departure_date: null,
        share_location: false,
        seeded: {},
      });
      if (insertError) throw insertError;

      router.push("/mode");
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "";
      setError(
        /already registered|duplicate/i.test(message)
          ? "Username udah dipakai, coba yang lain."
          : /network|fetch/i.test(message)
            ? "Koneksi internet bermasalah."
            : /password/i.test(message)
              ? "Password terlalu lemah, minimal 6 karakter."
              : "Gagal daftar, coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col p-5 gap-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Kembali" className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="font-bold text-base">Daftar</div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight leading-tight">
          Bikin akun dulu, biar packing-nya kesimpen.
        </h1>
        <p className="m-0 text-sm text-kb-muted">Cukup sekali. Habis ini langsung pilih trip.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[28px] p-5 flex flex-col gap-3.5">
        <Field label="Nama panggilan" value={displayName} onChange={setDisplayName} placeholder="Rani" />
        <Field label="Username" value={username} onChange={setUsername} placeholder="rani.bali" autoCapitalize="none" />
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

        <fieldset className="border-0 p-0 flex flex-col gap-2">
          <legend className="text-[13px] font-semibold text-[#3F4F44] mb-2">Gender</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {(["female", "male"] as Gender[]).map((g) => (
              <label
                key={g}
                className={`h-[52px] rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer ${
                  gender === g ? "bg-kb-green text-white" : "bg-kb-card border border-kb-border"
                }`}
              >
                <input type="radio" name="gender" className="accent-kb-green" checked={gender === g} onChange={() => setGender(g)} />
                {g === "female" ? "Perempuan" : "Laki-laki"}
              </label>
            ))}
          </div>
          <p className="m-0 text-xs text-kb-muted">Dipakai buat nyiapin template outfit otomatis.</p>
        </fieldset>

        <p className="m-0 text-xs text-kb-muted">Inget-inget password-nya ya — nggak ada reset lewat email, harus minta tolong admin trip.</p>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-[54px] rounded-full bg-kb-lime text-kb-ink font-bold text-base disabled:opacity-60"
        >
          {loading ? "Mendaftar..." : "Daftar & lanjut"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoCapitalize?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[#3F4F44]">{label}</label>
      <input
        type="text"
        required
        autoCapitalize={autoCapitalize}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 border border-kb-border rounded-2xl px-4 text-[15px] bg-kb-card"
      />
    </div>
  );
}
