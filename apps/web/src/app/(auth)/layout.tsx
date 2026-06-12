"use client";

import { GuestGuard } from "@/components/auth-guard";
import { LogoImage } from "@/components/shared/logo-image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <LogoImage className="h-7 w-auto" />
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </GuestGuard>
  );
}
