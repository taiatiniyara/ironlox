"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/vault/password-input";
import { TotpDisplay } from "@/components/vault/totp-display";
import { toast } from "sonner";
import { Globe, CreditCard, FileText, User, Pencil, LinkIcon, Key } from "lucide-react";
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
  const { removeItem } = useVault();
  const router = useRouter();
  const Icon = categoryIcons[item.type] ?? FileText;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Icon className="size-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{item.name}</h1>
          <Badge variant="secondary" className="text-[10px]">
            {item.type}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/vault?edit=${item.id}`)}>
          <Pencil className="size-3.5 mr-1" />
          Edit
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
        <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
        <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        onClick={async () => {
          await removeItem(item.id);
          toast.success("Item deleted");
          onBack();
        }}
      >
        Delete Item
      </Button>
    </div>
  );
});

import { ArrowLeft } from "lucide-react";

const LoginFieldsDetail = memo(function LoginFieldsDetail({ item }: { item: VaultItem }) {
  const f = item.fields as LoginFields;
  return (
    <div className="space-y-3">
      {f.uris?.length ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            <LinkIcon className="size-3 inline mr-1" />
            Website
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
        <Label className="text-xs text-muted-foreground">Username</Label>
        <div className="flex items-center gap-2">
          <Input value={f.username} readOnly className="h-8 text-sm font-mono flex-1" />
          <CopyButton value={f.username} label="Copy" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          <Key className="size-3 inline mr-1" />
          Password
        </Label>
        <div className="flex items-center gap-2">
          <PasswordInput value={f.password} readOnly />
          <CopyButton value={f.password} />
        </div>
      </div>
      {f.totpSecret ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">2FA Code</Label>
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
  const f = item.fields as CardFields;
  return (
    <div className="space-y-3">
      {f.brand ? <Badge variant="outline">{f.brand}</Badge> : null}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Cardholder</Label>
        <div className="flex items-center gap-2">
          <Input value={f.cardholder} readOnly className="h-8 text-sm flex-1" />
          <CopyButton value={f.cardholder} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Card Number</Label>
        <div className="flex items-center gap-2">
          <PasswordInput value={f.number} readOnly />
          <CopyButton value={f.number} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Expiry</Label>
          <Input
            value={f.expiryMonth && f.expiryYear ? `${f.expiryMonth}/${f.expiryYear}` : ""}
            readOnly
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">CVV</Label>
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
