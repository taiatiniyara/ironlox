"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function MfaPage() {
  const { apiClient } = useVault();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !code || !email) return;
    setLoading(true);
    try {
      await apiClient.mfaVerify({ code, email });
      toast.success("Verification successful");
      router.push("/login");
    } catch (err) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? "Invalid verification code");
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
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} className="font-mono text-center text-2xl tracking-widest" />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
