import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SkipToContent } from "@/components/skip-to-content";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ironlox",
  description: "Zero-knowledge password manager",
  icons: { icon: "/logo-icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <SkipToContent />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
