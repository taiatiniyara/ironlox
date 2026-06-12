"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Download, FileDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { exportVaultToCsv } from "@ironlox/crypto";

export default function ExportPage() {
  usePageTitle("Export");
  const { vault } = useVault();
  const router = useRouter();
  const [warnOpen, setWarnOpen] = useState(false);

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvExport() {
    if (!vault) return;
    const csv = exportVaultToCsv(vault);
    downloadFile(csv, "ironlox-export.csv", "text/csv");
    toast.success("Vault exported as CSV");
    setWarnOpen(false);
  }

  function handleJsonExport() {
    if (!vault) return;
    const json = JSON.stringify(vault, null, 2);
    downloadFile(json, "ironlox-export.json", "application/json");
    toast.success("Vault exported as JSON");
    setWarnOpen(false);
  }

  const itemCount = vault?.items.filter((i) => !i.deleted).length ?? 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/vault")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Export Vault</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Your Data</CardTitle>
          <CardDescription>
            {itemCount} items in your vault. Exported files are not encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
            <DialogTrigger>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileDown className="size-4" />
                Export as CSV (plaintext)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  Security Warning
                </DialogTitle>
                <DialogDescription>
                  The exported CSV file will contain your passwords in plaintext. Anyone with access
                  to this file can read all your secrets. Store it securely and delete it after use.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWarnOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCsvExport}>Download CSV</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleJsonExport}
          >
            <Download className="size-4" />
            Export as JSON (unencrypted)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
