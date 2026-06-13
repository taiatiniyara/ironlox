"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useVault } from "@/lib/vault-context";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordInput } from "@/components/vault/password-input";
import { TotpDisplay } from "@/components/vault/totp-display";
import { toast } from "sonner";
import {
  Globe,
  CreditCard,
  FileText,
  User,
  Pencil,
  LinkIcon,
  Key,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import type {
  VaultItem,
  LoginFields,
  CardFields,
  IdentityFields,
  NoteFields,
} from "@ironlox/schemas";

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  login: Globe,
  card: CreditCard,
  note: FileText,
  identity: User,
};

export const ItemDetailView = memo(function ItemDetailView({
  item,
  onBack,
}: {
  item: VaultItem;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { removeItem } = useVault();
  const router = useRouter();
  const Icon = categoryIcons[item.type] ?? FileText;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const typeLabels: Record<string, string> = {
    login: t("vault.typeLogin"),
    card: t("vault.typeCard"),
    note: t("vault.typeNote"),
    identity: t("vault.typeIdentity"),
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeItem(item.id);
      toast.success(t("vault.itemDeleted"), {
        action: { label: t("common.undo"), onClick: () => onBack() },
      });
      setDeleteOpen(false);
      onBack();
    } catch {
      toast.error(t("vault.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Icon className="size-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{item.name}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">
              {typeLabels[item.type] ?? item.type}
            </Badge>
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/vault?edit=${item.id}`)}>
          <Pencil className="size-3.5 mr-1" />
          {t("common.edit")}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4">
          {item.type === "login" && <LoginFieldsDetail item={item} />}
          {item.type === "card" && <CardFieldsDetail item={item} />}
          {item.type === "note" && "content" in item.fields && (
            <p className="text-sm whitespace-pre-wrap">{(item.fields as NoteFields).content}</p>
          )}
          {item.type === "identity" && <IdentityFieldsDetail item={item} />}
        </CardContent>
      </Card>

      {item.customFields && item.customFields.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            {item.customFields.map((f, i) => (
              <div key={i} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{f.name}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={f.value}
                    readOnly
                    type={f.type === "hidden" ? "password" : "text"}
                    className="h-8 text-xs font-mono"
                  />
                  <CopyButton value={f.value} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {t("vault.createdLabel")} {new Date(item.createdAt).toLocaleDateString()}
        </span>
        <span>
          {t("vault.updatedLabel")} {new Date(item.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-3.5 mr-1" />
        {t("vault.deleteItem")}
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("vault.deleteConfirmTitle", { name: item.name })}</DialogTitle>
            <DialogDescription>{t("vault.deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t("vault.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

const LoginFieldsDetail = memo(function LoginFieldsDetail({ item }: { item: VaultItem }) {
  const { t } = useTranslation();
  const f = item.fields as LoginFields;
  return (
    <div className="space-y-3">
      {f.uris?.length ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            <LinkIcon className="size-3 inline mr-1" />
            {t("vault.website")}
          </Label>
          <div className="space-y-1">
            {f.uris.map((uri, i) => (
              <a
                key={i}
                href={uri}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-primary hover:underline break-all"
              >
                {uri}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("addItem.username")}</Label>
        <div className="flex items-center gap-2">
          <Input value={f.username} readOnly className="h-8 text-sm font-mono flex-1" />
          <CopyButton value={f.username} label={t("vault.copy")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          <Key className="size-3 inline mr-1" />
          {t("addItem.password")}
        </Label>
        <div className="flex items-center gap-2">
          <PasswordInput value={f.password} readOnly />
          <CopyButton value={f.password} />
        </div>
      </div>
      {f.totpSecret ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("vault.totpCode")}</Label>
          <TotpDisplay secret={f.totpSecret} />
        </div>
      ) : null}
      {f.notes ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.notes}</p>
      ) : null}
    </div>
  );
});

const CardFieldsDetail = memo(function CardFieldsDetail({ item }: { item: VaultItem }) {
  const { t } = useTranslation();
  const f = item.fields as CardFields;
  return (
    <div className="space-y-3">
      {f.brand ? <Badge variant="outline">{f.brand}</Badge> : null}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("vault.cardholder")}</Label>
        <div className="flex items-center gap-2">
          <Input value={f.cardholder} readOnly className="h-8 text-sm flex-1" />
          <CopyButton value={f.cardholder} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("addItem.cardNumber")}</Label>
        <div className="flex items-center gap-2">
          <PasswordInput value={f.number} readOnly />
          <CopyButton value={f.number} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("vault.expiry")}</Label>
          <Input
            value={f.expiryMonth && f.expiryYear ? `${f.expiryMonth}/${f.expiryYear}` : ""}
            readOnly
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("addItem.cvv")}</Label>
          <div className="flex items-center gap-2">
            <PasswordInput value={f.cvv} readOnly />
            <CopyButton value={f.cvv} />
          </div>
        </div>
      </div>
      {f.notes ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.notes}</p>
      ) : null}
    </div>
  );
});

const IdentityFieldsDetail = memo(function IdentityFieldsDetail({ item }: { item: VaultItem }) {
  const f = item.fields as IdentityFields;
  return (
    <div className="space-y-3">
      {(["firstName", "lastName", "email", "phone", "address"] as const).map((key) => {
        const val = f[key];
        if (!val) return null;
        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground capitalize">{key}</Label>
            <div className="flex items-center gap-2">
              <Input value={val} readOnly className="h-8 text-sm flex-1" />
              <CopyButton value={val} />
            </div>
          </div>
        );
      })}
      {f.notes ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.notes}</p>
      ) : null}
    </div>
  );
});
