"use client";

import { useState } from "react";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileDown, Download, AlertTriangle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { exportVaultToCsv, aesEncrypt, deriveEncryptionKey, generateSalt } from "@ironlox/crypto";

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  usePageTitle("Export");
  const { vault } = useVault();
  const [warnOpen, setWarnOpen] = useState(false);
  const [encryptedOpen, setEncryptedOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exporting, setExporting] = useState(false);

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
    toast.success("Vault exported as JSON (unencrypted)");
  }

  async function handleEncryptedExport(e: React.FormEvent) {
    e.preventDefault();
    if (!vault || !exportPassword) return;
    setExporting(true);
    try {
      const salt = generateSalt();
      const key = await deriveEncryptionKey(exportPassword, salt);
      const plaintext = JSON.stringify(vault);
      const encrypted = await aesEncrypt(plaintext, key);

      const envelope = JSON.stringify({
        version: 1,
        salt: Array.from(salt),
        data: encrypted,
      });

      downloadFile(envelope, "ironlox-export-encrypted.json", "application/json");
      toast.success("Vault exported as encrypted JSON");
      setEncryptedOpen(false);
      setExportPassword("");
    } catch {
      toast.error("Encryption failed");
    } finally {
      setExporting(false);
    }
  }

  const itemCount = vault?.items.filter((i) => !i.deleted).length ?? 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <PageHeader title="Export Vault" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Your Data</CardTitle>
          <CardDescription>
            {itemCount} items in your vault. Unencrypted exports contain your data in plaintext.
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

          <Dialog open={encryptedOpen} onOpenChange={setEncryptedOpen}>
            <DialogTrigger>
              <Button variant="outline" className="w-full justify-start gap-2">
                <LockKeyhole className="size-4" />
                Export as Encrypted JSON (AES-256-GCM)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Encrypted JSON Export</DialogTitle>
                <DialogDescription>
                  Your vault will be encrypted with AES-256-GCM using the password you choose below.
                  You will need this password to decrypt the file later.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEncryptedExport} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="export-pass">Encryption Password</Label>
                  <Input
                    id="export-pass"
                    type="password"
                    required
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Choose a strong password"
                    minLength={8}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setEncryptedOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={exportPassword.length < 8 || exporting}>
                    {exporting ? "Encrypting..." : "Encrypt & Download"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
