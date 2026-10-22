"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-dvh flex items-center justify-center text-kb-muted text-sm">Memuat...</div>;
  }

  return (
    <div className="min-h-dvh pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
