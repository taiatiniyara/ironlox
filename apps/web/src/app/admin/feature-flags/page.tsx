"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/components/admin/admin-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Flag, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const adminQueryKeys = {
  featureFlags: ["admin", "featureFlags"] as const,
};

export default function AdminFeatureFlagsPage() {
  const { client } = useAdmin();
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("true");

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.featureFlags,
    queryFn: () => client.getFeatureFlags(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      client.updateFeatureFlag(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.featureFlags });
      queryClient.invalidateQueries({ queryKey: ["admin", "auditLog"] });
      toast.success("Flag updated");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to update flag";
      toast.error(message);
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      client.updateFeatureFlag(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.featureFlags });
      toast.success("Flag created");
      setNewKey("");
      setNewValue("true");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to create flag";
      toast.error(message);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Feature Flags</h1>

      {error && (
        <Card className="p-6 text-center text-destructive">
          {error instanceof Error ? error.message : "Failed to load feature flags"}
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Toggle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.flags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    <Flag className="size-8 mx-auto mb-2 opacity-30" />
                    No feature flags configured
                  </TableCell>
                </TableRow>
              )}
              {data.flags.map((flag) => (
                <TableRow key={flag.key}>
                  <TableCell className="font-medium font-mono text-sm">{flag.key}</TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        flag.value === "true"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {flag.value}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={flag.value === "true"}
                      disabled={updateMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ key: flag.key, value: checked ? "true" : "false" })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator label="Create Flag" />

          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs space-y-1">
              <label className="text-xs text-muted-foreground">Key</label>
              <Input
                placeholder="my_feature"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs text-muted-foreground">Value</label>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <Button
              size="sm"
              disabled={!newKey.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ key: newKey.trim(), value: newValue })}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Create
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
