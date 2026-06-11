"use client";

import { AuthGuard } from "@/components/auth-guard";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </AuthGuard>
  );
}
