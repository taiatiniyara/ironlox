"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { AdminGuard } from "./admin-guard";
import { useAdmin } from "./admin-context";
import { LogoImage } from "@/components/shared/logo-image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, LayoutDashboard, Users, ScrollText, Flag } from "lucide-react";

function AdminSidebar() {
  const { logout } = useAdmin();
  const pathname = usePathname();

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
    { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border">
        <LogoImage className="h-5 w-auto" />
        <p className="text-xs text-muted-foreground mt-1">Admin Portal</p>
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
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function AdminContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r border-border bg-card shrink-0 hidden md:flex flex-col">
        <AdminSidebar />
      </aside>
      <main id="main-content" className="flex-1 overflow-auto">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex flex-col h-full p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full animate-pulse" />
                ))}
              </div>
            }
          >
            <div className="page-enter">{children}</div>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AdminGuard>
      <AdminContent>{children}</AdminContent>
    </AdminGuard>
  );
}
