"use client";

import { memo, useState } from "react";
import { useVault } from "@/lib/vault-context";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingButton } from "@/components/shared/loading-button";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/vault/password-input";
import type { VaultItem, LoginFields } from "@ironlox/schemas";

export const ItemEditView = memo(function ItemEditView({
  item,
  onDone,
}: {
  item: VaultItem;
  onDone: () => void;
}) {
  const { updateItem } = useVault();
  const [name, setName] = useState(item.name);
  const [notes, setNotes] = useState(
    (item.type === "login"
      ? (item.fields as LoginFields).notes
      : ((item.fields as Record<string, unknown>).content as string)) ?? "",
  );
  const [saving, setSaving] = useState(false);

  const isLogin = item.type === "login";
  const loginFields = isLogin ? (item.fields as LoginFields) : null;
  const [username, setUsername] = useState(loginFields?.username ?? "");
  const [password, setPassword] = useState(loginFields?.password ?? "");
  const [uris, setUris] = useState<string[]>(loginFields?.uris ?? []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateItem(item.id, {
      name,
      updatedAt: new Date().toISOString(),
      fields: isLogin
        ? { username, password, uris, notes: notes || undefined }
        : { notes: notes || undefined },
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <PageHeader title={`Edit ${item.name}`} backHref="/vault" backLabel="Back to vault" />
      <Card className="mt-4">
        <CardContent className="pt-4">
          <form onSubmit={handleSave} className="space-y-4">
            <FormField id="ename" label="Name">
              <Input id="ename" required value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            {isLogin && (
              <>
                <FormField id="euris" label="URIs">
                  <Input
                    id="euris"
                    value={uris.join(", ")}
                    onChange={(e) =>
                      setUris(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="https://example.com, https://..."
                  />
                </FormField>
                <FormField id="euser" label="Username">
                  <Input
                    id="euser"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </FormField>
                <div className="space-y-2">
                  <Label htmlFor="epass">Password</Label>
                  <PasswordInput id="epass" value={password} onChange={setPassword} />
                </div>
              </>
            )}
            <FormField id="enotes" label="Notes">
              <Input id="enotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                className="flex-1"
                loading={saving}
                loadingText="Saving..."
                disabled={!name}
              >
                Save Changes
              </LoadingButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
});
