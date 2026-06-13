"use client";

import { useState } from "react";
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
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { useDebounce } from "@/lib/utils";

const adminQueryKeys = {
  auditLog: (action: string, q: string, page: number) =>
    ["admin", "auditLog", action, q, page] as const,
};

const ACTION_LABELS: Record<string, string> = {
  tier_change: "Tier Change",
  user_suspend: "Suspend",
  user_unsuspend: "Unsuspend",
  feature_flag_update: "Flag Update",
};

export default function AdminAuditLogPage() {
  const { client } = useAdmin();
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.auditLog(actionFilter, debouncedSearch, page),
    queryFn: () => {
      const params: Record<string, string | number> = {};
      if (actionFilter) params.action = actionFilter;
      if (debouncedSearch) params.q = debouncedSearch;
      params.page = page;
      params.limit = 20;
      return client.getAuditLog(params);
    },
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Audit Log</h1>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by target..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All actions</SelectItem>
            <SelectItem value="tier_change">Tier Change</SelectItem>
            <SelectItem value="user_suspend">Suspend</SelectItem>
            <SelectItem value="user_unsuspend">Unsuspend</SelectItem>
            <SelectItem value="feature_flag_update">Flag Update</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="p-6 text-center text-destructive">
          {error instanceof Error ? error.message : "Failed to load audit log"}
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
                <TableHead className="w-40">Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right w-48">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <ScrollText className="size-8 mx-auto mb-2 opacity-30" />
                    No audit entries found
                  </TableCell>
                </TableRow>
              )}
              {data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{entry.targetType}: </span>
                      <span className="font-mono text-xs">{entry.targetId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground font-mono max-w-xs truncate block">
                      {entry.details ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.total} entr{data.total !== 1 ? "ies" : "y"} total
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
