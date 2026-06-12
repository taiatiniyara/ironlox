"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingState({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <img src="/logo-icon.svg" alt="Ironlox" className="size-10 animate-pulse" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthRestored, isVaultLoaded } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (isAuthRestored && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthRestored, isAuthenticated, router]);

  if (!isAuthRestored) {
    return <LoadingState label="Restoring session..." />;
  }

  if (!isAuthenticated) {
    return <LoadingState label="Redirecting..." />;
  }

  if (!isVaultLoaded) {
    return <LoadingState label="Decrypting vault..." />;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthRestored } = useVault();
  const router = useRouter();

  useEffect(() => {
    if (isAuthRestored && isAuthenticated) {
      router.push("/vault");
    }
  }, [isAuthRestored, isAuthenticated, router]);

  if (!isAuthRestored) {
    return <LoadingState label="Restoring session..." />;
  }

  if (isAuthenticated) {
    return <LoadingState label="Redirecting..." />;
  }

  return <>{children}</>;
}
