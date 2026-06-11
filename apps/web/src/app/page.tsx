"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";

export default function Home() {
  const { isAuthenticated } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/vault");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
