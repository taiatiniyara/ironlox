"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput } from "@/components/vault/password-input";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { UriManager } from "@/components/vault/uri-manager";
import { CustomFieldsEditor } from "@/components/vault/custom-fields-editor";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { VaultItem } from "@ironlox/schemas";

type ItemType = "login" | "card" | "note" | "identity";

const itemTypes: { value: ItemType; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "card", label: "Card" },
  { value: "note", label: "Note" },
  { value: "identity", label: "Identity" },
];

interface CustomField { name: string; value: string; type: "text" | "hidden" }

export default function AddPage() {
  const { addItem, updateItem, vault } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const existingItem = editId
    ? vault?.items.find((i) => i.id === editId && !i.deleted)
    : null;

  const [type, setType] = useState<ItemType>(existingItem?.type ?? "login");
  const [name, setName] = useState(existingItem?.name ?? "");
  const [notes, setNotes] = useState(() => {
    if (!existingItem) return "";
    const f = existingItem.fields as Record<string, unknown>;
    return (f.notes as string) ?? "";
  });
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState(() => {
    if (existingItem?.type === "login") return (existingItem.fields as Record<string, unknown>).username as string ?? "";
    if (existingItem?.type === "card") return (existingItem.fields as Record<string, unknown>).cardholder as string ?? "";
    return "";
  });
  const [password, setPassword] = useState(() => {
    if (existingItem?.type === "login") return (existingItem.fields as Record<string, unknown>).password as string ?? "";
    if (existingItem?.type === "card") return (existingItem.fields as Record<string, unknown>).number as string ?? "";
    return "";
  });
  const [uris, setUris] = useState<string[]>(() => {
    if (existingItem?.type === "login") return ((existingItem.fields as Record<string, unknown>).uris as string[]) ?? [];
    return [];
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(() =>
    existingItem?.customFields ?? [],
  );

  const [expiryMonth, setExpiryMonth] = useState(() => {
    if (existingItem?.type === "card") return (existingItem.fields as Record<string, unknown>).expiryMonth as string ?? "";
    return "";
  });
  const [expiryYear, setExpiryYear] = useState(() => {
    if (existingItem?.type === "card") return (existingItem.fields as Record<string, unknown>).expiryYear as string ?? "";
    return "";
  });
  const [cvv, setCvv] = useState(() => {
    if (existingItem?.type === "card") return (existingItem.fields as Record<string, unknown>).cvv as string ?? "";
    return "";
  });
  const [identityFields, setIdentityFields] = useState<Record<string, string>>(() => {
    if (existingItem?.type === "identity") {
      const f = existingItem.fields as Record<string, unknown>;
      return {
        firstName: (f.firstName as string) ?? "",
        lastName: (f.lastName as string) ?? "",
        email: (f.email as string) ?? "",
        phone: (f.phone as string) ?? "",
        address: (f.address as string) ?? "",
      };
    }
    return { firstName: "", lastName: "", email: "", phone: "", address: "" };
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);

    const now = new Date().toISOString();
    const baseFields: Record<string, unknown> = { notes: notes || undefined };

    if (type === "login") {
      const oldPasswords = (existingItem
        ? ((existingItem.fields as Record<string, unknown>).previousPasswords as string[]) ?? []
        : []) as string[];
      const oldPassword = existingItem
        ? (existingItem.fields as Record<string, unknown>).password as string ?? ""
        : "";
      const passwordChanged = existingItem && oldPassword && password !== oldPassword;
      const previousPasswords = passwordChanged
        ? [oldPassword, ...oldPasswords].slice(0, 5)
        : oldPasswords;
      Object.assign(baseFields, { username, password, uris: uris.length > 0 ? uris : undefined, previousPasswords });
    } else if (type === "card") {
      Object.assign(baseFields, { cardholder: username, number: password, expiryMonth, expiryYear, cvv });
    } else if (type === "note") {
      Object.assign(baseFields, { content: notes || "" });
    } else if (type === "identity") {
      Object.assign(baseFields, identityFields);
    }

    const item: VaultItem = {
      id: existingItem?.id ?? crypto.randomUUID(),
      type,
      name,
      tags: existingItem?.tags ?? [],
      folderId: null,
      createdAt: existingItem?.createdAt ?? now,
      updatedAt: now,
      fields: baseFields as VaultItem["fields"],
      customFields: customFields.length > 0 ? customFields : undefined,
    };

    if (existingItem) {
      await updateItem(existingItem.id, item);
      toast.success("Item updated");
    } else {
      await addItem(item);
      toast.success("Item added");
    }

    router.push("/vault");
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/vault")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">
          {existingItem ? "Edit Item" : "Add Item"}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!existingItem && (
              <Tabs value={type} onValueChange={(v) => setType(v as ItemType)}>
                <TabsList className="w-full">
                  {itemTypes.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="flex-1">{t.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
            </div>

            {type === "login" && (
              <>
                <UriManager uris={uris} onChange={setUris} />
                <div className="space-y-2">
                  <Label htmlFor="user">Username</Label>
                  <Input id="user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass">Password</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PasswordInput id="pass" value={password} onChange={setPassword} />
                    </div>
                    <PasswordGenerator onSelect={setPassword} />
                  </div>
                </div>
              </>
            )}

            {type === "card" && (
              <>
                <div className="space-y-2"><Label htmlFor="cardholder">Cardholder Name</Label><Input id="cardholder" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Name on card" /></div>
                <div className="space-y-2"><Label htmlFor="cardnum">Card Number</Label><Input id="cardnum" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="1234 5678 9012 3456" /></div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2"><Label>Expiry Month</Label><Input value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} placeholder="MM" maxLength={2} /></div>
                  <div className="flex-1 space-y-2"><Label>Expiry Year</Label><Input value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} placeholder="YYYY" maxLength={4} /></div>
                  <div className="flex-1 space-y-2"><Label>CVV</Label><Input value={cvv} onChange={(e) => setCvv(e.target.value)} type="password" placeholder="123" maxLength={4} /></div>
                </div>
              </>
            )}

            {type === "identity" && (
              <div className="space-y-2">
                {["firstName", "lastName", "email", "phone", "address"].map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs capitalize">{key}</Label>
                    <Input
                      value={identityFields[key] ?? ""}
                      onChange={(e) => setIdentityFields((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={3} />
            </div>

            <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/vault")}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!name || saving}>
                {saving ? "Saving..." : existingItem ? "Save Changes" : "Save Item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
