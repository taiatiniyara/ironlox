"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { isAuthenticated, isAuthRestored } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthRestored) return;
    if (isAuthenticated) {
      router.replace("/vault");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, isAuthRestored, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <img src="/logo-icon.svg" alt="Ironlox" className="size-10 animate-pulse" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
