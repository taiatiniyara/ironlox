"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { useAccountQuery } from "@/hooks/queries/use-account";
import { useUploadAttachmentMutation } from "@/hooks/mutations/use-upload-attachment";
import { useDeleteAttachmentMutation } from "@/hooks/mutations/use-delete-attachment";
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
  const { t } = useTranslation();
  const { apiClient } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);

  const { data: account } = useAccountQuery();
  const uploadMutation = useUploadAttachmentMutation();
  const deleteMutation = useDeleteAttachmentMutation();

  const quota = {
    used: account?.attachmentUsed ?? 0,
    total: account?.attachmentQuota ?? 250,
  };

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t("attachments.fileTooBig"));
      return;
    }
    const id = crypto.randomUUID();
    const buffer = await file.arrayBuffer();
    uploadMutation.mutate(
      { id, buffer },
      {
        onSuccess: () => {
          setFiles((prev) => [...prev, { id, name: file.name, size: file.size }]);
          toast.success(t("attachments.uploaded", { name: file.name }));
        },
        onError: () => toast.error(t("attachments.uploadFailed")),
        onSettled: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  function handleDelete(id: string, name: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        toast.success(t("attachments.deleted", { name }));
      },
      onError: () => toast.error(t("attachments.deleteFailed")),
    });
  }

  async function handleDownload(id: string) {
    if (!apiClient) return;
    try {
      const { attachmentUrl } = await apiClient.getAttachmentUrl(id);
      window.open(attachmentUrl, "_blank");
    } catch {
      toast.error(t("attachments.downloadFailed"));
    }
  }

  const usagePercent = quota.total > 0 ? Math.round((quota.used / quota.total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <PageHeader title={t("attachments.title")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("attachments.storage")}</CardTitle>
          <CardDescription>
            {t("attachments.mbUsed", { used: quota.used, total: quota.total })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={usagePercent} className="h-2" />
          <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
          <LoadingButton
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileRef.current?.click()}
            loading={uploadMutation.isPending}
            loadingText={t("attachments.uploading")}
          >
            <Upload className="size-4" />
            {t("attachments.upload")}
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
                    onClick={() => handleDelete(f.id, f.name)}
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
            <p className="text-sm text-muted-foreground">{t("attachments.noFiles")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("attachments.noFilesDesc")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
