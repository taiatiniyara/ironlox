"use client";

import { useState, useMemo, memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { useDebounce, usePageTitle } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingButton } from "@/components/shared/loading-button";
import { OnboardingTour } from "@/components/onboarding-tooltip";
import { ItemDetailView } from "@/components/vault/item-detail-view";
import { ItemEditView } from "@/components/vault/item-edit-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  Pin,
  SearchX,
  Key,
} from "lucide-react";
import Fuse from "fuse.js";
import type { VaultItem, LoginFields } from "@ironlox/schemas";

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
  const { t } = useTranslation();
  const { vault, isAuthenticated, unlockVault } = useVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [unlockPass, setUnlockPass] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const [category, setCategory] = useState<Category>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState("updatedAt");

  const sortOptions = useMemo(
    () => [
      { value: "updatedAt", label: t("sort.recentlyUpdated") },
      { value: "createdAt", label: t("sort.recentlyCreated") },
      { value: "nameAsc", label: t("sort.nameAz") },
      { value: "nameDesc", label: t("sort.nameZa") },
    ],
    [t],
  );

  const categoryLabels: Record<Category, string> = useMemo(
    () => ({
      all: t("vault.categories.all"),
      login: t("vault.categories.login"),
      card: t("vault.categories.card"),
      note: t("vault.categories.note"),
      identity: t("vault.categories.identity"),
    }),
    [t],
  );

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
  }, [activeItems, fuse, debouncedSearch, category, tagFilter, sort]);

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

  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          addRecent(item.id);
          router.push(`/vault?item=${item.id}`);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (detailItem || editItem) {
          clearParams();
        } else if (search) {
          setSearch("");
          setSelectedIndex(-1);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("input[placeholder]");
        input?.focus();
      } else if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        router.push("/add");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, search, detailItem, editItem, router]);

  if (editItem) return <ItemEditView item={editItem} onDone={clearParams} />;
  if (detailItem) return <ItemDetailView item={detailItem} onBack={clearParams} />;

  if (!vault) {
    if (isAuthenticated) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16 px-4">
          <div className="rounded-full bg-muted p-4 mb-3">
            <Key className="size-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm mb-4">{t("vault.lockedVaultDesc")}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setUnlocking(true);
              try {
                await unlockVault(unlockPass);
                setUnlockPass("");
              } catch (err) {
                const msg = (err as Error).message;
                if (msg === "SESSION_EXPIRED") {
                  router.push("/login");
                } else {
                  toast.error(msg ?? "Unlock failed");
                }
              } finally {
                setUnlocking(false);
              }
            }}
            className="flex flex-col gap-2 w-full max-w-xs"
          >
            <Input
              type="password"
              placeholder={t("vault.masterPassword")}
              value={unlockPass}
              onChange={(e) => setUnlockPass(e.target.value)}
            />
            <LoadingButton
              type="submit"
              loading={unlocking}
              loadingText={t("vault.unlocking")}
              disabled={!unlockPass}
            >
              {t("vault.unlock")}
            </LoadingButton>
          </form>
        </div>
      );
    }
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
      <EmptyState
        icon={Plus}
        title={t("vault.noItems")}
        description={t("vault.noItemsDesc")}
        action={
          <Button onClick={() => router.push("/add")}>
            <Plus className="size-4 mr-2" />
            {t("vault.addFirstItem")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <OnboardingTour />
      <div className="sticky top-0 z-10 bg-background -mx-4 px-4 pb-3 pt-4 -mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("vault.searchItems", { count: activeItems.length })}
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
              {categoryLabels[cat]}
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
            <Pin className="size-3" /> {t("vault.recent")}
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
          <p className="text-sm text-muted-foreground">{t("vault.noMatches")}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1">
          <div className="hidden md:block animate-stagger-list">
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${idx === selectedIndex ? "bg-muted/50 ring-1 ring-primary/30" : ""}`}
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

          <div className="md:hidden space-y-1 animate-stagger-list">
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group ${idx === selectedIndex ? "bg-muted/50 ring-1 ring-primary/30" : ""}`}
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
      className="size-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      onClick={copy}
    >
      {copied ? (
        <span className="text-[10px] text-green-500 animate-pop-in">OK</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
});
