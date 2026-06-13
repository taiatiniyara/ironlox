"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/components/admin/admin-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Shield, ArrowLeft, CheckCircle, XCircle, Calendar, Ban, Undo2, Crown } from "lucide-react";
import { toast } from "sonner";
import type { AdminUserDetailResponse } from "@ironlox/schemas";

const adminQueryKeys = {
  user: (id: string) => ["admin", "user", id] as const,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { client } = useAdmin();
  const queryClient = useQueryClient();
  const userId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.user(userId),
    queryFn: (): Promise<AdminUserDetailResponse> => client.getUser(userId),
  });

  const tierMutation = useMutation({
    mutationFn: (tier: "free" | "premium") => client.updateUserTier(userId, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Tier updated");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to update tier";
      toast.error(message);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: () => client.suspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User suspended");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to suspend user";
      toast.error(message);
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => client.unsuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User unsuspended");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to unsuspend user";
      toast.error(message);
    },
  });

  if (error) {
    const message = error instanceof Error ? error.message : "Failed to load user";
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/users")}
          className="mb-4"
        >
          <ArrowLeft className="size-4 mr-2" /> Back to Users
        </Button>
        <Card className="p-6 text-center text-destructive">{message}</Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/users")}
        className="mb-2"
      >
        <ArrowLeft className="size-4 mr-2" /> Back to Users
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.email}</h1>
          <p className="text-sm text-muted-foreground">ID: {data.id}</p>
        </div>
        <div className="flex gap-2">
          {data.tier === "free" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={tierMutation.isPending}
              onClick={() => tierMutation.mutate("premium")}
            >
              <Crown className="size-4 mr-2" />
              Make Premium
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={tierMutation.isPending}
              onClick={() => tierMutation.mutate("free")}
            >
              Downgrade to Free
            </Button>
          )}
          {data.deleted ? (
            <Button
              variant="outline"
              size="sm"
              disabled={unsuspendMutation.isPending}
              onClick={() => unsuspendMutation.mutate()}
            >
              <Undo2 className="size-4 mr-2" />
              Unsuspend
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              disabled={suspendMutation.isPending}
              onClick={() => suspendMutation.mutate()}
            >
              <Ban className="size-4 mr-2" />
              Suspend
            </Button>
          )}
        </div>
      </div>

      {data.deleted && (
        <Card className="p-4 bg-destructive/10 border-destructive/40 text-destructive text-sm">
          This account was suspended on{" "}
          {data.deletedAt ? new Date(data.deletedAt).toLocaleDateString() : "unknown date"}.
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Tier</p>
          <div className="text-lg font-semibold flex items-center gap-2">
            {data.tier === "premium" ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 gap-1">
                <Shield className="size-3" />
                Premium
              </Badge>
            ) : (
              <Badge variant="secondary">Free</Badge>
            )}
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">MFA</p>
          <div className="text-lg font-semibold">
            {data.mfaEnabled ? (
              <CheckCircle className="size-5 text-green-500" />
            ) : (
              <XCircle className="size-5 text-muted-foreground" />
            )}
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Storage</p>
          <p className="text-lg font-semibold">{formatBytes(data.attachmentUsed)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Subscription</p>
          <p className="text-lg font-semibold capitalize">{data.subscriptionStatus}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase">Created</p>
          </div>
          <p className="text-sm">{new Date(data.createdAt).toLocaleString()}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase">Updated</p>
          </div>
          <p className="text-sm">{new Date(data.updatedAt).toLocaleString()}</p>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">Attachments ({data.attachments.length})</h2>
        {data.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attachments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{formatBytes(a.size)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.contentType ?? "unknown"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">Login Events ({data.loginEvents.length})</h2>
        {data.loginEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login events recorded</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">IP Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loginEvents.slice(0, 10).map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">
                    {new Date(e.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.cityCountry}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-mono">
                    {e.ipHash.slice(0, 16)}...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
