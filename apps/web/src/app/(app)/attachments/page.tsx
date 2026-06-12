"use client";

import { useRef, useState, useEffect } from "react";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Paperclip, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
}

export default function AttachmentsPage() {
  usePageTitle("Attachments");
  const { apiClient } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [quota, setQuota] = useState({ used: 0, total: 250 });
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!apiClient) return;
    let cancelled = false;
    apiClient
      .getAccount()
      .then((acct) => {
        if (cancelled) return;
        setQuota({ used: acct.attachmentUsed || 0, total: acct.attachmentQuota || 250 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !apiClient) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File exceeds 25MB limit");
      return;
    }
    setUploading(true);
    try {
      const id = crypto.randomUUID();
      const buffer = await file.arrayBuffer();
      await apiClient.uploadAttachment(id, buffer);
      setFiles((prev) => [...prev, { id, name: file.name, size: file.size }]);
      setQuota((prev) => ({ ...prev, used: prev.used + Math.round(file.size / (1024 * 1024)) }));
      toast.success(`${file.name} uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string, name: string, size: number) {
    if (!apiClient) return;
    try {
      await apiClient.deleteAttachment(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setQuota((prev) => ({
        ...prev,
        used: Math.max(0, prev.used - Math.round(size / (1024 * 1024))),
      }));
      toast.success(`${name} deleted`);
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleDownload(id: string) {
    if (!apiClient) return;
    try {
      const { attachmentUrl } = await apiClient.getAttachmentUrl(id);
      window.open(attachmentUrl, "_blank");
    } catch {
      toast.error("Download failed");
    }
  }

  const usagePercent = quota.total > 0 ? Math.round((quota.used / quota.total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <PageHeader title="File Attachments" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage</CardTitle>
          <CardDescription>
            {quota.used}MB of {quota.total}MB used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={usagePercent} className="h-2" />
          <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
          <LoadingButton
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileRef.current?.click()}
            loading={uploading}
            loadingText="Uploading..."
          >
            <Upload className="size-4" />
            Upload File (max 25MB)
          </LoadingButton>
        </CardContent>
      </Card>

      {files.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-1">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <Paperclip className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleDownload(f.id)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => handleDelete(f.id, f.name, f.size)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Paperclip className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No file attachments yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Attach files up to 25MB each. 250MB free, 2GB with Premium.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
