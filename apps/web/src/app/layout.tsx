import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ironlox",
  description: "Zero-knowledge password manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
