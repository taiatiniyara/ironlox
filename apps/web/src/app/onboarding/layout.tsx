"use client";

import { AuthGuard } from "@/components/auth-guard";
import { LogoImage } from "@/components/shared/logo-image";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <LogoImage className="h-7 w-auto" />
        <div className="w-full max-w-md">{children}</div>
      </div>
    </AuthGuard>
  );
}
