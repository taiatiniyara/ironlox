"use client";

import { useState, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
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

interface CustomField {
  name: string;
  value: string;
  type: "text" | "hidden";
}

interface FormState {
  name: string;
  notes: string;
  username: string;
  password: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

type FormAction = { field: keyof FormState; value: string };

function formReducer(state: FormState, action: FormAction): FormState {
  return { ...state, [action.field]: action.value };
}

const emptyForm: FormState = {
  name: "",
  notes: "",
  username: "",
  password: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
};

function fieldsFromExisting(item: VaultItem): Partial<FormState> {
  const f = item.fields as Record<string, unknown>;
  if (item.type === "login")
    return {
      name: item.name,
      username: (f.username as string) ?? "",
      password: (f.password as string) ?? "",
      notes: (f.notes as string) ?? "",
    };
  if (item.type === "card")
    return {
      name: item.name,
      username: (f.cardholder as string) ?? "",
      password: (f.number as string) ?? "",
      expiryMonth: (f.expiryMonth as string) ?? "",
      expiryYear: (f.expiryYear as string) ?? "",
      cvv: (f.cvv as string) ?? "",
      notes: (f.notes as string) ?? "",
    };
  if (item.type === "note")
    return {
      name: item.name,
      notes: (f.content as string) ?? (f.notes as string) ?? "",
    };
  if (item.type === "identity")
    return {
      name: item.name,
      firstName: (f.firstName as string) ?? "",
      lastName: (f.lastName as string) ?? "",
      email: (f.email as string) ?? "",
      phone: (f.phone as string) ?? "",
      address: (f.address as string) ?? "",
      notes: (f.notes as string) ?? "",
    };
  return { name: item.name };
}

export default function AddPage() {
  usePageTitle("Add Item");
  const { addItem, updateItem, vault } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const existingItem = editId ? vault?.items.find((i) => i.id === editId && !i.deleted) : null;

  const [type, setType] = useState<ItemType>(existingItem?.type ?? "login");
  const [uris, setUris] = useState<string[]>(() => {
    if (existingItem?.type === "login")
      return ((existingItem.fields as Record<string, unknown>).uris as string[]) ?? [];
    return [];
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(
    () => existingItem?.customFields ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [form, dispatch] = useReducer(formReducer, {
    ...emptyForm,
    ...(existingItem ? fieldsFromExisting(existingItem) : {}),
  });

  function setField(field: keyof FormState) {
    return (value: string) => dispatch({ field, value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);

    const now = new Date().toISOString();
    const baseFields: Record<string, unknown> = { notes: form.notes || undefined };

    if (type === "login") {
      const oldPasswords = (
        existingItem
          ? (((existingItem.fields as Record<string, unknown>).previousPasswords as string[]) ?? [])
          : []
      ) as string[];
      const oldPassword = existingItem
        ? (((existingItem.fields as Record<string, unknown>).password as string) ?? "")
        : "";
      const passwordChanged = existingItem && oldPassword && form.password !== oldPassword;
      const previousPasswords = passwordChanged
        ? [oldPassword, ...oldPasswords].slice(0, 5)
        : oldPasswords;
      Object.assign(baseFields, {
        username: form.username,
        password: form.password,
        uris: uris.length > 0 ? uris : undefined,
        previousPasswords,
      });
    } else if (type === "card") {
      Object.assign(baseFields, {
        cardholder: form.username,
        number: form.password,
        expiryMonth: form.expiryMonth,
        expiryYear: form.expiryYear,
        cvv: form.cvv,
      });
    } else if (type === "note") {
      Object.assign(baseFields, { content: form.notes || "" });
    } else if (type === "identity") {
      const cleaned: Record<string, string | undefined> = {};
      for (const k of ["firstName", "lastName", "email", "phone", "address"] as const) {
        if (form[k]) cleaned[k] = form[k];
      }
      Object.assign(baseFields, cleaned);
    }

    const item: VaultItem = {
      id: existingItem?.id ?? crypto.randomUUID(),
      type,
      name: form.name,
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
        <h1 className="text-lg font-semibold">{existingItem ? "Edit Item" : "Add Item"}</h1>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!existingItem && (
              <Tabs value={type} onValueChange={(v) => setType(v as ItemType)}>
                <TabsList className="w-full">
                  {itemTypes.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="flex-1">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setField("name")(e.target.value)}
                placeholder="Item name"
              />
            </div>

            {type === "login" && (
              <>
                <UriManager uris={uris} onChange={setUris} />
                <div className="space-y-2">
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    value={form.username}
                    onChange={(e) => setField("username")(e.target.value)}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass">Password</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PasswordInput
                        id="pass"
                        value={form.password}
                        onChange={setField("password")}
                      />
                    </div>
                    <PasswordGenerator onSelect={setField("password")} />
                  </div>
                </div>
              </>
            )}

            {type === "card" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cardholder">Cardholder Name</Label>
                  <Input
                    id="cardholder"
                    value={form.username}
                    onChange={(e) => setField("username")(e.target.value)}
                    placeholder="Name on card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cardnum">Card Number</Label>
                  <Input
                    id="cardnum"
                    value={form.password}
                    onChange={(e) => setField("password")(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Expiry Month</Label>
                    <Input
                      value={form.expiryMonth}
                      onChange={(e) => setField("expiryMonth")(e.target.value)}
                      placeholder="MM"
                      maxLength={2}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Expiry Year</Label>
                    <Input
                      value={form.expiryYear}
                      onChange={(e) => setField("expiryYear")(e.target.value)}
                      placeholder="YYYY"
                      maxLength={4}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>CVV</Label>
                    <Input
                      value={form.cvv}
                      onChange={(e) => setField("cvv")(e.target.value)}
                      type="password"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>
              </>
            )}

            {type === "identity" && (
              <div className="space-y-2">
                {(["firstName", "lastName", "email", "phone", "address"] as const).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs capitalize">{key}</Label>
                    <Input
                      value={form[key]}
                      onChange={(e) => setField(key)(e.target.value)}
                      placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setField("notes")(e.target.value)}
                placeholder="Optional notes"
                rows={3}
              />
            </div>

            <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/vault")}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!form.name || saving}>
                {saving ? "Saving..." : existingItem ? "Save Changes" : "Save Item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
