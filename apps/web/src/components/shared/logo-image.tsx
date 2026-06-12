"use client";

import { useTheme } from "next-themes";

export function LogoImage({ className = "h-7 w-auto" }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={resolvedTheme === "light" ? "/logo-dark.svg" : "/logo.svg"}
      alt="Ironlox"
      className={className}
    />
  );
}
