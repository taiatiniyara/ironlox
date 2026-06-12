"use client";

import { useState, useMemo, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { useDebounce, usePageTitle } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/vault/password-input";
import { CopyButton } from "@/components/shared/copy-button";
import { TotpDisplay } from "@/components/vault/totp-display";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Search,
  Globe,
  CreditCard,
  FileText,
  User,
  ArrowUpDown,
  ArrowLeft,
  Pencil,
  Key,
  LinkIcon,
  Pin,
  SearchX,
} from "lucide-react";
import Fuse from "fuse.js";
import type {
  VaultItem,
  LoginFields,
  CardFields,
  IdentityFields,
  NoteFields,
} from "@ironlox/schemas";

const RECENTS_KEY = "ironlox_recent_items";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecents(ids: string[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
}

function addRecent(id: string) {
  const recents = loadRecents().filter((r) => r !== id);
  recents.unshift(id);
  saveRecents(recents.slice(0, MAX_RECENTS));
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  login: Globe,
  card: CreditCard,
  note: FileText,
  identity: User,
};

const categories = ["all", "login", "card", "note", "identity"] as const;
type Category = (typeof categories)[number];

const sortOptions = [
  { value: "updatedAt", label: "Recently Updated" },
  { value: "createdAt", label: "Recently Created" },
  { value: "nameAsc", label: "Name A-Z" },
  { value: "nameDesc", label: "Name Z-A" },
];

const fuseOptions = {
  keys: [
    "name",
    "fields.username",
    "fields.uris",
    "fields.cardholder",
    "fields.content",
    "fields.notes",
  ],
  threshold: 0.4,
  distance: 100,
};

export default function VaultPage() {
  usePageTitle("Vault");
  const { vault } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [category, setCategory] = useState<Category>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState("updatedAt");

  const itemId = searchParams.get("item");
  const editId = searchParams.get("edit");

  const activeItems = useMemo(() => (vault?.items ?? []).filter((i) => !i.deleted), [vault]);

  const fuse = useMemo(() => new Fuse(activeItems, fuseOptions), [activeItems]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of activeItems) {
      for (const tag of item.tags) tagSet.add(tag);
    }
    return [...tagSet].sort();
  }, [activeItems]);

  const recentIds = useMemo(() => loadRecents(), []);
  const recentItems = useMemo(
    () =>
      recentIds.map((id) => activeItems.find((i) => i.id === id)).filter(Boolean) as VaultItem[],
    [recentIds, activeItems],
  );

  const filtered = useMemo(() => {
    let items = debouncedSearch
      ? fuse.search(debouncedSearch).map((r) => r.item)
      : [...activeItems];
    if (category !== "all") items = items.filter((i) => i.type === category);
    if (tagFilter) items = items.filter((i) => i.tags.includes(tagFilter));
    switch (sort) {
      case "createdAt":
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "nameAsc":
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "nameDesc":
        items.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return items;
  }, [activeItems, fuse, search, category, tagFilter, sort]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: activeItems.length,
      login: 0,
      card: 0,
      note: 0,
      identity: 0,
    };
    for (const item of activeItems) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }
    return counts;
  }, [activeItems]);

  function clearParams() {
    router.push("/vault");
  }

  const detailItem = itemId ? activeItems.find((i) => i.id === itemId) : null;
  const editItem = editId ? activeItems.find((i) => i.id === editId) : null;

  if (editItem) {
    return <EditItemInline item={editItem} onDone={clearParams} />;
  }

  if (detailItem) {
    return <ItemDetailInline item={detailItem} onBack={clearParams} />;
  }

  if (!vault) {
    return (
      <div className="flex flex-col h-full p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-4">
        <div className="rounded-full bg-muted p-4 mb-3">
          <Plus className="size-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm mb-1">No passwords yet</p>
        <p className="text-xs text-muted-foreground mb-4">
          Add your first login, card, note, or identity
        </p>
        <Button onClick={() => router.push("/add")}>
          <Plus className="size-4 mr-2" />
          Add your first item
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="sticky top-0 z-10 bg-background -mx-4 px-4 pb-3 pt-4 -mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeItems.length} items...`}
              className="pl-8"
            />
          </div>
          <Select
            value={sort}
            onValueChange={(v) => {
              if (v) setSort(v);
            }}
          >
            <SelectTrigger className="w-9 h-9 p-0 flex items-center justify-center">
              <ArrowUpDown className="size-4" />
            </SelectTrigger>
            <SelectContent align="end">
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" onClick={() => router.push("/add")}>
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex gap-1.5 mb-1 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={category === cat && !tagFilter ? "default" : "secondary"}
              className="cursor-pointer text-xs shrink-0"
              onClick={() => {
                setCategory(cat);
                setTagFilter(null);
              }}
            >
              {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              <span className="ml-1 opacity-60">({typeCounts[cat] ?? 0})</span>
            </Badge>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={tagFilter === tag ? "default" : "outline"}
                className="cursor-pointer text-[10px] shrink-0"
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {!search && !tagFilter && category === "all" && recentItems.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Pin className="size-3" /> Recent
          </p>
          <div className="space-y-0.5">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors group text-sm"
                onClick={() => {
                  addRecent(item.id);
                  router.push(`/vault?item=${item.id}`);
                }}
              >
                <IconForType type={item.type} />
                <span className="flex-1 truncate">{item.name}</span>
                <QuickCopy item={item} />
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No items match your search</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1">
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          addRecent(item.id);
                          router.push(`/vault?item=${item.id}`);
                        }}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <IconForType type={item.type} />
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{subtitle(item)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <QuickCopy item={item} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden space-y-1">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => {
                  addRecent(item.id);
                  router.push(`/vault?item=${item.id}`);
                }}
              >
                <IconForType type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{subtitle(item)}</p>
                </div>
                <QuickCopy item={item} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const IconForType = memo(function IconForType({ type }: { type: string }) {
  const Icon = categoryIcons[type] ?? FileText;
  return <Icon className="size-4 text-muted-foreground shrink-0" />;
});

function subtitle(item: VaultItem): string {
  if (item.type === "login") {
    return (item.fields as LoginFields).username || "Login";
  }
  return item.type.charAt(0).toUpperCase() + item.type.slice(1);
}

const QuickCopy = memo(function QuickCopy({ item }: { item: VaultItem }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (item.type === "login") {
      const pwd = (item.fields as LoginFields).password;
      if (pwd) {
        navigator.clipboard.writeText(pwd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={copy}
    >
      {copied ? (
        <span className="text-[10px] text-green-500">OK</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
});

/** ── Inline Item Detail ── */
const ItemDetailInline = memo(function ItemDetailInline({
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
          {item.type === "login" && <LoginFields item={item} />}
          {item.type === "card" && <CardFields item={item} />}
          {item.type === "note" && "content" in item.fields && (
            <p className="text-sm whitespace-pre-wrap">{(item.fields as NoteFields).content}</p>
          )}
          {item.type === "identity" && <IdentityFields item={item} />}
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

const LoginFields = memo(function LoginFields({ item }: { item: VaultItem }) {
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

const CardFields = memo(function CardFields({ item }: { item: VaultItem }) {
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

const IdentityFields = memo(function IdentityFields({ item }: { item: VaultItem }) {
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

/** ── Inline Edit ── */
const EditItemInline = memo(function EditItemInline({
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
      : (item.fields as NoteFields).content) ?? "",
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
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onDone}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">Edit {item.name}</h1>
      </div>
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ename">Name</Label>
              <Input id="ename" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="euris">URIs</Label>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="euser">Username</Label>
                  <Input
                    id="euser"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="epass">Password</Label>
                  <PasswordInput id="epass" value={password} onChange={setPassword} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="enotes">Notes</Label>
              <Input id="enotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!name || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
});
