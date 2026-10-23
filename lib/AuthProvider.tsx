"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { rowToProfile } from "./mappers";
import type { UserProfile } from "./types";

// Just the bit of the Supabase auth user every page actually reads. Keeping this instead of
// the full Supabase `User` type means every existing `user.uid` / `user?.uid` call site in the
// app keeps working unchanged.
export interface AuthUser {
  uid: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUser(uid ? { uid } : null);
      if (!uid) setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUser(uid ? { uid } : null);
      if (!uid) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(data ? rowToProfile(data) : null);
        setLoading(false);
      });

    const channel = supabase
      .channel(`profile-${user.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.uid}` },
        (payload) => {
          if (payload.eventType === "DELETE") setProfile(null);
          else setProfile(rowToProfile(payload.new as Record<string, unknown>));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
