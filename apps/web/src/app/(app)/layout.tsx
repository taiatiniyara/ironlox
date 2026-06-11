"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useVault } from "@/lib/vault-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Lock,
  Plus,
  Settings,
  Shield,
  FolderOpen,
  Upload,
  Download,
  Paperclip,
} from "lucide-react";

const navItems = [
  { href: "/vault", label: "Vault", icon: FolderOpen },
  { href: "/add", label: "Add Item", icon: Plus },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/export", label: "Export", icon: Download },
  { href: "/attachments", label: "Files", icon: Paperclip },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

function AppSidebar() {
  const { email, logout, isSyncing } = useVault();
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-primary" />
          <span className="font-semibold text-sm">Ironlox</span>
        </div>
        {email && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{email}</p>
        )}
        {isSyncing && (
          <p className="text-[10px] text-muted-foreground animate-pulse mt-0.5">
            Syncing...
          </p>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="size-4 mr-3" />
          Lock Vault
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <aside className="w-56 border-r border-border bg-card shrink-0 hidden md:flex flex-col">
          <AppSidebar />
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
