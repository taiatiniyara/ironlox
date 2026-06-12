"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { importExportCsv } from "@ironlox/crypto";
import type { VaultItem } from "@ironlox/schemas";

const CSV_TEMPLATE =
  "type,name,uri,username,password,notes,tags\nlogin,Example,https://example.com,user@example.com,mypassword,Optional notes,work;personal\ncard,My Card,,,,4111111111111111,,\nnote,Secure Note,,,,Some secret content,\nidentity,John Doe,,john@email.com,,,555-0100,";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ironlox-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  usePageTitle("Import");
  const { bulkAddItems } = useVault();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<VaultItem[]>([]);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const items = importExportCsv(text).map((item, i) => ({
          ...item,
          id: `import-${i}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          folderId: null,
        })) as VaultItem[];
        setPreview(items);
        toast.success(`Parsed ${items.length} items`);
      } catch {
        toast.error("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    const items = preview.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
    await bulkAddItems(items);
    toast.success(`Imported ${items.length} items`);
    setImporting(false);
    router.push("/vault");
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <PageHeader title="Import Passwords" />

      {preview.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Upload className="size-8 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Import from 1Password, Bitwarden, LastPass, or Chrome. Expected columns: type, name,
              uri, username, password, notes, tags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <Button className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4 mr-2" />
              Choose CSV File
            </Button>
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="size-4 mr-2" />
              Download Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{preview.length} items ready to import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-64 overflow-auto space-y-1">
              {preview.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0"
                >
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.type}
                  </Badge>
                  <span className="truncate flex-1">{item.name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPreview([])}>
                Cancel
              </Button>
              <LoadingButton
                className="flex-1"
                onClick={handleImport}
                loading={importing}
                loadingText="Importing..."
              >
                Import {preview.length} Items
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
