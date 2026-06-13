"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import type { AdminUserListResponse } from "@ironlox/schemas";
import { useDebounce } from "@/lib/utils";

const adminQueryKeys = {
  users: (q: string, tier: string, page: number) => ["admin", "users", q, tier, page] as const,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function AdminUsersPage() {
  const { client } = useAdmin();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
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
                  onClick={() => router.push(`/admin/users/${user.id}`)}
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
                    {user.mfaEnabled ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCircle className="size-4 text-green-500" />
                          </TooltipTrigger>
                          <TooltipContent>MFA enabled</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <XCircle className="size-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>MFA not enabled</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
