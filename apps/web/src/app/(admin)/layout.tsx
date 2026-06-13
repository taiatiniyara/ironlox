"use client";

import { AdminProvider } from "@/components/admin/admin-context";
import AdminLayout from "@/components/admin/admin-layout";

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminProvider>
  );
}
