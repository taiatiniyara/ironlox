"use client";

import { useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput } from "@/components/vault/password-input";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { UriManager } from "@/components/vault/uri-manager";
import { CustomFieldsEditor } from "@/components/vault/custom-fields-editor";
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
      <PageHeader title={existingItem ? "Edit Item" : "Add Item"} />

      <Card className="mt-4">
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

            <FormField id="name" label="Name">
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setField("name")(e.target.value)}
                placeholder="Item name"
              />
            </FormField>

            {type === "login" && (
              <>
                <UriManager uris={uris} onChange={setUris} />
                <FormField id="user" label="Username">
                  <Input
                    id="user"
                    value={form.username}
                    onChange={(e) => setField("username")(e.target.value)}
                    placeholder="Username"
                  />
                </FormField>
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
                <FormField id="cardholder" label="Cardholder Name">
                  <Input
                    id="cardholder"
                    value={form.username}
                    onChange={(e) => setField("username")(e.target.value)}
                    placeholder="Name on card"
                  />
                </FormField>
                <FormField id="cardnum" label="Card Number">
                  <Input
                    id="cardnum"
                    value={form.password}
                    onChange={(e) => setField("password")(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                  />
                </FormField>
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
              <>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setField("firstName")(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setField("lastName")(e.target.value)}
                    />
                  </div>
                </div>
                <FormField id="ide-mail" label="Email">
                  <Input
                    id="ide-mail"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email")(e.target.value)}
                  />
                </FormField>
                <FormField id="ide-phone" label="Phone">
                  <Input
                    id="ide-phone"
                    value={form.phone}
                    onChange={(e) => setField("phone")(e.target.value)}
                  />
                </FormField>
                <FormField id="ide-addr" label="Address">
                  <Input
                    id="ide-addr"
                    value={form.address}
                    onChange={(e) => setField("address")(e.target.value)}
                  />
                </FormField>
              </>
            )}

            <FormField id="item-notes" label="Notes">
              <Input
                id="item-notes"
                value={form.notes}
                onChange={(e) => setField("notes")(e.target.value)}
              />
            </FormField>

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
              <LoadingButton
                type="submit"
                className="flex-1"
                loading={saving}
                loadingText="Saving..."
                disabled={!form.name}
              >
                {existingItem ? "Save Changes" : "Save Item"}
              </LoadingButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
