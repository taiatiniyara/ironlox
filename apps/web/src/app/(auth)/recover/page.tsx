"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function RecoverPage() {
  usePageTitle("Recover Account");
  const { apiClient } = useVault();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient) return;
    setLoading(true);
    try {
      await apiClient.recover({ recoveryKey: key, email });
      toast.success("Vault recovered. Enter your master password to unlock.");
      router.push("/login");
    } catch (err) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? "Invalid recovery key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
          <Shield className="size-6 text-primary" />
        </div>
        <CardTitle>Recover Your Account</CardTitle>
        <CardDescription>
          Enter your email and 32-character recovery key to regain access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Recovery Key</Label>
            <Input
              id="key"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your 32-character recovery key"
              className="font-mono text-xs"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || key.length < 32}>
            {loading ? "Recovering..." : "Recover Vault"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
