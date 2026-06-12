"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useTheme } from "next-themes";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <img
          src={resolvedTheme === "light" ? "/logo-dark.svg" : "/logo.svg"}
          alt="Ironlox"
          className="h-7 w-auto"
        />
        <div className="w-full max-w-md">{children}</div>
      </div>
    </AuthGuard>
  );
}
