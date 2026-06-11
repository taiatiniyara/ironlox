"use client";

import { VaultProvider } from "@/lib/vault-context";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          {children}
          <Toaster position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </VaultProvider>
  );
}
