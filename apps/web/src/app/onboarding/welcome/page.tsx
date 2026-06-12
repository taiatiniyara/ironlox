"use client";

import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, CreditCard, FileText } from "lucide-react";
import type { VaultItem } from "@ironlox/schemas";

const demoItems: VaultItem[] = [
  {
    id: crypto.randomUUID(),
    type: "login",
    name: "GitHub",
    tags: ["dev"],
    folderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: {
      username: "demo-user",
      password: "P@ssw0rd2024!",
      uris: ["https://github.com"],
      notes: "Example login item",
    },
  },
  {
    id: crypto.randomUUID(),
    type: "card",
    name: "Visa Platinum",
    tags: ["finance"],
    folderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: {
      cardholder: "Demo User",
      number: "4111111111111111",
      expiryMonth: "12",
      expiryYear: "2028",
      cvv: "123",
      brand: "Visa",
    },
  },
  {
    id: crypto.randomUUID(),
    type: "note",
    name: "Wi-Fi Password",
    tags: ["home"],
    folderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: { content: "Network: Ironlox-Guest\nPassword: demo-wifi-2024" },
  },
];

export default function WelcomePage() {
  usePageTitle("Welcome");
  const { addItem, vault } = useVault();
  const router = useRouter();
  const hasItems = (vault?.items ?? []).filter((i) => !i.deleted).length > 0;

  async function handleDemo() {
    for (const item of demoItems) {
      await addItem({
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    toast.success("Demo vault loaded. Explore your vault!");
    router.push("/vault");
  }

  const demoIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    login: Globe,
    card: CreditCard,
    note: FileText,
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Welcome to Ironlox</CardTitle>
        <CardDescription>Choose how you want to get started</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/add" className="block">
          <Button variant="outline" className="w-full justify-start">
            Add your first password
          </Button>
        </Link>
        <Link href="/import" className="block">
          <Button variant="outline" className="w-full justify-start">
            Import from another password manager
          </Button>
        </Link>
        <div className="border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Try the demo vault (3 sample items, no real data)
          </p>
          <div className="space-y-1">
            {demoItems.map((item) => {
              const Icon = demoIcons[item.type] ?? FileText;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Icon className="size-3" />
                  <span>{item.name}</span>
                  <span className="ml-auto text-[10px] capitalize">{item.type}</span>
                </div>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleDemo}
            disabled={hasItems}
          >
            {hasItems ? "Vault already has items" : "Load Demo Vault"}
          </Button>
        </div>
        <Link href="/vault" className="block">
          <Button variant="ghost" className="w-full text-muted-foreground">
            Skip for now
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
