"use client";

import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "@/components/admin/admin-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users, HardDrive, TrendingUp, KeyRound, Activity } from "lucide-react";
import type { AdminStatsResponse } from "@ironlox/schemas";

const adminQueryKeys = {
  stats: ["admin", "stats"] as const,
};

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function AdminDashboardPage() {
  const { client } = useAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.stats,
    queryFn: (): Promise<AdminStatsResponse> => client.getStats(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (error) {
    const message = error instanceof Error ? error.message : "Failed to load stats";
    return (
      <div className="p-6">
        <Card className="p-6 text-center text-destructive">{message}</Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <span className="text-xs text-muted-foreground">Auto-refreshes every 60s</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.totalUsers} icon={Users} />
        <StatCard label="Premium" value={data.premiumUsers} icon={Shield} />
        <StatCard label="Free" value={data.freeUsers} icon={Users} />
        <StatCard label="Suspended" value={data.suspendedUsers} icon={Shield} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Signups Today" value={data.signupsToday} icon={TrendingUp} />
        <StatCard label="Signups (Week)" value={data.signupsThisWeek} icon={TrendingUp} />
        <StatCard label="Signups (Month)" value={data.signupsThisMonth} icon={TrendingUp} />
        <StatCard label="Login Events Today" value={data.loginEventsToday} icon={Activity} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Attachment Storage"
          value={formatBytes(data.totalAttachmentBytes)}
          icon={HardDrive}
        />
        <StatCard
          label="Premium Rate"
          value={`${data.totalUsers > 0 ? Math.round((data.premiumUsers / data.totalUsers) * 100) : 0}%`}
          icon={KeyRound}
          sub={`${data.premiumUsers} of ${data.totalUsers} users`}
        />
      </div>
    </div>
  );
}
