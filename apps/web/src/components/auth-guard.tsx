"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isVaultLoaded } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  if (!isVaultLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Decrypting vault...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/vault");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
