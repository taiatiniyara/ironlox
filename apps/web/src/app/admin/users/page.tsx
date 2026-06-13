"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/components/admin/admin-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Calendar,
  Ban,
  Undo2,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminUserListResponse, AdminUserDetailResponse } from "@ironlox/schemas";
import { useDebounce } from "@/lib/utils";

const adminQueryKeys = {
  users: (q: string, tier: string, page: number) => ["admin", "users", q, tier, page] as const,
  user: (id: string) => ["admin", "user", id] as const,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

function UserDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { client } = useAdmin();
  const queryClient = useQueryClient();

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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update tier"),
  });

  const suspendMutation = useMutation({
    mutationFn: () => client.suspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User suspended");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to suspend"),
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => client.unsuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User unsuspended");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to unsuspend"),
  });

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <Card className="p-6 text-center text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4 mr-2" />
        Back to Users
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{data.email}</h2>
          <p className="text-xs text-muted-foreground font-mono">ID: {data.id}</p>
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
          Suspended on{" "}
          {data.deletedAt ? new Date(data.deletedAt).toLocaleDateString() : "unknown date"}
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Tier</p>
          <div>
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
        <Card className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">MFA</p>
          <div>
            {data.mfaEnabled ? (
              <CheckCircle className="size-5 text-green-500" />
            ) : (
              <XCircle className="size-5 text-muted-foreground" />
            )}
          </div>
        </Card>
        <Card className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Storage</p>
          <p className="text-sm font-semibold">{formatBytes(data.attachmentUsed)}</p>
        </Card>
        <Card className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Subscription</p>
          <p className="text-sm font-semibold capitalize">{data.subscriptionStatus}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase">Created</p>
          </div>
          <p className="text-sm">{new Date(data.createdAt).toLocaleString()}</p>
        </Card>
        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase">Updated</p>
          </div>
          <p className="text-sm">{new Date(data.updatedAt).toLocaleString()}</p>
        </Card>
      </div>

      <Separator />
      <div>
        <h3 className="text-sm font-semibold mb-2">Attachments ({data.attachments.length})</h3>
        {data.attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
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
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell className="text-sm">{formatBytes(a.size)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.contentType ?? "unknown"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
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
        <h3 className="text-sm font-semibold mb-2">Login Events ({data.loginEvents.length})</h3>
        {data.loginEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
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

export default function AdminUsersPage() {
  const { client } = useAdmin();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.users(debouncedSearch, tierFilter, page),
    queryFn: (): Promise<AdminUserListResponse> => {
      const params: Record<string, string | number> = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (tierFilter) params.tier = tierFilter;
      params.page = page;
      params.limit = 20;
      return client.getUsers(params);
    },
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  if (selectedUserId) {
    return (
      <div className="p-6">
        <UserDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={tierFilter}
          onValueChange={(v) => {
            setTierFilter(v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All users</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="p-6 text-center text-destructive">
          {error instanceof Error ? error.message : "Failed to load users"}
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
              {data.users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.deleted ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : user.tier === "premium" ? (
                      <Badge className="bg-yellow-500/20 text-yellow-400 gap-1">
                        <Shield className="size-3" />
                        Premium
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Free</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {user.mfaEnabled ? (
                            <CheckCircle className="size-4 text-green-500" />
                          ) : (
                            <XCircle className="size-4 text-muted-foreground" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {user.mfaEnabled ? "MFA enabled" : "MFA not enabled"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatBytes(user.attachmentUsed)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.total} user{data.total !== 1 ? "s" : ""} total
            </p>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
